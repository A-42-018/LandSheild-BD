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
import { formatDateTime } from "@/features/result/format";
import QrCard from "@/features/qr/QrCard";
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
    <Link href="/verify" className="text-sm font-medium text-primary underline">
      {t("result.newSearch")}
    </Link>
  );

  let body: React.ReactNode;
  if (q.isPending) {
    body = <LoadingState />;
  } else if (q.isError) {
    const e = q.error;
    const status = e instanceof ApiError ? e.status : 0;
    if (status === 404 || (e instanceof ApiError && e.code === "VERIFICATION_NOT_FOUND")) {
      body = <EmptyState title={t("report.notFound")} action={back} />;
    } else {
      const msg =
        e instanceof ApiError && e.code === "VERIFICATION_NOT_READY"
          ? t("report.notReady")
          : status === 403
            ? t("errors.permission")
            : t("report.loadError");
      body = <ErrorState message={msg} onRetry={() => void q.refetch()} />;
    }
  } else {
    const r = q.data;
    const code = `report.disclaimer.${r.disclaimer_code}`;
    body = (
      <>
        <Card title={t("report.summary")} icon={<ClipboardCheck />} accent="primary" data-testid="report-summary">
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
        <div className="flex flex-wrap items-center gap-4 print:hidden">
          <Button icon={<Download />} onClick={() => window.print()}>{t("report.print")}</Button>
          <Link href={`/verify/result?land_id=${encodeURIComponent(r.land_id)}`} className="text-sm font-medium text-primary underline">
            {t("report.backToResult")}
          </Link>
          {back}
        </div>
      </>
    );
  }

  return (
    <div className="report flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink">{t("report.title")}</h1>
      <p role="note" className="flex items-center gap-2 rounded-lg border border-review/30 bg-review-soft px-4 py-2 text-sm font-medium text-ink">
        <Info aria-hidden="true" className="h-4 w-4 shrink-0 text-review" />
        {t("common.demoLabel")}
      </p>
      {body}
    </div>
  );
}
