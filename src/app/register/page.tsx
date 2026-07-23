"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function RegisterForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [f, setF] = useState({
    email: "",
    password: "",
    name: "",
    company: "",
    phone: "",
    whatsapp: "",
    telegram: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...f }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kayıt başarısız");
      window.location.assign("/products");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Kayıt başarısız");
    } finally {
      setBusy(false);
    }
  };

  const FIELDS: Array<[keyof typeof f, string, string, boolean]> = [
    ["company", "Firma adı", "text", true],
    ["name", "Ad Soyad", "text", true],
    ["email", "E-posta", "email", true],
    ["password", "Şifre (en az 6 karakter)", "password", true],
    ["phone", "Telefon", "text", false],
    ["whatsapp", "WhatsApp numarası", "text", false],
    ["telegram", "Telegram kullanıcı adı", "text", false],
  ];

  return (
    <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
      <h1 className="text-xl font-bold mb-1">Toptan Müşteri Kaydı</h1>
      <p className="text-sm text-gray-500 mb-6">
        GHISA toptan portalına hoş geldiniz. Bilgilerinizi doldurun; hesabınız
        hemen açılır.
      </p>
      <form onSubmit={submit} className="space-y-3">
        {FIELDS.map(([k, label, type, req]) => (
          <input
            key={k}
            type={type}
            required={req}
            minLength={k === "password" ? 6 : undefined}
            value={f[k]}
            onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))}
            placeholder={label + (req ? " *" : "")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
          />
        ))}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 bg-gray-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
        >
          {busy ? "Kaydediliyor…" : "Hesap Oluştur"}
        </button>
      </form>
      <Link href="/login" className="block mt-4 text-center text-sm text-gray-500 hover:text-gray-900">
        ← Girişe dön
      </Link>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background,#faf9f7)] px-4">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
