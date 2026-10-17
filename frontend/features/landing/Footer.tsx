import { Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { HOTLINE } from "@/features/help/help";
import { Link } from "@/i18n/navigation";
import { localDigits } from "@/lib/intl-locale";
import { contours } from "./Backdrop";
import SkylineStrip from "./SkylineStrip";

const LINK = "rounded text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline hover:decoration-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const HEAD = "mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gold-strong";
const LIST = "flex flex-col gap-2";

const SUPPORT_EMAIL = "support@landshield.demo";

const RINGS = contours([
  { cx: 1180, cy: 60, rings: 8, step: 30, seed: 1.2 },
  { cx: 120, cy: 330, rings: 5, step: 34, seed: 3.4 },
]);

/** Footer (U1.7, roadmap P11): village → city strip on top (U1.8), brand row, then the five standard columns. "Planned and built by" holds the demo-project note instead of ministry credits; no app or social links exist, so those columns say so or point to real contact routes. */
export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <>
    <SkylineStrip />
    <footer className="header-glass relative overflow-hidden border-b-0 shadow-none border-t border-t-gold/55 text-sm text-white/80 print:hidden">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-gold" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMid slice" fill="none">
        <path d={RINGS} stroke="currentColor" strokeOpacity="0.1" />
      </svg>
      <div className="relative mx-auto max-w-[75rem] px-4 pb-4 pt-10">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/" className="inline-flex min-h-touch items-center gap-2.5 rounded-md text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.svg" alt="" width={64} height={64} className="h-10 w-10 object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/0.45)]" />
            <span className="font-display text-[1.1rem] font-extrabold uppercase tracking-[0.045em]">{t("common.brand")}</span>
          </Link>
          <p className="max-w-md leading-relaxed text-white/75">{t("footer.tagline")}</p>
          <p className="inline-flex items-center rounded-full border border-gold/40 bg-black/20 px-3 py-1 text-xs font-medium text-gold-soft">
            {t("footer.version")}
          </p>
        </div>
        <nav aria-label={t("landing.footerNav")} className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-5">
          <div>
            <p className={HEAD}>{t("footer.importantLinks")}</p>
            <ul className={LIST}>
              <li><Link href="/services" className={LINK}>{t("services.title")}</Link></li>
              <li><Link href="/verify" className={LINK}>{t("nav.verify")}</Link></li>
              <li><Link href="/track" className={LINK}>{t("nav.track")}</Link></li>
              <li><Link href="/map" className={LINK}>{t("nav.map")}</Link></li>
              <li><Link href="/tools" className={LINK}>{t("tools.title")}</Link></li>
              <li><Link href="/guide" className={LINK}>{t("nav.guide")}</Link></li>
              <li><Link href="/faq" className={LINK}>{t("footer.faq")}</Link></li>
              <li><Link href="/sitemap" className={LINK}>{t("info.sitemap.title")}</Link></li>
            </ul>
          </div>
          <div>
            <p className={HEAD}>{t("footer.planning")}</p>
            <p data-testid="footer-demo-note" className="font-semibold text-gold-soft">{t("footer.demoProject")}</p>
            <p className="mt-1 leading-relaxed text-white/75">{t("footer.demoNote")}</p>
            <ul className={`${LIST} mt-3`}>
              <li><Link href="/about" className={LINK}>{t("footer.howItWorks")}</Link></li>
              <li><Link href="/data-sources" className={LINK}>{t("footer.dataSources")}</Link></li>
              <li><Link href="/statistics" className={LINK}>{t("statistics.title")}</Link></li>
            </ul>
          </div>
          <div>
            <p className={HEAD}>{t("footer.apps")}</p>
            <p className="leading-relaxed text-white/75">{t("footer.appsNote")}</p>
          </div>
          <div>
            <p className={HEAD}>{t("footer.contactTitle")}</p>
            <ul className={LIST}>
              <li>
                <a href={`tel:${HOTLINE}`} data-testid="footer-hotline" className={LINK}>
                  {t("footer.hotline")}: {localDigits(HOTLINE, locale)}
                </a>
              </li>
              <li><Link href="/feedback" className={LINK}>{t("feedback.title")}</Link></li>
              <li><Link href="/login" className={LINK}>{t("nav.login")}</Link></li>
            </ul>
          </div>
          <div>
            <p className={HEAD}>{t("footer.techSupport")}</p>
            <ul className={LIST}>
              <li><a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>{SUPPORT_EMAIL}</a></li>
              <li><Link href="/accessibility" className={LINK}>{t("footer.accessibility")}</Link></li>
              <li><Link href="/privacy" className={LINK}>{t("footer.privacy")}</Link></li>
              <li><Link href="/terms" className={LINK}>{t("footer.terms")}</Link></li>
              <li className="text-white/60">{t("footer.licence")}</li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="relative mx-auto max-w-[75rem] px-4 pb-6">
        <p className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 leading-relaxed text-white/80 backdrop-blur-sm">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold-strong" />
          <span>{t("landing.disclaimer")}</span>
        </p>
      </div>
      <div className="relative border-t border-gold/25 bg-black/20">
        <div className="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-white/60">
          <p>
            {t("common.demoLabel")} · {t("footer.updated")}
          </p>
        </div>
      </div>
    </footer>
    </>
  );
}
