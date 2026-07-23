"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const TXT = {
  en: {
    portal: "Wholesale Portal",
    email: "E-mail",
    emailPh: "Your e-mail address",
    password: "Password",
    passwordPh: "Password",
    signingIn: "Signing in...",
    signIn: "Sign In",
    noAccount: "Don't have an account?",
    forgot: "Forgot my password",
    newCustomer: "New customer? Enter the registration key you were given.",
    regKeyPh: "Registration key",
    register: "Register →",
    regInvalid: "Invalid registration key",
    connErr: "Connection error",
    badCreds: "E-mail or password incorrect",
  },
  tr: {
    portal: "Toptan Satış Portalı",
    email: "E-posta",
    emailPh: "E-posta adresiniz",
    password: "Şifre",
    passwordPh: "Şifre",
    signingIn: "Giriş yapılıyor...",
    signIn: "Giriş Yap",
    noAccount: "Hesabınız yok mu?",
    forgot: "Şifremi unuttum",
    newCustomer: "{t.newCustomer}",
    regKeyPh: "Kayıt anahtarı",
    register: "{t.register}",
    regInvalid: "Kayıt anahtarı geçersiz",
    connErr: "Bağlantı hatası",
    badCreds: "E-posta veya şifre hatalı",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "tr">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("wholesale_locale");
      if (saved === "tr") return "tr";
    }
    return "en";
  });
  const t = TXT[lang];
  const switchLang = (l: "en" | "tr") => {
    setLang(l);
    localStorage.setItem("wholesale_locale", l); // the whole site follows
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regToken, setRegToken] = useState("");
  const [regErr, setRegErr] = useState("");
  const tryRegister = async () => {
    setRegErr("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: regToken.trim() }),
    });
    if (res.ok) {
      window.location.assign(`/register?token=${encodeURIComponent(regToken.trim())}`);
    } else {
      setRegErr(t.regInvalid);
    }
  };
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Giris basarisiz");
        return;
      }

      window.location.assign("/products");
    } catch {
      setError(t.connErr);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <Link href="/products" className="flex flex-col items-center mb-8">
          <Image
            src="/ghisa-logo.jpg"
            alt="GHISA"
            width={2947}
            height={641}
            priority
            className="h-7 w-auto"
          />
          <p className="label-eyebrow text-ink-soft mt-3">{t.portal}</p>
        </Link>

        <div className="flex justify-end gap-1 mb-2">
          {(["en", "tr"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => switchLang(l)}
              className={`px-2 py-0.5 text-xs uppercase border ${
                lang === l ? "bg-ink text-white border-ink" : "border-line text-ink-soft"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white px-6 py-8 space-y-5 border border-line"
        >
          {error && (
            <div className="bg-red-50 text-sale px-4 py-2 text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-[0.1em] text-ink-soft mb-1.5">
              {t.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-base bg-white border border-line text-ink
                         focus:border-ink focus:outline-none transition-colors
                         placeholder:text-gray-400"
              placeholder={t.emailPh}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.1em] text-ink-soft mb-1.5">
              {t.password}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-base bg-white border border-line text-ink
                         focus:border-ink focus:outline-none transition-colors
                         placeholder:text-gray-400"
              placeholder={t.passwordPh}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-ink w-full py-3.5 disabled:opacity-50"
          >
            {loading ? t.signingIn : t.signIn}
          </button>

          <p className="text-sm text-center text-ink-soft">
            {t.noAccount}{" "}
            <a
              href="mailto:info@ghisa.com"
              className="text-ink underline hover:opacity-70"
            >
              info@ghisa.com
            </a>
          </p>
          <a href="/forgot" className="block text-center text-sm text-gray-500 hover:text-gray-900 mt-3">
            {t.forgot}
          </a>
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-2">
              Yeni müşteri misiniz? Size verilen kayıt anahtarını girin.
            </p>
            <div className="flex gap-2">
              <input
                value={regToken}
                onChange={(e) => setRegToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tryRegister();
                  }
                }}
                placeholder={t.regKeyPh}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase"
              />
              <button
                type="button"
                onClick={tryRegister}
                disabled={!regToken.trim()}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 disabled:opacity-40"
              >
                Kayıt →
              </button>
            </div>
            {regErr && <p className="text-xs text-red-600 mt-1.5 text-center">{regErr}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
