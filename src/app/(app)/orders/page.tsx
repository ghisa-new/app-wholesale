"use client";

// Siparişlerim — the customer's own orders + proforma download.

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Line {
  product_title: string;
  color: string;
  size: string;
  sku: string;
  qty: number;
  unit_price: number;
  discount_pct: number;
}
interface Order {
  order_id: number;
  status: string;
  total_amount: number;
  created_at: string;
  lines: Line[];
}

const STATUS: Record<string, [string, string]> = {
  pending: ["Hazırlanıyor", "bg-amber-100 text-amber-800"],
  fulfilled: ["Tamamlandı", "bg-green-100 text-green-800"],
  cancelled: ["İptal", "bg-gray-100 text-gray-500"],
};

export default function MyOrdersPage() {
  const { locale } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/my-orders")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.orders && setOrders(d.orders))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-5">Siparişlerim</h1>
      {loading && <p className="text-gray-400 text-sm">Yükleniyor…</p>}
      {!loading && orders.length === 0 && (
        <p className="text-gray-400 text-sm py-8 text-center">Henüz siparişiniz yok.</p>
      )}
      <div className="space-y-2">
        {orders.map((o) => {
          const [label, cls] = STATUS[o.status] ?? [o.status, "bg-gray-100"];
          return (
            <div key={o.order_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === o.order_id ? null : o.order_id)}
                className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
              >
                <span className="font-bold text-sm">#{o.order_id}</span>
                <span className="text-xs text-gray-400">{o.created_at}</span>
                <span className="text-sm font-bold tabular-nums ml-auto">
                  {o.total_amount.toLocaleString("tr-TR")} ₺
                </span>
                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${cls}`}>{label}</span>
              </button>
              {open === o.order_id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                  <table className="w-full text-xs mb-3">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="py-1">Ürün</th>
                        <th>Renk</th>
                        <th>Beden</th>
                        <th className="text-right">Adet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.lines.map((l, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-1">{l.product_title}</td>
                          <td>{l.color}</td>
                          <td>{l.size}</td>
                          <td className="text-right tabular-nums">{l.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <a
                    href={`/api/my-orders/${o.order_id}/proforma?lang=${locale === "tr" ? "tr" : "en"}`}
                    className="inline-block px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg"
                  >
                    📄 Proforma İndir
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
