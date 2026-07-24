import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getAdminCatalog } from "@/lib/products";

// GET ?q= — up to 25 catalog matches for the admin "add product as lot" picker.
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const q = (new URL(request.url).searchParams.get("q") || "").trim().toLocaleLowerCase("tr");
  if (q.length < 2) return NextResponse.json({ products: [] });
  try {
    const catalog = await getAdminCatalog();
    const hits = catalog
      .filter(
        (p) =>
          p.title.toLocaleLowerCase("tr").includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.handle.includes(q)
      )
      .slice(0, 25)
      .map((p) => ({
        handle: p.handle,
        title: p.title,
        sku: p.sku,
        image: p.image,
        unitPrice: parseFloat(p.price.amount),
        lots: p.lots,
        onSale: p.onSale,
      }));
    return NextResponse.json({ products: hits });
  } catch (err) {
    console.error("Product search error:", err);
    return NextResponse.json({ error: "Arama başarısız" }, { status: 500 });
  }
}
