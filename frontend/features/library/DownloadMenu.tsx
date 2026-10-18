"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Archive, ChevronDown, Download, FileJson, FileText, FileType2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { Button, useToast } from "@/components/ui";

/** Until it is measured the list sits out of sight, so it never shows (or scrolls the page) at the end of <body>. */
const UNPLACED: CSSProperties = { position: "fixed", top: 0, right: 0, visibility: "hidden" };

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
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>(UNPLACED);
  const trigger = () => root.current?.querySelector<HTMLButtonElement>("[data-testid=download-trigger]");
  /** Close and hand focus back to the trigger (the list is outside the row in the tab order). */
  const close = () => {
    setOpen(false);
    trigger()?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // The list lives in a portal on <body>: inside a table row it was clipped by the scrolling table and the glass
  // card (backdrop-filter). It is pinned to the trigger's right edge, below it, or above it when there is no room.
  useLayoutEffect(() => {
    if (!open) {
      setPos(UNPLACED);
      return;
    }
    const place = () => {
      const r = root.current?.getBoundingClientRect();
      if (!r) return;
      const h = menu.current?.offsetHeight ?? 0;
      const gap = 6;
      const above = r.bottom + gap + h > window.innerHeight - 8 && r.top - gap - h > 8;
      setPos({
        position: "fixed",
        right: Math.max(8, window.innerWidth - r.right),
        top: above ? r.top - gap - h : r.bottom + gap,
      });
    };
    place();
    menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
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
        title={compact ? t("button") : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {/* in a table row the column header already says "Download": the trigger shows only its icon */}
        {compact ? <span className="sr-only">{t("button")}</span> : t("button")}
      </Button>
      {open &&
        createPortal(
        <div
          ref={menu}
          style={pos}
          id={`dl-${documentId}`}
          role="group"
          aria-label={t("label")}
          data-testid="download-list"
          onKeyDown={(e) => {
            if (e.key !== "Tab") return;
            const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
            const leaving = e.shiftKey ? document.activeElement === items[0] : document.activeElement === items[items.length - 1];
            if (leaving) {
              e.preventDefault();
              close();
            }
          }}
          className="z-50 flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-1 rounded-xl border border-line/80 bg-surface p-2 shadow-lift"
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
        </div>,
          document.body,
        )}
    </div>
  );
}
