import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { contours } from "./Backdrop";

const LINK = "rounded text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline hover:decoration-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const HEAD = "mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gold-strong";
const LIST = "flex flex-col gap-2";

const RINGS = contours([
  { cx: 1180, cy: 60, rings: 8, step: 30, seed: 1.2 },
  { cx: 120, cy: 330, rings: 5, step: 34, seed: 3.4 },
]);

/** Footer (U3, roadmap 4.5 item 5): deep green band matching the header — brand column + 4 link columns, disclaimer strip, meta line. */
export default function Footer() {
  const t = useTranslations();
  return (
    <footer className="header-glass relative mt-12 overflow-hidden border-b-0 shadow-none border-t border-t-gold/55 text-sm text-white/80 print:hidden">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-gold" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMid slice" fill="none">
        <path d={RINGS} stroke="currentColor" strokeOpacity="0.1" />
      </svg>
      <div className="relative mx-auto grid max-w-[75rem] grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div className="col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-md text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.svg" alt="" width={64} height={64} className="h-10 w-10 object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/0.45)]" />
            <span className="font-display text-[1.1rem] font-extrabold uppercase tracking-[0.045em]">{t("common.brand")}</span>
          </Link>
          <p className="mt-3 max-w-xs leading-relaxed text-white/75">{t("footer.tagline")}</p>
          <p className="mt-4 inline-flex items-center rounded-full border border-gold/40 bg-black/20 px-3 py-1 text-xs font-medium text-gold-soft">
            {t("footer.version")}
          </p>
        </div>
        <nav aria-label={t("landing.footerNav")} className="contents">
          <div>
            <p className={HEAD}>{t("footer.services")}</p>
            <ul className={LIST}>
              <li><Link href="/services" className={LINK}>{t("services.title")}</Link></li>
              <li><Link href="/verify" className={LINK}>{t("nav.verify")}</Link></li>
              <li><Link href="/tools" className={LINK}>{t("tools.title")}</Link></li>
              <li><Link href="/map" className={LINK}>{t("nav.map")}</Link></li>
              <li><Link href="/login" className={LINK}>{t("nav.login")}</Link></li>
            </ul>
          </div>
          <div>
            <p className={HEAD}>{t("footer.aboutTitle")}</p>
            <ul className={LIST}>
              <li><Link href="/about" className={LINK}>{t("footer.howItWorks")}</Link></li>
              <li><Link href="/data-sources" className={LINK}>{t("footer.dataSources")}</Link></li>
              <li className="text-white/60">{t("footer.disclaimerShort")}</li>
            </ul>
          </div>
          <div>
            <p className={HEAD}>{t("footer.help")}</p>
            <ul className={LIST}>
              <li><Link href="/faq" className={LINK}>{t("footer.faq")}</Link></li>
              <li><Link href="/feedback" className={LINK}>{t("feedback.title")}</Link></li>
              <li><Link href="/accessibility" className={LINK}>{t("footer.accessibility")}</Link></li>
              <li><Link href="/sitemap" className={LINK}>{t("info.sitemap.title")}</Link></li>
              <li className="text-white/60">{t("footer.contact")}: support@landshield.demo</li>
            </ul>
          </div>
          <div>
            <p className={HEAD}>{t("footer.legal")}</p>
            <ul className={LIST}>
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
  );
}
