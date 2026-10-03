"use client";
import { useLocale, useTranslations } from "next-intl";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import RiskBadge from "@/components/domain/RiskBadge";
import StatusBadge from "@/components/domain/StatusBadge";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/features/result/format";
import { usePublicVerify } from "./usePublicVerify";
import { intlLocale } from "@/lib/intl-locale";

export default function PublicVerifyView({ landId }: { landId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const q = usePublicVerify(landId);

  let body: React.ReactNode;
  if (q.isPending) {
    body = <LoadingState />;
  } else if (q.isError) {
    const e = q.error;
    if (e instanceof ApiError && (e.status === 404 || e.code === "LAND_NOT_FOUND")) {
      body = <EmptyState title={t("publicVerify.notFound")} />;
    } else {
      const msg = e instanceof ApiError && e.status === 429 ? t("publicVerify.rateLimited") : t("publicVerify.loadError");
      body = <ErrorState message={msg} onRetry={() => void q.refetch()} />;
    }
  } else {
    const d = q.data;
    const counts: [string, number][] = [
      ["ownershipRecords", d.counts.ownership_records],
      ["transactions", d.counts.transactions],
      ["flaggedTransactions", d.counts.flagged_transactions],
      ["openAlerts", d.counts.open_alerts],
    ];
    body = (
      <>
        <Card title={d.land_id} data-testid="public-summary">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">{t("publicVerify.district")}</dt>
              <dd className="font-medium text-ink">{d.district}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("publicVerify.upazila")}</dt>
              <dd className="font-medium text-ink">{d.upazila}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("publicVerify.mouza")}</dt>
              <dd className="font-medium text-ink">{d.mouza}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("publicVerify.status")}</dt>
              <dd className="font-medium text-ink">
                <StatusBadge code={d.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("publicVerify.risk")}</dt>
              <dd className="font-medium text-ink" data-testid="public-risk">
                <RiskBadge level={d.risk_level} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("publicVerify.lastVerified")}</dt>
              <dd className="font-medium text-ink" data-testid="public-last-verified">
                {formatDateTime(d.last_verified_at, locale, t("publicVerify.neverVerified"))}
              </dd>
            </div>
          </dl>
        </Card>
        <Card title={t("publicVerify.countsTitle")} data-testid="public-counts">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {counts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-ink-muted">{t(`publicVerify.${k}`)}</dt>
                <dd className="text-xl font-semibold text-ink">{new Intl.NumberFormat(intlLocale(locale)).format(v)}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card data-testid="public-privacy">
          <p className="text-sm text-ink">{t("publicVerify.privacyNote")}</p>
          <p className="mt-2 text-sm text-ink-muted">{t("risk.disclaimer")}</p>
          <p className="mt-3 text-sm">
            <Link href="/login" className="font-medium text-primary underline">
              {t("publicVerify.signIn")}
            </Link>
          </p>
        </Card>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink">{t("publicVerify.title")}</h1>
      <p role="note" className="rounded-lg border border-line bg-surface-muted px-4 py-2 text-sm font-medium text-ink">
        {t("common.demoLabel")}
      </p>
      {body}
    </div>
  );
}
