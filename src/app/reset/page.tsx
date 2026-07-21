"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (password !== password2) {
      setErr("Şifreler eşleşmiyor");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "İşlem başarısız");
      router.push("/login?reset=1");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
      <h1 className="text-xl font-bold mb-6">Yeni Şifre Belirle</h1>
      <form onSubmit={submit} className="space-y-4">
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Yeni şifre (en az 6 karakter)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          required
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="Yeni şifre (tekrar)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
        >
          {busy ? "Kaydediliyor…" : "Şifreyi Güncelle"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background,#faf9f7)] px-4">
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
