import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getDiscountOverrides, setDiscount, setProductOverride } from "@/lib/discounts";
import { getEligibilityMap } from "@/lib/eligibility";
import { getAdminCatalog } from "@/lib/products";

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET — the ENTIRE retail catalog with sale-state + discount annotations
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const rows = await getAdminCatalog();
    const overrides = getDiscountOverrides();
    return NextResponse.json({
      products: rows.map((r) => ({
        ...r,
        discount: overrides.get(r.handle) ?? 0,
        overridden: overrides.has(r.handle),
      })),
    });
  } catch (err) {
    console.error("Admin catalog error:", err);
    return NextResponse.json({ error: "Liste alınamadı" }, { status: 500 });
  }
}

// PUT { handle, discount } — set one product's discount
export async function PUT(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const { handle, discount, saleState } = (await request.json()) as {
      handle?: string;
      discount?: number;
      saleState?: "on" | "off" | "auto";
    };
    if (!handle) return NextResponse.json({ error: "handle gerekli" }, { status: 400 });
    if (saleState) {
      setProductOverride(handle, saleState, user.email);
      return NextResponse.json({ ok: true });
    }
    if (typeof discount !== "number" || discount < 0 || discount > 100) {
      return NextResponse.json({ error: "0-100 arası discount gerekli" }, { status: 400 });
    }
    setDiscount(handle, discount, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin discount set error:", err);
    return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  }
}
