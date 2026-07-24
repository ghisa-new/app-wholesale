"use client";

/** Fire-and-forget client activity beacon. Never blocks the UI. */
export function track(type: "view_product" | "add_to_cart" | "view_cart", data?: {
  ref?: string;
  label?: string;
  meta?: string;
}) {
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...(data || {}) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
