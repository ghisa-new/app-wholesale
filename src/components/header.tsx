"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useI18n, type Locale } from "@/lib/i18n";
import { useCurrency, type CurrencyCode } from "@/lib/currency";
import { useCart } from "@/lib/cart";
import type { Category } from "@/lib/categories";

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

export default function Header({ user, onLogout }: HeaderProps) {
  const { t, locale, setLocale } = useI18n();
  const { currency, setCurrency } = useCurrency();
  const { getCartItemCount } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const count = getCartItemCount();

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  // Close the mobile menu whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
    router.push("/products");
  };

  const navLink = (href: string, active: boolean) =>
    `text-xs uppercase tracking-[0.12em] transition-colors ${
      active ? "text-ink" : "text-ink-soft hover:text-ink"
    }`;

  const isActive = (href: string) =>
    href === "/products"
      ? pathname === "/products"
      : pathname.startsWith(href);

  return (
    <header>
      {/* Announcement bar */}
      <div className="bg-[#2a2928] text-white text-center text-[11px] tracking-[0.1em] py-2 px-4">
        {t("announcement")}
      </div>

      {/* Sticky main bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            {/* Left: mobile toggle + logo */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Menu"
                className="md:hidden -ml-1 p-1 text-ink"
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
              <Link href="/products" aria-label="GHISA" className="block">
                <Image
                  src="/ghisa-logo.jpg"
                  alt="GHISA"
                  width={2947}
                  height={641}
                  priority
                  className="h-6 sm:h-7 w-auto"
                />
              </Link>
            </div>

            {/* Center: desktop nav */}
            <nav className="hidden md:flex flex-1 justify-center items-center gap-8">
              <Link href="/products" className={navLink("/products", isActive("/products"))}>
                {t("products")}
              </Link>

              

              <Link href="/stores" className={navLink("/stores", isActive("/stores"))}>
                {t("stores")}
              </Link>
              <Link href="/faq" className={navLink("/faq", isActive("/faq"))}>
                {t("faq")}
              </Link>
            </nav>

            {/* Right: controls */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto md:ml-0">
              {/* Currency switcher */}
              <div className="flex border border-line text-xs">
                {(["TRY", "USD"] as CurrencyCode[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    aria-label={c}
                    className={`px-2 py-1 transition-colors ${
                      currency === c
                        ? "bg-ink text-white"
                        : "text-ink-soft hover:bg-surface"
                    }`}
                  >
                    {c === "TRY" ? "₺" : "$"}
                  </button>
                ))}
              </div>

              {/* Language switcher */}
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                aria-label={t("language")}
                className="text-xs px-1.5 py-1.5 bg-white border border-line text-ink-soft focus:outline-none focus:border-ink"
              >
                <option value="tr">TR</option>
                <option value="en">EN</option>
                <option value="ar">AR</option>
              </select>

              {/* Account (desktop) */}
              {user && (
                <Link
                  href="/orders"
                  className="hidden sm:inline text-xs uppercase tracking-[0.1em] text-ink-soft hover:text-ink"
                >
                  Siparişlerim
                </Link>
              )}
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="hidden sm:inline text-xs uppercase tracking-[0.1em] font-bold text-ink hover:opacity-70"
                >
                  Yönetim
                </Link>
              )}
              {user ? (
                <button
                  onClick={handleLogout}
                  className="hidden sm:inline text-xs uppercase tracking-[0.1em] text-ink-soft hover:text-ink"
                  title={user.name}
                >
                  {t("logout")}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="hidden sm:inline text-xs uppercase tracking-[0.1em] text-ink-soft hover:text-ink"
                >
                  {t("login")}
                </Link>
              )}

              {/* Cart */}
              <Link
                href="/cart"
                aria-label={t("cart")}
                className="relative text-ink hover:opacity-70"
              >
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
                    d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z"
                  />
                </svg>
                {count > 0 && (
                  <span className="absolute -top-2 -right-2 bg-ink text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-line bg-white max-h-[calc(100vh-8rem)] overflow-y-auto">
            <nav className="max-w-7xl mx-auto px-4 py-5 space-y-5">
              <div className="space-y-3">
                <Link
                  href="/products"
                  className="block text-sm uppercase tracking-[0.12em] text-ink"
                >
                  {t("products")}
                </Link>
                <Link
                  href="/stores"
                  className="block text-sm uppercase tracking-[0.12em] text-ink"
                >
                  {t("stores")}
                </Link>
                <Link
                  href="/faq"
                  className="block text-sm uppercase tracking-[0.12em] text-ink"
                >
                  {t("faq")}
                </Link>
              </div>

              

              <div className="border-t border-line pt-4">
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="text-sm uppercase tracking-[0.12em] text-ink-soft"
                  >
                    {t("logout")}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="text-sm uppercase tracking-[0.12em] text-ink-soft"
                  >
                    {t("login")}
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
