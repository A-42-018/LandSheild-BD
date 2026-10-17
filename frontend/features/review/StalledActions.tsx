"use client";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { hasRole, OFFICER_UP } from "@/features/auth/roles";
import { useReviewActions } from "./useReviewActions";

/**
 * Documents that never reached review: UPLOADED (processing not started; only an officer may
 * start it) and FAILED (anyone who can review may retry: POST /reprocess accepts FAILED).
 */
export default function StalledActions({ id, status, failureCode }: { id: string; status: "UPLOADED" | "FAILED"; failureCode?: string | null }) {
  const t = useTranslations("review");
  const te = useTranslations("errors");
  const { user } = useAuth();
  const { start, reprocess } = useReviewActions(id);

  if (status === "UPLOADED") {
    const canStart = hasRole(user?.role, OFFICER_UP);
    return (
      <div role="status" data-testid="not-started-state" className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface p-6 text-center text-ink-muted shadow-card">
        <p>{canStart ? t("notStarted") : t("waitingForOfficer")}</p>
        {canStart && (
          <Button onClick={() => start.mutate()} loading={start.isPending} disabled={start.isPending} data-testid="start-processing-review">
            {t("startProcessing")}
          </Button>
        )}
        {start.isError && (
          <p role="alert" className="text-sm text-critical">
            {start.error instanceof ApiError && start.error.code && t.has(`failed.${start.error.code}`) ? t(`failed.${start.error.code}`) : te("documentFailed")}
          </p>
        )}
      </div>
    );
  }
  return (
    <div role="alert" data-testid="failed-state" className="flex flex-col items-center gap-3 rounded-xl border border-critical/40 bg-surface p-6 text-center shadow-card">
      <p className="text-critical">{failureCode && t.has(`failed.${failureCode}`) ? t(`failed.${failureCode}`) : te("documentFailed")}</p>
      {failureCode && (
        <p className="text-xs text-ink-muted" data-testid="failure-code">
          {t("failed.codeLabel")} <code className="font-mono">{failureCode}</code>
        </p>
      )}
      <Button variant="secondary" onClick={() => reprocess.mutate()} loading={reprocess.isPending} disabled={reprocess.isPending} data-testid="retry-processing">
        {t("actions.reprocess")}
      </Button>
      {reprocess.isError && <p className="text-sm text-critical">{t("actions.reprocessFailed")}</p>}
    </div>
  );
}
