"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui";
import RejectModal from "./RejectModal";
import { useReviewActions } from "./useReviewActions";
import type { ExtractionOut } from "./types";

export const REVIEWABLE = ["REVIEW_REQUIRED", "EXTRACTED"];

export default function ReviewActions({
  data,
  actions,
}: {
  data: ExtractionOut;
  actions: ReturnType<typeof useReviewActions>;
}) {
  const t = useTranslations("review");
  const [rejecting, setRejecting] = useState(false);
  const status = data.processing_status;

  if (status === "APPROVED" || status === "REJECTED") {
    return (
      <p role="status" data-testid="decision-banner" className="rounded-lg border border-line bg-surface p-4 text-sm text-ink">
        {t(`decision.${status}`)}
      </p>
    );
  }
  if (!REVIEWABLE.includes(status)) return null;

  const { approve, reject, reprocess } = actions;
  const invalid = !data.validation.valid;
  const busy = approve.isPending || reject.isPending || reprocess.isPending;
  const failure = (e: ApiError | null, fallback: string) =>
    e && e.status === 409 ? t("actions.notReviewable") : fallback;

  return (
    <section aria-label={t("actions.title")} className="flex flex-col gap-3" data-testid="review-actions">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => approve.mutate()}
          disabled={invalid || busy}
          loading={approve.isPending}
          aria-describedby={invalid ? "approve-blocked" : undefined}
          data-testid="approve-btn"
        >
          {t("actions.approve")}
        </Button>
        <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy} data-testid="reject-btn">
          {t("actions.reject")}
        </Button>
        <Button variant="secondary" onClick={() => reprocess.mutate()} disabled={busy} loading={reprocess.isPending} data-testid="reprocess-btn">
          {t("actions.reprocess")}
        </Button>
      </div>
      {invalid && (
        <p id="approve-blocked" data-testid="approve-blocked" className="text-xs text-ink-muted">
          {t("actions.approveBlocked")}
        </p>
      )}
      <p className="text-xs text-ink-muted">{t("actions.reprocessHint")}</p>
      {approve.isError && (
        <p role="alert" className="text-sm text-critical">{failure(approve.error, t("actions.approveFailed"))}</p>
      )}
      {reprocess.isError && (
        <p role="alert" className="text-sm text-critical">{failure(reprocess.error, t("actions.reprocessFailed"))}</p>
      )}
      <RejectModal
        open={rejecting}
        onClose={() => setRejecting(false)}
        loading={reject.isPending}
        failed={reject.isError}
        onConfirm={(reason) => reject.mutate(reason, { onSuccess: () => setRejecting(false) })}
      />
    </section>
  );
}
