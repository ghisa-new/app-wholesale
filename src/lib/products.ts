import { Product, SiblingProduct, WholesaleMeta } from "./types";
import { shopifyFetch } from "./shopify";
import { GET_PRODUCT_BY_HANDLE } from "./queries";
import fs from "fs";
import path from "path";
import { getDiscountOverrides } from "./discounts";
import { getEligibilityMap, seriFromSizes } from "./eligibility";
import { getProductOverrides } from "./discounts";

// Admin discount overrides are read fresh (tiny SQLite table) with a short
// TTL so edits take effect immediately without a cache-bust dance.
let overrideCache: { map: Map<string, number>; at: number } | null = null;
function discountOverrideFor(handle: string): number | undefined {
  try {
    if (!overrideCache || Date.now() - overrideCache.at > 5000) {
      overrideCache = { map: getDiscountOverrides(), at: Date.now() };
    }
    return overrideCache.map.get(handle);
  } catch {
    return undefined;
  }
}

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

  const discount = discountOverrideFor(raw.handle) ?? meta?.discount ?? 0;
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

  const allShopify = await fetchAllShopifyProducts();
  const products: Product[] = [];

  // dynamic eligibility from cell-product-intel; static products.json is
  // only the emergency fallback when the cell AND its cached copy are gone
  const elig = await getEligibilityMap();
  const overrides = getProductOverrides();
  if (elig) {
    for (const raw of allShopify) {
      const ov = overrides.get(raw.handle);
      if (ov === "off") continue; // admin archived
      const sku = raw.variants?.edges?.[0]?.node?.sku || "";
      const parts = sku.split("-");
      const baseSku = (parts.length > 1 ? parts.slice(0, -1).join("-") : sku).toUpperCase();
      const e = baseSku ? elig.get(baseSku) : undefined;
      if (!e && ov !== "on") continue; // not auto-eligible and not forced on
      products.push(
        transformProduct(raw, {
          temperature: e?.temp ?? "",
          lotCount: e?.lots ?? 0,
          discount: 0,
          seriDistribution: e ? seriFromSizes(e.sizes) : {},
        })
      );
    }
  } else {
    const productsData = getProductsData();
    const handleSet = new Set(productsData.handles);
    const meta = productsData.products || {};
    for (const raw of allShopify) {
      if (!handleSet.has(raw.handle)) continue;
      products.push(transformProduct(raw, meta[raw.handle]));
    }
  }

  cachedProducts = products;
  cacheTs = Date.now();

  return products;
}

export async function getProductByHandle(
  handle: string
): Promise<Product | null> {
  try {
    const data = await shopifyFetch<ShopifyProductResponse>(
      GET_PRODUCT_BY_HANDLE,
      { handle }
    );
    const raw = data.productByHandle;
    if (!raw) return null;

    // same dynamic eligibility as the list — the March meta file is only the
    // last-resort fallback (its seri data is stale; missing meta previously
    // rendered "1 pcs" lots)
    const elig = await getEligibilityMap();
    const sku = raw.variants?.edges?.[0]?.node?.sku || "";
    const parts = sku.split("-");
    const baseSku = (parts.length > 1 ? parts.slice(0, -1).join("-") : sku).toUpperCase();
    const e = elig && baseSku ? elig.get(baseSku) : undefined;
    const meta = e
      ? {
          temperature: e.temp,
          lotCount: e.lots,
          discount: 0,
          seriDistribution: seriFromSizes(e.sizes),
        }
      : getProductsData().products?.[handle];
    return transformProduct(raw, meta);
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


export interface AdminCatalogRow {
  handle: string;
  sku: string;
  title: string;
  productType: string;
  price: { amount: string; currencyCode: string };
  image: string | null;
  temperature: string | null;
  lots: number | null;
  autoEligible: boolean;
  override: "on" | "off" | null;
  onSale: boolean;
}

/** EVERY retail Shopify product with sale-state annotations for the admin
 *  Ürünler tab: auto eligibility + manual override + effective onSale. */
export async function getAdminCatalog(): Promise<AdminCatalogRow[]> {
  const allShopify = await fetchAllShopifyProducts();
  const elig = await getEligibilityMap();
  const overrides = getProductOverrides();
  const rows: AdminCatalogRow[] = [];
  for (const raw of allShopify) {
    const sku = raw.variants?.edges?.[0]?.node?.sku || "";
    const parts = sku.split("-");
    const baseSku = (parts.length > 1 ? parts.slice(0, -1).join("-") : sku).toUpperCase();
    const e = elig && baseSku ? elig.get(baseSku) : undefined;
    const ov = overrides.get(raw.handle) ?? null;
    const onSale = ov === "off" ? false : ov === "on" ? true : Boolean(e);
    const p = transformProduct(raw, undefined);
    rows.push({
      handle: raw.handle,
      sku: baseSku,
      title: raw.title,
      productType: raw.productType,
      price: p.price,
      image: p.images?.[0]?.url ?? null,
      temperature: e?.temp ?? null,
      lots: e?.lots ?? null,
      autoEligible: Boolean(e),
      override: ov,
      onSale,
    });
  }
  return rows;
}
