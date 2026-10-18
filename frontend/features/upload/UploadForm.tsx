"use client";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, CheckCircle2, CircleDashed, ClipboardCheck, FileText, Landmark, Play, ScanLine, UploadCloud, UserCheck, X } from "lucide-react";
import { localDigits } from "@/lib/intl-locale";
import { Button, Card, Input, Select } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { cn } from "@/components/ui/cn";
import {
  ACCEPT,
  DOCUMENT_TYPES,
  LAND_ID_RE,
  normaliseLandId,
  errorCodeFromApi,
  formatBytes,
  validateFile,
  type UploadErrorCode,
} from "./validation";
import { EXTRACTION_READY } from "@/features/review/types";
import StalledActions from "@/features/review/StalledActions";
import { TERMINAL_STATUSES, type DocumentUploadOut } from "./types";
import { Link } from "@/i18n/navigation";
import OfficeCascade from "@/features/officers/OfficeCascade";
import { bi, officePath, type Office } from "@/features/officers/types";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { useDocumentStatus } from "./useDocumentStatus";
import {
  EMPTY_PARTY,
  PartyNidFields,
  checkParty,
  hasErrors,
  needsPartyNid,
  toBody,
  type PartyNidErrors,
  type PartyNidValue,
} from "./PartyNidFields";
import DemoDocPicker from "@/features/demo-docs/DemoDocPicker";
import { DEMO_OWNERS, UPLOAD_DEMO_DOCS, type UploadDemoDoc } from "@/features/demo-docs/catalog";

function DocumentStatusPanel({ doc }: { doc: DocumentUploadOut }) {
  const t = useTranslations("upload");
  const tr = useTranslations("review");
  const { api } = useAuth();
  const qc = useQueryClient();
  const q = useDocumentStatus(doc.id);
  const status = q.data?.processing_status ?? doc.processing_status;
  const start = useMutation({
    mutationFn: () => api.post(`/documents/${doc.id}/process`),
    onSettled: () => qc.invalidateQueries({ queryKey: ["document", doc.id] }),
  });
  const busy = !TERMINAL_STATUSES.includes(status);
  const ocrDone = EXTRACTION_READY.includes(status);
  const steps = [
    { key: "uploaded", Icon: UploadCloud, done: true },
    { key: "ocr", Icon: ScanLine, done: ocrDone },
    { key: "review", Icon: UserCheck, done: status === "APPROVED" || status === "REJECTED" },
  ];
  return (
    <div className="flex flex-col gap-3" data-testid="upload-result">
      <ol aria-label={t("steps.label")} className="grid grid-cols-3 gap-2" data-testid="upload-steps">
        {steps.map(({ key, Icon, done }) => (
          <li key={key} data-done={done} className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center text-xs font-medium ${done ? "border-verified/40 bg-verified-soft/60 text-verified" : "border-line bg-surface/60 text-ink-muted"}`}>
            <span aria-hidden="true">{done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</span>
            {t(`steps.${key}`)}
          </li>
        ))}
      </ol>
      <p
        role="status"
        className="glass-card flex items-center gap-2 border-l-[4px] border-l-verified px-3 py-2 font-medium text-ink"
      >
        <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-verified" />
        <span>{doc.duplicate ? t("duplicate") : t("uploaded")}</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-line/70 bg-surface/60 p-3 text-sm">
        <dt className="text-ink-muted">{t("statusLabel")}</dt>
        <dd data-testid="doc-status">
          <StatusBadge code={status} />
        </dd>
        <dt className="text-ink-muted">{t("type")}</dt>
        <dd>{t(`types.${doc.document_type}`)}</dd>
        {doc.office && (
          <>
            <dt className="text-ink-muted">{t("filedUnder")}</dt>
            <dd data-testid="doc-office">
              {bi(doc.office.name_en, doc.office.name_bn)}
              <br />
              <span className="text-xs text-ink-muted">{officePath(doc.office as Office)}</span>
            </dd>
          </>
        )}
        {doc.land_id && (
          <>
            <dt className="text-ink-muted">{t("landId")}</dt>
            <dd>{doc.land_id}</dd>
          </>
        )}
        <dt className="text-ink-muted">{t("hash")}</dt>
        <dd className="break-all font-mono text-xs">{doc.file_hash.slice(0, 16)}…</dd>
      </dl>
      {status === "UPLOADED" && (
        <div className="flex flex-col gap-2">
          <Button
            className="w-fit"
            icon={<Play />}
            loading={start.isPending}
            onClick={() => start.mutate()}
            data-testid="start-processing"
          >
            {t("startProcessing")}
          </Button>
          {start.isError && (
            <p role="alert" className="text-sm text-critical">
              {t("processError")}
            </p>
          )}
        </div>
      )}
      {busy && status !== "UPLOADED" && !q.isError && <p className="text-sm text-ink-muted">{t("polling")}</p>}
      {status === "FAILED" && <StalledActions id={doc.id} status="FAILED" failureCode={q.data?.failure_code ?? doc.failure_code} />}
      {!busy && status !== "FAILED" && (
        <Link
          href={`/officer/review/${doc.id}`}
          className="inline-flex w-fit items-center gap-2 rounded-md bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary underline"
        >
          {tr("openReview")}
        </Link>
      )}
      {q.isError && (
        <p role="alert" className="text-sm text-critical">
          {t("statusError")}
        </p>
      )}
    </div>
  );
}

export default function UploadForm() {
  const t = useTranslations("upload");
  const tp = useTranslations("partyNid");
  const { api, user } = useAuth();
  const myOffice = user?.office ?? null; // an office officer files only into their own office
  const needsOffice = !myOffice && user?.role === "ADMIN";
  const [office, setOffice] = useState<Office | null>(null);
  const [officeError, setOfficeError] = useState(false);
  const fileId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<UploadErrorCode | null>(null);
  const [docType, setDocType] = useState<string>("DEED");
  const [landId, setLandId] = useState("");
  const [landIdError, setLandIdError] = useState(false);
  const [buyer, setBuyer] = useState<PartyNidValue>(EMPTY_PARTY);
  const [seller, setSeller] = useState<PartyNidValue>(EMPTY_PARTY);
  const [nidErrors, setNidErrors] = useState<{ buyer: PartyNidErrors; seller: PartyNidErrors }>({ buyer: {}, seller: {} });
  const withNid = needsPartyNid(docType);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);

  const m = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData();
      form.append("file", f);
      form.append("document_type", docType);
      if (landId.trim()) form.append("land_id", normaliseLandId(landId));
      if (!myOffice && office) form.append("office_id", office.id);
      if (withNid) {
        for (const [party, v] of [["buyer", buyer], ["seller", seller]] as const) {
          if (!v.nid.trim()) continue;
          const b = toBody(v);
          form.append(`${party}_nid`, b.nid);
          form.append(`${party}_dob`, b.date_of_birth);
        }
      }
      setProgress(0);
      return api.upload<DocumentUploadOut>("/documents/upload", form, { onProgress: setProgress });
    },
  });

  const apiCode: UploadErrorCode | null = m.error
    ? m.error instanceof ApiError
      ? errorCodeFromApi(m.error)
      : "GENERIC"
    : null;
  const shownError = fileError ?? apiCode;

  function pick(f: File | undefined | null) {
    m.reset();
    if (!f) return;
    setFile(f);
    setFileError(validateFile(f));
  }

  function pickDemo(f: File, d: UploadDemoDoc) {
    pick(f);
    if (inputRef.current) inputRef.current.value = "";
    setDocType(d.docType);
    // the parties named on the sample deed; survey records have none
    setBuyer(d.parties ? { ...DEMO_OWNERS[d.parties.buyer] } : EMPTY_PARTY);
    setSeller(d.parties ? { ...DEMO_OWNERS[d.parties.seller] } : EMPTY_PARTY);
    setNidErrors({ buyer: {}, seller: {} });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  function reset() {
    m.reset();
    setFile(null);
    setFileError(null);
    setLandId("");
    setLandIdError(false);
    setBuyer(EMPTY_PARTY);
    setSeller(EMPTY_PARTY);
    setNidErrors({ buyer: {}, seller: {} });
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  const focus = useFocusFirstInvalid();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setFileError("EMPTY_FILE");
      return focus.request();
    }
    const fe = validateFile(file);
    setFileError(fe);
    const badLand = landId.trim() !== "" && !LAND_ID_RE.test(normaliseLandId(landId));
    setLandIdError(badLand);
    const noOffice = needsOffice && !office;
    setOfficeError(noOffice);
    // the new owner's NID is required for a deed; the seller's only when the office has it
    const nids = withNid ? { buyer: checkParty(buyer, true), seller: checkParty(seller, false) } : { buyer: {}, seller: {} };
    setNidErrors(nids);
    const badNid = hasErrors(nids.buyer) || hasErrors(nids.seller);
    if (fe || badLand || noOffice || badNid) return focus.request();
    m.mutate(file);
  }

  if (m.isSuccess) {
    return (
      <Card title={t("title")} icon={<FileText />} accent="verified" className="max-w-2xl">
        <DocumentStatusPanel doc={m.data} />
        <div className="mt-4">
          <Button variant="secondary" onClick={reset}>
            {t("another")}
          </Button>
        </div>
      </Card>
    );
  }

  const typeLabel = t(`types.${docType}`);
  const officeName = myOffice ? bi(myOffice.name_en, myOffice.name_bn) : office ? bi(office.name_en, office.name_bn) : null;
  const buyerDone = !hasErrors(checkParty(buyer, true));
  const fileOk = !!file && !fileError;
  const checklist: { key: string; label: string; value: string | null; done: boolean; optional?: boolean }[] = [
    { key: "file", label: t("summary.file"), value: file ? file.name : null, done: fileOk },
    { key: "office", label: t("summary.office"), value: officeName, done: !!officeName, optional: !needsOffice && !myOffice },
    { key: "type", label: t("type"), value: typeLabel, done: true },
    ...(withNid ? [{ key: "owner", label: t("summary.owner"), value: buyerDone ? tp("entered") : null, done: buyerDone }] : []),
  ];
  const requiredLeft = checklist.filter((c) => !c.done && !c.optional).length;
  let step = 0;

  return (
    <form ref={focus.ref} onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <UploadStep n={++step} title={t("sections.file")} hint={t("intro")} done={fileOk}>
          <div
            data-testid="dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            // the whole box opens the file dialog, not only the "Choose a file" link
            onClick={(e) => {
              if (!(e.target as Element).closest("label,button,input,a")) inputRef.current?.click();
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
              "focus-within:ring-2 focus-within:ring-primary",
              dragging ? "border-primary bg-primary-soft" : "border-primary/35 bg-surface/50 hover:border-primary hover:bg-primary-soft/40",
              shownError && "border-critical",
            )}
          >
            <span aria-hidden="true" className="icon-tile !h-14 !w-14 !rounded-2xl">
              <UploadCloud className="h-7 w-7" />
            </span>
            <label htmlFor={fileId} className="cursor-pointer text-base font-semibold text-primary underline-offset-4 hover:underline">
              {t("choose")}
            </label>
            <input
              ref={inputRef}
              id={fileId}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-invalid={fileError ? true : undefined}
              aria-describedby={`${fileId}-hint`}
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <p id={`${fileId}-hint`} className="text-sm text-ink-muted">
              {t("dropHint")}
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs text-ink-muted" aria-hidden="true">
              <span className="h-px w-10 bg-line" />
              {t("or")}
              <span className="h-px w-10 bg-line" />
            </div>
            <DemoDocPicker docs={UPLOAD_DEMO_DOCS} disabled={m.isPending} onPick={pickDemo} />
          </div>

          {file && (
            <div
              data-testid="selected-file"
              className={cn(
                "mt-3 flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5",
                fileError ? "border-critical/50" : "border-verified/40",
              )}
            >
              <span aria-hidden="true" className="icon-tile !h-10 !w-10 !rounded-lg">
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink" title={file.name}>{file.name}</span>
                <span className="block text-xs text-ink-muted">{formatBytes(file.size)}</span>
              </span>
              {!m.isPending && (
                <Button variant="ghost" size="sm" icon={<X />} onClick={reset} data-testid="clear-file">
                  {t("clear")}
                </Button>
              )}
            </div>
          )}

          {shownError && (
            <p
              role="alert"
              data-testid="upload-error"
              className="mt-3 flex items-start gap-2 rounded-xl border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t(`errors.${shownError}`)}</span>
            </p>
          )}
        </UploadStep>

        <UploadStep n={++step} title={t("officeLegend")} done={!!officeName} fieldset data-testid="office-sortlist">
          {myOffice ? (
            <div className="flex items-start gap-3 rounded-xl border border-line/80 bg-surface px-3 py-3 text-sm" data-testid="my-office">
              <span aria-hidden="true" className="icon-tile !h-9 !w-9 !rounded-lg">
                <Landmark className="h-4 w-4" />
              </span>
              <p>
                <span className="font-medium">{bi(myOffice.name_en, myOffice.name_bn)}</span>
                <br />
                <span className="text-ink-muted">{officePath(myOffice as Office)}</span>
                <br />
                <span className="text-xs text-ink-muted">{t("ownOfficeOnly")}</span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">{t(needsOffice ? "pickOffice" : "pickOfficeOptional")}</p>
              <OfficeCascade officeId={office?.id ?? ""} onChange={setOffice} error={officeError ? t("errors.OFFICE_REQUIRED") : undefined} />
            </div>
          )}
        </UploadStep>

        <UploadStep n={++step} title={t("sections.details")} done={!!landId.trim() && !landIdError}>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Select
              label={t("type")}
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              options={DOCUMENT_TYPES.map((d) => ({ value: d, label: t(`types.${d}`) }))}
            />
            <Input
              label={t("landId")}
              hint={t("landIdHint")}
              placeholder="LP-10100"
              value={landId}
              onChange={(e) => setLandId(e.target.value)}
              error={landIdError ? t("errors.LAND_ID") : undefined}
            />
          </div>
        </UploadStep>

        {withNid && (
          <UploadStep n={++step} title={tp("legend")} hint={tp("intro")} done={buyerDone} fieldset data-testid="party-nids">
            <div className="grid gap-4">
              <div className="rounded-xl border border-line/80 bg-surface/70 p-3">
                <PartyNidFields party="buyer" value={buyer} onChange={setBuyer} errors={nidErrors.buyer} required />
              </div>
              <div className="rounded-xl border border-dashed border-line bg-surface/40 p-3">
                <PartyNidFields party="seller" value={seller} onChange={setSeller} errors={nidErrors.seller} required={false} />
              </div>
            </div>
          </UploadStep>
        )}
      </div>

      <aside aria-labelledby={`${fileId}-summary`} className="glass-card flex flex-col gap-4 p-4 lg:sticky lg:top-24" data-testid="upload-summary">
        <div>
          <h2 id={`${fileId}-summary`} className="flex items-center gap-2 text-base font-semibold text-ink">
            <ClipboardCheck aria-hidden="true" className="h-5 w-5 text-primary" />
            {t("summary.title")}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">{requiredLeft ? t("summary.left", { count: requiredLeft }) : t("summary.ready")}</p>
        </div>
        <ul className="flex flex-col gap-2.5">
          {checklist.map((c) => (
            <li key={c.key} className="flex items-start gap-2.5 text-sm" data-done={c.done}>
              {c.done ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-verified" />
              ) : (
                <CircleDashed aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
              )}
              <span className="min-w-0">
                <span className="block font-medium text-ink">{c.label}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {c.value ?? (c.optional ? t("summary.optional") : t("summary.missing"))}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {m.isPending && (
          <div className="flex flex-col gap-1">
            <div
              role="progressbar"
              aria-label={t("progress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-2.5 w-full overflow-hidden rounded-full bg-primary-soft"
            >
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-ink-muted">
              {t("uploading")} {progress}%
            </p>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={m.isPending} disabled={!fileOk} icon={<UploadCloud />}>
          {t("submit")}
        </Button>
        {!file && <p className="-mt-2 text-center text-xs text-ink-muted">{t("summary.needFile")}</p>}
      </aside>
    </form>
  );
}

/** One numbered section of the upload form; `fieldset` groups its controls for screen readers (legend = title). */
function UploadStep({
  n,
  title,
  hint,
  done,
  fieldset,
  children,
  ...rest
}: {
  n: number;
  title: string;
  hint?: string;
  done: boolean;
  fieldset?: boolean;
  children: ReactNode;
  "data-testid"?: string;
}) {
  const locale = useLocale();
  const Tag = fieldset ? "fieldset" : "section";
  const Head = fieldset ? "legend" : "h2";
  return (
    <Tag className="glass-card min-w-0 p-0" {...rest}>
      <Head className="float-left flex w-full items-center gap-3 border-b border-line/70 px-4 py-3">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            done ? "bg-verified text-surface" : "bg-primary-soft text-primary ring-1 ring-primary/25",
          )}
        >
          {done ? <Check className="h-4 w-4" /> : localDigits(n, locale)}
        </span>
        <span className="text-base font-semibold text-ink">{title}</span>
      </Head>
      <div className="clear-both p-4">
        {hint && <p className="mb-3 text-sm text-ink-muted">{hint}</p>}
        {children}
      </div>
    </Tag>
  );
}
