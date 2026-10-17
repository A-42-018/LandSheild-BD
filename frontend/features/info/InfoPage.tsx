import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PageHeader from "@/components/PageHeader";
import { ShieldArt } from "@/features/landing/Illustrations";
import FaqList from "./FaqList";
import { FAQ_IDS, INFO_PAGES, SITEMAP_GROUPS, type InfoSlug } from "./pages";

const SECTION = "glass-card p-5 sm:p-6";
const LINK = "inline-flex min-h-11 items-center text-link underline underline-offset-2";

function Header({ ns }: { ns: string }) {
  const t = useTranslations("info");
  return (
    <PageHeader
      title={t(`${ns}.title`)}
      purpose={t(`${ns}.purpose`)}
      art={<ShieldArt />}
      meta={[t("updated", { date: t("updatedDate") })]}
    />
  );
}

export function TextPage({ slug }: { slug: InfoSlug }) {
  const { ns, sections } = INFO_PAGES[slug];
  const t = useTranslations(`info.${ns}`);
  const tp = useTranslations("page");
  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-5">
      <Header ns={ns} />
      <div className="xl:grid xl:grid-cols-[14rem_minmax(0,1fr)] xl:gap-8">
        <nav aria-label={tp("onThisPage")} className="sticky top-24 hidden self-start xl:block">
          <ol className="flex flex-col gap-1 border-l-2 border-line text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${ns}-${s.id}`} className="-ml-0.5 block border-l-2 border-transparent py-1 pl-3 text-ink-muted hover:border-gold hover:text-ink">{t(`${s.id}.title`)}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex max-w-[70ch] flex-col gap-4">
          {sections.map((s) => (
            <section key={s.id} id={`${ns}-${s.id}`} aria-labelledby={`${ns}-${s.id}-h`} className={SECTION}>
              <h2 id={`${ns}-${s.id}-h`} className="section-title text-xl font-semibold text-ink">{t(`${s.id}.title`)}</h2>
              <p className="mt-3 text-ink-muted">{t(`${s.id}.body`)}</p>
              {"list" in s && s.list && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
                  {Object.values(t.raw(`${s.id}.items`) as Record<string, string>).map((x) => <li key={x}>{x}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

export function FaqPage() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <Header ns="faq" />
      <FaqList ids={FAQ_IDS} />
    </article>
  );
}

export function SitemapPage() {
  const t = useTranslations();
  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-5">
      <Header ns="sitemap" />
      <div className="grid gap-4 sm:grid-cols-2">
        {SITEMAP_GROUPS.map((g) => (
          <section key={g.id} aria-labelledby={`sitemap-${g.id}`} className={SECTION}>
            <h2 id={`sitemap-${g.id}`} className="section-title text-xl font-semibold text-ink">{t(`info.sitemap.groups.${g.id}`)}</h2>
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
