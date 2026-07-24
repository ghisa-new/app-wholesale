import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { searchNebimProducts } from "@/lib/nebim-stock";

// GET ?q= — search ALL NEBIM products (item code or name), any color,
// regardless of Shopify presence. For the admin "add product as lot" picker.
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const q = new URL(request.url).searchParams.get("q") || "";
  try {
    const hits = await searchNebimProducts(q);
    return NextResponse.json({
      products: hits.map((h) => ({
        ...h,
        // verioku CDN image by base sku (falls back gracefully in the browser)
        image: `https://verioku.com/products/${encodeURIComponent(
          `${h.itemCode}-${h.colorCode}`
        )}/0.jpg`,
      })),
    });
  } catch (err) {
    console.error("NEBIM search error:", err);
    return NextResponse.json({ error: "Arama başarısız" }, { status: 500 });
  }
}
