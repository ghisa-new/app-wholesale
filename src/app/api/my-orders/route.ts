import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { queryAll } from "@/lib/db";

// GET — the logged-in customer's own orders with lines
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orders = queryAll<Record<string, unknown>>(
    `SELECT order_id, status, notes, total_amount, discount_pct, discount_amount, created_at
     FROM orders WHERE user_id = ? ORDER BY order_id DESC LIMIT 100`,
    [user.id]
  );
  const ids = orders.map((o) => Number(o.order_id));
  const lines = ids.length
    ? queryAll<Record<string, unknown>>(
        `SELECT order_id, product_title, color, size, sku, qty, unit_price, discount_pct
         FROM order_lines WHERE order_id IN (${ids.map(() => "?").join(",")})`,
        ids
      )
    : [];
  const byOrder = new Map<number, Record<string, unknown>[]>();
  for (const l of lines) {
    const id = Number(l.order_id);
    (byOrder.get(id) ?? byOrder.set(id, []).get(id)!).push(l);
  }
  return NextResponse.json({
    orders: orders.map((o) => ({ ...o, lines: byOrder.get(Number(o.order_id)) ?? [] })),
  });
}
