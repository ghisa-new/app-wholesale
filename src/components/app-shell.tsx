"use client";

import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { CurrencyProvider } from "@/lib/currency";
import { CartProvider } from "@/lib/cart";
import Header from "./header";

interface User {
  id: number;
  email: string;
  name: string;
  company: string;
  phone: string;
  role: string;
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {
        // Not logged in, that's fine for browsing
      });
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <Header user={user} onLogout={() => setUser(null)} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-lg font-bold text-gray-900 tracking-wider">
              GHISA
            </p>
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Ghisa. {t("subtitle")}.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <CurrencyProvider>
        <CartProvider>
          <ShellContent>{children}</ShellContent>
        </CartProvider>
      </CurrencyProvider>
    </I18nProvider>
  );
}
