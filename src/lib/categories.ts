import { Product } from "./types";

export interface Category {
  slug: string;
  label: string;
}

// Garment category lives in Shopify's `productType` (e.g. "TAKIM", "HIRKA",
// "TUNİK", "PARDÖSÜ") — uppercase Turkish. Fold the Turkish-specific letters to
// ASCII so an URL-safe slug matches regardless of locale-aware casing quirks
// (JS toLowerCase is not Turkish-aware: "TUNİK" -> "tuni̇k", "HIRKA" -> "hirka").
export function normalizeType(input: string): string {
  return (input || "")
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "g")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "u")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "o")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "c")
    .replace(/ç/g, "c")
    .toLowerCase()
    .trim();
}

// Turn an all-caps productType into a nicely cased Turkish display label.
// Turkish-locale casing recovers the dotted/dotless i correctly:
// "TAKIM" -> "Takım", "TUNİK" -> "Tunik", "PARDÖSÜ" -> "Pardösü".
export function labelForType(productType: string): string {
  const t = (productType || "").trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase("tr") + t.slice(1).toLocaleLowerCase("tr");
}

// Build the category list from products' productType. Only surface a category
// when at least two products share it, ordered by frequency.
export function extractCategories(products: Product[]): Category[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const p of products) {
    const pt = (p.productType || "").trim();
    if (!pt) continue;
    const slug = normalizeType(pt);
    if (!slug) continue;
    const existing = counts.get(slug);
    if (existing) existing.count += 1;
    else counts.set(slug, { label: labelForType(pt), count: 1 });
  }
  return [...counts.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([slug, v]) => ({ slug, label: v.label }));
}
