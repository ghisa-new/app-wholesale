import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { queryAll, queryOne } from "./db";
import { translationFor } from "./translate";
import { sizeLabel } from "./types";

/**
 * Order PDFs — "pick" (depo toplama listesi, mailed with each order) and
 * "proforma" (professional proforma invoice with logo, product images and
 * per-line/order discounts).
 */

const FONT = path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf");
const FONT_BOLD = path.join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf");
const LOGO = path.join(process.cwd(), "public", "ghisa-logo.jpg");

const WH_LABELS: Record<string, string> = {
  "1-1-1": "MERKEZ DEPO (1-1-1)",
  "1-2-23": "E-TİCARET DEPO (1-2-23)",
  "": "DEPO BELİRLENEMEDİ",
  "?": "DEPO BELİRLENEMEDİ",
};

interface OrderRow {
  order_id: number;
  status: string;
  notes: string;
  total_amount: number;
  discount_pct: number;
  discount_amount: number;
  created_at: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  contact_email: string;
  curr_acc_code: string;
}

interface LineRow {
  line_id: number;
  product_title: string;
  color: string;
  size: string;
  sku: string;
  qty: number;
  unit_price: number;
  discount_pct: number;
  warehouse_code: string;
  image_url: string;
}

function loadOrder(orderId: number): { order: OrderRow; lines: LineRow[] } | null {
  const order = queryOne<OrderRow>(
    `SELECT o.order_id, o.status, o.notes, o.total_amount, o.discount_pct, o.discount_amount, o.created_at,
            u.email, u.name, u.company, u.phone, u.whatsapp, u.telegram, u.contact_email, u.curr_acc_code
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.order_id = ?`,
    [orderId]
  );
  if (!order) return null;
  const lines = queryAll<LineRow>(
    `SELECT line_id, product_title, color, size, sku, qty, unit_price, discount_pct, warehouse_code, image_url
     FROM order_lines WHERE order_id = ? ORDER BY warehouse_code, product_title, color, size`,
    [orderId]
  );
  return { order, lines };
}

async function fetchOne(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // pdfkit accepts JPEG/PNG only
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    return isJpg || isPng ? buf : null;
  } catch {
    return null;
  }
}

/** stored url first; older orders (no image_url) fall back to the verioku CDN
 *  by base sku (MODEL-COLOR), then the low-quality model photo */
async function fetchImage(line: { image_url: string; sku: string }): Promise<Buffer | null> {
  const candidates: string[] = [];
  if (line.image_url) {
    candidates.push(
      line.image_url.includes("?") ? `${line.image_url}&width=200` : `${line.image_url}?width=200`
    );
  }
  if (line.sku) {
    const baseSku = line.sku.split("-").slice(0, -1).join("-");
    const model = baseSku.split("-").slice(0, -1).join("-") || baseSku;
    if (baseSku) candidates.push(`https://verioku.com/products/${encodeURIComponent(baseSku)}/0.jpg`);
    if (model) candidates.push(`https://verioku.com/low-quality/${encodeURIComponent(model)}/${encodeURIComponent(model)}.jpeg`);
  }
  for (const url of candidates) {
    const buf = await fetchOne(url);
    if (buf) return buf;
  }
  return null;
}

const L = {
  tr: {
    proforma: "PROFORMA FATURA",
    pick: "SİPARİŞ TOPLAMA LİSTESİ",
    orderNo: "Sipariş No",
    date: "Tarih",
    customer: "Müşteri",
    product: "Ürün",
    color: "Renk",
    size: "Beden",
    qty: "Adet",
    unit: "Birim ₺",
    disc: "İnd.%",
    amount: "Tutar ₺",
    subtotal: "Ara Toplam:",
    orderDisc: (d: number) => `Sipariş İndirimi (%${d}):`,
    grand: "GENEL TOPLAM:",
    notes: "Notlar:",
    disclaimer:
      "Bu belge proforma faturadır; mali belge niteliği taşımaz. Fiyatlar TL olup KDV durumu sipariş onayında netleşir.",
  },
  en: {
    proforma: "PROFORMA INVOICE",
    pick: "ORDER PICKING LIST",
    orderNo: "Order No",
    date: "Date",
    customer: "Customer",
    product: "Product",
    color: "Color",
    size: "Size",
    qty: "Qty",
    unit: "Unit ₺",
    disc: "Disc.%",
    amount: "Total ₺",
    subtotal: "Subtotal:",
    orderDisc: (d: number) => `Order Discount (${d}%):`,
    grand: "GRAND TOTAL:",
    notes: "Notes:",
    disclaimer:
      "This document is a proforma invoice and is not a fiscal document. Prices are in Turkish Lira (TRY); VAT is confirmed on order approval.",
  },
} as const;

export async function buildOrderPdf(
  orderId: number,
  kind: "pick" | "proforma",
  lang: "tr" | "en" = "tr"
): Promise<Buffer | null> {
  const data = loadOrder(orderId);
  if (!data) return null;
  const { order, lines } = data;
  const t = L[lang];

  // English proforma uses the translated product names where available
  if (lang === "en") {
    for (const l of lines) {
      const handle = queryOne<{ product_handle: string }>(
        "SELECT product_handle FROM order_lines WHERE line_id = ?",
        [l.line_id]
      )?.product_handle;
      if (handle) {
        const tx = translationFor(handle, "en");
        if (tx?.title) l.product_title = tx.title;
      }
    }
  }

  const images = new Map<number, Buffer | null>();
  await Promise.all(
    lines.map(async (l) => {
      images.set(l.line_id, await fetchImage(l));
    })
  );

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks)))
  );

  doc.registerFont("R", FONT);
  doc.registerFont("B", FONT_BOLD);

  // ── header ──
  if (fs.existsSync(LOGO)) {
    doc.image(LOGO, 40, 38, { width: 140 });
  }
  doc.font("B").fontSize(16).text(
    kind === "proforma" ? t.proforma : t.pick,
    300, 42, { align: "right", width: 255 }
  );
  doc.font("R").fontSize(10).fillColor("#555")
    .text(`${t.orderNo}: #${order.order_id}`, 300, 66, { align: "right", width: 255 })
    .text(`${t.date}: ${order.created_at.slice(0, 16)}`, 300, 80, { align: "right", width: 255 });
  doc.fillColor("#000");

  // ── customer ──
  let y = 110;
  doc.font("B").fontSize(11).text(t.customer, 40, y);
  y += 16;
  doc.font("R").fontSize(9).fillColor("#333");
  const contactBits = [
    order.company || order.name,
    order.name !== order.company ? order.name : "",
    order.curr_acc_code ? `Cari: ${order.curr_acc_code}` : "",
    !order.email.endsWith("@toptan.ghisa.com") ? order.email : order.contact_email,
    order.whatsapp ? `WhatsApp: ${order.whatsapp}` : "",
    order.telegram ? `Telegram: ${order.telegram}` : "",
    order.phone ? `Tel: ${order.phone}` : "",
  ].filter(Boolean);
  for (const bit of contactBits) {
    doc.text(String(bit), 40, y);
    y += 13;
  }
  doc.fillColor("#000");
  y += 8;

  // ── lines ──
  const IMG_W = 34;
  const ROW_H = 46;
  const drawHeader = (extraCols: boolean) => {
    doc.font("B").fontSize(8).fillColor("#666");
    doc.text(t.product, 84, y);
    doc.text(t.color, 300, y);
    doc.text(t.size, 360, y);
    doc.text(t.qty, 412, y, { width: 34, align: "right" });
    if (extraCols) {
      doc.text(t.unit, 448, y, { width: 50, align: "right" });
      doc.text(t.disc, 500, y, { width: 26, align: "right" });
      doc.text(t.amount, 528, y, { width: 40, align: "right" });
    }
    y += 14;
    doc.moveTo(40, y - 3).lineTo(568, y - 3).strokeColor("#ddd").stroke();
    doc.fillColor("#000");
  };

  const ensureSpace = (need: number, extraCols: boolean) => {
    if (y + need > 790) {
      doc.addPage();
      y = 46;
      drawHeader(extraCols);
    }
  };

  const money = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let subtotal = 0;
  const renderLines = (ls: LineRow[], extraCols: boolean) => {
    for (const l of ls) {
      ensureSpace(ROW_H, extraCols);
      const img = images.get(l.line_id);
      if (img) {
        try {
          doc.image(img, 40, y, { fit: [IMG_W, ROW_H - 6] });
        } catch {
          /* corrupt image — skip */
        }
      }
      doc.font("R").fontSize(9);
      doc.text(l.product_title.slice(0, 55), 84, y + 4, { width: 210 });
      doc.text(l.color, 300, y + 4, { width: 56 });
      doc.text(sizeLabel(l.size), 360, y + 4, { width: 50 });
      doc.text(String(l.qty), 412, y + 4, { width: 34, align: "right" });
      if (extraCols) {
        const pu = l.unit_price;
        const lineTotal = pu * l.qty * (1 - (l.discount_pct || 0) / 100);
        subtotal += lineTotal;
        doc.text(money(pu), 448, y + 4, { width: 50, align: "right" });
        doc.text(l.discount_pct ? String(l.discount_pct) : "-", 500, y + 4, { width: 26, align: "right" });
        doc.text(money(lineTotal), 528, y + 4, { width: 40, align: "right" });
      }
      y += ROW_H;
      doc.moveTo(40, y - 4).lineTo(568, y - 4).strokeColor("#f0f0f0").stroke();
      doc.fillColor("#000");
    }
  };

  if (kind === "pick") {
    const byWh = new Map<string, LineRow[]>();
    for (const l of lines) {
      const k = l.warehouse_code || "?";
      (byWh.get(k) ?? byWh.set(k, []).get(k)!).push(l);
    }
    for (const [wh, ls] of [...byWh.entries()].sort()) {
      ensureSpace(40, false);
      doc.font("B").fontSize(11).text(
        `${WH_LABELS[wh] ?? wh} — ${ls.reduce((s, l) => s + l.qty, 0)} adet`,
        40, y
      );
      y += 18;
      drawHeader(false);
      renderLines(ls, false);
      y += 10;
    }
  } else {
    drawHeader(true);
    renderLines(lines, true);

    // totals
    ensureSpace(80, true);
    y += 6;
    const orderDisc = order.discount_pct || 0;
    const discAmt = order.discount_amount || 0;
    const grand = Math.max(subtotal * (1 - orderDisc / 100) - discAmt, 0);
    doc.font("R").fontSize(10);
    doc.text(t.subtotal, 380, y, { width: 110, align: "right" });
    doc.text(`${money(subtotal)} ₺`, 492, y, { width: 76, align: "right" });
    y += 16;
    if (orderDisc > 0) {
      doc.text(t.orderDisc(orderDisc), 340, y, { width: 150, align: "right" });
      doc.text(`-${money(subtotal * (orderDisc / 100))} ₺`, 492, y, { width: 76, align: "right" });
      y += 16;
    }
    if (discAmt > 0) {
      doc.text(lang === "en" ? "Discount:" : "İndirim:", 380, y, { width: 110, align: "right" });
      doc.text(`-${money(discAmt)} ₺`, 492, y, { width: 76, align: "right" });
      y += 16;
    }
    doc.font("B").fontSize(12);
    doc.text(t.grand, 360, y, { width: 130, align: "right" });
    doc.text(`${money(grand)} ₺`, 492, y, { width: 76, align: "right" });
    y += 30;
    doc.font("R").fontSize(8).fillColor("#888").text(t.disclaimer, 40, y, { width: 520 });
    doc.fillColor("#000");
  }

  if (order.notes) {
    ensureSpace(40, false);
    y += 8;
    doc.font("B").fontSize(9).text(t.notes, 40, y);
    doc.font("R").fontSize(9).text(order.notes.slice(0, 500), 84, y, { width: 480 });
  }

  doc.end();
  return done;
}
