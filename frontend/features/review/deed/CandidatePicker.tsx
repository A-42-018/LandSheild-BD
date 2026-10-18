"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button } from "@/components/ui";
import { toRecordErrors } from "../useReviewActions";
import { BAND_TONE, bandFor, percent } from "../confidence";
import type { LhdrCandidate } from "../types";
import { useRecordEditContext } from "./RecordEdit";

/** Warning badges for `Field.flags` (ai/extraction/fuse.py: DISAGREE, NOT_IN_TEXT). Unknown codes show as they are. */
export function FlagBadges({ id, flags }: { id: string; flags?: string[] }) {
  const t = useTranslations("review.deed");
  if (!flags?.length) return null;
  return (
    <>
      {flags.map((f) => (
        <Badge
          key={f}
          tone="review"
          data-testid={`deed-${id}-flag-${f}`}
          title={t.has(`flagHelp.${f}`) ? t(`flagHelp.${f}`) : undefined}
        >
          {t.has(`flags.${f}`) ? t(`flags.${f}`) : f}
        </Badge>
      ))}
    </>
  );
}

/**
 * "Both readings" (H4 fusion): the other readings of a value, each with the engine and confidence that
 * produced it. A reviewer picks one; the choice is saved as a `replace` of the value.
 */
export default function CandidatePicker({
  id,
  label,
  path,
  candidates,
  threshold,
  format,
}: {
  id: string;
  label: string;
  path?: string;
  candidates?: LhdrCandidate[];
  threshold: number;
  format?: (v: unknown) => string;
}) {
  const t = useTranslations("review.deed");
  const ctx = useRecordEditContext();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const list = (candidates ?? []).filter(
    (c) => c.value !== null && c.value !== undefined && c.value !== "",
  );
  if (!list.length) return null;
  const canPick = !!ctx?.editable && !!path;

  const pick = async (c: LhdrCandidate, i: number) => {
    if (!ctx || !path) return;
    setBusy(i);
    setError("");
    try {
      await ctx.save({ op: "replace", path, value: c.value });
    } catch (e) {
      const errs = toRecordErrors(e);
      setError(
        errs.length
          ? errs
              .map((x) =>
                t.has(`issues.${x.code}`)
                  ? t(`issues.${x.code}`)
                  : x.message || t("issues.UNKNOWN"),
              )
              .join(" ")
          : t("errors.saveFailed"),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="group"
      aria-label={`${t("candidates.title")}: ${label}`}
      data-testid={`deed-${id}-candidates`}
      className="mt-1 flex flex-col gap-1 rounded-md bg-primary-soft p-2"
    >
      <p className="text-xs font-medium text-ink">{t("candidates.title")}</p>
      <ul className="flex flex-col gap-1">
        {list.map((c, i) => {
          const text = format ? format(c.value) : String(c.value);
          const band =
            typeof c.confidence === "number"
              ? bandFor(c.confidence, threshold)
              : null;
          return (
            <li
              key={`${i}-${String(c.value)}`}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
              data-testid={`deed-${id}-candidate`}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-1">
                <span className="break-words text-ink" lang="bn">
                  {text}
                </span>
                {c.method && (
                  <span className="text-xs text-ink-muted">({c.method})</span>
                )}
                {band && typeof c.confidence === "number" && (
                  <Badge tone={BAND_TONE[band]} data-band={band}>
                    {percent(c.confidence)}%
                  </Badge>
                )}
              </span>
              {canPick && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === i}
                  disabled={busy !== null}
                  onClick={() => void pick(c, i)}
                  aria-label={`${t("candidates.use")}: ${text} (${label})`}
                  data-testid={`deed-${id}-candidate-use`}
                >
                  {t("candidates.use")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p
          role="alert"
          className="text-xs text-critical"
          data-testid={`deed-${id}-candidate-error`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
