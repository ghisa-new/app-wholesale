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
  /** NEBIM toptan (BasePriceCode 3) per-piece price; null → seller falls back to retail/2 */
  toptanPrice: number | null;
  totalRetailSold: number;
  last30dSales: number;
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
    { sizes: Record<string, number>; arrived: string | null; price: number | null }
  >();
  for (const c of cells) {
    const k = `${c.itemCode}|${c.color}`;
    const e = byColor.get(k) ?? { sizes: {}, arrived: null, price: null };
    if (c.listPrice != null && c.listPrice > 0) e.price = c.listPrice;
    e.sizes[c.size] = (e.sizes[c.size] ?? 0) + c.qty;
    // age rule keys off the Merkez arrival
    if (c.warehouse === "1-1-1" && c.arrivedDate) {
      if (!e.arrived || c.arrivedDate > e.arrived) e.arrived = c.arrivedDate;
    }
    byColor.set(k, e);
  }

  // temperature overlay from the cell — best-effort
  const tempMap = new Map<string, { temp: string; firstCentral: string | null; totalRetailSold: number; last30dSales: number }>();
  try {
    const res = await fetch(`${CELL_URL}/call/get_wholesale_eligibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ min_lots: 1 }),
      signal: AbortSignal.timeout(90000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        ok: boolean;
        data?: { rows: Array<{ itemCode: string; colorCode: string; temp: string; firstCentral: string | null; totalRetailSold?: number; last30dSales?: number }> };
      };
      for (const r of json.data?.rows ?? []) {
        tempMap.set(`${r.itemCode}|${r.colorCode}`, {
          temp: r.temp,
          firstCentral: r.firstCentral,
          totalRetailSold: r.totalRetailSold ?? 0,
          last30dSales: r.last30dSales ?? 0,
        });
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
      toptanPrice: e.price,
      totalRetailSold: t?.totalRetailSold ?? 0,
      last30dSales: t?.last30dSales ?? 0,
    });
  }
  return rows;
}

let refreshing: Promise<void> | null = null;

/** Fetch fresh rows and update cache + disk. Throws on failure. */
async function refresh(): Promise<void> {
  const rows = await fetchRows();
  if (rows.length === 0) throw new Error("integrator returned empty catalog");
  cache = { map: buildMap(rows), at: Date.now() };
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify({ at: Date.now(), rows }));
  } catch {
    /* persist is best-effort */
  }
}

/** Kick off a background refresh at most once at a time. Never awaited by a
 *  request — NEBIM being slow must never block the catalog. */
function triggerRefresh(): void {
  if (refreshing) return;
  refreshing = refresh()
    .catch((err) => console.error("Eligibility background refresh failed:", err))
    .finally(() => {
      refreshing = null;
    });
}

/** Seed the in-memory cache from the last good disk copy (stale). */
function seedFromDisk(): boolean {
  try {
    const raw = JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf-8")) as {
      rows: EligibilityRow[];
    };
    cache = { map: buildMap(raw.rows), at: 0 }; // at:0 → treated as stale
    return true;
  } catch {
    return false;
  }
}

/** baseSku (MODEL-COLOR, upper) -> eligibility row. STALE-WHILE-REVALIDATE:
 *  a request is served from cache/disk instantly and the refresh runs in the
 *  background, so a slow NEBIM never hangs the storefront. Null only on a true
 *  cold start with no disk fallback AND the very first fetch failing. */
export async function getEligibilityMap(): Promise<Map<string, EligibilityRow> | null> {
  // fresh cache → serve as-is
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;

  // no cache yet → try the disk copy so we have something to serve instantly
  if (!cache) seedFromDisk();

  // any cache (fresh-enough handled above, so this is stale) → serve + refresh
  if (cache) {
    triggerRefresh();
    return cache.map;
  }

  // no cache, no disk copy → must block on the first fetch, once
  try {
    await refresh();
    return cache!.map;
  } catch (err) {
    console.error("Eligibility cold fetch failed, no fallback:", err);
    return null;
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
