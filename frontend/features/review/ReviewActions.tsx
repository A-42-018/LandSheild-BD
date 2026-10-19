"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";
import { useStickyBar } from "@/lib/sticky-bar";
import { Button, useToast } from "@/components/ui";
import AmbiguousChooser, { candidatesOf } from "@/features/verify/AmbiguousChooser";
import RejectModal from "./RejectModal";
import { useReviewShortcuts } from "./useReviewShortcuts";
import { useReviewActions } from "./useReviewActions";
import type { AreaConflict, ExtractionOut } from "./types";

export const REVIEWABLE = ["REVIEW_REQUIRED", "EXTRACTED"];

// approval refusals about the deed parties' NIDs, each with its own sentence (partyNid.errors.*)
const NID_CODES = ["OWNER_NID_REQUIRED", "NID_DOB_CONFLICT", "NID_NAME_MISMATCH", "SAME_PARTY_NID"];

type T = ReturnType<typeof useTranslations>;

/** "This deed is for land in Narayanganj, Rupganj, outside the area of …" */
export function areaText(t: T, a: AreaConflict, locale: string): string {
  if (a.land_id && !a.district) return t("actions.landOtherOffice", { land: a.land_id });
  const place = [a.district, a.upazila].filter(Boolean).join(", ") || "—";
  const office = (locale === "bn" ? a.office_name_bn : a.office_name_en) || a.office_name_en || a.office || "—";
  return t("actions.outsideArea", { place, office });
}

/**
 * Why an approve / reprocess was refused, in words the reviewer can act on. Every 409 used to read
 * "no longer waiting for review, open the page again", which was wrong for the area and land checks:
 * reloading never helped and the document stayed pending.
 */
export function refusalText(
  e: ApiError | null,
  fallback: string,
  t: T,
  tn: T,
  locale: string,
): string {
  if (!e) return fallback;
  if (NID_CODES.includes(e.code)) return tn(`errors.${e.code}`);
  const d = (e.details && typeof e.details === "object" ? e.details : {}) as Record<string, string>;
  switch (e.code) {
    case "SELF_APPROVAL_FORBIDDEN":
      return t("actions.selfApproval");
    case "DOCUMENT_NOT_REVIEWABLE":
    case "DOCUMENT_NOT_EDITABLE":
    case "DOCUMENT_NOT_REPROCESSABLE":
      return t("actions.notReviewable");
    case "RECORD_OUTSIDE_AREA":
      return areaText(t, d as AreaConflict, locale);
    case "LAND_IDENTIFIER_MISMATCH":
      return t("actions.landMismatch", { land: d.land_id ?? "—" });
    case "EXTRACTION_NOT_READY":
      return t("actions.notReady");
    case "EXTRACTION_INVALID":
    case "RECORD_INVALID":
      return t("actions.approveBlocked");
  }
  return e.status === 0 || e.code === "HTTP_ERROR" ? fallback : `${fallback} (${e.code})`;
}

export default function ReviewActions({
  data,
  actions,
  needsNid = false,
}: {
  data: ExtractionOut;
  actions: ReturnType<typeof useReviewActions>;
  /** deed without the new owner's NID yet: approving is refused until it is entered */
  needsNid?: boolean;
}) {
  const tn = useTranslations("partyNid");
  const t = useTranslations("review");
  const locale = useLocale();
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
  const outside = data.area_conflict ?? null;
  const blocked = !data.validation.valid || !!data.self_approval_blocked || !!outside || needsNid || ap.isPending || rj.isPending || actions.reprocess.isPending;
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

  const { approve, reject, reprocess, attachLand } = actions;
  // D7: approval found several lands for this deed; the reviewer picks one (never picked silently)
  const landChoices = approve.error?.code === "LAND_AMBIGUOUS" ? candidatesOf("land", approve.error.details) : [];
  const invalid = !data.validation.valid;
  const ownUpload = !!data.self_approval_blocked;
  const busy = approve.isPending || reject.isPending || reprocess.isPending;
  const failure = (e: ApiError | null, fallback: string) => refusalText(e, fallback, t, tn, locale);

  return (
    <>
      <section
        aria-label={t("actions.title")}
        className="glass-card sticky bottom-0 z-10 !bg-surface flex flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lift"
        data-testid="review-actions"
        data-sticky-bar
        ref={barRef}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            aria-keyshortcuts="A"
            onClick={() => approve.mutate()}
            disabled={invalid || ownUpload || !!outside || needsNid || busy}
            loading={approve.isPending}
            aria-describedby={ownUpload ? "approve-own-upload" : outside ? "approve-outside-area" : invalid ? "approve-blocked" : needsNid ? "approve-needs-nid" : undefined}
            data-testid="approve-btn"
          >
            {t("actions.approve")} <kbd aria-hidden="true" className="ml-1 hidden rounded border border-current px-1 text-xs md:inline">A</kbd>
          </Button>
          <Button variant="danger" aria-keyshortcuts="R" onClick={() => setRejecting(true)} disabled={busy} data-testid="reject-btn">
            {t("actions.reject")} <kbd aria-hidden="true" className="ml-1 hidden rounded border border-current px-1 text-xs md:inline">R</kbd>
          </Button>
        </div>
        {ownUpload && (
          <p id="approve-own-upload" data-testid="approve-own-upload" className="text-xs text-ink-muted">
            {t("actions.selfApproval")}
          </p>
        )}
        {outside && (
          <p id="approve-outside-area" data-testid="approve-outside-area" className="text-xs font-medium text-critical">
            {t("actions.outsideAreaShort")}
          </p>
        )}
        {invalid && (
          <p id="approve-blocked" data-testid="approve-blocked" className="text-xs text-ink-muted">
            {t("actions.approveBlocked")}
          </p>
        )}
        {needsNid && !invalid && (
          <p id="approve-needs-nid" data-testid="approve-needs-nid" className="text-xs text-ink-muted">
            {tn("errors.OWNER_NID_REQUIRED")}
          </p>
        )}
        {landChoices.length > 0 ? (
          <AmbiguousChooser
            kind="land"
            candidates={landChoices}
            showLandId
            intro={t("actions.landIntro")}
            disabled={attachLand.isPending}
            onPick={(c) => c.land_id && attachLand.mutate(c.land_id)}
          />
        ) : (
          approve.isError && (
            <p role="alert" className="text-sm text-critical">{failure(approve.error, t("actions.approveFailed"))}</p>
          )
        )}
        {attachLand.isError && (
          <p role="alert" data-testid="land-attach-failed" className="text-sm text-critical">
            {attachLand.error?.code === "DOCUMENT_NOT_REVIEWABLE"
              ? t("actions.notReviewable")
              : [404, 409, 422].includes(attachLand.error?.status ?? 0)
                ? t("actions.landAttachFailed")
                : t("actions.landAttachRetry")}
          </p>
        )}
        {attachLand.isSuccess && !approve.isError && attachLand.data?.land_id && (
          <p role="status" data-testid="land-attached" className="text-sm text-ink">
            {t("actions.landAttached", { land: attachLand.data.land_id })}
          </p>
        )}
        <RejectModal
          open={rejecting}
          onClose={() => setRejecting(false)}
          loading={reject.isPending}
          failed={reject.isError}
          onConfirm={(reason) => reject.mutate(reason, { onSuccess: () => setRejecting(false) })}
        />
      </section>
      {/* rarely needed and not a decision: kept out of the sticky bar so it stays one short row */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => reprocess.mutate()} disabled={busy} loading={reprocess.isPending} aria-describedby="reprocess-hint" data-testid="reprocess-btn">
            {t("actions.reprocess")}
          </Button>
          <p id="reprocess-hint" className="text-xs text-ink-muted">{t("actions.reprocessHint")}</p>
        </div>
        {reprocess.isError && (
          <p role="alert" className="text-sm text-critical">{failure(reprocess.error, t("actions.reprocessFailed"))}</p>
        )}
      </div>
    </>
  );
}
