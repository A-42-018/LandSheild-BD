import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import { ShieldArt } from "@/features/landing/Illustrations";

const LIMITS = ["l1", "l2", "l3", "l4"] as const;
const box = "glass-card p-5 sm:p-6";

export default function AboutPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = useTranslations("about");
  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader title={t("title")} purpose={t("intro")} art={<ShieldArt />} />
      <section aria-labelledby="about-purpose" className={box}>
        <h2 id="about-purpose" className="section-title text-xl font-semibold text-ink">
          {t("purpose.title")}
        </h2>
        <p className="mt-3 max-w-[70ch] text-ink-muted">{t("purpose.body")}</p>
      </section>
      <section aria-labelledby="about-limits" className={box}>
        <h2 id="about-limits" className="section-title text-xl font-semibold text-ink">
          {t("limits.title")}
        </h2>
        <ul className="mt-3 max-w-[70ch] list-disc space-y-1 pl-5 text-ink-muted">
          {LIMITS.map((k) => (
            <li key={k}>{t(`limits.${k}`)}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="about-demo" className={box}>
        <h2 id="about-demo" className="section-title text-xl font-semibold text-ink">
          {t("demo.title")}
        </h2>
        <p className="mt-3 max-w-[70ch] text-ink-muted">{t("demo.body")}</p>
      </section>
      <section aria-labelledby="about-notice" className="section-panel p-5 sm:p-6">
        <h2 id="about-notice" className="text-xl font-semibold text-primary">
          {t("notice.title")}
        </h2>
        <p className="mt-2 max-w-[70ch] text-ink">{t("notice.body")}</p>
      </section>
    </article>
  );
}
