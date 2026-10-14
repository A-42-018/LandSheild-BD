import { useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { SERVICE_HREF, SERVICE_IDS } from "./services";

const ROWS = ["need", "fee", "time", "office", "apply"] as const;

/** Citizen charter: per service, what is needed, the fee, the time limit, the responsible office and how to apply. */
export default function ServicesPage() {
  const t = useTranslations("services");
  const list = (id: string, key: string) => Object.values(t.raw(`items.${id}.${key}`) as Record<string, string>);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("title")} purpose={t("purpose")} meta={[t("updated")]} />
      <p className="max-w-3xl rounded-md border border-line bg-surface-muted p-3 text-sm text-ink-muted">{t("notice")}</p>
      {SERVICE_IDS.map((id) => (
        <section key={id} aria-labelledby={`svc-${id}`} className="rounded-xl border border-line bg-surface p-6 shadow-card">
          <h2 id={`svc-${id}`} className="text-xl font-semibold text-ink">{t(`items.${id}.title`)}</h2>
          <p className="mt-1 text-ink-muted">{t(`items.${id}.who`)}</p>
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
            {ROWS.map((r) => (
              <div key={r} className="contents">
                <dt className="font-medium text-ink">{t(`rows.${r}`)}</dt>
                <dd className="text-ink-muted">
                  {r === "need" || r === "apply" ? (
                    r === "apply" ? (
                      <ol className="list-decimal space-y-1 pl-5">{list(id, r).map((x) => <li key={x}>{x}</li>)}</ol>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5">{list(id, r).map((x) => <li key={x}>{x}</li>)}</ul>
                    )
                  ) : (
                    t(`items.${id}.${r}`)
                  )}
                  {r === "fee" && (
                    <> <Link href="/tools/fees" className="text-link underline underline-offset-2">{t("feeLink")}</Link></>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4">
            <Link href={SERVICE_HREF[id]} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-fg hover:bg-primary-hover">
              {t("open")}
            </Link>
          </p>
        </section>
      ))}
    </div>
  );
}
