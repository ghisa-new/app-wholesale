import fs from "fs";
import path from "path";

/**
 * Dynamic wholesale catalog eligibility — served by cell-product-intel
 * (get_wholesale_eligibility): Merkez + e-com combined stock, one row per
 * item+color holding a full size run.
 *
 * Murathan's exclusion rule (2026-07-23): drop only items that are
 * FIRE **and** first arrived at Merkez within the last 14 days **and**
 * have fewer than 20 lots. Everything else with >=1 full seri is offered.
 *
 * Refreshed every 6h in-process; last good copy persisted to
 * data/eligibility.json so a cell outage never empties the catalog.
 */

const CELL_URL =
  process.env.CELL_PRODUCT_INTEL_URL || "http://46.62.246.160:3215";
const TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_FILE = path.join(process.cwd(), "data", "eligibility.json");

export interface EligibilityRow {
  itemCode: string;
  colorCode: string;
  sizes: Record<string, number>;
  lots: number;
  temp: string;
  firstCentral: string | null;
}

let cache: { map: Map<string, EligibilityRow>; at: number } | null = null;

function isExcluded(r: EligibilityRow): boolean {
  if (r.temp !== "FIRE") return false;
  if (r.lots >= 20) return false;
  if (!r.firstCentral) return false;
  const ageDays = (Date.now() - Date.parse(r.firstCentral)) / 86400000;
  return ageDays <= 14;
}

function buildMap(rows: EligibilityRow[]): Map<string, EligibilityRow> {
  const map = new Map<string, EligibilityRow>();
  for (const r of rows) {
    if (isExcluded(r)) continue;
    map.set(`${r.itemCode}-${r.colorCode}`.toUpperCase(), r);
  }
  return map;
}

async function fetchFromCell(): Promise<EligibilityRow[]> {
  const res = await fetch(`${CELL_URL}/call/get_wholesale_eligibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ min_lots: 5 }), // Murathan 2026-07-23: only full 5+ seri products are offered
    signal: AbortSignal.timeout(240000),
  });
  if (!res.ok) throw new Error(`cell ${res.status}`);
  const json = (await res.json()) as {
    ok: boolean;
    data?: { rows: EligibilityRow[] };
  };
  if (!json.ok || !json.data?.rows) throw new Error("cell envelope not ok");
  return json.data.rows;
}

/** baseSku (MODEL-COLOR, upper) -> eligibility row. Null only if we have
 *  neither a fresh fetch nor a persisted fallback. */
export async function getEligibilityMap(): Promise<Map<string, EligibilityRow> | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  try {
    const rows = await fetchFromCell();
    cache = { map: buildMap(rows), at: Date.now() };
    try {
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify({ at: Date.now(), rows }));
    } catch {
      /* persist is best-effort */
    }
    return cache.map;
  } catch (err) {
    console.error("Eligibility fetch failed, using fallback:", err);
    if (cache) return cache.map; // stale beats empty
    try {
      const raw = JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf-8")) as {
        rows: EligibilityRow[];
      };
      cache = { map: buildMap(raw.rows), at: Date.now() - TTL_MS + 15 * 60 * 1000 };
      return cache.map;
    } catch {
      return null;
    }
  }
}

/** seri = one of each size in the run, natural size order */
export function seriFromSizes(sizes: Record<string, number>): Record<string, number> {
  const keys = Object.keys(sizes).sort((a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b, "tr");
  });
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = 1;
  return out;
}
