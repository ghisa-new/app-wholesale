import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getDiscountOverrides, setDiscount } from "@/lib/discounts";
import { getWholesaleProducts } from "@/lib/products";

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET — product list with current effective discount
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const products = await getWholesaleProducts();
    const overrides = getDiscountOverrides();
    return NextResponse.json({
      products: products.map((p) => ({
        handle: p.handle,
        title: p.title,
        productType: p.productType,
        price: p.price,
        discount: overrides.get(p.handle) ?? p.campaignDiscount ?? 0,
        overridden: overrides.has(p.handle),
      })),
    });
  } catch (err) {
    console.error("Admin discounts list error:", err);
    return NextResponse.json({ error: "Liste alınamadı" }, { status: 500 });
  }
}

// PUT { handle, discount } — set one product's discount
export async function PUT(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const { handle, discount } = (await request.json()) as {
      handle?: string;
      discount?: number;
    };
    if (!handle || typeof discount !== "number" || discount < 0 || discount > 100) {
      return NextResponse.json({ error: "handle ve 0-100 arası discount gerekli" }, { status: 400 });
    }
    setDiscount(handle, discount, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin discount set error:", err);
    return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  }
}
