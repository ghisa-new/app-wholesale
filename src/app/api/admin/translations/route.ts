import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { queryAll, queryOne, run } from "@/lib/db";

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") return null;
  return user;
}

interface Row {
  handle: string;
  locale: string;
  title: string;
  description_html: string;
}

// GET ?q= — search products by ANY language (TR/EN/AR title or description);
// returns each matching product with all three locale versions.
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ items: [] });
  const like = `%${q}%`;
  const handles = queryAll<{ handle: string }>(
    `SELECT handle, MAX(updated_at) mu FROM product_i18n
     WHERE title LIKE ? OR description_html LIKE ?
     GROUP BY handle ORDER BY mu DESC LIMIT 40`,
    [like, like]
  ).map((r) => r.handle);
  if (handles.length === 0) return NextResponse.json({ items: [] });

  const ph = handles.map(() => "?").join(",");
  const rows = queryAll<Row>(
    `SELECT handle, locale, title, description_html FROM product_i18n WHERE handle IN (${ph})`,
    handles
  );
  const byHandle = new Map<string, Record<string, { title: string; descriptionHtml: string }>>();
  for (const r of rows) {
    const m = byHandle.get(r.handle) ?? {};
    m[r.locale] = { title: r.title, descriptionHtml: r.description_html };
    byHandle.set(r.handle, m);
  }
  const items = handles.map((h) => ({ handle: h, ...byHandle.get(h) }));
  return NextResponse.json({ items });
}

// PUT { handle, locale, title, descriptionHtml } — save a manual edit; the
// batch won't overwrite it unless the Turkish source itself changes.
export async function PUT(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const b = (await request.json()) as {
      handle?: string;
      locale?: string;
      title?: string;
      descriptionHtml?: string;
    };
    if (!b.handle || (b.locale !== "en" && b.locale !== "ar")) {
      return NextResponse.json({ error: "handle ve locale (en|ar) gerekli" }, { status: 400 });
    }
    // tie the edit to the current TR source hash so the batch treats it as current
    const tr = queryOne<{ source_hash: string }>(
      "SELECT source_hash FROM product_i18n WHERE handle = ? AND locale = 'tr'",
      [b.handle]
    );
    run(
      `INSERT INTO product_i18n (handle, locale, title, description_html, source_hash, manual, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
       ON CONFLICT(handle, locale) DO UPDATE SET
         title = excluded.title, description_html = excluded.description_html,
         source_hash = COALESCE(excluded.source_hash, product_i18n.source_hash),
         manual = 1, updated_at = datetime('now')`,
      [b.handle, b.locale, (b.title || "").trim(), b.descriptionHtml || "", tr?.source_hash || ""]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Translation edit error:", err);
    return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  }
}
