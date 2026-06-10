"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { FAQS } from "@/lib/faq";

export default function FaqPage() {
  const { t, locale } = useI18n();
  const items = FAQS[locale] ?? FAQS.tr;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div>
      {/* Page header */}
      <section className="border-b border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
          <p className="label-eyebrow text-ink-soft mb-3">GHISA</p>
          <h1 className="text-3xl md:text-4xl text-ink">{t("faqTitle")}</h1>
          <p className="text-ink-soft mt-3 max-w-xl mx-auto">
            {t("faqSubtitle")}
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="border-t border-line">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-b border-line">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 py-5 text-start"
                >
                  <span className="text-base font-medium text-ink">
                    {item.q}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className={`w-4 h-4 shrink-0 text-ink-soft transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>
                <div
                  className={`grid transition-all duration-200 ease-out ${
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm text-ink-soft leading-relaxed pb-5 max-w-2xl">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <div className="mt-10 border border-line bg-card p-8 text-center">
          <h2 className="text-xl text-ink">{t("faqMoreTitle")}</h2>
          <p className="text-ink-soft mt-2 text-sm">{t("faqMoreText")}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a href="mailto:info@ghisa.com" className="btn-ink px-6 py-3">
              info@ghisa.com
            </a>
            <Link
              href="/stores"
              className="px-6 py-3 text-xs uppercase tracking-[0.1em] border border-ink text-ink hover:bg-ink hover:text-white transition-colors"
            >
              {t("stores")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
