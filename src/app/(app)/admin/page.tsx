"use client";

// Yönetim paneli — indirimler (tek tek + Excel), müşteriler (hesaplar +
// NEBIM istatistikleri), siparişler (onay/iptal — bekleyenler stok rezerve eder).
// Erişim: role=admin; middleware + her API ayrıca sunucu tarafında doğrular.

import { useCallback, useEffect, useRef, useState } from "react";

interface DiscountRow {
  handle: string;
  sku: string;
  title: string;
  productType: string;
  temperature: string | null;
  lots: number | null;
  price: { amount: string; currencyCode: string };
  image: string | null;
  autoEligible: boolean;
  override: "on" | "off" | null;
  onSale: boolean;
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
  whatsapp: string;
  telegram: string;
  contact_email: string;
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
  line_id: number;
  product_title: string;
  color: string;
  size: string;
  sku: string;
  qty: number;
  unit_price: number;
  discount_pct: number;
  warehouse_code?: string;
}

const WH_SHORT: Record<string, string> = {
  "1-1-1": "Merkez",
  "1-2-23": "E-Ticaret",
};
interface Order {
  order_id: number;
  status: string;
  notes: string;
  total_amount: number;
  discount_pct: number;
  discount_amount: number;
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
  const [tab, setTab] = useState<"indirim" | "musteri" | "siparis" | "ceviri" | "aktivite">("indirim");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Yönetim Paneli</h1>
      <div className="flex gap-1 mb-5">
        {(
          [
            ["indirim", "Ürünler"],
            ["musteri", "Müşteriler"],
            ["siparis", "Siparişler"],
            ["ceviri", "Çeviriler"],
            ["aktivite", "Aktivite"],
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
      {tab === "ceviri" && <TranslateTab />}
      {tab === "aktivite" && <ActivityTab />}
    </div>
  );
}

// ── İndirimler ───────────────────────────────────────────────────────────────

function DiscountsTab() {
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [q, setQ] = useState("");
  const [sortCol, setSortCol] = useState<string>("title");
  const [sortAsc, setSortAsc] = useState(true);
  const [showDisabled, setShowDisabled] = useState(false);
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

  const setSale = async (r: DiscountRow) => {
    // cycle: auto → (opposite of current effective state) → auto
    const next: "on" | "off" | "auto" =
      r.override !== null ? "auto" : r.onSale ? "off" : "on";
    const res = await fetch("/api/admin/discounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: r.handle, saleState: next }),
    });
    if (res.ok) load();
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

  const TEMP_ORDER = ["FIRE", "HOT", "WARM", "COOL", "COLD", "DEAD", "DORMANT"];
  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
  };
  const shown = rows
    .filter((r) => showDisabled || r.onSale)
    .filter(
      (r) =>
        !q.trim() ||
        r.title.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")) ||
        r.handle.includes(q.toLowerCase()) ||
        r.sku.toUpperCase().includes(q.toUpperCase())
    )
    .sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (sortCol) {
        case "temperature":
          va = a.temperature ? TEMP_ORDER.indexOf(a.temperature) : 99;
          vb = b.temperature ? TEMP_ORDER.indexOf(b.temperature) : 99;
          break;
        case "lots":
          va = a.lots ?? -1;
          vb = b.lots ?? -1;
          break;
        case "price":
          va = parseFloat(a.price.amount);
          vb = parseFloat(b.price.amount);
          break;
        case "discount":
          va = a.discount;
          vb = b.discount;
          break;
        case "productType":
          va = a.productType || "";
          vb = b.productType || "";
          break;
        case "onSale":
          va = a.onSale ? 0 : 1;
          vb = b.onSale ? 0 : 1;
          break;
        default:
          va = a.title;
          vb = b.title;
      }
      if (typeof va === "string" && typeof vb === "string") {
        return sortAsc ? va.localeCompare(vb, "tr") : vb.localeCompare(va, "tr");
      }
      return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });

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
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showDisabled}
            onChange={(e) => setShowDisabled(e.target.checked)}
          />
          Arşivdekileri göster
        </label>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
        <span className="text-xs text-gray-400 ml-auto">
          Excel: sku · name · price · discount — &quot;discount&quot; sütununu doldur, yükle
        </span>
      </div>
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Yükleniyor…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-gray-400 border-b border-gray-200">
                {(
                  [
                    ["image", "", ""],
                    ["title", "Ürün", ""],
                    ["productType", "Kategori", ""],
                    ["temperature", "Sıcaklık", ""],
                    ["lots", "Seri", "text-right"],
                    ["price", "Toptan Fiyat", "text-right"],
                    ["discount", "İndirim %", "text-right"],
                    ["onSale", "Durum", ""],
                  ] as const
                ).map(([key, label, align]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`px-3 py-2 cursor-pointer select-none hover:text-gray-700 ${align}`}
                  >
                    {label}
                    {sortCol === key && (
                      <span className="ml-0.5 text-blue-600">{sortAsc ? "▲" : "▼"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.handle}
                  className={`border-b border-gray-50 ${
                    r.onSale ? "" : "opacity-45 grayscale bg-gray-50"
                  }`}
                >
                  <td className="px-2 py-1">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image.includes("?") ? `${r.image}&width=80` : `${r.image}?width=80`}
                        alt=""
                        className="w-9 h-11 object-cover rounded"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-9 h-11 bg-gray-100 rounded" />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-[10px] font-mono text-gray-400">{r.sku || r.handle}</div>
                  </td>
                  <td className="px-3 py-1.5 text-gray-500">{r.productType}</td>
                  <td className="px-3 py-1.5">
                    {r.temperature && <TempChip temp={r.temperature} />}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{r.lots ?? "-"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {parseFloat(r.price.amount).toLocaleString("tr-TR")} {r.price.currencyCode}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <DiscountInput value={r.discount} overridden={r.overridden} onSave={(d) => save(r.handle, d)} />
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => setSale(r)}
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                        r.onSale
                          ? "bg-green-50 border-green-300 text-green-700"
                          : "bg-gray-100 border-gray-300 text-gray-500"
                      }`}
                      title={
                        r.override
                          ? `Manuel: ${r.override === "on" ? "satışta" : "arşiv"} — tıkla: otomatiğe dön`
                          : `Otomatik: ${r.autoEligible ? "uygun" : "stok/kural dışı"} — tıkla: ${r.onSale ? "arşivle" : "satışa al"}`
                      }
                    >
                      {r.onSale ? "Satışta" : "Arşiv"}
                      {r.override && " ✎"}
                    </button>
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

function RegisterTokenCard() {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.registerToken && setToken(d.registerToken))
      .catch(() => {});
  }, []);
  const save = async () => {
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registerToken: token }),
    });
    if (res.ok) {
      setSaved("✓ kaydedildi");
      setTimeout(() => setSaved(""), 2000);
    }
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
      <span className="text-sm font-bold">🔑 Kayıt Anahtarı</span>
      <span className="text-xs text-gray-400">
        (girişteki &quot;Kayıt&quot; kutusu bu anahtarı ister — değiştirince eskisi anında geçersizleşir)
      </span>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-mono w-44"
      />
      <button onClick={save} className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg">
        Kaydet
      </button>
      {saved && <span className="text-xs text-green-700">{saved}</span>}
    </div>
  );
}

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
      <RegisterTokenCard />
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
                {c.whatsapp && (
                  <span className="text-[11px] bg-green-50 border border-green-200 rounded px-1.5 py-0.5">📱 {c.whatsapp}</span>
                )}
                {c.telegram && (
                  <span className="text-[11px] bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5">✈️ {c.telegram}</span>
                )}
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
  const [withTry, setWithTry] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/orders");
    const json = await res.json();
    if (res.ok) setOrders(json.orders);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const lineAction = async (orderId: number, body: Record<string, unknown>) => {
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, ...body }),
    });
    load();
  };

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
                    <th>Depo</th>
                    <th className="text-right">Adet</th>
                    <th className="text-right">Birim ₺</th>
                    <th className="text-right">İnd.%</th>
                    <th className="text-right">Tutar ₺</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...o.lines]
                    .sort((a, b) => (a.warehouse_code || "z").localeCompare(b.warehouse_code || "z"))
                    .map((l) => (
                      <tr key={l.line_id} className="border-t border-gray-100">
                        <td className="py-1">
                          {l.product_title}
                          {l.sku && (
                            <span className="block text-[10px] font-mono text-gray-400">{l.sku}</span>
                          )}
                        </td>
                        <td>{l.color}</td>
                        <td>{l.size}</td>
                        <td className="text-gray-500">{WH_SHORT[l.warehouse_code || ""] ?? (l.warehouse_code || "—")}</td>
                        <td className="text-right">
                          <InlineNum
                            value={l.qty}
                            onSave={(v) => lineAction(o.order_id, { action: "setQty", lineId: l.line_id, qty: v })}
                          />
                        </td>
                        <td className="text-right tabular-nums">{fmt(l.unit_price)}</td>
                        <td className="text-right">
                          <InlineNum
                            value={l.discount_pct || 0}
                            onSave={(v) =>
                              lineAction(o.order_id, { action: "lineDiscount", lineId: l.line_id, lineDiscountPct: v })
                            }
                          />
                        </td>
                        <td className="text-right tabular-nums">
                          {fmt(Math.round(l.qty * l.unit_price * (1 - (l.discount_pct || 0) / 100) * 100) / 100)}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => lineAction(o.order_id, { action: "deleteLine", lineId: l.line_id })}
                            className="text-red-400 hover:text-red-600 text-xs"
                            title="Satırı sil"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              <AddLineForm onAdd={(al) => lineAction(o.order_id, { action: "addLine", addLine: al })} />

              <div className="flex flex-wrap items-center gap-3 mt-3">
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  Sipariş indirimi %:
                  <InlineNum
                    value={o.discount_pct || 0}
                    onSave={(v) => lineAction(o.order_id, { action: "orderDiscount", orderDiscountPct: v })}
                  />
                </label>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  İndirim ₺:
                  <InlineNum
                    value={o.discount_amount || 0}
                    onSave={(v) => lineAction(o.order_id, { action: "orderDiscountAmount", orderDiscountAmount: v })}
                  />
                </label>
                <span className="text-sm font-bold tabular-nums">Toplam: {fmt(o.total_amount)} ₺</span>
                <a
                  href={`/api/admin/orders/${o.order_id}/proforma?lang=tr${withTry ? "&try=1" : ""}`}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg"
                >
                  📄 Proforma (TR)
                </a>
                <a
                  href={`/api/admin/orders/${o.order_id}/proforma?lang=en${withTry ? "&try=1" : ""}`}
                  className="px-3 py-1.5 bg-gray-700 text-white text-xs font-bold rounded-lg"
                >
                  📄 Proforma (EN)
                </a>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <input type="checkbox" checked={withTry} onChange={(e) => setWithTry(e.target.checked)} />
                  ₺ karşılığını da göster
                </label>
              </div>

              {o.notes && <p className="text-xs text-gray-500 my-2">Not: {o.notes}</p>}
              <div className="flex gap-2 mt-2">
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


// ── Çeviriler ────────────────────────────────────────────────────────────────

interface TxState {
  progress: {
    running: boolean;
    total: number;
    done: number;
    errors: string[];
    finishedAt: string | null;
  };
  stats: Array<{ locale: string; c: number }>;
}

function TranslateTab() {
  const [st, setSt] = useState<TxState | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/admin/translate");
    if (res.ok) setSt(await res.json());
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const start = async () => {
    await fetch("/api/admin/translate", { method: "POST" });
    load();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-sm text-gray-600">
          Ürün adları ve açıklamaları Gemini Flash ile İngilizce + Arapça&apos;ya
          çevrilir ve saklanır. Yalnızca Türkçe içeriği değişen ürünler yeniden
          çevrilir; müşteri sitede dil değiştirdiğinde çeviriler anında görünür.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={start}
            disabled={st?.progress.running}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg disabled:opacity-50"
          >
            {st?.progress.running ? "Çeviri sürüyor…" : "Çevirileri Güncelle"}
          </button>
          {st?.progress.running && (
            <span className="text-sm tabular-nums">
              {st.progress.done} / {st.progress.total}
            </span>
          )}
          {!st?.progress.running && st?.progress.finishedAt && (
            <span className="text-xs text-gray-400">Son çalışma: {st.progress.finishedAt.slice(0, 16).replace("T", " ")}</span>
          )}
        </div>
        <div className="flex gap-2 text-xs">
          {(st?.stats ?? []).map((r) => (
            <span key={r.locale} className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
              {r.locale.toUpperCase()}: {r.c} ürün çevrildi
            </span>
          ))}
        </div>
        {st && st.progress.errors.length > 0 && (
          <div className="text-xs text-red-600 max-h-32 overflow-y-auto">
            {st.progress.errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


const TEMP_COLORS: Record<string, string> = {
  FIRE: "bg-red-100 text-red-700",
  HOT: "bg-orange-100 text-orange-700",
  WARM: "bg-amber-100 text-amber-700",
  COOL: "bg-sky-100 text-sky-700",
  COLD: "bg-blue-100 text-blue-700",
  DEAD: "bg-gray-200 text-gray-600",
  DORMANT: "bg-gray-100 text-gray-400",
};

function TempChip({ temp }: { temp: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${TEMP_COLORS[temp] ?? "bg-gray-100 text-gray-500"}`}>
      {temp}
    </span>
  );
}


function InlineNum({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = parseFloat(v);
    if (!isNaN(n) && n >= 0 && n !== value) onSave(n);
  };
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="w-14 text-right border border-gray-300 rounded px-1 py-0.5 tabular-nums bg-white"
    />
  );
}

function AddLineForm({
  onAdd,
}: {
  onAdd: (l: { title: string; color?: string; size?: string; sku?: string; qty: number; unitPrice: number }) => void;
}) {
  const [f, setF] = useState({ title: "", color: "", size: "", sku: "", qty: "1", unitPrice: "" });
  return (
    <div className="flex flex-wrap items-end gap-1.5 text-xs bg-white border border-dashed border-gray-300 rounded-lg p-2">
      <span className="font-bold text-gray-500 mr-1">+ Satır ekle:</span>
      {(
        [
          ["title", "Ürün adı", "w-44"],
          ["sku", "SKU", "w-32"],
          ["color", "Renk", "w-20"],
          ["size", "Beden", "w-16"],
          ["qty", "Adet", "w-14"],
          ["unitPrice", "Birim ₺", "w-20"],
        ] as const
      ).map(([k, ph, w]) => (
        <input
          key={k}
          value={f[k]}
          onChange={(e) => setF((s2) => ({ ...s2, [k]: e.target.value }))}
          placeholder={ph}
          className={`border border-gray-300 rounded px-1.5 py-1 ${w}`}
        />
      ))}
      <button
        onClick={() => {
          const qty = parseInt(f.qty) || 0;
          const up = parseFloat(f.unitPrice) || 0;
          if (!f.title || qty <= 0 || up <= 0) return;
          onAdd({ title: f.title, color: f.color, size: f.size, sku: f.sku.toUpperCase(), qty, unitPrice: up });
          setF({ title: "", color: "", size: "", sku: "", qty: "1", unitPrice: "" });
        }}
        className="px-2.5 py-1 bg-gray-900 text-white font-bold rounded"
      >
        Ekle
      </button>
    </div>
  );
}


// ── Aktivite ─────────────────────────────────────────────────────────────────

interface FeedRow {
  id: number;
  event_type: string;
  ref: string;
  label: string;
  meta: string;
  created_at: string;
  name: string;
  company: string;
}
interface CustSummary {
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

const EVENT_LABEL: Record<string, string> = {
  login: "🔑 Giriş yaptı",
  view_product: "👁️ Ürün baktı",
  add_to_cart: "🛒 Sepete ekledi",
  view_cart: "🧺 Sepete baktı",
  order: "📦 Sipariş verdi",
};

function ActivityTab() {
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [summary, setSummary] = useState<CustSummary[]>([]);
  const [focus, setFocus] = useState<number | null>(null);

  const load = useCallback(async (userId?: number) => {
    const url = userId ? `/api/admin/activity?user=${userId}` : "/api/admin/activity";
    const res = await fetch(url);
    if (res.ok) {
      const d = await res.json();
      setFeed(d.feed);
      if (!userId) setSummary(d.summary);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => load(focus ?? undefined), 20000);
    return () => clearInterval(t);
  }, [load, focus]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* per-customer engagement */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold">Müşteri Etkileşimi (son 30 gün)</h3>
          {focus && (
            <button onClick={() => { setFocus(null); load(); }} className="text-xs text-blue-700 underline">
              tümünü göster
            </button>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase text-gray-400 border-b border-gray-200">
                <th className="px-2 py-2">Müşteri</th>
                <th className="px-2 py-2 text-right" title="Ürün görüntüleme">👁️</th>
                <th className="px-2 py-2 text-right" title="Sepete ekleme">🛒</th>
                <th className="px-2 py-2 text-right" title="Sipariş">📦</th>
                <th className="px-2 py-2">Son görülme</th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 && (
                <tr><td colSpan={5} className="px-2 py-6 text-center text-gray-400">Henüz aktivite yok.</td></tr>
              )}
              {summary.map((c) => (
                <tr
                  key={c.user_id}
                  onClick={() => { setFocus(c.user_id); load(c.user_id); }}
                  className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${focus === c.user_id ? "bg-blue-50" : ""}`}
                >
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{c.company || c.name}</div>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{c.views}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{c.cart_adds}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-bold">{c.orders}</td>
                  <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">{c.last_active?.slice(5, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* live feed */}
      <div>
        <h3 className="text-sm font-bold mb-2">
          {focus ? "Bu müşterinin akışı" : "Son Hareketler"}
        </h3>
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
          {feed.length === 0 && (
            <p className="px-3 py-6 text-center text-gray-400 text-xs">Kayıt yok.</p>
          )}
          {feed.map((e) => (
            <div key={e.id} className="px-3 py-2 text-xs flex items-start gap-2">
              <span className="text-gray-400 tabular-nums whitespace-nowrap">{e.created_at.slice(5, 16)}</span>
              <div className="min-w-0">
                <span className="font-medium">{e.company || e.name || "—"}</span>{" "}
                <span className="text-gray-600">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                {e.label && <span className="text-gray-500"> · {e.label}</span>}
                {e.meta && <span className="text-gray-400"> ({e.meta})</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
