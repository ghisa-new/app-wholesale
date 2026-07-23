"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Lang = "en" | "tr" | "ar";

const TXT: Record<Lang, Record<string, string>> = {
  en: {
    title: "Wholesale Customer Registration",
    intro: "Welcome to the GHISA wholesale portal. Fill in your details; your account opens instantly.",
    company: "Company name",
    name: "Full name",
    email: "E-mail",
    password: "Password (min 6 characters)",
    phone: "Phone",
    whatsapp: "WhatsApp number",
    telegram: "Telegram username",
    submit: "Create Account",
    submitting: "Creating…",
    back: "← Back to sign in",
    failed: "Registration failed",
  },
  tr: {
    title: "Toptan Müşteri Kaydı",
    intro: "GHISA toptan portalına hoş geldiniz. Bilgilerinizi doldurun; hesabınız hemen açılır.",
    company: "Firma adı",
    name: "Ad Soyad",
    email: "E-posta",
    password: "Şifre (en az 6 karakter)",
    phone: "Telefon",
    whatsapp: "WhatsApp numarası",
    telegram: "Telegram kullanıcı adı",
    submit: "Hesap Oluştur",
    submitting: "Kaydediliyor…",
    back: "← Girişe dön",
    failed: "Kayıt başarısız",
  },
  ar: {
    title: "تسجيل عميل الجملة",
    intro: "مرحباً بك في بوابة GHISA للبيع بالجملة. املأ بياناتك؛ سيُفتح حسابك فوراً.",
    company: "اسم الشركة",
    name: "الاسم الكامل",
    email: "البريد الإلكتروني",
    password: "كلمة المرور (٦ أحرف على الأقل)",
    phone: "الهاتف",
    whatsapp: "رقم واتساب",
    telegram: "اسم مستخدم تيليجرام",
    submit: "إنشاء حساب",
    submitting: "جارٍ الحفظ…",
    back: "← العودة لتسجيل الدخول",
    failed: "فشل التسجيل",
  },
};

function RegisterForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const lang: Lang = ((): Lang => {
    if (typeof window === "undefined") return "en";
    const l = localStorage.getItem("wholesale_locale");
    return l === "tr" || l === "ar" ? l : "en";
  })();
  const t = TXT[lang];
  const rtl = lang === "ar";

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
      if (!res.ok) throw new Error(json.error || t.failed);
      window.location.assign("/products");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const FIELDS: Array<[keyof typeof f, string, string, boolean]> = [
    ["company", t.company, "text", true],
    ["name", t.name, "text", true],
    ["email", t.email, "email", true],
    ["password", t.password, "password", true],
    ["phone", t.phone, "text", false],
    ["whatsapp", t.whatsapp, "text", false],
    ["telegram", t.telegram, "text", false],
  ];

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
      <h1 className="text-xl font-bold mb-1">{t.title}</h1>
      <p className="text-sm text-gray-500 mb-6">{t.intro}</p>
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
          {busy ? t.submitting : t.submit}
        </button>
      </form>
      <Link href="/login" className="block mt-4 text-center text-sm text-gray-500 hover:text-gray-900">
        {t.back}
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
