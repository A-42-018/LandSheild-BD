import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const LINK = "rounded hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

export default function Footer() {
  const t = useTranslations();
  return (
    <footer className="mt-8 border-t-4 border-primary bg-brand-gradient-soft text-sm text-ink-muted print:hidden">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[2fr_1fr_1fr_2fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 text-lg font-bold text-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.png" alt="" width={820} height={608} className="h-10 w-auto object-contain drop-shadow" />
            <span>{t("common.appName")}</span>
          </div>
          <p>{t("footer.tagline")}</p>
        </div>
        <nav aria-label={t("landing.footerNav")} className="contents">
          <div>
            <p className="mb-2 font-semibold text-ink">{t("footer.explore")}</p>
            <ul className="flex flex-col gap-1.5">
              <li><Link href="/about" className={LINK}>{t("nav.about")}</Link></li>
              <li><Link href="/verify" className={LINK}>{t("nav.verify")}</Link></li>
              <li><Link href="/map" className={LINK}>{t("nav.map")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-semibold text-ink">{t("footer.account")}</p>
            <ul className="flex flex-col gap-1.5">
              <li><Link href="/login" className={LINK}>{t("nav.login")}</Link></li>
            </ul>
          </div>
        </nav>
        <div>
          <p className="mb-2 font-semibold text-ink">{t("footer.notice")}</p>
          <p>{t("landing.disclaimer")}</p>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-3 text-xs">{t("common.demoLabel")}</p>
      </div>
    </footer>
  );
}
