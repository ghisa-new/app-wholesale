import { getPool, mssql } from "./nebim";
import { queryAll } from "./db";

/**
 * Live NEBIM reads for the wholesale portal:
 *  - central (1-1-1) stock per variant, minus this app's own pending-order
 *    reservations ("reserve until fulfilled/cancelled")
 *  - per-customer account stats (balance, open/closed WS orders, last dates)
 *
 * NEBIM warehouse codes are CHAR-padded — every code is LTRIM/RTRIMed.
 * TODO(fleet): promote to a cell when a second consumer appears.
 */

const MERKEZ = "1-1-1";

export interface CentralStockRow {
  color: string;
  size: string;
  qty: number;
}

/** Live 1-1-1 balance per color+size for one model (item) code. */
export async function getCentralStockByModel(model: string): Promise<CentralStockRow[]> {
  const p = await getPool();
  const req = p.request();
  req.input("item", mssql.NVarChar(30), model);
  req.input("wh", mssql.NVarChar(10), MERKEZ);
  const r = await req.query(`
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    SELECT s.ColorCode AS color, COALESCE(s.ItemDim1Code, '') AS size,
           SUM(s.In_Qty1 - s.Out_Qty1) AS qty
    FROM trStock s WITH (NOLOCK)
    WHERE s.CompanyCode = 1 AND s.ItemTypeCode = 1
      AND s.ItemCode = @item
      AND LTRIM(RTRIM(s.WarehouseCode)) = @wh
    GROUP BY s.ColorCode, COALESCE(s.ItemDim1Code, '')
    HAVING SUM(s.In_Qty1 - s.Out_Qty1) > 0
  `);
  return r.recordset as CentralStockRow[];
}

/** Units reserved by PENDING wholesale-portal orders, per sku. */
export function getReservedBySku(skus: string[]): Map<string, number> {
  if (skus.length === 0) return new Map();
  const ph = skus.map(() => "?").join(",");
  const rows = queryAll<{ sku: string; reserved: number }>(
    `SELECT ol.sku, SUM(ol.qty) AS reserved
     FROM order_lines ol
     JOIN orders o ON o.order_id = ol.order_id
     WHERE o.status = 'pending' AND ol.sku IN (${ph})
     GROUP BY ol.sku`,
    skus
  );
  return new Map(rows.map((r) => [r.sku, Number(r.reserved) || 0]));
}

export interface CustomerStats {
  currAccCode: string;
  customerName: string | null;
  /** positive = customer owes us (borç), TRY */
  balance: number;
  openOrders: number;
  closedOrders: number;
  lastOrderDate: string | null;
  lastInvoiceDate: string | null;
}

/** NEBIM account stats for the admin customer cards. */
export async function getCustomerStats(currAccCode: string): Promise<CustomerStats> {
  const p = await getPool();
  const req = p.request();
  req.input("cari", mssql.NVarChar(30), currAccCode);
  const r = await req.query(`
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    SELECT
      (SELECT TOP 1 cad.CurrAccDescription FROM cdCurrAccDesc cad WITH (NOLOCK)
        WHERE cad.CurrAccTypeCode = 3 AND LTRIM(RTRIM(cad.CurrAccCode)) = @cari
          AND cad.LangCode = 'TR') AS CustomerName,
      (SELECT ISNULL(SUM(CASE WHEN bc.CurrencyCode = b.LocalCurrencyCode
                              THEN bc.Debit - bc.Credit ELSE 0 END), 0)
        FROM trCurrAccBook b WITH (NOLOCK)
        JOIN trCurrAccBookCurrency bc WITH (NOLOCK) ON bc.CurrAccBookID = b.CurrAccBookID
        WHERE b.CompanyCode = 1 AND b.CurrAccTypeCode = 3
          AND LTRIM(RTRIM(b.CurrAccCode)) = @cari) AS Balance,
      (SELECT COUNT(*) FROM trOrderHeader oh WITH (NOLOCK)
        WHERE oh.CompanyCode = 1 AND oh.ProcessCode = 'WS' AND oh.OrderTypeCode = 1
          AND LTRIM(RTRIM(oh.CurrAccCode)) = @cari
          AND oh.IsClosed = 0 AND ISNULL(oh.IsCancelOrder, 0) = 0) AS OpenOrders,
      (SELECT COUNT(*) FROM trOrderHeader oh WITH (NOLOCK)
        WHERE oh.CompanyCode = 1 AND oh.ProcessCode = 'WS' AND oh.OrderTypeCode = 1
          AND LTRIM(RTRIM(oh.CurrAccCode)) = @cari
          AND oh.IsClosed = 1) AS ClosedOrders,
      (SELECT CONVERT(varchar(10), MAX(oh.OrderDate), 23) FROM trOrderHeader oh WITH (NOLOCK)
        WHERE oh.CompanyCode = 1 AND oh.ProcessCode = 'WS' AND oh.OrderTypeCode = 1
          AND LTRIM(RTRIM(oh.CurrAccCode)) = @cari) AS LastOrderDate,
      (SELECT CONVERT(varchar(10), MAX(ih.InvoiceDate), 23) FROM trInvoiceHeader ih WITH (NOLOCK)
        WHERE ih.CompanyCode = 1 AND ih.ProcessCode = 'WS'
          AND LTRIM(RTRIM(ih.CurrAccCode)) = @cari) AS LastInvoiceDate
  `);
  const row = r.recordset[0] ?? {};
  return {
    currAccCode,
    customerName: row.CustomerName ?? null,
    balance: Math.round((Number(row.Balance) || 0) * 100) / 100,
    openOrders: Number(row.OpenOrders) || 0,
    closedOrders: Number(row.ClosedOrders) || 0,
    lastOrderDate: row.LastOrderDate ?? null,
    lastInvoiceDate: row.LastInvoiceDate ?? null,
  };
}
