"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useCart } from "@/lib/cart";

interface User {
  id: number;
  email: string;
  name: string;
  company: string;
  phone: string;
  role: string;
}

export default function CartPage() {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const { items, updateQuantity, removeFromCart, getCartTotal, clearCart } =
    useCart();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  async function handlePlaceOrder() {
    if (!user) {
      router.push("/login");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, notes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }

      setSuccess(true);
      clearCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-green-600 text-5xl mb-4">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("orderSuccess")}
        </h1>
        <p className="text-gray-500 mt-2">{t("orderSuccessDetail")}</p>
        <Link
          href="/products"
          className="inline-block mt-8 bg-blue-600 text-white px-8 py-3 text-sm uppercase tracking-wider rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          {t("continueShopping")}
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {t("yourCart")}
      </h1>

      {!user && (
        <div className="bg-blue-50 border border-blue-200 p-4 mb-6 rounded-lg text-sm text-blue-800">
          {t("loginRequired")}{" "}
          <Link href="/login" className="text-blue-600 underline font-medium">
            {t("login")}
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{t("emptyCart")}</p>
          <Link
            href="/products"
            className="inline-block mt-6 bg-blue-600 text-white px-8 py-3 text-sm uppercase tracking-wider rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            {t("continueShopping")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            {items.map((item) => (
              <div key={item.variantId} className="flex gap-3 p-3 bg-white rounded-lg border border-gray-200">
                {item.image && (
                  <div className="w-20 h-24 relative shrink-0 bg-gray-100 rounded">
                    <Image
                      src={item.image}
                      alt={item.productTitle}
                      fill
                      className="object-cover rounded"
                      sizes="80px"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {item.productTitle}
                  </h4>
                  {item.color && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.color}
                    </p>
                  )}
                  {item.seriDistribution &&
                    Object.keys(item.seriDistribution).length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t("lotSizes")}:{" "}
                        {Object.entries(item.seriDistribution)
                          .flatMap(([size, qty]: [string, number]) =>
                            Array(qty).fill(size)
                          )
                          .join("-")}{" "}
                        (
                        {Object.values(item.seriDistribution).reduce(
                          (s: number, q: number) => s + q,
                          0
                        )}{" "}
                        {t("pieces")})
                      </p>
                    )}
                  <p className="text-sm text-gray-900 mt-1">
                    {formatPrice(item.price)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500 uppercase">
                      {t("lotCount")}:
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.variantId, item.quantity - 1)
                      }
                      className="w-7 h-7 border border-gray-200 rounded flex items-center justify-center text-sm hover:border-gray-400"
                    >
                      -
                    </button>
                    <span className="text-sm w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.variantId, item.quantity + 1)
                      }
                      className="w-7 h-7 border border-gray-200 rounded flex items-center justify-center text-sm hover:border-gray-400"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item.variantId)}
                      className="ml-auto text-xs text-gray-400 hover:text-red-500 uppercase"
                    >
                      {t("remove")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 border border-gray-200 rounded-lg">
              <div className="flex justify-between text-lg font-bold mb-4">
                <span>{t("total")}</span>
                <span>{formatPrice(getCartTotal())}</span>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  {t("orderNotes")}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("orderNotesPlaceholder")}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm mb-2">{error}</p>
              )}

              <button
                onClick={handlePlaceOrder}
                disabled={!user || submitting}
                className="w-full bg-blue-600 text-white py-3 text-sm uppercase tracking-wider rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
              >
                {submitting ? "..." : t("placeOrder")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
