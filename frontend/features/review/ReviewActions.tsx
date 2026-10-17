"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";
import { useStickyBar } from "@/lib/sticky-bar";
import { Button, useToast } from "@/components/ui";
import RejectModal from "./RejectModal";
import { useReviewShortcuts } from "./useReviewShortcuts";
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
  const barRef = useStickyBar();
  const [rejecting, setRejecting] = useState(false);
  const toast = useToast();
  const { approve: ap, reject: rj } = actions;
  useEffect(() => {
    if (ap.isSuccess) toast("success", t("decision.APPROVED"));
  }, [ap.isSuccess]);
  useEffect(() => {
    if (rj.isSuccess) toast("success", t("decision.REJECTED"));
  }, [rj.isSuccess]);
  const status = data.processing_status;
  const reviewable = REVIEWABLE.includes(status);
  const blocked = !data.validation.valid || !!data.self_approval_blocked || ap.isPending || rj.isPending || actions.reprocess.isPending;
  useReviewShortcuts({
    A: reviewable && !blocked ? () => ap.mutate() : undefined,
    R: reviewable && !rj.isPending ? () => setRejecting(true) : undefined,
  });

  if (status === "APPROVED" || status === "REJECTED") {
    return (
      <p role="status" data-testid="decision-banner" className="glass-card p-4 text-sm font-medium text-ink">
        {t(`decision.${status}`)}
      </p>
    );
  }
  if (!REVIEWABLE.includes(status)) return null;

  const { approve, reject, reprocess } = actions;
  const invalid = !data.validation.valid;
  const ownUpload = !!data.self_approval_blocked;
  const busy = approve.isPending || reject.isPending || reprocess.isPending;
  const failure = (e: ApiError | null, fallback: string) =>
    e && e.code === "SELF_APPROVAL_FORBIDDEN"
      ? t("actions.selfApproval")
      : e && e.status === 409
        ? t("actions.notReviewable")
        : fallback;

  return (
    <section
      aria-label={t("actions.title")}
      className="glass-card sticky bottom-0 z-10 flex flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lift"
      data-testid="review-actions"
      data-sticky-bar
      ref={barRef}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          aria-keyshortcuts="A"
          onClick={() => approve.mutate()}
          disabled={invalid || ownUpload || busy}
          loading={approve.isPending}
          aria-describedby={ownUpload ? "approve-own-upload" : invalid ? "approve-blocked" : undefined}
          data-testid="approve-btn"
        >
          {t("actions.approve")} <kbd aria-hidden="true" className="ml-1 hidden rounded border border-current px-1 text-xs md:inline">A</kbd>
        </Button>
        <Button variant="danger" aria-keyshortcuts="R" onClick={() => setRejecting(true)} disabled={busy} data-testid="reject-btn">
          {t("actions.reject")} <kbd aria-hidden="true" className="ml-1 hidden rounded border border-current px-1 text-xs md:inline">R</kbd>
        </Button>
        <Button variant="secondary" onClick={() => reprocess.mutate()} disabled={busy} loading={reprocess.isPending} data-testid="reprocess-btn">
          {t("actions.reprocess")}
        </Button>
      </div>
      {ownUpload && (
        <p id="approve-own-upload" data-testid="approve-own-upload" className="text-xs text-ink-muted">
          {t("actions.selfApproval")}
        </p>
      )}
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
