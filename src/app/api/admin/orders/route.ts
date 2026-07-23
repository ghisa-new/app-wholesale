import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { queryAll, queryOne, run } from "@/lib/db";

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
      `SELECT o.order_id, o.status, o.notes, o.total_amount, o.currency, o.discount_pct, o.discount_amount,
              o.created_at, o.status_changed_at, o.status_changed_by,
              u.email, u.name, u.company, u.curr_acc_code
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.order_id DESC LIMIT 200`
    );
    const lines = queryAll<Record<string, unknown>>(
      `SELECT line_id, order_id, product_handle, product_title, color, size, sku, qty, unit_price, warehouse_code, discount_pct, image_url
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

function recomputeTotal(orderId: number) {
  const row = queryOne<{ sub: number; disc: number; damt: number }>(
    `SELECT COALESCE(SUM(qty * unit_price * (1 - COALESCE(discount_pct,0)/100.0)), 0) AS sub,
            (SELECT COALESCE(discount_pct,0) FROM orders WHERE order_id = ?) AS disc,
            (SELECT COALESCE(discount_amount,0) FROM orders WHERE order_id = ?) AS damt
     FROM order_lines WHERE order_id = ?`,
    [orderId, orderId, orderId]
  )!;
  const total = Math.max(
    Math.round((row.sub * (1 - row.disc / 100) - row.damt) * 100) / 100,
    0
  );
  run("UPDATE orders SET total_amount = ? WHERE order_id = ?", [total, orderId]);
  return total;
}

// PATCH { orderId, status } — fulfil or cancel; both release the reservation
export async function PATCH(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const b = (await request.json()) as {
      orderId?: number;
      status?: string;
      action?: string;
      lineId?: number;
      qty?: number;
      lineDiscountPct?: number;
      orderDiscountPct?: number;
      addLine?: {
        title: string;
        color?: string;
        size?: string;
        sku?: string;
        qty: number;
        unitPrice: number;
        imageUrl?: string;
      };
    };
    const orderId = Number(b.orderId);
    if (!orderId) return NextResponse.json({ error: "orderId gerekli" }, { status: 400 });

    if (b.status) {
      if (!["pending", "fulfilled", "cancelled"].includes(b.status)) {
        return NextResponse.json({ error: "Geçersiz status" }, { status: 400 });
      }
      run(
        `UPDATE orders SET status = ?, status_changed_at = datetime('now'), status_changed_by = ?
         WHERE order_id = ?`,
        [b.status, user.email, orderId]
      );
      return NextResponse.json({ ok: true });
    }

    if (b.action === "setQty" && b.lineId) {
      const q = Math.max(0, Math.floor(Number(b.qty) || 0));
      if (q === 0) run("DELETE FROM order_lines WHERE line_id = ? AND order_id = ?", [b.lineId, orderId]);
      else run("UPDATE order_lines SET qty = ? WHERE line_id = ? AND order_id = ?", [q, b.lineId, orderId]);
    } else if (b.action === "deleteLine" && b.lineId) {
      run("DELETE FROM order_lines WHERE line_id = ? AND order_id = ?", [b.lineId, orderId]);
    } else if (b.action === "lineDiscount" && b.lineId) {
      const d = Math.min(Math.max(Number(b.lineDiscountPct) || 0, 0), 100);
      run("UPDATE order_lines SET discount_pct = ? WHERE line_id = ? AND order_id = ?", [d, b.lineId, orderId]);
    } else if (b.action === "orderDiscount") {
      const d = Math.min(Math.max(Number(b.orderDiscountPct) || 0, 0), 100);
      run("UPDATE orders SET discount_pct = ? WHERE order_id = ?", [d, orderId]);
    } else if (b.action === "orderDiscountAmount") {
      const d = Math.max(Number((b as Record<string, unknown>).orderDiscountAmount) || 0, 0);
      run("UPDATE orders SET discount_amount = ? WHERE order_id = ?", [d, orderId]);
    } else if (b.action === "addLine" && b.addLine) {
      const a = b.addLine;
      if (!a.title || !a.qty || !a.unitPrice) {
        return NextResponse.json({ error: "title, qty, unitPrice gerekli" }, { status: 400 });
      }
      run(
        `INSERT INTO order_lines (order_id, product_handle, product_title, color, size, sku, qty, unit_price, warehouse_code, image_url)
         VALUES (?, '', ?, ?, ?, ?, ?, ?, '', ?)`,
        [orderId, a.title, a.color || "", a.size || "", a.sku || "", Math.floor(a.qty), a.unitPrice, a.imageUrl || ""]
      );
    } else {
      return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
    }
    const total = recomputeTotal(orderId);
    return NextResponse.json({ ok: true, total });
  } catch (err) {
    console.error("Admin order status error:", err);
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}
