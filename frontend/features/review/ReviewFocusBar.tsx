"use client";
import { useTranslations } from "next-intl";
import { DEED_SECTIONS } from "./deed/DeedView";
import { useReviewFocus, type FocusMode } from "./focus";

/**
 * Sticky at the top of the fields column: how many values need checking, a filter to show only
 * those, and (for the sectioned deed) links to each part, so a long deed is not one endless scroll.
 */
export default function ReviewFocusBar({ errors, sections }: { errors: number; sections: boolean }) {
  const t = useTranslations("review.focus");
  const ts = useTranslations("review.deed.sections");
  const focus = useReviewFocus();
  if (!focus) return null;
  const { counts, mode, setMode } = focus;
  const modes: { k: FocusMode; label: string }[] = [
    { k: "all", label: t("all") },
    { k: "check", label: `${t("check")} (${counts.check})` },
  ];

  return (
    <>
      <p className="text-xs text-ink-muted">{t("hint")}</p>
      {/* below the site header (65 px, sticky too), so the filter stays at hand while scrolling */}
      <section
        aria-label={t("title")}
        data-testid="review-focus"
        className="glass-card z-20 flex flex-col gap-2 px-3 py-2 shadow-raised md:sticky md:top-[4.5rem]"
      >
        <h2 className="sr-only">{t("title")}</h2>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label={t("modeLabel")} className="inline-flex gap-1 rounded-xl bg-primary-soft p-1">
            {modes.map(({ k, label }) => (
              <button
                key={k}
                type="button"
                aria-pressed={mode === k}
                onClick={() => setMode(k)}
                data-testid={`focus-mode-${k}`}
                className={`min-h-touch rounded-lg px-3 text-sm font-semibold transition-colors [@media(pointer:fine)]:min-h-8 ${mode === k ? "bg-surface text-primary shadow-raised" : "text-ink-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="flex flex-wrap gap-1.5 text-xs font-semibold" data-testid="review-focus-counts">
            <li className="rounded-full bg-review-soft px-2 py-0.5 text-review" data-testid="focus-check">{t("needs", { n: counts.check })}</li>
            {errors > 0 && (
              <li className="rounded-full bg-critical-soft px-2 py-0.5 text-critical" data-testid="focus-errors">{t("errors", { n: errors })}</li>
            )}
            <li className="rounded-full bg-verified-soft px-2 py-0.5 text-verified">{t("fine", { n: counts.fine })}</li>
            {counts.empty > 0 && (
              <li className="rounded-full bg-surface-muted px-2 py-0.5 text-ink-muted">{t("empty", { n: counts.empty })}</li>
            )}
          </ul>
        </div>
        {sections && (
          <nav aria-label={t("jump")} className="flex flex-wrap items-center gap-x-0.5 text-xs">
            <span className="mr-1 font-medium text-ink-muted">{t("jump")}:</span>
            {DEED_SECTIONS.map((k) => (
              <a
                key={k}
                href={`#deed-anchor-${k}`}
                className="rounded-full px-2 py-1 font-medium text-primary underline-offset-2 hover:bg-primary-soft hover:underline"
              >
                {ts(k)}
              </a>
            ))}
          </nav>
        )}
      </section>
    </>
  );
}
