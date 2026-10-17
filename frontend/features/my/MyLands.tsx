"use client";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Contact, Landmark, Ruler, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import PageHeader from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState, Tabs } from "@/components/ui";
import { formatDate, localDigits } from "@/lib/intl-locale";
import { ParcelLine, resultHref } from "./parts";
import type { MyLand } from "./types";
import { useMyLands } from "./useMy";

const OPEN_LINK =
  "inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-primary px-3 text-sm font-medium text-primary hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

function useArea() {
  const t = useTranslations("result.units");
  const locale = useLocale();
  return (value: number, unit: string) => `${localDigits(Number(value.toFixed(2)), locale)} ${t.has(unit) ? t(unit) : unit}`;
}

function LandCards({ items, testId, past }: { items: MyLand[]; testId: string; past?: boolean }) {
  const t = useTranslations("my.lands");
  const locale = useLocale();
  const area = useArea();
  const date = (iso: string | null) => formatDate(iso, locale, t("unknownDate"));
  return (
    <ul data-testid={testId} className="flex flex-col gap-3">
      {items.map((l) => (
        <li key={`${l.land_id}-${l.since ?? ""}`} className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <ParcelLine p={l} />
            <p className="mt-1 text-sm text-ink-muted">
              {t("area", { area: area(l.area, l.area_unit) })} ·{" "}
              {past ? t("held", { from: date(l.since), to: date(l.until) }) : t("since", { date: date(l.since) })}
            </p>
          </div>
          <Link href={resultHref(l.land_id)} className={OPEN_LINK}>
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            {t("open")}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "আমার জমি": the land recorded under the citizen's own linked NID. Nobody else can open this list. */
export default function MyLands() {
  const t = useTranslations("my.lands");
  const tn = useTranslations("my.nav");
  const locale = useLocale();
  const q = useMyLands();
  const d = q.data;

  const stats: { label: string; value: string; Icon: LucideIcon; testId: string }[] = d?.nid.registered
    ? [
        { label: t("statCount"), value: localDigits(d.total_current, locale), Icon: Landmark, testId: "my-land-count" },
        {
          label: t("statArea"),
          value: d.total_area_decimal == null ? t("areaMixed") : t("areaDecimal", { area: localDigits(d.total_area_decimal, locale) }),
          Icon: Ruler,
          testId: "my-land-area",
        },
        { label: t("statNid"), value: `•••• ${localDigits(d.nid.last4 ?? "", locale)}`, Icon: Contact, testId: "my-land-nid" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader variant="plain" title={t("title")} purpose={t("purpose")} crumbs={[{ label: tn("dashboard"), href: "/my" }]} />
      {q.isPending ? (
        <LoadingState />
      ) : q.isError || !d ? (
        <ErrorState error={q.error} message={t("loadError")} onRetry={() => void q.refetch()} />
      ) : !d.nid.registered ? (
        <EmptyState
          title={t("needNid")}
          description={t("needNidHint")}
          action={<Link href="/my/profile#nid" className={OPEN_LINK}>{t("linkNid")}</Link>}
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-3">
            {stats.map(({ label, value, Icon, testId }) => (
              <li key={testId} data-testid={testId} className="glass-card flex h-full items-center gap-3 p-4">
                <span aria-hidden="true" className="icon-tile !h-10 !w-10 !rounded-xl"><Icon className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block font-display text-2xl font-bold leading-tight text-ink">{value}</span>
                  <span className="block text-sm text-ink-muted">{label}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 text-sm text-ink-muted">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {t("privateNote")}
          </p>
          <Tabs
            label={t("title")}
            defaultValue="current"
            tabs={[
              {
                id: "current",
                label: t("tabCurrent", { count: d.current.length }),
                content: d.current.length ? <LandCards items={d.current} testId="my-land-current" /> : <EmptyState title={t("emptyCurrent")} description={t("emptyHint")} />,
              },
              {
                id: "past",
                label: t("tabPast", { count: d.past.length }),
                content: d.past.length ? <LandCards items={d.past} testId="my-land-past" past /> : <EmptyState title={t("emptyPast")} />,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
