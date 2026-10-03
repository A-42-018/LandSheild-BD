"use client";
import { useLocale, useTranslations } from "next-intl";
import { AlertOctagon, BadgeCheck, Database, Hourglass, type LucideIcon } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Card, ErrorState, LoadingState } from "@/components/ui";
import { useOfficerStats } from "./useOfficerData";
import type { OfficerStats } from "./types";
import { intlLocale } from "@/lib/intl-locale";

const KPIS: { key: keyof OfficerStats; tone: string; tile: string; chip: string; Icon: LucideIcon; accent: "primary" | "review" | "critical" | "verified" }[] = [
  { key: "total_records", tone: "text-primary", tile: "bg-primary-soft/60", chip: "bg-primary/10 text-primary", Icon: Database, accent: "primary" },
  { key: "pending_review", tone: "text-review", tile: "bg-review-soft/60", chip: "bg-review/15 text-review", Icon: Hourglass, accent: "review" },
  { key: "high_risk", tone: "text-critical", tile: "bg-critical-soft/60", chip: "bg-critical/15 text-critical", Icon: AlertOctagon, accent: "critical" },
  { key: "verified", tone: "text-verified", tile: "bg-verified-soft/60", chip: "bg-verified/15 text-verified", Icon: BadgeCheck, accent: "verified" },
];

export default function KpiCards() {
  const t = useTranslations("officer.kpi");
  const te = useTranslations("errors");
  const locale = useLocale();
  const q = useOfficerStats();

  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) {
    const forbidden = q.error instanceof ApiError && q.error.status === 403;
    return <ErrorState message={forbidden ? te("permission") : undefined} onRetry={forbidden ? undefined : () => q.refetch()} />;
  }
  const fmt = new Intl.NumberFormat(intlLocale(locale));
  return (
    <ul aria-label={t("title")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPIS.map(({ key, tone, tile, chip, Icon, accent }) => (
        <li key={key}>
          <Card as="div" accent={accent} className={tile} data-testid={`kpi-${key}`}>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${chip}`}>
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink-muted">{t(key)}</p>
                <p className={`text-3xl font-bold ${tone}`}>{fmt.format(q.data[key])}</p>
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
