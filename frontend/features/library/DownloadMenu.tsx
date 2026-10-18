"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, ChevronDown, Download, FileJson, FileText, FileType2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { Button, useToast } from "@/components/ui";

export type DownloadKind = "pdf" | "json" | "original" | "bundle";
const KINDS: DownloadKind[] = ["pdf", "json", "original", "bundle"];
const ICON = { pdf: FileText, json: FileJson, original: FileType2, bundle: Archive } as const;

export interface DownloadMenuProps {
  documentId: string;
  /** jpg | png | pdf: the extension of the original upload */
  fileType: string;
  /** the record version to download; null = let the server pick (newest approved, else newest) */
  version: number | null;
  /** true when the version is not approved: the server marks the file "-draft" */
  draft: boolean;
  /** false while the document has no digital record yet: PDF, JSON and bundle are then disabled */
  hasRecord: boolean;
  /** smaller trigger for table rows */
  compact?: boolean;
}

/** The file name the server sends (Content-Disposition), rebuilt here because the blob helper returns only bytes. */
export function downloadName(kind: DownloadKind, id: string, fileType: string, version: number | null, draft: boolean): string {
  const v = version ? `-v${version}` : "";
  const d = draft ? "-draft" : "";
  if (kind === "original") return `landshield-original-${id}.${fileType}`;
  if (kind === "pdf") return `landshield-deed-${id}${v}${d}.pdf`;
  if (kind === "json") return `landshield-record-${id}${v}${d}.json`;
  return `landshield-bundle-${id}${v}${d}.zip`;
}

export function downloadPath(kind: DownloadKind, id: string, version: number | null): string {
  const v = kind !== "original" && version ? `&version=${version}` : "";
  return `/documents/${id}/download?what=${kind}${v}`;
}

/** H8e: Download ▾ — digital deed PDF, record JSON, the original upload, or the ZIP bundle, for the version shown. */
export default function DownloadMenu({ documentId, fileType, version, draft, hasRecord, compact }: DownloadMenuProps) {
  const t = useTranslations("library.download");
  const { api } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DownloadKind | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const reason = (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.status === 429 || e.code === "RATE_LIMITED") return t("errors.rateLimited");
      if (e.code === "PDF_ENGINE_UNAVAILABLE") return t("errors.pdfUnavailable");
      if (e.status === 403 || e.status === 404) return t("errors.notAllowed");
    }
    return t("errors.failed");
  };

  const run = async (kind: DownloadKind) => {
    if (busy) return;
    setBusy(kind);
    try {
      const blob = await api.blob(downloadPath(kind, documentId, version));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName(kind, documentId, fileType, version, draft);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("success", t("done", { what: t(`kinds.${kind}`) }));
      setOpen(false);
    } catch (e) {
      toast("error", reason(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={root} className="relative inline-block" data-testid={`download-menu-${documentId}`}>
      <Button
        size={compact ? "sm" : "md"}
        variant="secondary"
        icon={<Download />}
        iconRight={<ChevronDown />}
        aria-expanded={open}
        aria-controls={`dl-${documentId}`}
        data-testid="download-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        {t("button")}
      </Button>
      {open && (
        <div
          id={`dl-${documentId}`}
          role="group"
          aria-label={t("label")}
          data-testid="download-list"
          className="glass-card absolute right-0 z-30 mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1 p-2 shadow-lift"
        >
          {draft && hasRecord && (
            <p role="note" data-testid="download-draft-note" className="px-2 py-1 text-xs text-ink-muted">{t("draftNote")}</p>
          )}
          {KINDS.map((kind) => {
            const Icon = ICON[kind];
            const needsRecord = kind !== "original";
            const disabled = (needsRecord && !hasRecord) || busy !== null;
            return (
              <button
                key={kind}
                type="button"
                disabled={disabled}
                aria-busy={busy === kind || undefined}
                data-testid={`download-${kind}`}
                onClick={() => run(kind)}
                className="flex min-h-touch items-start gap-3 rounded-lg px-2 py-2 text-left text-sm text-ink hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="flex flex-col">
                  <span className="font-medium">{busy === kind ? t("preparing") : t(`kinds.${kind}`)}</span>
                  <span className="text-xs text-ink-muted">{needsRecord && !hasRecord ? t("noRecord") : t(`hints.${kind}`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
