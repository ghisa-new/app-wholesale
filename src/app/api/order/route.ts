import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { sendOrderEmail } from "@/lib/email";
import { CartItem } from "@/lib/types";
import { getDb, run } from "@/lib/db";

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

    const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

    // one row per size (seri dağılımı × seri adedi) so pending orders reserve
    // exact variants; sku = baseSku (MODEL-COLOR) + size
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
            `INSERT INTO order_lines (order_id, product_handle, product_title, color, size, sku, qty, unit_price)
             VALUES (?, ?, ?, ?, '', ?, ?, ?)`,
            [id, it.productHandle, it.productTitle, it.color || "", it.baseSku || "", it.quantity, it.price]
          );
          continue;
        }
        for (const [size, perSeri] of sizes) {
          const qty = (Number(perSeri) || 0) * it.quantity;
          if (qty <= 0) continue;
          run(
            `INSERT INTO order_lines (order_id, product_handle, product_title, color, size, sku, qty, unit_price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              it.productHandle,
              it.productTitle,
              it.color || "",
              size,
              it.baseSku ? `${it.baseSku}-${size}` : "",
              qty,
              it.price,
            ]
          );
        }
      }
      return id;
    })();

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
        orderId
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
