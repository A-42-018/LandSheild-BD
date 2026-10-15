"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { en: "English", bn: "বাংলা" };
const SHORT: Record<string, string> = { en: "EN", bn: "BN" };

export default function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "onBrand" | "strip" | "header" }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname(); // locale-less path → switch keeps current path
  const onBrand = variant === "onBrand";
  const strip = variant === "strip";
  const header = variant === "header";
  // Strip variant (U3): বাংলা first, then English, full names visible.
  const locales = strip ? [...routing.locales].sort((a) => (a === "bn" ? -1 : 1)) : routing.locales;

  return (
    <nav
      aria-label={t("language")}
      className={header ? "inline-flex h-10 items-center gap-0.5 rounded-lg border border-white/30 bg-white/10 p-0.5" : strip ? "inline-flex items-center gap-1" : `inline-flex items-center gap-0.5 rounded-lg border p-0.5 ${onBrand ? "border-white/30 bg-white/10" : "border-line bg-surface"}`}
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
            header
              ? "inline-flex h-full min-w-9 items-center justify-center rounded-md px-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
                (l === locale ? "bg-white text-primary" : "text-white hover:bg-white/15")
              : strip
              ? "inline-flex min-h-8 items-center rounded px-2 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
                (l === locale ? "bg-white/20 text-white underline underline-offset-4" : "text-white/90 hover:text-white")
              : "inline-flex min-h-11 min-w-11 items-center justify-center rounded px-2.5 py-1 text-sm font-semibold tracking-wide focus-visible:outline-none focus-visible:ring-2 " +
            (onBrand
              ? "focus-visible:ring-white/70 " +
                (l === locale ? "bg-white text-[rgb(15_61_122)]" : "text-white hover:bg-white/15")
              : "focus-visible:ring-primary/50 " +
                (l === locale ? "bg-primary text-primary-fg" : "text-primary hover:bg-primary-soft"))
          }
        >
          {onBrand || header ? SHORT[l] : LABELS[l]}
        </Link>
      ))}
    </nav>
  );
}
