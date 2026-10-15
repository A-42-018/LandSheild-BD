import { useTranslations } from "next-intl";

/** Service-first hero: H1 and one-line sub only. The "Online services" tiles right below are the way in, so no buttons or form here. */
export default function Hero() {
  const t = useTranslations();
  return (
    <section aria-labelledby="hero-title" className="-mt-8 py-8 sm:py-12">
      <h1 id="hero-title" className="text-[1.875rem] font-bold leading-tight text-ink sm:text-[2rem]">
        {t("home.title")}
      </h1>
      <p className="mt-2 max-w-3xl text-ink-muted">{t("home.intro")}</p>
    </section>
  );
}
