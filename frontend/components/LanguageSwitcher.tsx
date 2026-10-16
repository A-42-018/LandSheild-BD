"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { en: "English", bn: "বাংলা" };
const SHORT: Record<string, string> = { en: "EN", bn: "BN" };
const STRIP: Record<string, string> = { en: "EN", bn: "বাং" };

export default function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "onBrand" | "strip" }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname(); // locale-less path → switch keeps current path
  const onBrand = variant === "onBrand";
  const strip = variant === "strip";
  // Strip variant (U1.1): a "বাং | EN" pill, Bangla first; the accessible name is still the full language name.
  const locales = strip ? [...routing.locales].sort((a) => (a === "bn" ? -1 : 1)) : routing.locales;

  return (
    <nav
      aria-label={t("language")}
      className={strip ? "inline-flex items-center rounded-full border border-white/35 bg-black/20 p-0.5" : `inline-flex items-center gap-0.5 rounded-lg border p-0.5 ${onBrand ? "border-white/30 bg-white/10" : "border-line bg-surface"}`}
    >
      {locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          lang={l}
          aria-label={LABELS[l]}
          title={LABELS[l]}
          hrefLang={l}
          aria-current={l === locale ? "true" : undefined}
          className={
            strip
              ? "inline-flex min-h-7 min-w-10 items-center justify-center rounded-full px-3 text-[0.8125rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
                (l === locale ? "bg-white text-[#0B3D2C]" : "text-white hover:bg-white/15")
              : "inline-flex min-h-11 min-w-11 items-center justify-center rounded px-2.5 py-1 text-sm font-semibold tracking-wide focus-visible:outline-none focus-visible:ring-2 " +
            (onBrand
              ? "focus-visible:ring-white/70 " +
                (l === locale ? "bg-white text-[rgb(15_61_122)]" : "text-white hover:bg-white/15")
              : "focus-visible:ring-primary/50 " +
                (l === locale ? "bg-primary text-primary-fg" : "text-primary hover:bg-primary-soft"))
          }
        >
          {strip ? STRIP[l] : onBrand ? SHORT[l] : LABELS[l]}
        </Link>
      ))}
    </nav>
  );
}
