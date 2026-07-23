/**
 * LIVE NEBIM stock via the IIS IntegratorService (cookieless session) —
 * sp_GIXAGetEcomEligibleStock in fully-relaxed form = raw on-hand stock.
 * These reads hit production NEBIM, not the nightly snapshot. RunProc only.
 */

const BASE = process.env.NEBIM_INTEGRATOR_URL || "http://95.9.94.84:1515";
const USER = process.env.NEBIM_INTEGRATOR_USER || "";
const PASS = process.env.NEBIM_INTEGRATOR_PASSWORD || "";
const DB = process.env.NEBIM_INTEGRATOR_DB || "GHİSA_V3";
const PAIRS = "M:1-1-1,S99:1-2-23"; // wholesale sells from Merkez + e-com depot

let sessionBase: string | null = null;

async function connect(): Promise<string> {
  const qs = new URLSearchParams({
    ModelType: "1",
    DatabaseName: DB, // Turkish İ — URLSearchParams encodes it correctly
    UserGroupCode: "GHİSA",
    UserName: USER,
    Password: PASS,
  });
  const res = await fetch(`${BASE}/IntegratorService/Connect?${qs}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  if (res.status !== 302) {
    throw new Error(`NEBIM Connect: 302 bekleniyordu, ${res.status} geldi`);
  }
  const location = res.headers.get("location") || "";
  const m = location.match(/\(S\(([^)]+)\)\)/);
  if (!m) throw new Error(`NEBIM Connect: oturum yok: ${location.slice(0, 120)}`);
  // MUST follow the redirect once to finalize the session
  await fetch(`${BASE}${location}`, { signal: AbortSignal.timeout(20000) });
  return `${BASE}/(S(${m[1]}))`;
}

interface LiveStockRow {
  StoreCode: string;
  WarehouseCode: string;
  ProductCode: string;
  ColorCode: string;
  Size: string;
  RawQty: number;
  EligibleQty: number;
}

async function runStockProc(productCode: string, base: string): Promise<LiveStockRow[]> {
  const body = {
    ModelType: 1,
    ProcName: "sp_GIXAGetEcomEligibleStock",
    Parameters: [
      { Name: "StoreWarehousePairs", Value: PAIRS },
      { Name: "MinDaysInStore", Value: "0" },
      { Name: "NoSaleMode", Value: "window" },
      { Name: "NoSaleDays", Value: "-36500" },
      { Name: "BufferUnits", Value: "0" },
      { Name: "PriceBasePriceCode", Value: "7" },
      { Name: "MinPrice", Value: "0" },
      { Name: "ProductCode", Value: productCode },
    ],
  };
  const res = await fetch(`${base}/IntegratorService/RunProc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  if (/session.*(invalid|expired)/i.test(text)) {
    throw new SessionExpired();
  }
  if (!res.ok) throw new Error(`RunProc ${res.status}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  return Array.isArray(json) ? json : [];
}

class SessionExpired extends Error {}

/** Live per-variant stock for one model across Merkez + e-com, summed. */
export async function getLiveStockByModel(
  productCode: string
): Promise<Array<{ color: string; size: string; qty: number }>> {
  if (!USER || !PASS) throw new Error("NEBIM_INTEGRATOR_USER/PASSWORD yok");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (!sessionBase) sessionBase = await connect();
      const rows = await runStockProc(productCode, sessionBase);
      const byVariant = new Map<string, number>();
      for (const r of rows) {
        const k = `${r.ColorCode}|${r.Size}`;
        byVariant.set(k, (byVariant.get(k) ?? 0) + (Number(r.RawQty) || 0));
      }
      return [...byVariant.entries()]
        .filter(([, qty]) => qty > 0)
        .map(([k, qty]) => {
          const [color, size] = k.split("|");
          return { color, size, qty };
        });
    } catch (e) {
      sessionBase = null; // reconnect on any failure once
      if (attempt === 1) throw e;
      if (!(e instanceof SessionExpired)) {
        // network or handshake hiccup — one retry with a fresh session
      }
    }
  }
  return [];
}
