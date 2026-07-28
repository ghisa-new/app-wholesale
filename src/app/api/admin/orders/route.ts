import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { queryAll, queryOne, run } from "@/lib/db";
import { getProductByHandle } from "@/lib/products";
import { getLiveStockPerWarehouse } from "@/lib/nebim-live";
import { getNebimVariantSizes } from "@/lib/nebim-stock";

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
              datetime(o.created_at, '+3 hours') AS created_at, o.status_changed_at, o.status_changed_by,
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
    } else if (b.action === "addLot" && (b as Record<string, unknown>).handle) {
      const handle = String((b as Record<string, unknown>).handle);
      const lots = Math.max(1, Math.floor(Number((b as Record<string, unknown>).lots) || 1));
      const product = await getProductByHandle(handle);
      if (!product) return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
      const seri = Object.entries(product.seriDistribution || {});
      if (seri.length === 0) {
        return NextResponse.json({ error: "Bu ürünün seri bilgisi yok" }, { status: 400 });
      }
      const unitPrice = parseFloat(product.price.amount);
      const image = product.images?.[0]?.url || "";
      const variantSku = product.variants?.[0]?.sku || "";
      const baseSku = variantSku.split("-").slice(0, -1).join("-"); // MODEL-COLOR
      const colorCode = baseSku.split("-").slice(-1)[0] || "";
      const model = baseSku.split("-").slice(0, -1).join("-");
      const color =
        product.variants?.[0]?.selectedOptions?.find(
          (o) => o.name.toLowerCase() === "color" || o.name.toLowerCase() === "renk"
        )?.value || colorCode;

      // live per-warehouse stock for this color (Merkez first, then e-com)
      const whAvail = new Map<string, number>();
      try {
        for (const r of await getLiveStockPerWarehouse(model)) {
          if (r.color !== colorCode) continue;
          const k = `${r.warehouse}|${r.size}`;
          whAvail.set(k, (whAvail.get(k) ?? 0) + r.qty);
        }
      } catch (e) {
        console.error("addLot stock lookup failed:", e);
      }
      const allocate = (size: string, units: number): Array<[string, number]> => {
        if (whAvail.size === 0) return [["", units]];
        const out: Array<[string, number]> = [];
        let left = units;
        for (const wh of ["1-1-1", "1-1-4", "1-2-23"]) {
          if (left <= 0) break;
          const key = `${wh}|${size}`;
          const avail = whAvail.get(key) ?? 0;
          const take = Math.min(left, avail);
          if (take > 0) {
            out.push([wh, take]);
            whAvail.set(key, avail - take);
            left -= take;
          }
        }
        if (left > 0) out.push(["", left]);
        return out;
      };

      for (const [size, perSeri] of seri) {
        const units = (Number(perSeri) || 0) * lots;
        if (units <= 0) continue;
        const sku = baseSku ? `${baseSku}-${size}` : "";
        for (const [wh, u] of allocate(size, units)) {
          run(
            `INSERT INTO order_lines (order_id, product_handle, product_title, color, size, sku, qty, unit_price, warehouse_code, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, handle, product.title, color, size, sku, u, unitPrice, wh, image]
          );
        }
      }
    } else if (b.action === "addNebimLot" && (b as Record<string, unknown>).itemCode) {
      const bb = b as Record<string, unknown>;
      const itemCode = String(bb.itemCode).trim();
      const colorCode = String(bb.colorCode || "").trim();
      const lots = Math.max(1, Math.floor(Number(bb.lots) || 1));
      const unitPrice = Math.max(0, Number(bb.unitPrice) || 0);
      const title = String(bb.title || itemCode);
      if (unitPrice <= 0) {
        return NextResponse.json({ error: "Birim fiyat gerekli" }, { status: 400 });
      }
      // lenient: if NEBIM has no size rows for this color, still add a single
      // line so admin editing is never blocked (Murathan 2026-07-24)
      let sizes = await getNebimVariantSizes(itemCode, colorCode);
      if (sizes.length === 0) sizes = [""];
      const baseSku = colorCode ? `${itemCode}-${colorCode}` : itemCode;
      const image = `https://verioku.com/products/${encodeURIComponent(baseSku)}/0.jpg`;

      const whAvail = new Map<string, number>();
      try {
        for (const rr of await getLiveStockPerWarehouse(itemCode)) {
          if (rr.color !== colorCode) continue;
          const k = `${rr.warehouse}|${rr.size}`;
          whAvail.set(k, (whAvail.get(k) ?? 0) + rr.qty);
        }
      } catch (e) {
        console.error("addNebimLot stock lookup failed:", e);
      }
      const alloc = (size: string, units: number): Array<[string, number]> => {
        if (whAvail.size === 0) return [["", units]];
        const out: Array<[string, number]> = [];
        let left = units;
        for (const wh of ["1-1-1", "1-1-4", "1-2-23"]) {
          if (left <= 0) break;
          const key = `${wh}|${size}`;
          const avail = whAvail.get(key) ?? 0;
          const take = Math.min(left, avail);
          if (take > 0) { out.push([wh, take]); whAvail.set(key, avail - take); left -= take; }
        }
        if (left > 0) out.push(["", left]);
        return out;
      };
      for (const size of sizes) {
        const units = lots; // one per size per lot
        const sku = `${baseSku}-${size}`;
        for (const [wh, u] of alloc(size, units)) {
          run(
            `INSERT INTO order_lines (order_id, product_handle, product_title, color, size, sku, qty, unit_price, warehouse_code, image_url)
             VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, title, colorCode, size, sku, u, unitPrice, wh, image]
          );
        }
      }
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

// POST { userId } — create an EMPTY order on behalf of a customer. The admin
// then fills it with the normal line tools (NEBIM search, lots, discounts).
// It shows up in the customer's own "Siparişlerim" immediately (my-orders
// lists by user_id), including the proforma download.
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const b = (await request.json()) as { userId?: number };
    if (!b.userId) {
      return NextResponse.json({ error: "Müşteri gerekli" }, { status: 400 });
    }
    const customer = queryOne<{ id: number; company: string; name: string }>(
      "SELECT id, company, name FROM users WHERE id = ?",
      [b.userId]
    );
    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }
    const res = run(
      `INSERT INTO orders (user_id, status, notes, total_amount, currency)
       VALUES (?, 'pending', ?, 0, 'TRY')`,
      [customer.id, `Sipariş yönetici tarafından oluşturuldu (${admin.email})`]
    );
    const orderId = Number(res.lastInsertRowid);
    return NextResponse.json({
      ok: true,
      orderId,
      customer: customer.company || customer.name,
    });
  } catch (err) {
    console.error("Admin order create error:", err);
    return NextResponse.json({ error: "Oluşturulamadı" }, { status: 500 });
  }
}
