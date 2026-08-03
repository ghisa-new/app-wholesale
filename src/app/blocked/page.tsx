"use client";

import Link from "next/link";

type Lang = "en" | "tr" | "ar";

const TXT: Record<Lang, { title: string; body: string; how: string; back: string; relog: string }> = {
  en: {
    title: "Access restricted in your region",
    body: "The GHISA wholesale portal is not available from your current location.",
    how: "If you have a 3-day access code, register with it — or ask your GHISA contact to enable a 3-day access window for your account, then sign in again.",
    back: "← Back to sign in",
    relog: "Sign in again",
  },
  tr: {
    title: "Bölgenizde erişim kısıtlı",
    body: "GHISA toptan portalı bulunduğunuz konumdan erişime kapalıdır.",
    how: "3 günlük erişim kodunuz varsa onunla kayıt olun — ya da GHISA yetkilinizden hesabınıza 3 günlük erişim tanımlamasını isteyin ve tekrar giriş yapın.",
    back: "← Girişe dön",
    relog: "Tekrar giriş yap",
  },
  ar: {
    title: "الوصول مقيّد في منطقتك",
    body: "بوابة GHISA للبيع بالجملة غير متاحة من موقعك الحالي.",
    how: "إذا كان لديك رمز وصول لمدة 3 أيام، سجّل به — أو اطلب من مسؤول GHISA تفعيل نافذة وصول لمدة 3 أيام لحسابك ثم سجّل الدخول من جديد.",
    back: "← العودة لتسجيل الدخول",
    relog: "تسجيل الدخول مجدداً",
  },
};

export default function BlockedPage() {
  const lang: Lang = ((): Lang => {
    if (typeof window === "undefined") return "en";
    const l = localStorage.getItem("wholesale_locale");
    return l === "tr" || l === "ar" ? l : "en";
  })();
  const t = TXT[lang];
  const rtl = lang === "ar";

  const relog = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.assign("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background,#faf9f7)] px-4">
      <div dir={rtl ? "rtl" : "ltr"} className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="text-4xl mb-3">🌍</div>
        <h1 className="text-xl font-bold mb-2">{t.title}</h1>
        <p className="text-sm text-gray-600 mb-4">{t.body}</p>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">{t.how}</p>
        <button
          onClick={relog}
          className="w-full py-3 bg-gray-900 text-white rounded-lg text-sm font-bold mb-3"
        >
          {t.relog}
        </button>
        <Link href="/login" className="block text-sm text-gray-500 hover:text-gray-900">
          {t.back}
        </Link>
      </div>
    </div>
  );
}
