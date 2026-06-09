"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, type Locale } from "@/lib/i18n";
import { useCurrency, type CurrencyCode } from "@/lib/currency";
import { useCart } from "@/lib/cart";

interface User {
  id: number;
  email: string;
  name: string;
  company: string;
  phone: string;
  role: string;
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const CATEGORIES = [
  "takim",
  "tunik",
  "hirka",
  "kaban",
  "mont",
  "triko",
  "elbise",
  "gomlek",
  "pantolon",
  "etek",
  "yelek",
  "ceket",
];

export default function Header({ user, onLogout }: HeaderProps) {
  const { t, locale, setLocale } = useI18n();
  const { currency, setCurrency } = useCurrency();
  const { getCartItemCount } = useCart();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const count = getCartItemCount();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
    router.push("/products");
  };

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/products"
            className="text-2xl font-bold tracking-wider text-gray-900"
          >
            GHISA
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/products"
              className="text-sm uppercase tracking-wide text-gray-700 hover:text-gray-900"
            >
              {t("products")}
            </Link>
            <div className="relative group">
              <button className="text-sm uppercase tracking-wide text-gray-700 hover:text-gray-900 flex items-center gap-1">
                {t("categories")}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-3 h-3"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>
              <div className="absolute left-0 top-full pt-2 hidden group-hover:block z-50">
                <div className="bg-white border border-gray-200 shadow-lg rounded-lg py-2 min-w-[160px]">
                  {CATEGORIES.map((cat) => (
                    <Link
                      key={cat}
                      href={`/products?category=${cat}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 capitalize"
                    >
                      {cat}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          <div className="flex items-center gap-3">
            {/* Currency switcher */}
            <div className="flex border border-gray-200 rounded text-xs">
              {(["TRY", "USD"] as CurrencyCode[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-2 py-1 ${
                    currency === c
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  } ${c === "TRY" ? "rounded-l" : "rounded-r"}`}
                >
                  {c === "TRY" ? "₺" : "$"}
                </button>
              ))}
            </div>

            {/* Language switcher */}
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="tr">TR</option>
              <option value="en">EN</option>
              <option value="ar">AR</option>
            </select>

            {/* Auth */}
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm text-gray-600">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-red-600"
                >
                  {t("logout")}
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t("login")}
              </Link>
            )}

            {/* Cart */}
            <Link href="/cart" className="relative text-gray-700 hover:text-gray-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                {menuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-3">
            <Link
              href="/products"
              onClick={() => setMenuOpen(false)}
              className="block text-sm uppercase tracking-wide text-gray-700"
            >
              {t("products")}
            </Link>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                {t("categories")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat}
                    href={`/products?category=${cat}`}
                    onClick={() => setMenuOpen(false)}
                    className="text-sm text-gray-700 capitalize"
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </div>
            {user && (
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="text-sm text-red-600"
                >
                  {t("logout")}
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
