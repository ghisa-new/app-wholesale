import { Product, SiblingProduct, WholesaleMeta } from "./types";
import { shopifyFetch } from "./shopify";
import { GET_PRODUCT_BY_HANDLE } from "./queries";
import fs from "fs";
import path from "path";

interface ShopifyProductResponse {
  productByHandle: ShopifyRawProduct | null;
}

interface ShopifyRawProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml?: string;
  tags: string[];
  productType: string;
  availableForSale: boolean;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  compareAtPriceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  images: {
    edges: Array<{ node: { url: string; altText: string | null } }>;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        sku?: string;
        priceV2: { amount: string; currencyCode: string };
        compareAtPriceV2: { amount: string; currencyCode: string } | null;
        availableForSale: boolean;
        selectedOptions: Array<{ name: string; value: string }>;
        image?: { url: string; altText: string | null } | null;
      };
    }>;
  };
  metafield?: {
    references?: {
      edges: Array<{
        node: {
          id: string;
          handle: string;
          title: string;
          featuredImage?: { url: string } | null;
          variants: {
            edges: Array<{
              node: {
                selectedOptions: Array<{ name: string; value: string }>;
              };
            }>;
          };
        };
      }>;
    };
  } | null;
}

const WHOLESALE_MULTIPLIER = 0.5;

function applyWholesalePricing(
  price: { amount: string; currencyCode: string },
  discount: number
): { amount: string; currencyCode: string } {
  const retail = parseFloat(price.amount);
  const wholesale = retail * WHOLESALE_MULTIPLIER * (1 - discount / 100);
  return { amount: wholesale.toFixed(2), currencyCode: price.currencyCode };
}

function transformProduct(
  raw: ShopifyRawProduct,
  meta?: WholesaleMeta
): Product {
  const siblings: SiblingProduct[] = (
    raw.metafield?.references?.edges || []
  ).map((e) => {
    const color =
      e.node.variants.edges[0]?.node.selectedOptions.find(
        (o) =>
          o.name.toLowerCase() === "color" || o.name.toLowerCase() === "renk"
      )?.value || null;
    return {
      id: e.node.id,
      handle: e.node.handle,
      title: e.node.title,
      featuredImage: e.node.featuredImage?.url || null,
      color,
    };
  });

  const discount = meta?.discount ?? 0;
  const retailPrice = raw.priceRange.minVariantPrice;
  const wholesaleBase = applyWholesalePricing(retailPrice, 0);
  const wholesalePrice = applyWholesalePricing(retailPrice, discount);

  return {
    id: raw.id,
    title: raw.title,
    handle: raw.handle,
    description: raw.description,
    descriptionHtml: raw.descriptionHtml,
    tags: raw.tags,
    productType: raw.productType,
    availableForSale: raw.availableForSale,
    price: wholesalePrice,
    compareAtPrice: discount > 0 ? wholesaleBase : null,
    wholesalePrice,
    retailPrice,
    campaignDiscount: discount,
    seriDistribution: meta?.seriDistribution ?? {},
    images: raw.images.edges.map((e) => e.node),
    variants: raw.variants.edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      sku: e.node.sku,
      price: e.node.priceV2,
      compareAtPrice: e.node.compareAtPriceV2,
      availableForSale: e.node.availableForSale,
      selectedOptions: e.node.selectedOptions,
      image: e.node.image,
    })),
    siblings,
  };
}

interface ProductsData {
  handles: string[];
  products?: Record<string, WholesaleMeta>;
}

function getProductsData(): ProductsData {
  const filePath = path.join(process.cwd(), "data", "products.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { handles: [] };
  }
}

// ---------------------------------------------------------------------------
// Bulk fetch via Storefront API (250 per page, ~2 calls for 280 products)
// ---------------------------------------------------------------------------

const BULK_PRODUCTS_QUERY = `
  query bulkProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id title handle description tags productType availableForSale
          priceRange { minVariantPrice { amount currencyCode } }
          compareAtPriceRange { minVariantPrice { amount currencyCode } }
          images(first: 2) { edges { node { url altText } } }
          variants(first: 1) {
            edges {
              node {
                id title sku
                priceV2 { amount currencyCode }
                compareAtPriceV2 { amount currencyCode }
                availableForSale
                selectedOptions { name value }
                image { url altText }
              }
            }
          }
        }
      }
    }
  }
`;

interface BulkResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: ShopifyRawProduct }>;
  };
}

async function fetchAllShopifyProducts(): Promise<ShopifyRawProduct[]> {
  const all: ShopifyRawProduct[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const resp: BulkResponse = await shopifyFetch<BulkResponse>(
      BULK_PRODUCTS_QUERY,
      { first: 250, after: cursor },
    );
    for (const edge of resp.products.edges) {
      all.push(edge.node);
    }
    hasNext = resp.products.pageInfo.hasNextPage;
    cursor = resp.products.pageInfo.endCursor;
  }

  return all;
}

// ---------------------------------------------------------------------------
// In-memory cache (5-minute TTL)
// ---------------------------------------------------------------------------

let cachedProducts: Product[] | null = null;
let cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getWholesaleProducts(): Promise<Product[]> {
  if (cachedProducts && Date.now() - cacheTs < CACHE_TTL) {
    return cachedProducts;
  }

  const productsData = getProductsData();
  const handleSet = new Set(productsData.handles);
  const meta = productsData.products || {};

  const allShopify = await fetchAllShopifyProducts();
  const products: Product[] = [];

  for (const raw of allShopify) {
    if (!handleSet.has(raw.handle)) continue;
    products.push(transformProduct(raw, meta[raw.handle]));
  }

  cachedProducts = products;
  cacheTs = Date.now();

  return products;
}

export async function getProductByHandle(
  handle: string
): Promise<Product | null> {
  const productsData = getProductsData();
  const meta = productsData.products?.[handle];
  try {
    const data = await shopifyFetch<ShopifyProductResponse>(
      GET_PRODUCT_BY_HANDLE,
      { handle }
    );
    return data.productByHandle
      ? transformProduct(data.productByHandle, meta)
      : null;
  } catch {
    console.error(`Failed to fetch product: ${handle}`);
    return null;
  }
}

export async function searchProducts(query: string): Promise<Product[]> {
  const SEARCH_PRODUCTS = `
    query searchProducts($query: String!, $first: Int!) {
      products(query: $query, first: $first, sortKey: RELEVANCE) {
        edges {
          node {
            id title handle description tags productType availableForSale
            priceRange { minVariantPrice { amount currencyCode } }
            compareAtPriceRange { minVariantPrice { amount currencyCode } }
            images(first: 10) { edges { node { url altText } } }
            variants(first: 50) {
              edges {
                node {
                  id title sku
                  priceV2 { amount currencyCode }
                  compareAtPriceV2 { amount currencyCode }
                  availableForSale
                  selectedOptions { name value }
                  image { url altText }
                }
              }
            }
          }
        }
      }
    }
  `;
  const data = await shopifyFetch<{
    products: { edges: Array<{ node: ShopifyRawProduct }> };
  }>(SEARCH_PRODUCTS, { query, first: 20 });
  return data.products.edges.map((e) => transformProduct(e.node));
}
