import type { Metadata, Viewport } from "next";
import { Fraunces, Jost } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  fallback: ["Georgia", "serif"],
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  weight: ["300", "400", "500", "600"],
  display: "swap",
  fallback: ["system-ui", "Helvetica Neue", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "GHISA Toptan",
  description: "GHISA Toptan Satis Portali",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`h-full ${fraunces.variable} ${jost.variable}`}>
      <body className="min-h-full flex flex-col antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
