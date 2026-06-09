import { Product, SiblingProduct, WholesaleMeta } from "./types";
import { shopifyFetch } from "./shopify";
import { GET_PRODUCT_BY_HANDLE, SEARCH_PRODUCTS } from "./queries";
import fs from "fs";
import path from "path";

interface ShopifyProductResponse {
  productByHandle: ShopifyRawProduct | null;
}

interface ShopifySearchResponse {
  products: {
    edges: Array<{ node: ShopifyRawProduct }>;
  };
}

interface ShopifyRawProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml?: string;
  tags: string[];
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

const WHOLESALE_MULTIPLIER = 0.5; // Wholesale = 50% of retail

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

export async function getWholesaleProducts(): Promise<Product[]> {
  const productsData = getProductsData();
  const handles = productsData.handles;
  const meta = productsData.products || {};
  const products: Product[] = [];

  // Fetch in parallel, batches of 5
  for (let i = 0; i < handles.length; i += 5) {
    const batch = handles.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (handle) => {
        try {
          const data = await shopifyFetch<ShopifyProductResponse>(
            GET_PRODUCT_BY_HANDLE,
            { handle }
          );
          return data.productByHandle
            ? transformProduct(data.productByHandle, meta[handle])
            : null;
        } catch {
          console.error(`Failed to fetch product: ${handle}`);
          return null;
        }
      })
    );
    products.push(...results.filter((p): p is Product => p !== null));
  }

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

// Product type categories derived from tags
const CATEGORY_TAGS = [
  "takim",
  "tunik",
  "hirka",
  "kaban",
  "mont",
  "triko",
  "elbise",
  "gomlek",
  "pantolon",
  "etek",
  "yelek",
  "bluz",
  "ceket",
  "sal",
];

export function extractCategories(products: Product[]): string[] {
  const tagCounts = new Map<string, number>();
  for (const p of products) {
    for (const tag of p.tags) {
      const lower = tag.toLowerCase();
      if (CATEGORY_TAGS.includes(lower)) {
        tagCounts.set(lower, (tagCounts.get(lower) || 0) + 1);
      }
    }
  }
  return [...tagCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const data = await shopifyFetch<ShopifySearchResponse>(SEARCH_PRODUCTS, {
    query,
    first: 20,
  });
  return data.products.edges.map((e) => transformProduct(e.node));
}
