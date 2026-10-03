"use client";
import { lazy, Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BarChart3, ShieldAlert } from "lucide-react";
import { Card, ErrorState, LoadingState } from "@/components/ui";
import { useAlertTotals, useOfficerStats } from "./useOfficerData";
import type { ChartDatum } from "./types";
import { intlLocale } from "@/lib/intl-locale";

const ChartCanvas = lazy(() => import("./ChartCanvas"));

// Palette comes from the theme tokens (globals.css), so charts follow light/dark.
const C = { verified: "rgb(var(--verified))", review: "rgb(var(--review))", critical: "rgb(var(--critical))" };

function ChartCard({ title, data, testId, icon }: { title: string; data: ChartDatum[]; testId: string; icon: React.ReactNode }) {
  const locale = useLocale();
  const fmt = new Intl.NumberFormat(intlLocale(locale));
  return (
    <Card title={title} icon={icon} data-testid={testId}>
      <div aria-hidden="true">
        <Suspense fallback={<LoadingState />}>
          <ChartCanvas data={data} />
        </Suspense>
      </div>
      <ul aria-label={title} className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink">
        {data.map((d) => (
          <li key={d.key} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted/60 px-3 py-1">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm" style={{ background: d.color }} />
            {d.label}: <strong>{fmt.format(d.value)}</strong>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Charts() {
  const t = useTranslations("officer.charts");
  const k = useTranslations("officer.kpi");
  const r = useTranslations("risk.severity");
  const stats = useOfficerStats();
  const totals = useAlertTotals();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {stats.isLoading ? (
        <LoadingState />
      ) : stats.isError || !stats.data ? (
        <ErrorState onRetry={() => stats.refetch()} />
      ) : (
        <ChartCard
          testId="chart-status"
          icon={<BarChart3 />}
          title={t("statusTitle")}
          data={[
            { key: "verified", label: k("verified"), value: stats.data.verified, color: C.verified },
            { key: "pending_review", label: k("pending_review"), value: stats.data.pending_review, color: C.review },
            { key: "high_risk", label: k("high_risk"), value: stats.data.high_risk, color: C.critical },
          ]}
        />
      )}
      {totals.isLoading ? (
        <LoadingState />
      ) : totals.isError || !totals.data ? (
        <ErrorState onRetry={() => totals.refetch()} />
      ) : (
        <ChartCard
          testId="chart-risk"
          icon={<ShieldAlert />}
          title={t("riskTitle")}
          data={[
            { key: "HIGH", label: r("HIGH"), value: totals.data.HIGH, color: C.critical },
            { key: "MEDIUM", label: r("MEDIUM"), value: totals.data.MEDIUM, color: C.review },
          ]}
        />
      )}
    </div>
  );
}
