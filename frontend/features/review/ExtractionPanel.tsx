"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ListChecks, Pencil } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { BAND_TONE, bandFor, percent } from "./confidence";
import DeedProfileSwitch from "./DeedProfileSwitch";
import DeedView from "./deed/DeedView";
import { issuesOf, RecordEditProvider } from "./deed/RecordEdit";
import EngineBadge from "./EngineBadge";
import ReviewActions, { REVIEWABLE } from "./ReviewActions";
import PartyNidPanel from "./PartyNidPanel";
import { needsPartyNid } from "@/features/upload/PartyNidFields";
import { useDocumentStatus } from "./useReviewData";
import { fieldErrorText, toFieldErrors, useReviewActions } from "./useReviewActions";
import type { ExtractedFieldOut, ExtractionOut, FieldError } from "./types";

type T = ReturnType<typeof useTranslations>;

function FieldRow({
  f,
  label,
  threshold,
  editable,
  errors,
  onSave,
  t,
}: {
  f: ExtractedFieldOut;
  label: string;
  threshold: number;
  editable: boolean;
  errors: FieldError[];
  onSave: (value: string | null) => Promise<unknown>;
  t: T;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldError[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const band = bandFor(f.confidence, threshold);
  // the input is disabled while saving and so loses focus; give it back when the save is refused
  const focus = useFocusFirstInvalid();

  const open = () => {
    setDraft(f.value ?? "");
    setServerErrors([]);
    setSaveFailed(false);
    setEditing(true);
  };
  const save = async () => {
    const next = draft.trim() === "" ? null : draft;
    if ((next ?? "") === (f.value ?? "")) return setEditing(false);
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      const fe = toFieldErrors(e);
      setServerErrors(fe);
      setSaveFailed(fe.length === 0);
      focus.request();
    } finally {
      setSaving(false);
    }
  };

  const shown = (editing ? serverErrors : errors).map((e) => fieldErrorText(t as never, e));
  const errorText = shown.join(" ") || (saveFailed ? t("actions.saveFailed") : "");

  return (
    <div
      data-testid={`field-${f.field}`}
      className="flex flex-col gap-1 border-l-4 py-2 pl-3 data-[band=high]:border-l-verified data-[band=medium]:border-l-review data-[band=low]:border-l-critical "
      data-band={band}
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-col gap-1">
        {editing ? (
          <form
            ref={focus.ref}
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              label={label}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              error={errorText || undefined}
              disabled={saving}
              data-testid={`input-${f.field}`}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={saving} data-testid={`save-${f.field}`}>
                {t("save")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className={f.value ? "break-words text-ink" : "text-ink-muted"} data-testid={`value-${f.field}`}>
                {f.value ? f.value : t("valueNotFound")}
              </span>
              <span className="flex items-center gap-1">
                {f.edited_by_human && <Badge tone="pending">{t("edited")}</Badge>}
                <Badge tone={BAND_TONE[band]} data-band={band} title={t("confidence")}>
                  {t(`band.${band}`)} · {percent(f.confidence)}%
                </Badge>
                {editable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Pencil />}
                    onClick={open}
                    aria-label={`${t("edit")}: ${label}`}
                    data-testid={`edit-${f.field}`}
                  >
                    {t("edit")}
                  </Button>
                )}
              </span>
            </div>
            {errorText && (
              <p role="alert" data-testid={`error-${f.field}`} className="text-xs text-critical">
                {errorText}
              </p>
            )}
          </>
        )}
      </dd>
    </div>
  );
}

export default function ExtractionPanel({ data }: { data: ExtractionOut }) {
  const t = useTranslations("review");
  const te = useTranslations("errors");
  const actions = useReviewActions(data.document_id);
  const editable = REVIEWABLE.includes(data.processing_status);
  const doc = useDocumentStatus(data.document_id).data;
  const withNid = !!doc && needsPartyNid(doc.document_type);
  // the backend refuses to approve a deed without the new owner's NID; say so before the click
  const needsNid = withNid && !doc?.party_nids?.buyer;
  // H6a: a historical deed with an LHDR record shows the sectioned digital deed; everything else keeps the 13 rows
  const historical = data.deed_profile === "historical" && !!data.record;
  const lowLabels = data.low_confidence_fields.map((f) => (t.has(`fields.${f}`) ? t(`fields.${f}`) : f));

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="extraction-panel">
      {data.has_low_confidence && (
        <div role="alert" data-testid="low-confidence-banner" className="glass-card border-l-[4px] border-l-review p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-review">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{te("lowConfidence")}</span>
          </p>
          <p className="mt-1 text-ink">
            {t("lowConfidenceFields")}: {lowLabels.join(", ")}
          </p>
        </div>
      )}
      <EngineBadge data={data} />
      <DeedProfileSwitch data={data} actions={actions} />
      {historical ? (
        <>
          <RecordEditProvider documentId={data.document_id} editable={editable} issues={issuesOf(data)}>
            <DeedView record={data.record!} threshold={data.threshold} />
          </RecordEditProvider>
          <details data-testid="core-fields" className="text-sm">
            <summary className="cursor-pointer font-medium text-ink">{t("deed.coreFields")}</summary>
            <div className="mt-2">
            <Card title={t("fieldsTitle")} icon={<ListChecks />}>
              <dl className="divide-y divide-line">
                {data.fields.map((f) => (
                  <FieldRow
                    key={f.field}
                    f={f}
                    t={t}
                    label={t.has(`fields.${f.field}`) ? t(`fields.${f.field}`) : f.field}
                    threshold={data.threshold}
                    editable={editable}
                    errors={editable ? data.validation.errors.filter((e) => e.field === f.field) : []}
                    onSave={(value) => actions.save.mutateAsync({ field: f.field, value })}
                  />
                ))}
              </dl>
            </Card>
            </div>
          </details>
        </>
      ) : (
        <Card title={t("fieldsTitle")} icon={<ListChecks />}>
          <dl className="divide-y divide-line">
            {data.fields.map((f) => (
              <FieldRow
                key={f.field}
                f={f}
                t={t}
                label={t.has(`fields.${f.field}`) ? t(`fields.${f.field}`) : f.field}
                threshold={data.threshold}
                editable={editable}
                errors={editable ? data.validation.errors.filter((e) => e.field === f.field) : []}
                onSave={(value) => actions.save.mutateAsync({ field: f.field, value })}
              />
            ))}
          </dl>
        </Card>
      )}
      {withNid && doc && <PartyNidPanel doc={doc} editable={editable} />}
      <ReviewActions data={data} actions={actions} needsNid={needsNid} />
      <p className="text-xs text-ink-muted">{t("disclaimer")}</p>
    </div>
  );
}
