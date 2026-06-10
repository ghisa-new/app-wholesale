"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type CurrencyCode = "TRY" | "USD";

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  formatPrice: (amount: number) => string;
  convertPrice: (tryAmount: number) => number;
  rate: number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Fallback TRY->USD multiplier, used until the live rate loads (or if it fails).
const FALLBACK_TRY_TO_USD = 0.026;

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("wholesale_currency") as CurrencyCode) || "TRY";
    }
    return "TRY";
  });

  // Live TRY->USD rate, fetched from /api/exchange-rate (open.er-api.com).
  const [rate, setRate] = useState<number>(FALLBACK_TRY_TO_USD);

  useEffect(() => {
    let active = true;
    fetch("/api/exchange-rate")
      .then((res) => res.json())
      .then((data) => {
        if (active && typeof data?.rate === "number" && data.rate > 0) {
          setRate(data.rate);
        }
      })
      .catch(() => {
        // keep fallback rate
      });
    return () => {
      active = false;
    };
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem("wholesale_currency", c);
  }, []);

  const convertPrice = useCallback(
    (tryAmount: number) => {
      if (currency === "USD") return tryAmount * rate;
      return tryAmount;
    },
    [currency, rate]
  );

  const formatPrice = useCallback(
    (tryAmount: number) => {
      const amount = currency === "USD" ? tryAmount * rate : tryAmount;
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
    [currency, rate]
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, formatPrice, convertPrice, rate }}
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
