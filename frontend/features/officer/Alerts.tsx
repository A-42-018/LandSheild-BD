"use client";
import { useLocale, useTranslations } from "next-intl";
import { BellRing } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Link } from "@/i18n/navigation";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { RISK_TONE } from "@/components/domain/RiskBadge";
import EvidenceList from "@/features/risk/EvidenceList";
import { formatDateTime } from "@/features/result/format";
import { useAlertStatus, useAlerts } from "./useOfficerData";
import { ALERT_STATUSES, type AlertStatus } from "./types";

const ACTION_KEY: Record<AlertStatus, string> = {
  OPEN: "reopen",
  UNDER_REVIEW: "underReview",
  ESCALATED: "escalate",
  DISMISSED: "dismiss",
};

export default function Alerts() {
  const t = useTranslations("officer.alerts");
  const te = useTranslations("errors");
  const ts = useTranslations("risk.severity");
  const locale = useLocale();
  const q = useAlerts();
  const m = useAlertStatus();

  return (
    <Card title={t("title")} icon={<BellRing />} accent="critical" data-testid="alerts-card">
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError || !q.data ? (
        <ErrorState
          message={q.error instanceof ApiError && q.error.status === 403 ? te("permission") : undefined}
          onRetry={() => q.refetch()}
        />
      ) : q.data.items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul aria-label={t("title")} className="flex flex-col gap-3">
          {q.data.items.map((a) => (
            <li key={a.id} data-testid={`alert-${a.id}`} className={`rounded-xl border border-l-4 border-line bg-surface p-3 shadow-card ${a.severity === "HIGH" ? "border-l-critical" : a.severity === "MEDIUM" ? "border-l-review" : "border-l-pending"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/verify/result?land_id=${a.land_id}`} className="font-medium text-primary underline">
                  {a.land_id}
                </Link>
                <Badge tone={RISK_TONE[a.severity] ?? "pending"}>
                  {["HIGH", "MEDIUM", "INFO"].includes(a.severity) ? ts(a.severity) : a.severity}
                </Badge>
                <StatusBadge code={a.status} />
                <span className="text-xs text-ink-muted">{formatDateTime(a.created_at, locale, "—")}</span>
              </div>
              <div className="mt-2">
                <EvidenceList evidence={a.evidence} />
              </div>
              <div role="group" aria-label={t("actionsLabel", { land: a.land_id })} className="mt-2 flex flex-wrap gap-2">
                {ALERT_STATUSES.filter((s) => s !== a.status).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "ESCALATED" ? "danger" : "secondary"}
                    loading={m.isPending && m.variables?.id === a.id && m.variables.status === s}
                    disabled={m.isPending}
                    onClick={() => m.mutate({ id: a.id, status: s })}
                  >
                    {t(`actions.${ACTION_KEY[s]}`)}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {m.isError && (
        <p role="alert" className="mt-3 text-sm text-critical">
          {m.error instanceof ApiError && m.error.status === 403 ? te("permission") : t("updateError")}
        </p>
      )}
    </Card>
  );
}
