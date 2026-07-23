import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdfkit"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ghisa.com",
        pathname: "/cdn/**",
      },
    ],
  },
};
export default nextConfig;
