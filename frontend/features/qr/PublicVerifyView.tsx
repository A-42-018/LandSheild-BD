"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleSlash, Hash, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react";
import { districtName, upazilaName } from "@/lib/geo";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { ShieldArt } from "@/features/landing/Illustrations";
import PageHeader from "@/components/PageHeader";
import RiskIndicator from "@/components/domain/RiskIndicator";
import StatusBadge from "@/components/domain/StatusBadge";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/features/result/format";
import { usePublicSignature, usePublicVerify } from "./usePublicVerify";
import { intlLocale } from "@/lib/intl-locale";

/** Status = icon + text + colour (roadmap 4.2 rule 4), theme tokens only. */
const SIG_STYLE: Record<string, [string, LucideIcon]> = {
  VALID: ["border-l-verified bg-verified-soft/70 text-verified", ShieldCheck],
  INVALID: ["border-l-critical bg-critical-soft/70 text-critical", ShieldX],
  UNSIGNED: ["border-l-pending bg-pending-soft/70 text-pending", CircleSlash],
  NOT_FOUND: ["border-l-pending bg-pending-soft/70 text-pending", CircleSlash],
};

function SignatureChip({ deedId, hash12 }: { deedId: string; hash12: string }) {
  const t = useTranslations("publicVerify");
  const q = usePublicSignature(deedId, hash12);
  if (q.isPending || q.isError) return null;
  const state = q.data.state;
  const [cls, Icon] = SIG_STYLE[state] ?? SIG_STYLE.NOT_FOUND;
  return (
    <p
      role="status"
      data-testid="signature-chip"
      data-state={state}
      className={`glass-card flex items-center gap-4 border-l-[4px] px-5 py-4 text-base font-semibold ${cls}`}
    >
      <Icon aria-hidden="true" className="h-10 w-10 shrink-0" />
      <span className="text-ink">{t(`sig.${state}`)}</span>
    </p>
  );
}

export default function PublicVerifyView({ landId }: { landId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const q = usePublicVerify(landId);
  const [seal, setSeal] = useState<{ d: string; h: string } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const d = p.get("d");
    const h = p.get("h");
    setSeal(d && h ? { d, h } : null);
  }, []);

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
      ["activeEncumbrances", d.counts.active_encumbrances ?? 0],
      ["pendingMutations", d.counts.pending_mutations ?? 0],
    ];
    body = (
      <>
        <Card title={<span className="font-mono">{d.land_id}</span>} variant="record" data-testid="public-summary">
          <div className="mb-3 flex justify-end">
            <RiskIndicator level={d.risk_level} />
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">{t("publicVerify.district")}</dt>
              <dd className="font-medium text-ink">{districtName(d.district, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("publicVerify.upazila")}</dt>
              <dd className="font-medium text-ink">{upazilaName(d.district, d.upazila, locale)}</dd>
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
                <RiskIndicator level={d.risk_level} showLabel={false} />
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
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {counts.map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line/70 bg-surface/60 p-3">
                <dt className="flex items-center gap-2 text-xs text-ink-muted">
                  <span aria-hidden="true" className="icon-tile !h-7 !w-7 !rounded-lg"><Hash className="h-3.5 w-3.5" /></span>
                  {t(`publicVerify.${k}`)}
                </dt>
                <dd className="mt-1 font-display text-2xl font-bold text-ink">{new Intl.NumberFormat(intlLocale(locale)).format(v)}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card data-testid="public-privacy">
          <p className="text-sm text-ink">{t("publicVerify.privacyNote")}</p>
          <p className="mt-2 text-sm text-ink-muted">{t("risk.disclaimer")}</p>
          <p className="mt-3 text-sm">
            <Link href="/login" className="font-medium text-link underline">
              {t("publicVerify.signIn")}
            </Link>
          </p>
        </Card>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        art={<ShieldArt />}
        title={t("publicVerify.title")}
        purpose={t("page.publicPurpose")}
        meta={q.data ? [t("page.dataAsOf", { date: formatDateTime(q.data.last_verified_at, locale, t("publicVerify.neverVerified")) })] : []}
      />
      <p role="note" className="glass-card px-4 py-2 text-sm font-medium text-ink">
        {t("common.demoLabel")}
      </p>
      {seal ? <SignatureChip deedId={seal.d} hash12={seal.h} /> : null}
      {body}
    </div>
  );
}
