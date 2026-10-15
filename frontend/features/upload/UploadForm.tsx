"use client";
import { useId, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, CheckCircle2, CircleDashed, FileText, Play, ScanLine, UploadCloud, UserCheck } from "lucide-react";
import { Button, Card, Input, Select } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { cn } from "@/components/ui/cn";
import {
  ACCEPT,
  DOCUMENT_TYPES,
  LAND_ID_RE,
  errorCodeFromApi,
  formatBytes,
  validateFile,
  type UploadErrorCode,
} from "./validation";
import { EXTRACTION_READY } from "@/features/review/types";
import { TERMINAL_STATUSES, type DocumentUploadOut } from "./types";
import { Link } from "@/i18n/navigation";
import OfficeCascade from "@/features/officers/OfficeCascade";
import { bi, officePath, type Office } from "@/features/officers/types";
import { useDocumentStatus } from "./useDocumentStatus";

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
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);

  const m = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData();
      form.append("file", f);
      form.append("document_type", docType);
      if (landId.trim()) form.append("land_id", landId.trim().toUpperCase());
      if (!myOffice && office) form.append("office_id", office.id);
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
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setFileError("EMPTY_FILE");
    const fe = validateFile(file);
    setFileError(fe);
    const badLand = landId.trim() !== "" && !LAND_ID_RE.test(landId.trim().toUpperCase());
    setLandIdError(badLand);
    const noOffice = needsOffice && !office;
    setOfficeError(noOffice);
    if (fe || badLand || noOffice) return;
    m.mutate(file);
  }

  if (m.isSuccess) {
    return (
      <Card title={t("title")} icon={<FileText />} accent="verified">
        <DocumentStatusPanel doc={m.data} />
        <div className="mt-4">
          <Button variant="secondary" onClick={reset}>
            {t("another")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t("title")} icon={<UploadCloud />}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="text-ink-muted">{t("intro")}</p>

        <div
          data-testid="dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "glass-card flex flex-col items-center gap-2 border-2 border-dashed p-8 text-center transition-colors",
            "focus-within:ring-2 focus-within:ring-primary",
            dragging ? "border-primary bg-primary-soft" : "border-primary/40 hover:border-primary",
            shownError && "border-critical",
          )}
        >
          <span aria-hidden="true" className="icon-tile !h-12 !w-12 !rounded-xl">
            <UploadCloud className="h-6 w-6" />
          </span>
          <label htmlFor={fileId} className="cursor-pointer font-medium text-primary underline">
            {t("choose")}
          </label>
          <input
            ref={inputRef}
            id={fileId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-describedby={`${fileId}-hint`}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <p id={`${fileId}-hint`} className="text-sm text-ink-muted">
            {t("dropHint")}
          </p>
          {file && (
            <p
              data-testid="selected-file"
              className="inline-flex max-w-full items-center gap-2 break-all rounded-md border border-line bg-surface px-3 py-1 text-sm text-ink"
            >
              <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
              <span>
                {file.name} · {formatBytes(file.size)}
              </span>
            </p>
          )}
        </div>

        {shownError && (
          <p
            role="alert"
            data-testid="upload-error"
            className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t(`errors.${shownError}`)}</span>
          </p>
        )}

        <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3" data-testid="office-sortlist">
          <legend className="px-1 text-sm font-semibold">{t("officeLegend")}</legend>
          {myOffice ? (
            <p className="text-sm" data-testid="my-office">
              <span className="font-medium">{bi(myOffice.name_en, myOffice.name_bn)}</span>
              <br />
              <span className="text-ink-muted">{officePath(myOffice as Office)}</span>
              <br />
              <span className="text-xs text-ink-muted">{t("ownOfficeOnly")}</span>
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-muted">{t(needsOffice ? "pickOffice" : "pickOfficeOptional")}</p>
              <OfficeCascade officeId={office?.id ?? ""} onChange={setOffice} error={officeError ? t("errors.OFFICE_REQUIRED") : undefined} />
            </>
          )}
        </fieldset>
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

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={m.isPending} disabled={!file || !!fileError} icon={<UploadCloud />}>
            {t("submit")}
          </Button>
          {file && !m.isPending && (
            <Button variant="ghost" onClick={reset}>
              {t("clear")}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
