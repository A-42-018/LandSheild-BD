"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { toRecordErrors } from "../useReviewActions";
import type { RecordOp } from "../types";
import { issuesAt, useRecordEditContext } from "./RecordEdit";

/** Runs list edits (add / remove) through the record-edit context; keeps the busy flag and the refusal text. */
export function useListOps() {
  const t = useTranslations("review.deed");
  const ctx = useRecordEditContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const issueText = useIssueText();

  const run = async (ops: RecordOp | RecordOp[]): Promise<boolean> => {
    if (!ctx) return false;
    setBusy(true);
    setError("");
    try {
      await ctx.save(ops);
      return true;
    } catch (e) {
      const errs = toRecordErrors(e);
      setError(errs.length ? errs.map((x) => issueText(x.code, x.message)).join(" ") : t("errors.saveFailed"));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, error, setError, editable: !!ctx?.editable };
}

export function useIssueText() {
  const t = useTranslations("review.deed");
  return (code: string, message?: string) =>
    t.has(`issues.${code}`) ? t(`issues.${code}`) : message || t("issues.UNKNOWN");
}

/** Remove button with a one-step confirmation; sends one `remove` op for the pointer. */
export function RemoveButton({ id, path, what }: { id: string; path: string; what: string }) {
  const t = useTranslations("review.deed");
  const { run, busy, error, editable } = useListOps();
  const [sure, setSure] = useState(false);
  if (!editable) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid={`deed-${id}-remove-box`}>
      {sure ? (
        <>
          <span className="text-xs text-ink-muted">{t("removeSure")}</span>
          <Button
            size="sm"
            variant="danger"
            loading={busy}
            onClick={async () => {
              if (await run({ op: "remove", path })) setSure(false);
            }}
            aria-label={`${t("removeYes")}: ${what}`}
            data-testid={`deed-${id}-remove-yes`}
          >
            {t("removeYes")}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setSure(false)}>
            {t("cancel")}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 />}
          onClick={() => setSure(true)}
          aria-label={`${t("remove")}: ${what}`}
          data-testid={`deed-${id}-remove`}
        >
          {t("remove")}
        </Button>
      )}
      {error && (
        <span role="alert" className="text-xs text-critical" data-testid={`deed-${id}-remove-error`}>
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * Add form for a list: an optional select and an optional text box, one Add button.
 * `build(select, text)` makes the value of the `add` op sent to `path` (ends in "/-" = append).
 */
export function AddItem({
  id,
  path,
  title,
  select,
  text,
  build,
}: {
  id: string;
  path: string;
  title: string;
  select?: { label: string; options: { value: string; label: string }[]; initial: string };
  text?: { label: string; required?: boolean; lang?: string };
  build: (select: string, text: string) => unknown;
}) {
  const t = useTranslations("review.deed");
  const { run, busy, error, setError, editable } = useListOps();
  const [sel, setSel] = useState(select?.initial ?? "");
  const [txt, setTxt] = useState("");
  const [missing, setMissing] = useState(false);
  if (!editable) return null;
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-2"
      data-testid={`deed-${id}-add-form`}
      aria-label={title}
      onSubmit={async (e) => {
        e.preventDefault();
        const v = txt.trim();
        if (text?.required && !v) {
          setMissing(true);
          return;
        }
        setMissing(false);
        setError("");
        if (await run({ op: "add", path, value: build(sel, v) })) setTxt("");
      }}
    >
      {select && (
        <Select
          label={select.label}
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          options={select.options}
          disabled={busy}
          data-testid={`deed-${id}-add-select`}
        />
      )}
      {text && (
        <Input
          label={text.label}
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          lang={text.lang ?? "bn"}
          error={missing ? t("errors.valueRequired") : undefined}
          disabled={busy}
          data-testid={`deed-${id}-add-input`}
        />
      )}
      <Button type="submit" size="sm" variant="secondary" icon={<Plus />} loading={busy} data-testid={`deed-${id}-add`}>
        {title}
      </Button>
      {error && (
        <p role="alert" className="w-full text-xs text-critical" data-testid={`deed-${id}-add-error`}>
          {error}
        </p>
      )}
    </form>
  );
}

/** Issues the API reports for a whole list (path is the list itself, e.g. /parties): no field to sit next to. */
export function ContainerIssues({ paths }: { paths: string[] }) {
  const ctx = useRecordEditContext();
  const issueText = useIssueText();
  if (!ctx) return null;
  const found = ctx.issues.filter((i) => paths.includes(i.path));
  if (found.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {found.map((i) => (
        <p
          key={`${i.code}${i.path}`}
          role={i.severity === "error" ? "alert" : "status"}
          data-testid="deed-container-issue"
          data-severity={i.severity}
          data-path={i.path}
          className={i.severity === "error" ? "text-xs text-critical" : "text-xs text-review"}
        >
          {issueText(i.code, i.message)}
        </p>
      ))}
    </div>
  );
}

export { issuesAt };
