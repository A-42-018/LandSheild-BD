import { useTranslations } from "next-intl";
import { Banknote, Building2, Clock, ListChecks, ListOrdered, type LucideIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { SERVICE_ART } from "@/features/landing/Illustrations";
import { SERVICE_HREF, SERVICE_IDS } from "./services";

const ROWS = ["need", "fee", "time", "office", "apply"] as const;
const ROW_ICON: Record<(typeof ROWS)[number], LucideIcon> = { need: ListChecks, fee: Banknote, time: Clock, office: Building2, apply: ListOrdered };
const ART_OF = { verify: SERVICE_ART.verify, check: SERVICE_ART.check, track: SERVICE_ART.track, verifyDoc: SERVICE_ART.verifyDoc } as const;

/** Citizen charter: per service, what is needed, the fee, the time limit, the responsible office and how to apply. */
export default function ServicesPage() {
  const t = useTranslations("services");
  const list = (id: string, key: string) => Object.values(t.raw(`items.${id}.${key}`) as Record<string, string>);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader title={t("title")} purpose={t("purpose")} meta={[t("updated")]} />
      <p className="glass-card border-l-[3px] border-l-review p-3 text-sm text-ink">{t("notice")}</p>
      {SERVICE_IDS.map((id) => {
        const Art = ART_OF[id as keyof typeof ART_OF];
        return (
          <section key={id} aria-labelledby={`svc-${id}`} className="glass-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`svc-${id}`} className="section-title text-xl font-semibold text-ink">{t(`items.${id}.title`)}</h2>
                <p className="mt-3 text-ink-muted">{t(`items.${id}.who`)}</p>
              </div>
              {Art && <span aria-hidden="true" className="hidden shrink-0 sm:block [&>svg]:h-20 [&>svg]:w-auto"><Art /></span>}
            </div>
            <dl className="mt-5 grid gap-3 md:grid-cols-2">
              {ROWS.map((r) => {
                const Icon = ROW_ICON[r];
                return (
                  <div key={r} className={`rounded-xl border border-line/70 bg-surface/60 p-4`}>
                    <dt className="flex items-center gap-2 font-medium text-ink">
                      <span aria-hidden="true" className="icon-tile !h-8 !w-8 !rounded-lg"><Icon className="h-4 w-4" /></span>
                      {t(`rows.${r}`)}
                    </dt>
                    <dd className="mt-2 text-ink-muted">
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
                );
              })}
            </dl>
            <p className="mt-5">
              <Link href={SERVICE_HREF[id]} className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 py-2 font-medium text-primary-fg shadow-[0_6px_16px_-6px_rgb(var(--primary)/0.55)] hover:bg-primary-hover">
                {t("open")}
              </Link>
            </p>
          </section>
        );
      })}
    </div>
  );
}
