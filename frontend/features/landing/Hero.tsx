import { useTranslations } from "next-intl";

/** Service-first hero: H1 and one-line sub only. The "Online services" cards right below are the way in, so no buttons or form here.
 *  The topographic backdrop behind it is rendered by the page (Backdrop). */
export default function Hero() {
  const t = useTranslations();
  return (
    <section aria-labelledby="hero-title" className="pb-10 pt-6 sm:pb-14 sm:pt-12">
      <h1 id="hero-title" className="max-w-3xl text-[2rem] font-bold leading-tight tracking-tight text-ink sm:text-[2.6rem]">
        {t("home.title")}
      </h1>
      <p className="mt-3 max-w-3xl text-[1.0625rem] leading-relaxed text-ink-muted">{t("home.intro")}</p>
    </section>
  );
}
