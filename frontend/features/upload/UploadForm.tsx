"use client";
import { useId, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileText, Play, UploadCloud } from "lucide-react";
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
import { TERMINAL_STATUSES, type DocumentUploadOut } from "./types";
import { Link } from "@/i18n/navigation";
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
  return (
    <div className="flex flex-col gap-3" data-testid="upload-result">
      <p
        role="status"
        className="flex items-center gap-2 rounded-md border border-verified/40 bg-verified/10 px-3 py-2 font-medium text-ink"
      >
        <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-verified" />
        <span>{doc.duplicate ? t("duplicate") : t("uploaded")}</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-line bg-surface-muted p-3 text-sm">
        <dt className="text-ink-muted">{t("statusLabel")}</dt>
        <dd data-testid="doc-status">
          <StatusBadge code={status} />
        </dd>
        <dt className="text-ink-muted">{t("type")}</dt>
        <dd>{t(`types.${doc.document_type}`)}</dd>
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
  const { api } = useAuth();
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
    if (fe || badLand) return;
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
    <Card title={t("title")} icon={<UploadCloud />} accent="primary">
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
            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            "focus-within:ring-2 focus-within:ring-primary",
            dragging ? "border-primary bg-primary-soft" : "border-primary/40 bg-primary-soft/40 hover:bg-primary-soft/70",
            shownError && "border-critical",
          )}
        >
          <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
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
