import { queryAll, queryOne, run } from "./db";

export type EventType = "login" | "view_product" | "add_to_cart" | "view_cart" | "order";

/**
 * Customer activity log. Admins are never logged (they test the site); repeated
 * product views by the same user are throttled to one per 5 minutes so the feed
 * stays readable.
 */
export function logActivity(
  user: { id: number; role: string },
  type: EventType,
  ref = "",
  label = "",
  meta = ""
) {
  if (user.role === "admin") return;
  if (type === "view_product") {
    const recent = queryOne(
      `SELECT 1 FROM activity WHERE user_id = ? AND event_type = 'view_product'
         AND ref = ? AND created_at > datetime('now','-5 minutes') LIMIT 1`,
      [user.id, ref]
    );
    if (recent) return;
  }
  run(
    "INSERT INTO activity (user_id, event_type, ref, label, meta) VALUES (?,?,?,?,?)",
    [user.id, type, ref, label, meta]
  );
}

export interface FeedRow {
  id: number;
  event_type: string;
  ref: string;
  label: string;
  meta: string;
  created_at: string;
  name: string;
  company: string;
}

/** Recent activity across all customers (Istanbul time), newest first. */
export function recentActivity(limit = 300, userId?: number): FeedRow[] {
  const where = userId ? "WHERE a.user_id = ?" : "";
  const params = userId ? [userId, limit] : [limit];
  return queryAll<FeedRow>(
    `SELECT a.id, a.event_type, a.ref, a.label, a.meta,
            datetime(a.created_at, '+3 hours') AS created_at,
            u.name, u.company
     FROM activity a LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.id DESC LIMIT ?`,
    params
  );
}

export interface CustomerSummary {
  user_id: number;
  name: string;
  company: string;
  last_active: string | null;
  views: number;
  cart_adds: number;
  cart_views: number;
  logins: number;
  orders: number;
}

/** Per-customer engagement over the last N days. */
export function customerSummaries(days = 30): CustomerSummary[] {
  return queryAll<CustomerSummary>(
    `SELECT u.id AS user_id, u.name, u.company,
            (SELECT datetime(MAX(created_at), '+3 hours') FROM activity WHERE user_id = u.id) AS last_active,
            SUM(CASE WHEN a.event_type = 'view_product' THEN 1 ELSE 0 END) AS views,
            SUM(CASE WHEN a.event_type = 'add_to_cart'  THEN 1 ELSE 0 END) AS cart_adds,
            SUM(CASE WHEN a.event_type = 'view_cart'    THEN 1 ELSE 0 END) AS cart_views,
            SUM(CASE WHEN a.event_type = 'login'        THEN 1 ELSE 0 END) AS logins,
            SUM(CASE WHEN a.event_type = 'order'        THEN 1 ELSE 0 END) AS orders
     FROM users u
     LEFT JOIN activity a
       ON a.user_id = u.id AND a.created_at > datetime('now', ?)
     WHERE u.role != 'admin'
     GROUP BY u.id
     HAVING last_active IS NOT NULL
     ORDER BY MAX(a.created_at) DESC`,
    [`-${days} days`]
  );
}
