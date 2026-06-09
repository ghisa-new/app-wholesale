export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getWholesaleProducts } = await import("@/lib/products");
    getWholesaleProducts().catch(() => {});
  }
}
