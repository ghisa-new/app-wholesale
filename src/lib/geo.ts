import { TR_RANGES } from "./tr-ranges";

// Edge-safe (no node built-ins): parse an IPv4 string to a uint32.
function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

/** True if the IPv4 address falls in a Turkish range. IPv6 / unknown → false
 *  (unrecognised addresses are treated as non-TR, matching the old Caddy zone
 *  which was IPv4-only). */
export function isTurkishIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  // strip an IPv6-mapped IPv4 prefix (::ffff:1.2.3.4) and any :port
  let s = ip.trim();
  const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/i);
  if (mapped) s = mapped[1];
  else if (s.includes(":") && s.includes(".")) s = s.split(":")[0];
  const n = ipv4ToInt(s);
  if (n === null) return false;
  // binary search the flat [start,end,start,end,...] array
  let lo = 0;
  let hi = TR_RANGES.length / 2 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = TR_RANGES[mid * 2];
    const end = TR_RANGES[mid * 2 + 1];
    if (n < start) hi = mid - 1;
    else if (n > end) lo = mid + 1;
    else return true;
  }
  return false;
}

/** The real client IP as set by Caddy (X-Real-IP = remote_host, unspoofable
 *  because Caddy overwrites it), falling back to the first X-Forwarded-For hop. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return null;
}
