import { useTranslations } from "next-intl";

const KEYS = ["fields", "languages", "steps", "parcels"] as const;

export default function Stats() {
  const t = useTranslations("landing.stats");
  return (
    <section aria-label={t("title")} className="mt-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KEYS.map((k) => (
          <li key={k} data-testid="stat" className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-3xl font-bold text-primary">{t(`${k}.value`)}</p>
            <p className="mt-1 text-sm text-ink-muted">{t(`${k}.label`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
