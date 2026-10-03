import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import HeroActions from "./HeroActions";

/**
 * UD10 sketch: left = header card (title + intro) with the two actions underneath;
 * right = a large icon card holding the logo.
 */
export default function Hero() {
  const t = useTranslations();
  return (
    <section aria-labelledby="hero-title" className="space-y-6">
      <div className="grid items-stretch gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <div className="flex-1 overflow-hidden rounded-2xl border border-line bg-brand-gradient-soft px-5 py-8 shadow-raised sm:px-8 sm:py-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold text-primary">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              {t("common.tagline")}
            </p>
            <h1 id="hero-title" className="mt-4 text-3xl font-bold text-primary sm:text-4xl lg:text-5xl">
              {t("home.title")}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-ink-muted sm:text-lg">{t("home.intro")}</p>
          </div>
          <HeroActions />
        </div>
        {/* Transparent artwork on a theme-aware card: no white box in dark mode. */}
        <div className="flex items-center justify-center rounded-2xl border border-line bg-surface p-8 shadow-raised">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-full.png" alt="" width={820} height={695} className="h-auto w-full max-w-[22rem] drop-shadow-xl" />
        </div>
      </div>
      <p className="max-w-3xl rounded-md border border-line bg-surface p-3 text-sm text-ink-muted">
        <span className="font-semibold text-ink">{t("landing.disclaimerTitle")}: </span>
        {t("landing.disclaimer")}
      </p>
    </section>
  );
}
