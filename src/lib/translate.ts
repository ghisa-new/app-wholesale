import crypto from "crypto";
import { getDb, queryAll, queryOne, run } from "./db";
import { getAllProductsForTranslation } from "./products";

/**
 * Product content translation — pre-translated with Gemini Flash and cached in
 * SQLite; NEVER translated live per request. A product is re-translated only
 * when its Turkish source (title+description) hash changes. Admin can trigger
 * a batch run from the panel and edit results later (edits become overrides).
 */

const GEMINI_MODEL = "gemini-flash-latest"; // versioned names age out for new API keys
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

    -- translation memory: every unique source string is translated ONCE and
    -- reused (identical titles/descriptions across color variants, color
    -- names, repeated phrases never hit the LLM twice)
    CREATE TABLE IF NOT EXISTS tx_memory (
      locale TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (locale, source_hash)
    );
  `);
}

function textHash(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex");
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

async function geminiTranslateStrings(
  strings: string[],
  locale: TxLocale
): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY yok");
  const langName = locale === "en" ? "English" : "Arabic";

  const prompt = `You are translating strings from a Turkish women's-fashion wholesale catalog into ${langName}.
Rules:
- Preserve any HTML tags and structure EXACTLY; translate only text content.
- Keep the brand word "Ghisa"/"GHISA" untranslated.
- Keep measurements, size codes and fabric percentages as-is; translate fabric and color names naturally.
- Fashion-catalog tone, concise${locale === "ar" ? "; proper Modern Standard Arabic" : ""}.
Return ONLY a JSON array of the translated strings, same length and order as the input. No markdown fences.

Input strings:
${JSON.stringify(strings)}`;

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
  const out = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]");
  if (!Array.isArray(out) || out.length !== strings.length) {
    throw new Error(`Gemini uzunluk uyusmazligi: ${strings.length} girdi, ${out?.length} cikti`);
  }
  return out.map(String);
}

/**
 * Memory-first string translation. Returns source -> translated for every
 * input; only strings missing from tx_memory are sent to Gemini (batched),
 * then remembered forever.
 */
export async function translateStrings(
  texts: string[],
  locale: TxLocale
): Promise<Map<string, string>> {
  ensureTable();
  const unique = [...new Set(texts.filter((t) => t.trim() !== ""))];
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const t of unique) {
    const row = queryOne<{ translated_text: string }>(
      "SELECT translated_text FROM tx_memory WHERE locale = ? AND source_hash = ?",
      [locale, textHash(t)]
    );
    if (row) out.set(t, row.translated_text);
    else missing.push(t);
  }

  const STRINGS_PER_CALL = 20;
  for (let i = 0; i < missing.length; i += STRINGS_PER_CALL) {
    const chunk = missing.slice(i, i + STRINGS_PER_CALL);
    const translated = await geminiTranslateStrings(chunk, locale);
    for (let j = 0; j < chunk.length; j++) {
      out.set(chunk[j], translated[j]);
      run(
        `INSERT INTO tx_memory (locale, source_hash, source_text, translated_text)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(locale, source_hash) DO NOTHING`,
        [locale, textHash(chunk[j]), chunk[j], translated[j]]
      );
    }
  }
  return out;
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
  // EVERY Shopify product (not just the wholesale-eligible list), with
  // descriptionHtml already in hand from the bulk fetch — no per-handle calls.
  const products = await getAllProductsForTranslation();

  const work: Array<{ item: TxItem; locale: TxLocale }> = [];
  for (const p of products) {
    const h = hashOf(p.title, p.descriptionHtml ?? "");
    // store/refresh the Turkish source row so the editor can search on TR too
    const trRow = queryOne<{ source_hash: string; manual: number }>(
      "SELECT source_hash, manual FROM product_i18n WHERE handle = ? AND locale = 'tr'",
      [p.handle]
    );
    if (!trRow || trRow.source_hash !== h) {
      run(
        `INSERT INTO product_i18n (handle, locale, title, description_html, source_hash, manual, updated_at)
         VALUES (?, 'tr', ?, ?, ?, 0, datetime('now'))
         ON CONFLICT(handle, locale) DO UPDATE SET
           title = excluded.title, description_html = excluded.description_html,
           source_hash = excluded.source_hash, updated_at = datetime('now')`,
        [p.handle, p.title, p.descriptionHtml ?? "", h]
      );
    }
    for (const locale of LOCALES) {
      const row = queryOne<{ source_hash: string; manual: number }>(
        "SELECT source_hash, manual FROM product_i18n WHERE handle = ? AND locale = ?",
        [p.handle, locale]
      );
      // up to date, or a human-edited row whose source hasn't changed → skip
      if (row && row.source_hash === h) continue;
      work.push({
        item: { handle: p.handle, title: p.title, descriptionHtml: p.descriptionHtml ?? "" },
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

  try {
    for (const locale of LOCALES) {
      const mine = work.filter((w) => w.locale === locale).map((w) => w.item);
      // string-level dedupe: identical titles/descriptions translate once
      const PRODUCTS_PER_ROUND = 25;
      for (let i = 0; i < mine.length; i += PRODUCTS_PER_ROUND) {
        const chunk = mine.slice(i, i + PRODUCTS_PER_ROUND);
        try {
          const texts = chunk.flatMap((it) => [it.title, it.descriptionHtml]);
          const tx = await translateStrings(texts, locale);
          for (const it of chunk) {
            const title = tx.get(it.title);
            if (!title) {
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
              [it.handle, locale, title, tx.get(it.descriptionHtml) ?? "", hashOf(it.title, it.descriptionHtml)]
            );
          }
        } catch (e) {
          progress.errors.push(
            `${locale} parti ${i / PRODUCTS_PER_ROUND + 1}: ${e instanceof Error ? e.message : String(e)}`
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


/** Direct translation-memory lookup (no LLM call) — used for short strings
 *  like color names that were already translated for the product pages. */
export function memoryLookup(text: string, locale: "en" | "ar"): string | null {
  if (!text) return null;
  ensureTable();
  const row = queryOne<{ translated_text: string }>(
    "SELECT translated_text FROM tx_memory WHERE locale = ? AND source_hash = ?",
    [locale, textHash(text)]
  );
  return row?.translated_text ?? null;
}
