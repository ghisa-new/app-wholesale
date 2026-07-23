/**
 * Minimal in-memory sliding-window rate limiter (single-container deploy).
 * Protects auth endpoints from brute force and shields the live-NEBIM stock
 * endpoint from being hammered.
 */

const buckets = new Map<string, number[]>();

export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/** true = allowed, false = over the limit. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

// opportunistic cleanup so the map can't grow unbounded
let lastSweep = 0;
export function sweep(windowMs = 3600_000) {
  const now = Date.now();
  if (now - lastSweep < 600_000) return;
  lastSweep = now;
  for (const [k, arr] of buckets) {
    const kept = arr.filter((t) => now - t < windowMs);
    if (kept.length === 0) buckets.delete(k);
    else buckets.set(k, kept);
  }
}
