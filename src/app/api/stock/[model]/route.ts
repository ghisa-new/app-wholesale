import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getReservedBySku } from "@/lib/nebim-stock";
import { getLiveStockByModel } from "@/lib/nebim-live";

// GET /api/stock/[model] — TRUE-LIVE stock (IIS IntegratorService proc, not
// the nightly SQL snapshot) for Merkez + e-com combined, minus units reserved
// by this portal's pending orders.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ model: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { model } = await params;
    const code = model.toUpperCase();
    const rows = await getLiveStockByModel(code);
    const skus = rows.map((r) => `${code}-${r.color}-${r.size}`);
    const reserved = getReservedBySku(skus);

    const bySize: Record<
      string,
      { central: number; reserved: number; available: number }
    > = {};
    for (const r of rows) {
      const sku = `${code}-${r.color}-${r.size}`;
      const res = reserved.get(sku) ?? 0;
      bySize[`${r.color}|${r.size}`] = {
        central: r.qty,
        reserved: res,
        available: Math.max(r.qty - res, 0),
      };
    }
    return NextResponse.json({ model: code, bySize, live: true, at: Date.now() });
  } catch (err) {
    console.error("Live stock fetch error:", err);
    return NextResponse.json({ error: "Stok okunamadı" }, { status: 500 });
  }
}
