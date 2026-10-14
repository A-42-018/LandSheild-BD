import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const LINK = "rounded text-white/90 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const HEAD = "mb-2 font-semibold text-white";

/** Footer (U3, roadmap 4.5 item 5): dark band, 4 columns.  */
export default function Footer() {
  const t = useTranslations();
  return (
    <footer className="mt-8 border-t-2 border-accent bg-strip text-sm text-white/90 print:hidden">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <nav aria-label={t("landing.footerNav")} className="contents">
          <div>
            <p className={HEAD}>{t("footer.services")}</p>
            <ul className="flex flex-col gap-1.5">
              <li><Link href="/services" className={LINK}>{t("services.title")}</Link></li>
              <li><Link href="/verify" className={LINK}>{t("nav.verify")}</Link></li>
              <li><Link href="/tools" className={LINK}>{t("tools.title")}</Link></li>
              <li><Link href="/map" className={LINK}>{t("nav.map")}</Link></li>
              <li><Link href="/login" className={LINK}>{t("nav.login")}</Link></li>
            </ul>
          </div>
          <div>
            <p className={HEAD}>{t("footer.aboutTitle")}</p>
            <ul className="flex flex-col gap-1.5">
              <li><Link href="/about" className={LINK}>{t("footer.howItWorks")}</Link></li>
              <li><Link href="/data-sources" className={LINK}>{t("footer.dataSources")}</Link></li>
              <li>{t("footer.disclaimerShort")}</li>
            </ul>
          </div>
          <div>
            <p className={HEAD}>{t("footer.help")}</p>
            <ul className="flex flex-col gap-1.5">
              <li><Link href="/faq" className={LINK}>{t("footer.faq")}</Link></li>
              <li><Link href="/feedback" className={LINK}>{t("feedback.title")}</Link></li>
              <li><Link href="/accessibility" className={LINK}>{t("footer.accessibility")}</Link></li>
              <li><Link href="/sitemap" className={LINK}>{t("info.sitemap.title")}</Link></li>
              <li>{t("footer.contact")}: support@landshield.demo</li>
            </ul>
          </div>
          <div>
            <p className={HEAD}>{t("footer.legal")}</p>
            <ul className="flex flex-col gap-1.5">
              <li><Link href="/privacy" className={LINK}>{t("footer.privacy")}</Link></li>
              <li><Link href="/terms" className={LINK}>{t("footer.terms")}</Link></li>
              <li>{t("footer.licence")}</li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="mx-auto max-w-[1200px] px-4 pb-4">
        <p>{t("landing.disclaimer")}</p>
      </div>
      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
          <p>
            {t("common.demoLabel")} · {t("footer.version")} · {t("footer.updated")}
          </p>
          <ThemeToggle variant="onBrand" />
        </div>
      </div>
    </footer>
  );
}
