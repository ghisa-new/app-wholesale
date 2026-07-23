import crypto from "crypto";
import { getDb, queryAll, queryOne, run } from "./db";
import { getWholesaleProducts, getProductByHandle } from "./products";

/**
 * Product content translation — pre-translated with Gemini Flash and cached in
 * SQLite; NEVER translated live per request. A product is re-translated only
 * when its Turkish source (title+description) hash changes. Admin can trigger
 * a batch run from the panel and edit results later (edits become overrides).
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const LOCALES = ["en", "ar"] as const;
export type TxLocale = (typeof LOCALES)[number];

function ensureTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS product_i18n (
      handle TEXT NOT NULL,
      locale TEXT NOT NULL,
      title TEXT NOT NULL,
      description_html TEXT NOT NULL DEFAULT '',
      source_hash TEXT NOT NULL,
      manual INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (handle, locale)
    );
  `);
}

function hashOf(title: string, desc: string): string {
  return crypto.createHash("sha1").update(`${title}${desc}`).digest("hex");
}

// ── Gemini call ──────────────────────────────────────────────────────────────

interface TxItem {
  handle: string;
  title: string;
  descriptionHtml: string;
}

async function geminiTranslateBatch(
  items: TxItem[],
  locale: TxLocale
): Promise<Record<string, { title: string; descriptionHtml: string }>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY yok");
  const langName = locale === "en" ? "English" : "Arabic";

  const prompt = `You are translating a Turkish women's-fashion wholesale catalog into ${langName}.
Rules:
- Preserve any HTML tags and structure EXACTLY; translate only the text content.
- Keep the brand word "Ghisa"/"GHISA" untranslated.
- Keep measurements, size codes and fabric percentages as-is; translate fabric names naturally (e.g. "Viskon" -> ${locale === "en" ? '"Viscose"' : "the correct Arabic term"}).
- Fashion-catalog tone, concise and natural${locale === "ar" ? "; use proper Modern Standard Arabic" : ""}.
Return ONLY a JSON object mapping each product handle to {"title": "...", "descriptionHtml": "..."} for ALL handles given. No markdown fences.

Products:
${JSON.stringify(
  items.map((i) => ({ handle: i.handle, title: i.title, descriptionHtml: i.descriptionHtml }))
)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return JSON.parse(text);
}

// ── batch runner with in-process progress ────────────────────────────────────

export interface TxProgress {
  running: boolean;
  total: number;
  done: number;
  errors: string[];
  startedAt: string | null;
  finishedAt: string | null;
}

const progress: TxProgress = {
  running: false,
  total: 0,
  done: 0,
  errors: [],
  startedAt: null,
  finishedAt: null,
};

export function getProgress(): TxProgress {
  return progress;
}

export async function runTranslationBatch(): Promise<void> {
  if (progress.running) return;
  ensureTable();
  const products = await getWholesaleProducts();

  // work list: (product, locale) pairs whose stored hash is stale (manual
  // overrides only refresh when the Turkish source itself changed)
  // the list payload has no descriptionHtml — pull the full product for
  // anything that might need work, then hash on title+description
  const work: Array<{ item: TxItem; locale: TxLocale }> = [];
  for (const p of products) {
    const missing = LOCALES.filter((locale) => {
      const row = queryOne<{ source_hash: string }>(
        "SELECT source_hash FROM product_i18n WHERE handle = ? AND locale = ?",
        [p.handle, locale]
      );
      // cheap pre-check on title-only hash mismatch is impossible without the
      // full source, so re-check with the full product below when any row exists
      return !row;
    });
    let full: { title: string; descriptionHtml?: string } | null = null;
    const localesToCheck = missing.length ? missing : [...LOCALES];
    for (const locale of localesToCheck) {
      if (!full) {
        full = await getProductByHandle(p.handle);
        if (!full) break;
      }
      const h = hashOf(full.title, full.descriptionHtml ?? "");
      const row = queryOne<{ source_hash: string }>(
        "SELECT source_hash FROM product_i18n WHERE handle = ? AND locale = ?",
        [p.handle, locale]
      );
      if (row?.source_hash === h) continue;
      work.push({
        item: { handle: p.handle, title: full.title, descriptionHtml: full.descriptionHtml ?? "" },
        locale,
      });
    }
  }

  progress.running = true;
  progress.total = work.length;
  progress.done = 0;
  progress.errors = [];
  progress.startedAt = new Date().toISOString();
  progress.finishedAt = null;

  const BATCH = 6;
  try {
    for (const locale of LOCALES) {
      const mine = work.filter((w) => w.locale === locale).map((w) => w.item);
      for (let i = 0; i < mine.length; i += BATCH) {
        const chunk = mine.slice(i, i + BATCH);
        try {
          const out = await geminiTranslateBatch(chunk, locale);
          for (const it of chunk) {
            const t = out[it.handle];
            if (!t?.title) {
              progress.errors.push(`${it.handle}/${locale}: çeviri boş döndü`);
              continue;
            }
            run(
              `INSERT INTO product_i18n (handle, locale, title, description_html, source_hash, manual, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
               ON CONFLICT(handle, locale) DO UPDATE SET
                 title = excluded.title,
                 description_html = excluded.description_html,
                 source_hash = excluded.source_hash,
                 manual = 0,
                 updated_at = datetime('now')`,
              [it.handle, locale, t.title, t.descriptionHtml ?? "", hashOf(it.title, it.descriptionHtml)]
            );
          }
        } catch (e) {
          progress.errors.push(
            `${locale} parti ${i / BATCH + 1}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
        progress.done = Math.min(progress.done + chunk.length, progress.total);
      }
    }
  } finally {
    progress.running = false;
    progress.finishedAt = new Date().toISOString();
  }
}

// ── serving ──────────────────────────────────────────────────────────────────

export function translationMap(locale: string): Map<string, { title: string; descriptionHtml: string }> {
  if (locale !== "en" && locale !== "ar") return new Map();
  ensureTable();
  const rows = queryAll<{ handle: string; title: string; description_html: string }>(
    "SELECT handle, title, description_html FROM product_i18n WHERE locale = ?",
    [locale]
  );
  return new Map(rows.map((r) => [r.handle, { title: r.title, descriptionHtml: r.description_html }]));
}

export function translationFor(handle: string, locale: string) {
  if (locale !== "en" && locale !== "ar") return null;
  ensureTable();
  return (
    queryOne<{ title: string; description_html: string }>(
      "SELECT title, description_html FROM product_i18n WHERE handle = ? AND locale = ?",
      [handle, locale]
    ) ?? null
  );
}

export function translationStats() {
  ensureTable();
  return queryAll<{ locale: string; c: number }>(
    "SELECT locale, COUNT(*) c FROM product_i18n GROUP BY locale"
  );
}

