/** TRY per USD, live with 1h cache (open.er-api.com), server-side. */

const FALLBACK_TRY_PER_USD = 38.5;
const TTL = 60 * 60 * 1000;

let cached: { tryPerUsd: number; at: number } | null = null;

export async function getTryPerUsd(): Promise<number> {
  if (cached && Date.now() - cached.at < TTL) return cached.tryPerUsd;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as { rates?: { TRY?: number } };
    const t = data?.rates?.TRY;
    if (typeof t === "number" && t > 0) {
      cached = { tryPerUsd: t, at: Date.now() };
      return t;
    }
  } catch (e) {
    console.error("Exchange fetch failed:", e);
  }
  return cached?.tryPerUsd ?? FALLBACK_TRY_PER_USD;
}
