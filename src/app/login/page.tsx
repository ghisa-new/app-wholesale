"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

      router.push("/products");
    } catch {
      setError("Baglanti hatasi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-wider">
            GHISA
          </h1>
          <p className="text-gray-500 text-sm mt-1">Toptan Satis Portali</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm px-6 py-8 space-y-5 border border-gray-200"
        >
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-base bg-gray-50 border-2 border-gray-200 rounded-lg text-gray-900
                         focus:border-blue-500 focus:outline-none transition-colors
                         placeholder:text-gray-400"
              placeholder="E-posta adresiniz"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-base bg-gray-50 border-2 border-gray-200 rounded-lg text-gray-900
                         focus:border-blue-500 focus:outline-none transition-colors
                         placeholder:text-gray-400"
              placeholder="Sifre"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white text-base font-semibold rounded-lg
                       hover:bg-blue-700 active:bg-blue-800 transition-colors
                       disabled:opacity-50"
          >
            {loading ? "Giris yapiliyor..." : "Giris Yap"}
          </button>

          <p className="text-sm text-center text-gray-500">
            Hesabiniz yok mu?{" "}
            <a
              href="mailto:info@ghisa.com"
              className="text-blue-600 hover:underline"
            >
              info@ghisa.com
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
