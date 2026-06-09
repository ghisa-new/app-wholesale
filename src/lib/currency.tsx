"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type CurrencyCode = "TRY" | "USD";

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  formatPrice: (amount: number) => string;
  convertPrice: (tryAmount: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Approximate TRY->USD rate
const TRY_TO_USD = 0.026;

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("wholesale_currency") as CurrencyCode) || "TRY";
    }
    return "TRY";
  });

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem("wholesale_currency", c);
  }, []);

  const convertPrice = useCallback(
    (tryAmount: number) => {
      if (currency === "USD") return tryAmount * TRY_TO_USD;
      return tryAmount;
    },
    [currency]
  );

  const formatPrice = useCallback(
    (tryAmount: number) => {
      const amount = currency === "USD" ? tryAmount * TRY_TO_USD : tryAmount;
      if (currency === "USD") {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
      }
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
      }).format(amount);
    },
    [currency]
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, formatPrice, convertPrice }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
