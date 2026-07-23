import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { sendOrderEmail } from "@/lib/email";
import { CartItem } from "@/lib/types";
import { getDb, run, queryOne } from "@/lib/db";
import { buildOrderPdf } from "@/lib/order-pdf";
import { hasRealContact } from "@/app/api/account/contact/route";
import { getLiveStockByModel, getLiveStockPerWarehouse } from "@/lib/nebim-live";
import { getReservedBySku } from "@/lib/nebim-stock";

// POST { items, notes } — persists the order (status 'pending' reserves the
// stock until an admin fulfils or cancels it), then notifies Murathan by mail.
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items, notes } = (await request.json()) as {
      items: CartItem[];
      notes: string;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // hard cap: at most 5 lots per cart line (mirrors the product-page limit)
    const MAX_LOTS = 5;
    if (items.some((it) => (Number(it.quantity) || 0) > MAX_LOTS)) {
      return NextResponse.json(
        { error: `En fazla ${MAX_LOTS} seri sipariş edebilirsiniz.` },
        { status: 400 }
      );
    }

    // a reachable contact channel is mandatory before ordering
    const contactRow = queryOne<{
      email: string;
      whatsapp: string;
      telegram: string;
      contact_email: string;
    }>("SELECT email, whatsapp, telegram, contact_email FROM users WHERE id = ?", [user.id]);
    if (!contactRow || !hasRealContact(contactRow)) {
      return NextResponse.json(
        {
          error: "contact_required",
          message:
            "Sipariş verebilmek için en az bir iletişim kanalı (WhatsApp, e-posta veya Telegram) kaydetmelisiniz.",
        },
        { status: 403 }
      );
    }

    // server-side stock enforcement: requested units per variant must fit the
    // LIVE depot stock minus existing pending reservations. Fails open on an
    // integrator outage (orders are reviewed by admin anyway).
    try {
      const required = new Map<string, number>(); // sku -> units
      for (const it of items) {
        if (!it.baseSku) continue;
        for (const [size, perSeri] of Object.entries(it.seriDistribution || {})) {
          const units = (Number(perSeri) || 0) * it.quantity;
          if (units > 0) {
            const sku = `${it.baseSku}-${size}`;
            required.set(sku, (required.get(sku) ?? 0) + units);
          }
        }
      }
      const models = [...new Set(items.map((it) => (it.baseSku || "").split("-").slice(0, -1).join("-")).filter(Boolean))];
      const liveBySku = new Map<string, number>();
      for (const model of models) {
        for (const r of await getLiveStockByModel(model)) {
          liveBySku.set(`${model}-${r.color}-${r.size}`, r.qty);
        }
      }
      const reservedMap = getReservedBySku([...required.keys()]);
      const short: string[] = [];
      for (const [sku, units] of required) {
        const avail = Math.max((liveBySku.get(sku) ?? 0) - (reservedMap.get(sku) ?? 0), 0);
        if (units > avail) short.push(`${sku}: istenen ${units}, mevcut ${avail}`);
      }
      if (short.length > 0) {
        return NextResponse.json(
          { error: "Yetersiz stok", details: short },
          { status: 409 }
        );
      }
    } catch (stockErr) {
      console.error("Order stock check skipped (integrator unreachable):", stockErr);
    }

    const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

    // depot allocation: Merkez (1-1-1) first, remainder from e-com (1-2-23) —
    // staff pick lists group by warehouse. Unknown on integrator outage.
    const whAvail = new Map<string, number>(); // "wh|sku" -> remaining units
    try {
      const models = [
        ...new Set(
          items
            .map((it) => (it.baseSku || "").split("-").slice(0, -1).join("-"))
            .filter(Boolean)
        ),
      ];
      for (const model of models) {
        for (const r of await getLiveStockPerWarehouse(model)) {
          const sku = `${model}-${r.color}-${r.size}`;
          whAvail.set(`${r.warehouse}|${sku}`, (whAvail.get(`${r.warehouse}|${sku}`) ?? 0) + r.qty);
        }
      }
    } catch (e) {
      console.error("Warehouse allocation skipped (integrator unreachable):", e);
    }
    const allocate = (sku: string, units: number): Array<[string, number]> => {
      if (whAvail.size === 0 || !sku) return [["", units]];
      const out: Array<[string, number]> = [];
      let left = units;
      for (const wh of ["1-1-1", "1-2-23"]) {
        if (left <= 0) break;
        const key = `${wh}|${sku}`;
        const avail = whAvail.get(key) ?? 0;
        const take = Math.min(left, avail);
        if (take > 0) {
          out.push([wh, take]);
          whAvail.set(key, avail - take);
          left -= take;
        }
      }
      if (left > 0) out.push(["", left]); // over-allocation guard: unassigned
      return out;
    };

    // one row per size×warehouse so pending orders reserve exact variants and
    // pick lists group cleanly; sku = baseSku (MODEL-COLOR) + size
    const db = getDb();
    const orderId = db.transaction(() => {
      const res = run(
        `INSERT INTO orders (user_id, status, notes, total_amount, currency)
         VALUES (?, 'pending', ?, ?, 'TRY')`,
        [user.id, notes || "", Math.round(total * 100) / 100]
      );
      const id = Number(res.lastInsertRowid);
      for (const it of items) {
        const sizes = Object.entries(it.seriDistribution || {});
        if (sizes.length === 0) {
          run(
            `INSERT INTO order_lines (order_id, product_handle, product_title, color, size, sku, qty, unit_price, warehouse_code)
             VALUES (?, ?, ?, ?, '', ?, ?, ?, '')`,
            [id, it.productHandle, it.productTitle, it.color || "", it.baseSku || "", it.quantity, it.price]
          );
          continue;
        }
        const piecesInLot = sizes.reduce((s2, [, q]) => s2 + (Number(q) || 0), 0) || 1;
        const perUnit = Math.round((it.price / piecesInLot) * 100) / 100;
        for (const [size, perSeri] of sizes) {
          const qty = (Number(perSeri) || 0) * it.quantity;
          if (qty <= 0) continue;
          const sku = it.baseSku ? `${it.baseSku}-${size}` : "";
          for (const [wh, units] of allocate(sku, qty)) {
            run(
              `INSERT INTO order_lines (order_id, product_handle, product_title, color, size, sku, qty, unit_price, warehouse_code, image_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [id, it.productHandle, it.productTitle, it.color || "", size, sku, units, perUnit, wh, it.image || ""]
            );
          }
        }
      }
      return id;
    })();

    // warehouse-grouped summary for the notification mail
    const whGroups: Record<string, Array<{ title: string; color: string; size: string; qty: number }>> = {};
    const glines = getDb()
      .prepare(
        "SELECT product_title, color, size, qty, warehouse_code FROM order_lines WHERE order_id = ?"
      )
      .all(orderId) as Array<{ product_title: string; color: string; size: string; qty: number; warehouse_code: string }>;
    for (const l of glines) {
      const key = l.warehouse_code || "?";
      (whGroups[key] ??= []).push({ title: l.product_title, color: l.color, size: l.size, qty: l.qty });
    }

    let pickPdf: Buffer | null = null;
    try {
      pickPdf = await buildOrderPdf(orderId, "pick");
    } catch (pdfErr) {
      console.error("Pick PDF failed (mail goes without attachment):", pdfErr);
    }

    try {
      await sendOrderEmail(
        {
          name: user.name,
          company: user.company,
          email: user.email,
          phone: user.phone,
        },
        items,
        notes || "",
        orderId,
        whGroups,
        pickPdf
      );
    } catch (mailErr) {
      // the order is saved either way — mail failure must not lose it
      console.error("Order mail failed (order persisted):", mailErr);
    }

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json(
      { error: "Failed to send order" },
      { status: 500 }
    );
  }
}
