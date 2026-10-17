"use client";
import { useTranslations } from "next-intl";
import { Badge, Button } from "@/components/ui";
import { REVIEWABLE } from "./ReviewActions";
import type { useReviewActions } from "./useReviewActions";
import type { DeedProfile, ExtractionOut } from "./types";

const OTHER: Record<DeedProfile, DeedProfile> = { modern: "historical", historical: "modern" };

/**
 * The deed's modern | historical profile (H3, D1: detected from the OCR text, stored in
 * extraction_json) and the reviewer's switch: reprocess with the other profile when detection is
 * wrong. Khatian / porcha and older results carry no profile and show nothing.
 */
export default function DeedProfileSwitch({
  data,
  actions,
}: {
  data: ExtractionOut;
  actions: ReturnType<typeof useReviewActions>;
}) {
  const t = useTranslations("review.profile");
  const profile = data.deed_profile;
  if (profile !== "modern" && profile !== "historical") return null;
  const other = OTHER[profile];
  const reviewable = REVIEWABLE.includes(data.processing_status);
  const { approve, reject, reprocess } = actions;
  const busy = approve.isPending || reject.isPending || reprocess.isPending;

  return (
    <div data-testid="deed-profile" data-profile={profile} className="flex flex-col gap-1 text-xs text-ink-muted">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={profile === "historical" ? "review" : "pending"} data-testid="badge-profile">
          {t("label")}: {t(profile)}
        </Badge>
        <span data-testid="profile-origin">{t(data.profile_overridden ? "overridden" : "detected")}</span>
        {reviewable && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => reprocess.mutate(other)}
            disabled={busy}
            loading={reprocess.isPending && reprocess.variables === other}
            aria-describedby="profile-switch-hint"
            data-testid="profile-switch"
            data-to={other}
          >
            {t(other === "historical" ? "toHistorical" : "toModern")}
          </Button>
        )}
      </div>
      {reviewable && <p id="profile-switch-hint">{t("hint")}</p>}
    </div>
  );
}
