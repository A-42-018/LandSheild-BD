import type { MetadataRoute } from "next";
import { BRAND_COLOR } from "@/lib/theme";
import { routing } from "@/i18n/routing";

/** U5.2: makes the site installable. Starts on the Bangla home page (the default language); the service worker (public/sw.js) keeps the guide pages readable offline. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ল্যান্ডশিল্ড বিডি — LandShield BD",
    short_name: "ল্যান্ডশিল্ড",
    description: "জমি কেনার আগে যাচাই করুন — ডেমো তথ্য, সরকারি রেকর্ড নয়।",
    lang: routing.defaultLocale,
    dir: "ltr",
    id: `/${routing.defaultLocale}`,
    start_url: `/${routing.defaultLocale}`,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: BRAND_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "জমি যাচাই", url: `/${routing.defaultLocale}/verify` },
      { name: "সেবার গাইড", url: `/${routing.defaultLocale}/guide` },
    ],
  };
}
