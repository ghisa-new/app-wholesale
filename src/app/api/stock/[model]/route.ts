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

    // customers never see quantities — only how many LOTS they may order per
    // color (min available across the seri's sizes; a missing size = 0)
    const url = new URL(request.url);
    const seriSizes = (url.searchParams.get("sizes") || "").split(",").filter(Boolean);
    const colors = [...new Set(rows.map((r) => r.color))];
    const colorMax: Record<string, number> = {};
    for (const color of colors) {
      const sizes = seriSizes.length
        ? seriSizes
        : rows.filter((r) => r.color === color).map((r) => r.size);
      let max = Infinity;
      for (const size of sizes) {
        const cell = bySize[`${color}|${size}`];
        max = Math.min(max, cell?.available ?? 0);
      }
      colorMax[color] = Number.isFinite(max) ? max : 0;
    }

    if (user.role !== "admin") {
      return NextResponse.json({ model: code, colorMax, live: true, at: Date.now() });
    }
    return NextResponse.json({ model: code, bySize, colorMax, live: true, at: Date.now() });
  } catch (err) {
    console.error("Live stock fetch error:", err);
    return NextResponse.json({ error: "Stok okunamadı" }, { status: 500 });
  }
}
