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
