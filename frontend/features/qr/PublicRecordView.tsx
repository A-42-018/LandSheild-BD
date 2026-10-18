"use client";
import { useLocale, useTranslations } from "next-intl";
import { CircleSlash, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { ShieldArt } from "@/features/landing/Illustrations";
import PageHeader from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/features/result/format";
import { usePublicRecord } from "./usePublicVerify";

/** Status = icon + text + colour (roadmap 4.2 rule 4), theme tokens only. */
const STATE_STYLE: Record<string, [string, LucideIcon]> = {
  VALID: ["border-l-verified bg-verified-soft/70 text-verified", ShieldCheck],
  INVALID: ["border-l-critical bg-critical-soft/70 text-critical", ShieldX],
};

/** The page the PDF's QR code opens (H8d). Shows the signature state, deed no, version and
 *  approval date. No names, no values, no hashes. */
export default function PublicRecordView({ recordId }: { recordId: string }) {
  const t = useTranslations("publicRecord");
  const tc = useTranslations();
  const locale = useLocale();
  const q = usePublicRecord(recordId);

  let body: React.ReactNode;
  if (q.isPending) {
    body = <LoadingState />;
  } else if (q.isError) {
    const e = q.error;
    if (e instanceof ApiError && (e.status === 404 || e.code === "RECORD_NOT_FOUND")) {
      body = (
        <div data-testid="record-not-found">
          <EmptyState title={t("notFound")} />
        </div>
      );
    } else {
      body = <ErrorState error={e} message={t("loadError")} onRetry={() => void q.refetch()} />;
    }
  } else {
    const d = q.data;
    const [cls, Icon] = STATE_STYLE[d.state] ?? [
      "border-l-pending bg-pending-soft/70 text-pending",
      CircleSlash,
    ];
    body = (
      <>
        <p
          role="status"
          data-testid="record-state"
          data-state={d.state}
          className={`glass-card flex items-center gap-4 border-l-[4px] px-5 py-4 text-base font-semibold ${cls}`}
        >
          <Icon aria-hidden="true" className="h-10 w-10 shrink-0" />
          <span className="text-ink">{t(`state.${d.state}`)}</span>
        </p>
        {d.superseded ? (
          <p role="note" data-testid="record-superseded" className="glass-card px-4 py-2 text-sm font-medium text-ink">
            {t("superseded")}
          </p>
        ) : null}
        <Card title={t("detailsTitle")} variant="record" data-testid="record-details">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-muted">{t("deedNo")}</dt>
              <dd className="font-mono font-medium text-ink" data-testid="record-deed-no">{d.deed_no ?? t("none")}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("version")}</dt>
              <dd className="font-medium text-ink" data-testid="record-version">{d.version}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t("approvedAt")}</dt>
              <dd className="font-medium text-ink" data-testid="record-approved-at">
                {formatDateTime(d.approved_at, locale, t("none"))}
              </dd>
            </div>
          </dl>
        </Card>
        <Card data-testid="record-privacy">
          <p className="text-sm text-ink">{t("privacyNote")}</p>
          <p className="mt-3 text-sm">
            <Link href="/login" className="font-medium text-link underline">
              {tc("publicVerify.signIn")}
            </Link>
          </p>
        </Card>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader art={<ShieldArt />} title={t("title")} purpose={t("purpose")} meta={[]} />
      <p role="note" className="glass-card px-4 py-2 text-sm font-medium text-ink">
        {tc("common.demoLabel")}
      </p>
      {body}
    </div>
  );
}
