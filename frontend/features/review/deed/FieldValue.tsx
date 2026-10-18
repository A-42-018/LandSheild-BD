"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Crosshair, Pencil } from "lucide-react";
import { Badge, Button, Input, Select } from "@/components/ui";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { BAND_TONE, bandFor, percent } from "../confidence";
import { toRecordErrors } from "../useReviewActions";
import { usableBbox, useHighlight } from "../highlight";
import CandidatePicker, { FlagBadges } from "./CandidatePicker";
import type { Leaf, RecordApiError } from "../types";
import { asField } from "./asField";
import { issuesAt, useRecordEditContext } from "./RecordEdit";

export type EditKind = "text" | "number" | "boolean" | "select";

/**
 * One value of the digital deed: the normalised value, the text exactly as written under it when
 * that differs, the legibility, and a confidence badge when the record states one (H6a).
 * With a `path` (JSON pointer into the record) and an editing context (H6b) it gets an Edit button:
 * a save sends one `replace` op; the H1 issues of that value are shown under it.
 */
export default function FieldValue({
  id,
  label,
  field,
  threshold = 0.85,
  format,
  path,
  kind = "text",
  options,
}: {
  id: string;
  label: string;
  field: Leaf;
  threshold?: number;
  /** turns the stored value into display text (enum labels, yes/no) */
  format?: (v: unknown) => string;
  /** JSON pointer of this value in the record; without it the value is read-only */
  path?: string;
  kind?: EditKind;
  /** kind "select": the allowed codes (shown through `format`) */
  options?: string[];
}) {
  const t = useTranslations("review.deed");
  const ctx = useRecordEditContext();
  const hl = useHighlight();
  const f = asField(field);
  const raw = f?.value;
  const present = raw !== null && raw !== undefined && raw !== "";
  const text = present ? (format ? format(raw) : String(raw)) : "";
  const verbatim =
    f?.verbatim && f.verbatim.trim() !== text.trim() ? f.verbatim : null;
  const band =
    typeof f?.confidence === "number" ? bandFor(f.confidence, threshold) : null;
  const unclear =
    f?.legibility && f.legibility !== "clear" ? f.legibility : null;

  const bbox = usableBbox(f?.source?.bbox);
  const highlighted = hl?.active?.id === id;
  const locate = () => {
    if (!hl || !bbox) return;
    if (highlighted) hl.clear();
    else hl.show({ id, label, page: f?.source?.page ?? 1, bbox });
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<RecordApiError[]>([]);
  const [failed, setFailed] = useState(false);
  const [badNumber, setBadNumber] = useState(false);
  const focus = useFocusFirstInvalid();

  const canEdit = !!ctx?.editable && !!path;
  const issues = ctx && path ? issuesAt(ctx.issues, path) : [];
  const issueText = (code: string, message?: string) =>
    t.has(`issues.${code}`)
      ? t(`issues.${code}`)
      : message || t("issues.UNKNOWN");

  const open = () => {
    setDraft(present ? String(raw) : "");
    setRefused([]);
    setFailed(false);
    setBadNumber(false);
    setEditing(true);
  };

  const save = async () => {
    if (!path || !ctx) return;
    const trimmed = draft.trim();
    let value: unknown = trimmed === "" ? null : trimmed;
    if (value !== null && kind === "number") {
      const n = Number(trimmed.replace(/,/g, ""));
      if (!Number.isFinite(n)) {
        setBadNumber(true);
        return;
      }
      value = n;
    }
    if (value !== null && kind === "boolean") value = trimmed === "true";
    const same =
      value === null ? !present : present && String(value) === String(raw);
    if (same) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setBadNumber(false);
    setFailed(false);
    try {
      await ctx.save({ op: "replace", path, value });
      setEditing(false);
    } catch (e) {
      const errs = toRecordErrors(e);
      setRefused(errs);
      setFailed(errs.length === 0);
      focus.request();
    } finally {
      setSaving(false);
    }
  };

  const errorText = badNumber
    ? t("errors.notNumber")
    : refused.map((e) => issueText(e.code, e.message)).join(" ") ||
      (failed ? t("errors.saveFailed") : "");

  const selectOptions = (
    kind === "boolean" ? ["true", "false"] : (options ?? [])
  ).map((o) => ({
    value: o,
    label:
      kind === "boolean"
        ? o === "true"
          ? t("yes")
          : t("no")
        : format
          ? format(o)
          : o,
  }));

  return (
    <div
      data-testid={`deed-${id}`}
      data-band={band ?? undefined}
      data-edited={f?.edited_by_human ? "true" : undefined}
      className="flex min-w-0 flex-col gap-1 border-l-4 border-l-line py-1.5 pl-3 data-[band=high]:border-l-verified data-[band=medium]:border-l-review data-[band=low]:border-l-critical"
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-col gap-0.5">
        {editing ? (
          <form
            ref={focus.ref}
            className="flex flex-col gap-2"
            data-testid={`deed-${id}-form`}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {kind === "select" || kind === "boolean" ? (
              <Select
                label={label}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                options={selectOptions}
                placeholder={t("notRead")}
                error={errorText || undefined}
                disabled={saving}
                data-testid={`deed-${id}-input`}
              />
            ) : (
              <Input
                label={label}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                inputMode={kind === "number" ? "decimal" : undefined}
                lang={kind === "text" ? "bn" : undefined}
                error={errorText || undefined}
                disabled={saving}
                data-testid={`deed-${id}-input`}
                autoFocus
              />
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                loading={saving}
                data-testid={`deed-${id}-save`}
              >
                {t("save")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span
                className={present ? "break-words text-ink" : "text-ink-muted"}
                data-testid={`deed-${id}-value`}
              >
                {present ? text : t("notRead")}
              </span>
              <span className="flex flex-wrap items-center gap-1">
                <FlagBadges id={id} flags={f?.flags} />
                {f?.edited_by_human && (
                  <Badge tone="pending">{t("edited")}</Badge>
                )}
                {unclear && (
                  <Badge tone="review" data-testid={`deed-${id}-legibility`}>
                    {t(`legibility.${unclear}`)}
                  </Badge>
                )}
                {band && typeof f?.confidence === "number" && (
                  <Badge
                    tone={BAND_TONE[band]}
                    data-band={band}
                    title={t("confidence")}
                  >
                    {t(`band.${band}`)} · {percent(f.confidence)}%
                  </Badge>
                )}
                {hl && bbox && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Crosshair />}
                    onClick={locate}
                    aria-pressed={highlighted}
                    aria-label={`${t("locate")}: ${label}`}
                    data-testid={`deed-${id}-locate`}
                  >
                    {t("locate")}
                  </Button>
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Pencil />}
                    onClick={open}
                    aria-label={`${t("edit")}: ${label}`}
                    data-testid={`deed-${id}-edit`}
                  >
                    {t("edit")}
                  </Button>
                )}
              </span>
            </div>
            {verbatim && (
              <span
                className="break-words text-xs text-ink-muted"
                data-testid={`deed-${id}-verbatim`}
              >
                {t("asWritten")}: <span lang="bn">{verbatim}</span>
              </span>
            )}
            <CandidatePicker
              id={id}
              label={label}
              path={path}
              candidates={f?.candidates}
              threshold={threshold}
              format={format}
            />
            {issues.map((i) => (
              <p
                key={`${i.code}${i.path}`}
                role={i.severity === "error" ? "alert" : "status"}
                data-testid={`deed-${id}-issue`}
                data-severity={i.severity}
                className={
                  i.severity === "error"
                    ? "text-xs text-critical"
                    : "text-xs text-review"
                }
              >
                {issueText(i.code, i.message)}
              </p>
            ))}
          </>
        )}
      </dd>
    </div>
  );
}

/** Grid of FieldValue rows. */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{children}</dl>;
}
