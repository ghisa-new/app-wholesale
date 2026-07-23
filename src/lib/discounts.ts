import { queryAll, run } from "./db";

/**
 * Admin-set discount overrides. Pricing rule (products.ts):
 *   override (this table) ?? products.json meta discount ?? 0
 */

export function getDiscountOverrides(): Map<string, number> {
  const rows = queryAll<{ handle: string; discount: number }>(
    "SELECT handle, discount FROM product_discount"
  );
  return new Map(rows.map((r) => [r.handle, Number(r.discount) || 0]));
}

export function setDiscount(handle: string, discount: number, by: string) {
  const d = Math.min(Math.max(discount, 0), 100);
  run(
    `INSERT INTO product_discount (handle, discount, updated_by, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(handle) DO UPDATE SET
       discount = excluded.discount,
       updated_by = excluded.updated_by,
       updated_at = datetime('now')`,
    [handle, d, by]
  );
}

/** Base sku (MODEL-COLOR, size stripped) of a product's first variant. */
export function baseSkuOf(product: {
  variants?: Array<{ sku?: string | null }>;
}): string {
  const sku = product.variants?.[0]?.sku || "";
  const parts = sku.split("-");
  return parts.length > 1 ? parts.slice(0, -1).join("-") : sku;
}

import fs from "fs";
import path from "path";

// item model code -> "ss" | "aw" (NEBIM season attribute buckets, year-free)
let seasonMap: Record<string, string> | null = null;
export function seasonOfModel(baseSku: string): "ss" | "aw" | null {
  if (!seasonMap) {
    try {
      seasonMap = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "data", "season-map.json"), "utf-8")
      );
    } catch {
      seasonMap = {};
    }
  }
  // baseSku = MODEL-COLOR -> model
  const parts = baseSku.split("-");
  const model = parts.length > 1 ? parts.slice(0, -1).join("-") : baseSku;
  const v = seasonMap?.[model];
  return v === "ss" || v === "aw" ? v : null;
}
