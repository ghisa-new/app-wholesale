"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Store } from "@/lib/stores";

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-4 h-4 shrink-0 mt-0.5 text-ink"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-4 h-4 shrink-0 mt-0.5 text-ink"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-4 h-4 shrink-0 mt-0.5 text-ink"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

export default function StoresPage() {
  const { t } = useI18n();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<string>("");

  useEffect(() => {
    fetch("/api/stores")
      .then((res) => res.json())
      .then((data) => setStores(data.stores || []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stores) {
      if (!s.city) continue;
      counts.set(s.city, (counts.get(s.city) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
      .map(([name]) => name);
  }, [stores]);

  const filtered = useMemo(
    () => (city ? stores.filter((s) => s.city === city) : stores),
    [stores, city]
  );

  return (
    <div>
      {/* Page header */}
      <section className="border-b border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
          <p className="label-eyebrow text-ink-soft mb-3">GHISA</p>
          <h1 className="text-3xl md:text-4xl text-ink">{t("storesTitle")}</h1>
          <p className="text-ink-soft mt-3 max-w-xl mx-auto">
            {t("storesSubtitle")}
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* City filter */}
        {cities.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            <button
              onClick={() => setCity("")}
              className={`px-4 py-2 text-xs uppercase tracking-[0.1em] border transition-colors ${
                !city
                  ? "border-ink bg-ink text-white"
                  : "border-line text-ink-soft hover:border-ink"
              }`}
            >
              {t("allCities")}
            </button>
            {cities.map((c) => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className={`px-4 py-2 text-xs uppercase tracking-[0.1em] border transition-colors ${
                  city === c
                    ? "border-ink bg-ink text-white"
                    : "border-line text-ink-soft hover:border-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-center text-ink-soft py-12">{t("loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-ink-soft py-12">{t("noStores")}</p>
        ) : (
          <>
            <p className="text-sm text-ink-soft mb-4 text-center">
              {filtered.length} {t("storesWord")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filtered.map((store) => (
                <div
                  key={store.handle}
                  className="border border-line bg-card hover:bg-white hover:shadow-md transition-all p-6 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-medium uppercase tracking-wide text-ink leading-snug">
                      {store.name}
                    </h2>
                    {store.city && (
                      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-soft border border-line px-2 py-1 shrink-0">
                        {store.city}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-ink-soft flex-1">
                    {store.address && (
                      <div className="flex gap-2.5">
                        <PinIcon />
                        <span>{store.address}</span>
                      </div>
                    )}
                    {store.phone && (
                      <div className="flex gap-2.5">
                        <PhoneIcon />
                        <a
                          href={`tel:${store.phone.replace(/\s/g, "")}`}
                          className="hover:text-ink"
                          dir="ltr"
                        >
                          {store.phone}
                        </a>
                      </div>
                    )}
                    {store.hours && (
                      <div className="flex gap-2.5">
                        <ClockIcon />
                        <span className="whitespace-pre-line">{store.hours}</span>
                      </div>
                    )}
                  </div>

                  <a
                    href={store.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ink mt-5 px-5 py-2.5 self-start"
                  >
                    {t("viewOnMap")}
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
