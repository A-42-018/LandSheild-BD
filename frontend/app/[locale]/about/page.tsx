import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

const LIMITS = ["l1", "l2", "l3", "l4"] as const;
const box = "mt-6 rounded-xl border border-line bg-surface p-6 shadow-card";

export default function AboutPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = useTranslations("about");
  const tc = useTranslations("common");
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
      <p className="mt-2 text-ink-muted">{t("intro")}</p>
      <figure className="mt-6 overflow-hidden rounded-xl border border-line bg-white shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-new.jpg"
          alt={tc("appName")}
          width={1408}
          height={768}
          className="mx-auto h-auto w-full max-w-xl"
        />
      </figure>
      <section aria-labelledby="about-purpose" className={box}>
        <h2 id="about-purpose" className="text-xl font-semibold text-ink">
          {t("purpose.title")}
        </h2>
        <p className="mt-2 text-ink-muted">{t("purpose.body")}</p>
      </section>
      <section aria-labelledby="about-limits" className={box}>
        <h2 id="about-limits" className="text-xl font-semibold text-ink">
          {t("limits.title")}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
          {LIMITS.map((k) => (
            <li key={k}>{t(`limits.${k}`)}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="about-demo" className={box}>
        <h2 id="about-demo" className="text-xl font-semibold text-ink">
          {t("demo.title")}
        </h2>
        <p className="mt-2 text-ink-muted">{t("demo.body")}</p>
      </section>
      <section
        aria-labelledby="about-notice"
        className="mt-6 rounded-xl border border-line bg-primary-soft p-6"
      >
        <h2 id="about-notice" className="text-xl font-semibold text-primary">
          {t("notice.title")}
        </h2>
        <p className="mt-2 text-ink">{t("notice.body")}</p>
      </section>
    </article>
  );
}
