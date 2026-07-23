"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";

const SOCIALS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/ghisagiyim/",
    path: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.15 0-3.5.01-4.74.07-.97.04-1.5.21-1.85.34-.46.18-.8.4-1.15.74-.34.35-.56.69-.74 1.15-.13.35-.3.88-.34 1.85-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.04.97.21 1.5.34 1.85.18.46.4.8.74 1.15.35.34.69.56 1.15.74.35.13.88.3 1.85.34 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.97-.04 1.5-.21 1.85-.34.46-.18.8-.4 1.15-.74.34-.35.56-.69.74-1.15.13-.35.3-.88.34-1.85.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.97-.21-1.5-.34-1.85a3.1 3.1 0 0 0-.74-1.15 3.1 3.1 0 0 0-1.15-.74c-.35-.13-.88-.3-1.85-.34-1.24-.06-1.59-.07-4.74-.07Zm0 2.76a5.46 5.46 0 1 1 0 10.92 5.46 5.46 0 0 1 0-10.92Zm0 9a3.54 3.54 0 1 0 0-7.08 3.54 3.54 0 0 0 0 7.08Zm6.95-9.22a1.28 1.28 0 1 1-2.56 0 1.28 1.28 0 0 1 2.56 0Z",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/ghisagiyim",
    path: "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.48h-1.26c-1.24 0-1.63.78-1.63 1.57v1.87h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@ghisagiyim703",
    path: "M21.58 7.19a2.5 2.5 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42A2.5 2.5 0 0 0 2.42 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.5 2.5 0 0 0 1.77-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.81ZM10 15V9l5.2 3-5.2 3Z",
  },
];

export default function Footer() {
  const { t } = useI18n();
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="border-t border-line bg-[#f9f9f9] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Image
              src="/ghisa-logo.jpg"
              alt="GHISA"
              width={2947}
              height={641}
              className="h-6 w-auto"
            />
            <p className="text-sm text-ink-soft leading-relaxed max-w-xs">
              {t("aboutText")}
            </p>
            <div className="flex items-center gap-3 pt-1">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="text-ink-soft hover:text-ink transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="label-eyebrow text-ink mb-4">{t("quickLinks")}</h3>
            <ul className="space-y-2.5 text-sm text-ink-soft">
              <li>
                <Link href="/products" className="hover:text-ink">
                  {t("products")}
                </Link>
              </li>
              <li>
                <Link href="/stores" className="hover:text-ink">
                  {t("stores")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer service */}
          <div>
            <h3 className="label-eyebrow text-ink mb-4">{t("customerService")}</h3>
            <ul className="space-y-2.5 text-sm text-ink-soft">
              <li>
                <Link href="/login" className="hover:text-ink">
                  {t("login")}
                </Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-ink">
                  {t("cart")}
                </Link>
              </li>
              <li>
                <a href="mailto:info@ghisa.com" className="hover:text-ink">
                  info@ghisa.com
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="label-eyebrow text-ink mb-4">{t("newsletter")}</h3>
            <p className="text-sm text-ink-soft mb-4">{t("newsletterText")}</p>
            {subscribed ? (
              <p className="text-sm text-stock">✓ {t("subscribe")}</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubscribed(true);
                }}
                className="flex"
              >
                <input
                  type="email"
                  required
                  placeholder={t("emailPlaceholder")}
                  className="flex-1 min-w-0 border border-line border-r-0 bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                />
                <button
                  type="submit"
                  className="btn-ink px-4 py-2.5 shrink-0"
                >
                  {t("subscribe")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink-soft">
          <p>
            &copy; {new Date().getFullYear()} GHISA. {t("allRights")}
          </p>
          <p className="uppercase tracking-[0.1em]">{t("subtitle")}</p>
        </div>
      </div>
    </footer>
  );
}
