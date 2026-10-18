"use client";
import {
  useEffect,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import StatusBadge from "@/components/domain/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui";
import { HighlightProvider, useHighlight } from "./highlight";
import DocumentPreview from "./DocumentPreview";
import ExtractionPanel from "./ExtractionPanel";
import ReviewToolbar from "./ReviewToolbar";
import StalledActions from "./StalledActions";
import { EXTRACTION_READY, IN_PROGRESS } from "./types";
import { useDocumentStatus, useExtraction } from "./useReviewData";

/** Draggable divider (≥ 1280 px): pointer drag or arrow keys change the document pane width (35–70 %). */
function Splitter({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const clamp = (v: number) => Math.min(70, Math.max(35, v));
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const grid = e.currentTarget.parentElement;
    if (!grid) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => {
      const r = grid.getBoundingClientRect();
      onChange(clamp(((ev.clientX - r.left) / r.width) * 100));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") onChange(clamp(value - 3));
    else if (e.key === "ArrowRight") onChange(clamp(value + 3));
    else return;
    e.preventDefault();
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={35}
      aria-valuemax={70}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKey}
      className="group hidden w-3 cursor-col-resize touch-none items-stretch justify-center xl:flex"
    >
      <span className="w-px bg-line transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
    </div>
  );
}

/** On a phone the document is a separate tab: showing a value on the page opens it. */
function ShowDocumentOnHighlight({ setPane }: { setPane: (p: "doc") => void }) {
  const active = useHighlight()?.active;
  useEffect(() => {
    if (
      active &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(max-width: 767px)").matches
    )
      setPane("doc");
  }, [active, setPane]);
  return null;
}

export default function ReviewView({ id }: { id: string }) {
  const t = useTranslations("review");
  const doc = useDocumentStatus(id);
  const status = doc.data?.processing_status;
  const ext = useExtraction(id, status);
  const [split, setSplit] = useState(46);
  const [pane, setPane] = useState<"doc" | "fields">("fields");

  if (doc.isLoading) return <LoadingState />;
  if (doc.isError || !doc.data) {
    const e = doc.error;
    if (e instanceof ApiError && e.status === 404)
      return <ErrorState message={t("notFound")} />;
    return <ErrorState error={e} onRetry={() => doc.refetch()} />;
  }

  const d = doc.data;
  let body;
  if (status === "UPLOADED" || status === "FAILED") {
    body = (
      <StalledActions id={id} status={status} failureCode={d?.failure_code} />
    );
  } else if (status && IN_PROGRESS.includes(status)) {
    body = (
      <div
        role="status"
        data-testid="processing-state"
        className="glass-card p-6 text-center text-ink-muted"
      >
        {t("processing")}
      </div>
    );
  } else if (status && EXTRACTION_READY.includes(status)) {
    if (ext.isLoading) body = <LoadingState />;
    else if (ext.isError || !ext.data) {
      const notReady =
        ext.error instanceof ApiError &&
        ext.error.code === "EXTRACTION_NOT_READY";
      body = (
        <ErrorState
          error={notReady ? undefined : ext.error}
          message={notReady ? t("processing") : undefined}
          onRetry={() => ext.refetch()}
        />
      );
    } else body = <ExtractionPanel data={ext.data} />;
  } else body = <LoadingState />;

  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader
        title={t("title")}
        purpose={t("purpose")}
        meta={[
          <span key="s" data-testid="review-status">
            <StatusBadge code={d.processing_status} />
          </span>,
          `${t("docType")}: ${d.document_type}${d.land_id ? ` · ${d.land_id}` : ""}`,
        ]}
      />
      <ReviewToolbar id={id} />
      <div
        role="tablist"
        aria-label={t("panes.label")}
        className="grid grid-cols-2 gap-1 rounded-xl bg-primary-soft p-1 md:hidden"
      >
        {(["fields", "doc"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={pane === k}
            onClick={() => setPane(k)}
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${pane === k ? "bg-surface text-primary shadow-raised" : "text-ink-muted"}`}
          >
            {t(`panes.${k}`)}
          </button>
        ))}
      </div>
      <HighlightProvider>
        <ShowDocumentOnHighlight setPane={setPane} />
        <div
          className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,var(--split))_auto_minmax(0,var(--rest))] xl:gap-0"
          style={
            {
              "--split": `${split}fr`,
              "--rest": `${100 - split}fr`,
            } as React.CSSProperties
          }
          data-testid="review-columns"
        >
          <div
            className={`min-w-0 xl:pr-4 ${pane === "doc" ? "" : "max-md:hidden"}`}
          >
            <DocumentPreview id={id} fileType={d.file_type} />
          </div>
          <Splitter value={split} onChange={setSplit} label={t("splitter")} />
          <div
            className={`min-w-0 xl:pl-4 ${pane === "fields" ? "" : "max-md:hidden"}`}
          >
            {body}
          </div>
        </div>
      </HighlightProvider>
    </div>
  );
}
