import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCentralStockByModel, getReservedBySku } from "@/lib/nebim-stock";

// GET /api/stock/[model] — LIVE Merkez (1-1-1) stock per color+size for one
// model code, minus units reserved by this portal's pending orders.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ model: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { model } = await params;
    const rows = await getCentralStockByModel(model.toUpperCase());
    const skus = rows.map((r) => `${model.toUpperCase()}-${r.color}-${r.size}`);
    const reserved = getReservedBySku(skus);

    const bySize: Record<
      string,
      { central: number; reserved: number; available: number }
    > = {};
    for (const r of rows) {
      const sku = `${model.toUpperCase()}-${r.color}-${r.size}`;
      const res = reserved.get(sku) ?? 0;
      bySize[`${r.color}|${r.size}`] = {
        central: Number(r.qty) || 0,
        reserved: res,
        available: Math.max((Number(r.qty) || 0) - res, 0),
      };
    }
    return NextResponse.json({ model: model.toUpperCase(), bySize, at: Date.now() });
  } catch (err) {
    console.error("Stock fetch error:", err);
    return NextResponse.json({ error: "Stok okunamadı" }, { status: 500 });
  }
}
