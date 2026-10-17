"use client";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui";
import { useTodayQueue } from "@/features/reviewer/useReviewerData";
import { useReviewShortcuts } from "./useReviewShortcuts";

/** Back to "আজকের কাজ", the next waiting document (key N) and a reminder of the keys. */
export default function ReviewToolbar({ id }: { id: string }) {
  const t = useTranslations("review.toolbar");
  const router = useRouter();
  const queue = useTodayQueue();
  const items = queue.data?.items ?? [];
  const at = items.findIndex((i) => i.id === id);
  // the one after this in the queue, else the oldest other one
  const next = (at >= 0 ? items[at + 1] : undefined) ?? items.find((i) => i.id !== id);
  const goNext = () => next && router.push(`/officer/review/${next.id}`);
  useReviewShortcuts({ N: next ? goNext : undefined });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="review-toolbar">
      <Link href="/officer/review" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-link underline-offset-2 hover:underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t("back")}
      </Link>
      <p className="hidden text-xs text-ink-muted md:block" data-testid="shortcut-hint">
        {t("keys")}
      </p>
      {next ? (
        <Button variant="secondary" onClick={goNext} aria-keyshortcuts="N" data-testid="next-btn" icon={<ArrowRight />}>
          {t("next")} <kbd aria-hidden="true" className="ml-1 rounded border border-line px-1 text-xs">N</kbd>
        </Button>
      ) : (
        <span className="text-sm text-ink-muted" data-testid="queue-clear">{queue.isSuccess ? t("noNext") : ""}</span>
      )}
    </div>
  );
}
