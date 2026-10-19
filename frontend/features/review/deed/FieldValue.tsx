"use client";
import { createContext, useContext, useState } from "react";
import { useTranslations } from "next-intl";
import { Crosshair, Pencil } from "lucide-react";
import { Badge, Button, Input, Select } from "@/components/ui";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { BAND_TONE, bandFor, percent } from "../confidence";
import { toRecordErrors } from "../useReviewActions";
import { usableBbox, useHighlight } from "../highlight";
import { useFocusEntry, useReviewFocus, type FocusState } from "../focus";
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

  const inGrid = useContext(InGrid);
  const hasCandidates = (f?.candidates ?? []).some(
    (c) => c.value !== null && c.value !== undefined && c.value !== "",
  );
  const needsCheck =
    (band !== null && band !== "high") || issues.length > 0 || !!unclear || !!f?.flags?.length;
  const state: FocusState = needsCheck ? "check" : present ? "fine" : "empty";
  const hidden = useFocusEntry(`deed-${id}`, state, editing || highlighted);
  if (hidden) return null;
  // a value the deed did not show, with nothing to say about it: a small chip after the read values
  const chip = !editing && !present && !needsCheck && !hasCandidates;

  const editButton = canEdit && (
    <Button
      size="sm"
      variant="ghost"
      icon={<Pencil />}
      onClick={open}
      aria-label={`${t("edit")}: ${label}`}
      title={t("edit")}
      className="!px-2 [@media(pointer:fine)]:!min-h-8"
      data-testid={`deed-${id}-edit`}
    />
  );

  if (chip) {
    return (
      <div
        data-testid={`deed-${id}`}
        data-empty="true"
        className={`inline-flex min-w-0 items-center gap-1 rounded-full border border-dashed border-line py-0.5 pl-3 pr-1 text-xs text-ink-muted ${inGrid ? "order-last" : ""}`}
      >
        <dt className="font-medium">{label}</dt>
        <dd className="flex items-center gap-1">
          <span aria-hidden="true">·</span>
          <span data-testid={`deed-${id}-value`}>{t("notRead")}</span>
          {editButton}
        </dd>
      </div>
    );
  }

  return (
    <div
      data-testid={`deed-${id}`}
      data-band={band ?? undefined}
      data-edited={f?.edited_by_human ? "true" : undefined}
      className={`grid min-w-0 basis-full gap-x-3 gap-y-0.5 rounded-md border-l-4 border-l-line py-1.5 pl-3 pr-1 transition-colors hover:bg-primary-soft/40 data-[band=high]:border-l-verified data-[band=medium]:border-l-review data-[band=low]:border-l-critical ${inGrid ? "sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]" : ""} ${highlighted ? "bg-primary-soft/60" : ""}`}
    >
      <dt className="pt-1 text-xs font-medium text-ink-muted">
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
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <span
                className={present ? "break-words font-medium text-ink" : "text-ink-muted"}
                data-testid={`deed-${id}-value`}
              >
                {present ? text : t("notRead")}
              </span>
              <span className="flex flex-wrap items-center justify-end gap-1">
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
                    className="!px-2 !py-0 font-medium"
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
                    title={t("locate")}
                    className="!px-2 aria-pressed:bg-primary-soft aria-pressed:text-primary [@media(pointer:fine)]:!min-h-8"
                    data-testid={`deed-${id}-locate`}
                  />
                )}
                {editButton}
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

const InGrid = createContext(false);

/**
 * The values of one part of the deed: one compact row per read value (label | value, badges and
 * buttons on the same line), then the values the deed did not show as small chips. In the "only
 * what needs checking" filter a part with nothing left says so.
 */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  const t = useTranslations("review.focus");
  const filtered = useReviewFocus()?.mode === "check";
  return (
    <InGrid.Provider value={true}>
      <dl className="peer flex flex-wrap items-center gap-1">{children}</dl>
      {filtered && (
        <p className="hidden text-xs text-ink-muted peer-empty:block">{t("allFine")}</p>
      )}
    </InGrid.Provider>
  );
}
