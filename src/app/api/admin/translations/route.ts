import crypto from "crypto";
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { queryAll, run } from "@/lib/db";

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") return null;
  return user;
}

function textHash(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex");
}

// GET ?q=&offset= — UNIQUE translated strings (the translation memory), each
// once, regardless of how many products share it. Empty q lists everything.
// Search matches Turkish source OR the EN/AR translation.
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const LIMIT = 50;
  const like = `%${q}%`;

  const rows = queryAll<{
    source_hash: string;
    source_text: string;
    en: string | null;
    ar: string | null;
    used_by: number;
  }>(
    `SELECT source_hash, source_text,
            MAX(CASE WHEN locale = 'en' THEN translated_text END) AS en,
            MAX(CASE WHEN locale = 'ar' THEN translated_text END) AS ar,
            (SELECT COUNT(*) FROM product_i18n p
             WHERE p.locale = 'tr'
               AND (p.title = source_text OR p.description_html = source_text)) AS used_by
     FROM tx_memory
     GROUP BY source_hash
     HAVING (? = '' OR source_text LIKE ? OR en LIKE ? OR ar LIKE ?)
     ORDER BY LENGTH(source_text), source_text
     LIMIT ${LIMIT + 1} OFFSET ?`,
    [q, like, like, like, offset]
  );

  const hasMore = rows.length > LIMIT;
  const items = rows.slice(0, LIMIT).map((r) => ({
    hash: r.source_hash,
    tr: r.source_text,
    en: r.en || "",
    ar: r.ar || "",
    usedBy: r.used_by,
  }));
  return NextResponse.json({ items, hasMore, nextOffset: offset + LIMIT });
}

// PUT { tr, locale, text } — save a manual edit of ONE string; it updates the
// translation memory and propagates to EVERY product whose Turkish title or
// description is that string. Marked manual so the batch never overwrites it.
export async function PUT(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const b = (await request.json()) as { tr?: string; locale?: string; text?: string };
    if (!b.tr || (b.locale !== "en" && b.locale !== "ar")) {
      return NextResponse.json({ error: "tr ve locale (en|ar) gerekli" }, { status: 400 });
    }
    const text = (b.text || "").trim();
    const hash = textHash(b.tr);
    run(
      `INSERT INTO tx_memory (locale, source_hash, source_text, translated_text)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(locale, source_hash) DO UPDATE SET translated_text = excluded.translated_text`,
      [b.locale, hash, b.tr, text]
    );
    // propagate to all products sharing this Turkish title / description
    const titleRes = run(
      `UPDATE product_i18n SET title = ?, manual = 1, updated_at = datetime('now')
       WHERE locale = ? AND handle IN
         (SELECT handle FROM product_i18n WHERE locale = 'tr' AND title = ?)`,
      [text, b.locale, b.tr]
    );
    const descRes = run(
      `UPDATE product_i18n SET description_html = ?, manual = 1, updated_at = datetime('now')
       WHERE locale = ? AND handle IN
         (SELECT handle FROM product_i18n WHERE locale = 'tr' AND description_html = ?)`,
      [text, b.locale, b.tr]
    );
    return NextResponse.json({
      ok: true,
      productsUpdated: (titleRes.changes || 0) + (descRes.changes || 0),
    });
  } catch (err) {
    console.error("Translation edit error:", err);
    return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  }
}
