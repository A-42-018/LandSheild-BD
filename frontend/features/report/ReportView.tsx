"use client";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardCheck, Download, Info, Scale } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import LandInfoCard from "@/features/result/LandInfoCard";
import OwnershipTimeline from "@/features/result/OwnershipTimeline";
import TransactionsTable from "@/features/result/TransactionsTable";
import { formatDate, formatDateTime } from "@/features/result/format";
import QrCard, { SealQr } from "@/features/qr/QrCard";
import { Breadcrumb } from "@/components/PageHeader";
import RiskCard from "@/features/risk/RiskCard";
import DocumentConsistencyCard from "./DocumentConsistencyCard";
import type { VerificationReport } from "./types";

export default function ReportView({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const { api } = useAuth();
  const q = useQuery({
    queryKey: ["verification", id, "report"],
    retry: false,
    queryFn: () => api.get<VerificationReport>(`/verification/${encodeURIComponent(id)}/report`),
  });

  const back = (
    <Link href="/verify" className="text-sm font-medium text-link underline">
      {t("result.newSearch")}
    </Link>
  );

  const r0 = q.data;
  let body: React.ReactNode;
  if (q.isPending) {
    body = <LoadingState />;
  } else if (q.isError) {
    const e = q.error;
    const status = e instanceof ApiError ? e.status : 0;
    if (status === 404 || (e instanceof ApiError && e.code === "VERIFICATION_NOT_FOUND")) {
      body = <EmptyState title={t("report.notFound")} action={back} />;
    } else {
      const notReady = e instanceof ApiError && e.code === "VERIFICATION_NOT_READY";
      body = <ErrorState error={notReady ? undefined : e} message={notReady ? t("report.notReady") : t("report.loadError")} onRetry={() => void q.refetch()} />;
    }
  } else {
    const r = q.data;
    const code = `report.disclaimer.${r.disclaimer_code}`;
    body = (
      <div className="report-sections flex flex-col gap-4">
        <Card title={t("report.summary")} icon={<ClipboardCheck />} data-testid="report-summary">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">{t("report.overallStatus")}</dt>
              <dd className="font-medium text-ink">
                <StatusBadge code={r.overall_status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("report.verificationStatus")}</dt>
              <dd className="font-medium text-ink">
                <StatusBadge code={r.verification_status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("report.verificationId")}</dt>
              <dd className="break-all font-medium text-ink">{r.verification_id}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("report.verifiedAt")}</dt>
              <dd data-testid="verified-at" className="font-medium text-ink">
                {formatDateTime(r.verified_at, locale, t("result.unknownDate"))}
              </dd>
            </div>
          </dl>
        </Card>
        <RiskCard
          risk={{
            land_id: r.land_id,
            overall_score: r.risk_score,
            risk_level: r.risk_level,
            rule_score: r.risk_score,
            evidence: r.evidence,
            assessed_at: r.verified_at,
          }}
        />
        <LandInfoCard land={r.land} />
        <OwnershipTimeline entries={r.ownership} />
        <DocumentConsistencyCard data={r.document_consistency} />
        <TransactionsTable transactions={r.transactions} />
        <QrCard landId={r.land_id} />
        <Card title={t("report.disclaimerTitle")} icon={<Scale />} data-testid="report-disclaimer">
          <p className="text-sm text-ink">{t.has(code) ? t(code) : t("report.disclaimer.DEMO_DECISION_SUPPORT")}</p>
          <p className="mt-2 text-sm text-ink-muted">{t("risk.disclaimer")}</p>
        </Card>
        <p className="border-t border-line pt-3 text-xs text-ink-muted" data-testid="report-footer">{t("report.generatedFooter")}</p>
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-4 border-t border-line bg-surface/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:rounded-card sm:border sm:shadow-glass print:hidden">
          <Button size="lg" icon={<Download />} onClick={() => window.print()}>{t("report.print")}</Button>
          <Link href={`/verify/result?land_id=${encodeURIComponent(r.land_id)}`} className="text-sm font-medium text-link underline">
            {t("report.backToResult")}
          </Link>
          {back}
        </div>
      </div>
    );
  }

  return (
    <div className="report flex flex-col gap-4">
      <Breadcrumb crumbs={[{ label: t("nav.verify"), href: "/verify" }]} />
      {/* Letter-style header (roadmap 4.8): mark, title, ref no, date, signed QR. */}
      <header data-testid="report-letterhead" className="glass-card flex items-start justify-between gap-4 border-b-[3px] border-b-primary px-5 py-4 print:rounded-none print:px-0">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.svg" alt="" width={48} height={48} className="h-12 w-12 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-ink-muted">{t("common.appName")}</p>
            <h1 className="font-bold leading-tight text-ink">{t("report.title")}</h1>
            {r0 && (
              <dl className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink-muted">
                <div className="flex gap-1">
                  <dt>{t("report.ref")}:</dt>
                  <dd className="break-all font-mono text-ink">{r0.verification_id}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>{t("report.verifiedAt")}:</dt>
                  <dd className="text-ink">{formatDate(r0.verified_at, locale, t("result.unknownDate"))}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
        {r0 && (
          <div className="hidden shrink-0 rounded border border-line bg-white p-1.5 sm:block print:block">
            <SealQr landId={r0.land_id} />
          </div>
        )}
      </header>
      <p role="note" className="glass-card flex items-center gap-2 border-l-[3px] border-l-review px-4 py-2 text-sm font-medium text-ink print:hidden">
        <Info aria-hidden="true" className="h-4 w-4 shrink-0 text-review" />
        {t("common.demoLabel")}
      </p>
      {body}
    </div>
  );
}
