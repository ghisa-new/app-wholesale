"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background,#faf9f7)] px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <h1 className="text-xl font-bold mb-1">Şifremi Unuttum</h1>
        <p className="text-sm text-gray-500 mb-6">
          Kayıtlı e-posta adresinizi girin; sıfırlama bağlantısı gönderelim.
        </p>
        {sent ? (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            Eğer bu adres kayıtlıysa, sıfırlama bağlantısı e-postanıza
            gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-posta"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {busy ? "Gönderiliyor…" : "Bağlantı Gönder"}
            </button>
          </form>
        )}
        <Link href="/login" className="block mt-4 text-center text-sm text-gray-500 hover:text-gray-900">
          ← Girişe dön
        </Link>
      </div>
    </div>
  );
}
