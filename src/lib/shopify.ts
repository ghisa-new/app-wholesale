const domain = process.env.SHOPIFY_DOMAIN || "";
const token = process.env.SHOPIFY_STOREFRONT_TOKEN || "";
const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";

const endpoint = `https://${domain}/api/${apiVersion}/graphql.json`;

export async function shopifyFetch<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 }, // 5 min ISR
  });

  if (!response.ok) {
    throw new Error(
      `Shopify API error: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(
      json.errors.map((e: { message: string }) => e.message).join(", ")
    );
  }

  return json.data;
}
