"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError("Baglanti hatasi");
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
          <p className="label-eyebrow text-ink-soft mt-3">Toptan Satis Portali</p>
        </Link>

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
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-base bg-white border border-line text-ink
                         focus:border-ink focus:outline-none transition-colors
                         placeholder:text-gray-400"
              placeholder="E-posta adresiniz"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.1em] text-ink-soft mb-1.5">
              Sifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-base bg-white border border-line text-ink
                         focus:border-ink focus:outline-none transition-colors
                         placeholder:text-gray-400"
              placeholder="Sifre"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-ink w-full py-3.5 disabled:opacity-50"
          >
            {loading ? "Giris yapiliyor..." : "Giris Yap"}
          </button>

          <p className="text-sm text-center text-ink-soft">
            Hesabiniz yok mu?{" "}
            <a
              href="mailto:info@ghisa.com"
              className="text-ink underline hover:opacity-70"
            >
              info@ghisa.com
            </a>
          </p>
          <a href="/forgot" className="block text-center text-sm text-gray-500 hover:text-gray-900 mt-3">
            Şifremi unuttum
          </a>
        </form>
      </div>
    </div>
  );
}
