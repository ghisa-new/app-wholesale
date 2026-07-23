import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { queryAll, run } from "@/lib/db";

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET — orders with lines and customer info, newest first
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const orders = queryAll<Record<string, unknown>>(
      `SELECT o.order_id, o.status, o.notes, o.total_amount, o.currency,
              o.created_at, o.status_changed_at, o.status_changed_by,
              u.email, u.name, u.company, u.curr_acc_code
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.order_id DESC LIMIT 200`
    );
    const lines = queryAll<Record<string, unknown>>(
      `SELECT order_id, product_handle, product_title, color, size, sku, qty, unit_price, warehouse_code
       FROM order_lines
       WHERE order_id IN (SELECT order_id FROM orders ORDER BY order_id DESC LIMIT 200)`
    );
    const byOrder = new Map<number, Record<string, unknown>[]>();
    for (const l of lines) {
      const id = Number(l.order_id);
      (byOrder.get(id) ?? byOrder.set(id, []).get(id)!).push(l);
    }
    return NextResponse.json({
      orders: orders.map((o) => ({ ...o, lines: byOrder.get(Number(o.order_id)) ?? [] })),
    });
  } catch (err) {
    console.error("Admin orders error:", err);
    return NextResponse.json({ error: "Liste alınamadı" }, { status: 500 });
  }
}

// PATCH { orderId, status } — fulfil or cancel; both release the reservation
export async function PATCH(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const { orderId, status } = (await request.json()) as {
      orderId?: number;
      status?: string;
    };
    if (!orderId || !["pending", "fulfilled", "cancelled"].includes(status || "")) {
      return NextResponse.json(
        { error: "orderId ve status (pending|fulfilled|cancelled) gerekli" },
        { status: 400 }
      );
    }
    run(
      `UPDATE orders SET status = ?, status_changed_at = datetime('now'), status_changed_by = ?
       WHERE order_id = ?`,
      [status, user.email, orderId]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin order status error:", err);
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}
