import createNextIntlPlugin from "next-intl/plugin";
import { DEFAULT_TILE_URL, securityHeaders } from "./security-headers.mjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      // the worker file itself is never served from a cache, so a new version is picked up on the next visit
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0" }, { key: "Service-Worker-Allowed", value: "/" }] },
      {
        source: "/:path*",
        headers: securityHeaders({
          dev: process.env.NODE_ENV !== "production",
          apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1", // same default as lib/api.ts
          tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL ?? DEFAULT_TILE_URL,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        }),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
