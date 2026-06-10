"use client";

import { useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";
import { CurrencyProvider } from "@/lib/currency";
import { CartProvider } from "@/lib/cart";
import Header from "./header";
import Footer from "./footer";

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
      <Footer />
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
