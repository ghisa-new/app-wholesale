import { NextResponse } from "next/server";

// TRY -> USD multiplier. Used only if the live fetch fails.
const FALLBACK_TRY_TO_USD = 0.026;
const TTL = 60 * 60 * 1000; // 1 hour

let cached: { rate: number; tryPerUsd: number; fetchedAt: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.fetchedAt < TTL) {
    return NextResponse.json({
      rate: cached.rate,
      tryPerUsd: cached.tryPerUsd,
      source: "cache",
      fetchedAt: cached.fetchedAt,
    });
  }

  try {
    // open.er-api.com is free, no API key, base USD -> rates.TRY = TRY per 1 USD.
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const tryPerUsd = data?.rates?.TRY;

    if (typeof tryPerUsd === "number" && tryPerUsd > 0) {
      const rate = 1 / tryPerUsd;
      cached = { rate, tryPerUsd, fetchedAt: Date.now() };
      return NextResponse.json({
        rate,
        tryPerUsd,
        source: "open.er-api.com",
        fetchedAt: cached.fetchedAt,
      });
    }
    throw new Error("Invalid rate payload");
  } catch (error) {
    console.error("Exchange rate fetch error:", error);
    return NextResponse.json({
      rate: FALLBACK_TRY_TO_USD,
      tryPerUsd: 1 / FALLBACK_TRY_TO_USD,
      source: "fallback",
    });
  }
}
