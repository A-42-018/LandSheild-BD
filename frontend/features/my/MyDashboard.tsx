"use client";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, ClipboardCheck, Eye, FileClock, FileText, History, SearchCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import PageHeader from "@/components/PageHeader";
import PageTip from "@/components/PageTip";
import RiskIndicator from "@/components/domain/RiskIndicator";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDateTime, intlLocale } from "@/lib/intl-locale";
import { NotificationRow, ParcelLine, reportHref, resultHref } from "./parts";
import { useSummary } from "./useMy";

const ACTIONS: { key: "verify" | "check" | "track"; href: string; Icon: LucideIcon }[] = [
  { key: "verify", href: "/verify", Icon: SearchCheck },
  { key: "check", href: "/check", Icon: ClipboardCheck },
  { key: "track", href: "/track", Icon: FileClock },
];

function Section({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  const t = useTranslations("my.dashboard");
  return (
    <section className="glass-card flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">{title}</h3>
        <Link href={href} className="text-sm font-medium text-link underline">{t("seeAll")}</Link>
      </div>
      {children}
    </section>
  );
}

/** আমার ড্যাশবোর্ড: greeting, three big service buttons, counts, recent activity. */
export default function MyDashboard() {
  const t = useTranslations("my.dashboard");
  const ts = useTranslations("my.searches");
  const locale = useLocale();
  const { user } = useAuth();
  const q = useSummary();
  const fmt = new Intl.NumberFormat(intlLocale(locale));

  const stats: { label: string; value: number; href: string; Icon: LucideIcon }[] = q.data
    ? [
        { label: t("statSearches"), value: q.data.searches, href: "/my/searches", Icon: History },
        { label: t("statWatching"), value: q.data.watching, href: "/my/watchlist", Icon: Eye },
        { label: t("statReports"), value: q.data.reports, href: "/my/reports", Icon: FileText },
        { label: t("statUnread"), value: q.data.unread, href: "/my/notifications", Icon: Bell },
      ]
    : [];
  const s = q.data;
  const nothing = s && !s.recent_searches.length && !s.recent_reports.length && !s.latest_notifications.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader variant="plain" title={t("greeting", { name: user?.name ?? "" })} purpose={t("intro")} crumbs={[]} />
      <PageTip page="my" />

      <ul aria-label={t("actionsLabel")} className="grid gap-3 sm:grid-cols-3">
        {ACTIONS.map(({ key, href, Icon }) => (
          <li key={key}>
            <Link
              href={href}
              data-testid="my-action"
              className="glass-card flex h-full min-h-touch items-start gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:flex-col"
            >
              <span aria-hidden="true" className="icon-tile !h-12 !w-12 !rounded-xl"><Icon className="h-6 w-6" /></span>
              <span>
                <span className="block text-lg font-semibold text-ink">{t(`actions.${key}.title`)}</span>
                <span className="mt-1 block text-sm text-ink-muted">{t(`actions.${key}.desc`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {q.isPending ? (
        <LoadingState />
      ) : q.isError || !s ? (
        <ErrorState error={q.error} message={t("loadError")} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <section aria-labelledby="my-stats">
            <h2 id="my-stats" className="mb-3 text-heading-3 text-ink">{t("stats")}</h2>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {stats.map(({ label, value, href, Icon }) => (
                <li key={href}>
                  <Link href={href} data-testid="my-stat" className="glass-card flex h-full items-center gap-3 p-4 hover:bg-primary-soft/40">
                    <span aria-hidden="true" className="icon-tile !h-10 !w-10 !rounded-xl"><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block font-display text-2xl font-bold leading-tight text-ink">{fmt.format(value)}</span>
                      <span className="block text-sm text-ink-muted">{label}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="my-recent" className="flex flex-col gap-3">
            <h2 id="my-recent" className="text-heading-3 text-ink">{t("recent")}</h2>
            {nothing ? (
              <EmptyState
                title={t("emptyRecent")}
                action={<Link href="/verify" className="text-sm font-medium text-link underline">{t("actions.verify.title")}</Link>}
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {s.latest_notifications.length > 0 && (
                  <div className="lg:col-span-2">
                    <Section title={t("latestNotes")} href="/my/notifications">
                      <ul className="flex flex-col gap-1">
                        {s.latest_notifications.map((n) => <li key={n.id}><NotificationRow n={n} /></li>)}
                      </ul>
                    </Section>
                  </div>
                )}
                {s.recent_searches.length > 0 && (
                  <Section title={t("recentSearches")} href="/my/searches">
                    <ul className="flex flex-col divide-y divide-line">
                      {s.recent_searches.map((p) => (
                        <li key={p.land_id} className="flex items-center justify-between gap-3 py-2">
                          <ParcelLine p={p} />
                          <Link href={resultHref(p.land_id)} className="shrink-0 text-sm font-medium text-link underline">{ts("open")}</Link>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {s.recent_reports.length > 0 && (
                  <Section title={t("recentReports")} href="/my/reports">
                    <ul className="flex flex-col divide-y divide-line">
                      {s.recent_reports.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                          <Link href={reportHref(r.id)} className="min-w-0 text-link underline">
                            <span className="font-mono text-sm">{r.land_id}</span>
                            <span className="ml-2 text-sm text-ink-muted">{formatDateTime(r.created_at, locale, "")}</span>
                          </Link>
                          {r.risk_level && <RiskIndicator level={r.risk_level} size="sm" />}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
