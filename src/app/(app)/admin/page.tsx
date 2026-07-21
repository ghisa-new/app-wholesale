"use client";

// Yönetim paneli — indirimler (tek tek + Excel), müşteriler (hesaplar +
// NEBIM istatistikleri), siparişler (onay/iptal — bekleyenler stok rezerve eder).
// Erişim: role=admin; middleware + her API ayrıca sunucu tarafında doğrular.

import { useCallback, useEffect, useRef, useState } from "react";

interface DiscountRow {
  handle: string;
  title: string;
  productType: string;
  price: { amount: string; currencyCode: string };
  discount: number;
  overridden: boolean;
}
interface Customer {
  id: number;
  email: string;
  name: string;
  company: string;
  phone: string;
  role: string;
  curr_acc_code: string;
  password_plain: string;
  created_at: string;
}
interface Stats {
  currAccCode: string;
  customerName: string | null;
  balance: number;
  openOrders: number;
  closedOrders: number;
  lastOrderDate: string | null;
  lastInvoiceDate: string | null;
}
interface OrderLine {
  product_title: string;
  color: string;
  size: string;
  sku: string;
  qty: number;
  unit_price: number;
}
interface Order {
  order_id: number;
  status: string;
  notes: string;
  total_amount: number;
  created_at: string;
  status_changed_at: string | null;
  status_changed_by: string | null;
  email: string;
  name: string;
  company: string;
  lines: OrderLine[];
}

const fmt = (n: number) => n.toLocaleString("tr-TR");

export default function AdminPage() {
  const [tab, setTab] = useState<"indirim" | "musteri" | "siparis">("indirim");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Yönetim Paneli</h1>
      <div className="flex gap-1 mb-5">
        {(
          [
            ["indirim", "İndirimler"],
            ["musteri", "Müşteriler"],
            ["siparis", "Siparişler"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${
              tab === k ? "bg-gray-900 text-white" : "bg-white border border-gray-300 text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "indirim" && <DiscountsTab />}
      {tab === "musteri" && <CustomersTab />}
      {tab === "siparis" && <OrdersTab />}
    </div>
  );
}

// ── İndirimler ───────────────────────────────────────────────────────────────

function DiscountsTab() {
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/discounts");
    const json = await res.json();
    if (res.ok) setRows(json.products);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (handle: string, discount: number) => {
    const res = await fetch("/api/admin/discounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, discount }),
    });
    if (res.ok) {
      setRows((rs) => rs.map((r) => (r.handle === handle ? { ...r, discount, overridden: true } : r)));
      setMsg(`✓ ${handle} → %${discount}`);
      setTimeout(() => setMsg(""), 2500);
    }
  };

  const upload = async (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    setMsg("Excel işleniyor…");
    const res = await fetch("/api/admin/discounts/excel", { method: "POST", body: fd });
    const json = await res.json();
    if (res.ok) {
      setMsg(`✓ ${json.applied} ürün güncellendi${json.errors?.length ? ` · ${json.errors.length} hata` : ""}`);
      load();
    } else {
      setMsg(`✗ ${json.error}`);
    }
  };

  const shown = rows.filter(
    (r) =>
      !q.trim() ||
      r.title.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")) ||
      r.handle.includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ürün ara…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56"
        />
        <a
          href="/api/admin/discounts/excel"
          className="px-3 py-2 bg-green-700 text-white text-sm font-bold rounded-lg"
        >
          ⬇ Excel indir
        </a>
        <button
          onClick={() => fileRef.current?.click()}
          className="px-3 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg"
        >
          ⬆ Excel yükle
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
        <span className="text-xs text-gray-400 ml-auto">
          Excel akışı: indir → &quot;discount&quot; sütununu doldur → yükle
        </span>
      </div>
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Yükleniyor…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-gray-400 border-b border-gray-200">
                <th className="px-3 py-2">Ürün</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2 text-right">Toptan Fiyat</th>
                <th className="px-3 py-2 text-right">İndirim %</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.handle} className="border-b border-gray-50">
                  <td className="px-3 py-1.5">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-[10px] text-gray-400">{r.handle}</div>
                  </td>
                  <td className="px-3 py-1.5 text-gray-500">{r.productType}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {parseFloat(r.price.amount).toLocaleString("tr-TR")} {r.price.currencyCode}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <DiscountInput value={r.discount} overridden={r.overridden} onSave={(d) => save(r.handle, d)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DiscountInput({
  value,
  overridden,
  onSave,
}: {
  value: number;
  overridden: boolean;
  onSave: (d: number) => void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const d = parseFloat(v);
    if (!isNaN(d) && d >= 0 && d <= 100 && d !== value) onSave(d);
  };
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className={`w-16 text-right border rounded-lg px-2 py-1 tabular-nums ${
        overridden ? "border-amber-400 bg-amber-50" : "border-gray-300"
      }`}
      title={overridden ? "Panelden ayarlandı" : "Katalog varsayılanı"}
    />
  );
}

// ── Müşteriler ───────────────────────────────────────────────────────────────

const EMPTY_FORM = { email: "", password: "", name: "", company: "", phone: "", currAccCode: "" };

function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Record<string, Stats | "loading">>({});
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/customers");
    const json = await res.json();
    if (res.ok) setCustomers(json.customers);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const loadStats = async (cari: string) => {
    if (!cari || stats[cari]) return;
    setStats((s) => ({ ...s, [cari]: "loading" }));
    const res = await fetch(`/api/admin/customers?stats=${encodeURIComponent(cari)}`);
    const json = await res.json();
    if (res.ok) setStats((s) => ({ ...s, [cari]: json }));
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      setForm({ ...EMPTY_FORM });
      setMsg("✓ Hesap oluşturuldu");
      load();
    } else setMsg(`✗ ${json.error}`);
  };

  const remove = async (c: Customer) => {
    if (!confirm(`${c.email} hesabı silinsin mi?`)) return;
    await fetch(`/api/admin/customers?id=${c.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-2 items-end">
        {(
          [
            ["email", "E-posta *"],
            ["password", "Şifre *"],
            ["name", "İsim *"],
            ["company", "Firma"],
            ["phone", "Telefon"],
            ["currAccCode", "NEBIM Cari Kodu"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="text-xs text-gray-500">
            {label}
            <input
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              className="block border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 w-40 mt-0.5"
            />
          </label>
        ))}
        <button type="submit" className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg">
          + Hesap Aç
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </form>

      <div className="space-y-2">
        {customers.map((c) => {
          const st = c.curr_acc_code ? stats[c.curr_acc_code] : undefined;
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="min-w-[220px]">
                  <span className="font-bold text-sm">{c.company || c.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{c.name}</span>
                  {c.role === "admin" && (
                    <span className="ml-2 text-[10px] font-bold bg-gray-900 text-white rounded px-1.5 py-0.5">ADMIN</span>
                  )}
                </div>
                <code className="text-xs bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">{c.email}</code>
                <code className="text-xs bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5" title="Şifre">
                  🔑 {c.password_plain || "—"}
                </code>
                {c.curr_acc_code ? (
                  <button
                    onClick={() => loadStats(c.curr_acc_code)}
                    className="text-xs text-blue-700 underline decoration-dotted"
                  >
                    Cari: {c.curr_acc_code}
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-300">cari kodu yok</span>
                )}
                {c.role !== "admin" && (
                  <button onClick={() => remove(c)} className="ml-auto text-xs text-red-400 hover:text-red-600">
                    Sil
                  </button>
                )}
              </div>
              {st && st !== "loading" && (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                    {st.customerName ?? st.currAccCode}
                  </span>
                  <span
                    className={`rounded-lg px-2 py-1 border font-bold ${
                      st.balance > 0
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-green-50 border-green-200 text-green-700"
                    }`}
                    title="Pozitif = müşterinin borcu"
                  >
                    Bakiye: {fmt(st.balance)} ₺
                  </span>
                  <span className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    {st.openOrders} açık sipariş
                  </span>
                  <span className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                    {st.closedOrders} tamamlanan
                  </span>
                  <span className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                    Son sipariş: {st.lastOrderDate ?? "—"}
                  </span>
                  <span className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                    Son fatura: {st.lastInvoiceDate ?? "—"}
                  </span>
                </div>
              )}
              {st === "loading" && <p className="text-[11px] text-gray-400 mt-2">NEBIM verileri yükleniyor…</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Siparişler ───────────────────────────────────────────────────────────────

const ORDER_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  fulfilled: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};
const ORDER_LABEL: Record<string, string> = {
  pending: "Bekliyor (stok rezerve)",
  fulfilled: "Tamamlandı",
  cancelled: "İptal",
};

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/orders");
    const json = await res.json();
    if (res.ok) setOrders(json.orders);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (orderId: number, status: string) => {
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });
    load();
  };

  if (orders.length === 0)
    return <p className="text-gray-400 text-sm py-8 text-center">Henüz sipariş yok.</p>;

  return (
    <div className="space-y-2">
      {orders.map((o) => (
        <div key={o.order_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === o.order_id ? null : o.order_id)}
            className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
          >
            <span className="font-bold text-sm">#{o.order_id}</span>
            <span className="text-sm">{o.company || o.name}</span>
            <span className="text-xs text-gray-400">{o.created_at}</span>
            <span className="text-sm font-bold tabular-nums ml-auto">{fmt(o.total_amount)} ₺</span>
            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${ORDER_BADGE[o.status]}`}>
              {ORDER_LABEL[o.status] ?? o.status}
            </span>
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
                    <th className="text-right">Birim</th>
                  </tr>
                </thead>
                <tbody>
                  {o.lines.map((l, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1">{l.product_title}</td>
                      <td>{l.color}</td>
                      <td>{l.size}</td>
                      <td className="text-right tabular-nums">{l.qty}</td>
                      <td className="text-right tabular-nums">{fmt(l.unit_price)} ₺</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {o.notes && <p className="text-xs text-gray-500 mb-3">Not: {o.notes}</p>}
              <div className="flex gap-2">
                {o.status === "pending" && (
                  <>
                    <button
                      onClick={() => setStatus(o.order_id, "fulfilled")}
                      className="px-3 py-1.5 bg-green-700 text-white text-xs font-bold rounded-lg"
                    >
                      ✓ Tamamlandı (rezervi kaldır)
                    </button>
                    <button
                      onClick={() => setStatus(o.order_id, "cancelled")}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg"
                    >
                      ✗ İptal (rezervi kaldır)
                    </button>
                  </>
                )}
                {o.status !== "pending" && (
                  <button
                    onClick={() => setStatus(o.order_id, "pending")}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg"
                  >
                    ↩ Beklemeye al
                  </button>
                )}
                {o.status_changed_by && (
                  <span className="text-[11px] text-gray-400 self-center">
                    {o.status_changed_at} · {o.status_changed_by}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
