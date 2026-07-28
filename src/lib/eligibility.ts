import fs from "fs";
import path from "path";
import { getLiveCatalogStock } from "./nebim-live";

/**
 * Dynamic wholesale catalog eligibility.
 *
 * STOCK comes from the NEBIM Integrator stored proc (one full-catalog call,
 * Merkez 1-1-1 + e-com 1-2-23, positive cells only) — NEVER from the 5433
 * SQL copy, which misses recent Merkez receipts (Murathan 2026-07-28).
 * A full seri = every size of the color present; lots = min across sizes;
 * only colors with >= MIN_LOTS full seri are offered.
 *
 * TEMPERATURE (FIRE gating) still comes from cell-product-intel as a
 * best-effort overlay: FIRE items that arrived at Merkez within 14 days and
 * hold < 20 lots are kept off the catalog. If the cell is unreachable the
 * overlay is skipped (fail open) — stock alone decides.
 *
 * Refreshed every 6h in-process; last good copy persisted to
 * data/eligibility.json so an integrator outage never empties the catalog.
 */

const CELL_URL =
  process.env.CELL_PRODUCT_INTEL_URL || "http://46.62.246.160:3215";
const TTL_MS = 6 * 60 * 60 * 1000;
const MIN_LOTS = 5; // Murathan 2026-07-23: only full 5+ seri products are offered
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

/** Aggregate the proc's positive stock cells into per-color eligibility rows. */
async function fetchRows(): Promise<EligibilityRow[]> {
  const cells = await getLiveCatalogStock();

  const byColor = new Map<
    string,
    { sizes: Record<string, number>; arrived: string | null }
  >();
  for (const c of cells) {
    const k = `${c.itemCode}|${c.color}`;
    const e = byColor.get(k) ?? { sizes: {}, arrived: null };
    e.sizes[c.size] = (e.sizes[c.size] ?? 0) + c.qty;
    // age rule keys off the Merkez arrival
    if (c.warehouse === "1-1-1" && c.arrivedDate) {
      if (!e.arrived || c.arrivedDate > e.arrived) e.arrived = c.arrivedDate;
    }
    byColor.set(k, e);
  }

  // temperature overlay from the cell — best-effort
  const tempMap = new Map<string, { temp: string; firstCentral: string | null }>();
  try {
    const res = await fetch(`${CELL_URL}/call/get_wholesale_eligibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ min_lots: 1 }),
      signal: AbortSignal.timeout(240000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        ok: boolean;
        data?: { rows: Array<{ itemCode: string; colorCode: string; temp: string; firstCentral: string | null }> };
      };
      for (const r of json.data?.rows ?? []) {
        tempMap.set(`${r.itemCode}|${r.colorCode}`, { temp: r.temp, firstCentral: r.firstCentral });
      }
    }
  } catch (err) {
    console.error("Temperature overlay unavailable (fail open):", err);
  }

  const rows: EligibilityRow[] = [];
  for (const [k, e] of byColor) {
    const qtys = Object.values(e.sizes);
    if (qtys.length < 2) continue; // a lone size is not a seri
    const lots = Math.min(...qtys);
    if (lots < MIN_LOTS) continue;
    const [itemCode, colorCode] = k.split("|");
    const t = tempMap.get(k);
    rows.push({
      itemCode,
      colorCode,
      sizes: e.sizes,
      lots,
      temp: t?.temp ?? "UNKNOWN",
      firstCentral: t?.firstCentral ?? e.arrived,
    });
  }
  return rows;
}

/** baseSku (MODEL-COLOR, upper) -> eligibility row. Null only if we have
 *  neither a fresh fetch nor a persisted fallback. */
export async function getEligibilityMap(): Promise<Map<string, EligibilityRow> | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  try {
    const rows = await fetchRows();
    if (rows.length === 0) throw new Error("integrator returned empty catalog");
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
