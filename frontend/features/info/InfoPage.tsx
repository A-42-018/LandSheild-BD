import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PageHeader from "@/components/PageHeader";
import { FAQ_IDS, INFO_PAGES, SITEMAP_GROUPS, type InfoSlug } from "./pages";

const SECTION = "rounded-xl border border-line bg-surface p-6 shadow-card";
const LINK = "inline-flex min-h-11 items-center text-link underline underline-offset-2";

function Header({ ns }: { ns: string }) {
  const t = useTranslations("info");
  return (
    <PageHeader
      title={t(`${ns}.title`)}
      purpose={t(`${ns}.purpose`)}
      meta={[t("updated", { date: t("updatedDate") })]}
    />
  );
}

export function TextPage({ slug }: { slug: InfoSlug }) {
  const { ns, sections } = INFO_PAGES[slug];
  const t = useTranslations(`info.${ns}`);
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Header ns={ns} />
      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`${ns}-${s.id}`} className={SECTION}>
          <h2 id={`${ns}-${s.id}`} className="text-xl font-semibold text-ink">{t(`${s.id}.title`)}</h2>
          <p className="mt-2 text-ink-muted">{t(`${s.id}.body`)}</p>
          {"list" in s && s.list && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
              {Object.values(t.raw(`${s.id}.items`) as Record<string, string>).map((x) => <li key={x}>{x}</li>)}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}

export function FaqPage() {
  const t = useTranslations("info.faq");
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Header ns="faq" />
      <div className="flex flex-col gap-2">
        {FAQ_IDS.map((id) => (
          <details key={id} className="group rounded-xl border border-line bg-surface shadow-card">
            <summary className="flex min-h-11 cursor-pointer items-center px-5 py-3 font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
              {t(`${id}.q`)}
            </summary>
            <p className="px-5 pb-4 text-ink-muted">{t(`${id}.a`)}</p>
          </details>
        ))}
      </div>
    </article>
  );
}

export function SitemapPage() {
  const t = useTranslations();
  return (
    <article className="flex flex-col gap-4">
      <Header ns="sitemap" />
      <div className="grid gap-4 sm:grid-cols-2">
        {SITEMAP_GROUPS.map((g) => (
          <section key={g.id} aria-labelledby={`sitemap-${g.id}`} className={SECTION}>
            <h2 id={`sitemap-${g.id}`} className="text-xl font-semibold text-ink">{t(`info.sitemap.groups.${g.id}`)}</h2>
            <ul className="mt-2 flex flex-col">
              {g.links.map(([href, key]) => (
                <li key={href}>
                  <Link href={href} className={LINK}>{t(key)}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-sm text-ink-muted">{t("info.sitemap.officerNote")}</p>
    </article>
  );
}
