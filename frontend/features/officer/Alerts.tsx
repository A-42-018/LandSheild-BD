"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertOctagon, AlertTriangle, BellRing, Info } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Link } from "@/i18n/navigation";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, useToast } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { RISK_TONE } from "@/components/domain/RiskBadge";
import EvidenceList from "@/features/risk/EvidenceList";
import { formatDateTime } from "@/features/result/format";
import { useAuth } from "@/features/auth/AuthContext";
import { hasRole, OFFICER_UP } from "@/features/auth/roles";
import DismissModal from "./DismissModal";
import { useAlertStatus, useAlerts } from "./useOfficerData";
import { ALERT_STATUSES, type AlertItem, type AlertStatus } from "./types";

const SEV_ICON = { HIGH: AlertOctagon, MEDIUM: AlertTriangle, INFO: Info } as const;
const SEV_TILE = { HIGH: "bg-critical-soft text-critical", MEDIUM: "bg-review-soft text-review", INFO: "bg-pending-soft text-pending" } as const;
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
  const { user } = useAuth();
  const toast = useToast();
  useEffect(() => {
    if (m.isSuccess) toast("success", t("updated"));
  }, [m.isSuccess, m.submittedAt]);
  const [dismissing, setDismissing] = useState<AlertItem | null>(null);
  // backend: a HIGH alert can only be dismissed by an officer/admin (ALERT_DISMISS_FORBIDDEN)
  const canDismiss = (a: AlertItem) => a.severity !== "HIGH" || hasRole(user?.role, OFFICER_UP);

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
            <li key={a.id} data-testid={`alert-${a.id}`} className={`glass-card border-l-[4px] p-3 ${a.severity === "HIGH" ? "border-l-critical" : a.severity === "MEDIUM" ? "border-l-review" : "border-l-pending"}`}>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const k = (["HIGH", "MEDIUM", "INFO"].includes(a.severity) ? a.severity : "INFO") as keyof typeof SEV_ICON;
                  const SevIcon = SEV_ICON[k];
                  return <span aria-hidden="true" className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${SEV_TILE[k]}`}><SevIcon className="h-4 w-4" /></span>;
                })()}
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
                {ALERT_STATUSES.filter((s) => s !== a.status && (s !== "DISMISSED" || canDismiss(a))).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "ESCALATED" ? "danger" : "secondary"}
                    loading={m.isPending && m.variables?.id === a.id && m.variables.status === s}
                    disabled={m.isPending}
                    onClick={() => (s === "DISMISSED" ? setDismissing(a) : m.mutate({ id: a.id, status: s }))}
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
      <DismissModal
        open={dismissing !== null}
        land={dismissing?.land_id ?? ""}
        loading={m.isPending}
        onClose={() => setDismissing(null)}
        onConfirm={(reason) =>
          dismissing && m.mutate({ id: dismissing.id, status: "DISMISSED", reason }, { onSuccess: () => setDismissing(null) })
        }
      />
    </Card>
  );
}
