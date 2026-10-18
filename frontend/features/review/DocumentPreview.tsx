"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, ErrorState, LoadingState } from "@/components/ui";
import { useHighlight } from "./highlight";
import { useDocumentFile } from "./useReviewData";

const ZOOMS = [50, 75, 100, 150, 200, 300];

export default function DocumentPreview({
  id,
  fileType,
}: {
  id: string;
  fileType: string;
}) {
  const t = useTranslations("review");
  const file = useDocumentFile(id);
  const [zi, setZi] = useState(2); // 100 %
  const zoom = ZOOMS[zi];
  const isPdf = fileType.toLowerCase() === "pdf";
  const hl = useHighlight();
  const active = hl?.active ?? null;
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // images show the first page only; a PDF can switch page, but its viewer cannot be drawn on
  const box =
    active && !isPdf && active.page <= 1 && natural ? active.bbox : null;
  const page = isPdf && active ? Math.max(1, active.page) : 1;
  useEffect(() => {
    if (box)
      boxRef.current?.scrollIntoView?.({
        block: "center",
        inline: "center",
        behavior: "smooth",
      });
  }, [box]);

  return (
    <section
      aria-label={t("preview.title")}
      data-testid="doc-preview"
      className="flex min-w-0 flex-col gap-2 xl:h-[calc(100vh-6rem)]"
    >
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t("preview.zoom")}
      >
        <Button
          variant="secondary"
          size="sm"
          aria-label={t("preview.zoomOut")}
          disabled={zi === 0}
          onClick={() => setZi(zi - 1)}
        >
          −
        </Button>
        <span
          aria-live="polite"
          data-testid="zoom-level"
          className="min-w-[3.5rem] text-center text-sm text-ink-muted"
        >
          {zoom}%
        </span>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t("preview.zoomIn")}
          disabled={zi === ZOOMS.length - 1}
          onClick={() => setZi(zi + 1)}
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={zoom === 100}
          onClick={() => setZi(2)}
        >
          {t("preview.reset")}
        </Button>
      </div>
      {active && (
        <p
          role="status"
          data-testid="highlight-status"
          className="flex flex-wrap items-center gap-2 text-sm text-ink"
        >
          <span>
            {t("preview.highlighted", {
              label: active.label,
              page: active.page,
            })}
            {!box && (
              <span className="text-ink-muted">
                {" "}
                · {t(isPdf ? "preview.pdfNoBox" : "preview.noBox")}
              </span>
            )}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={hl?.clear}
            data-testid="highlight-clear"
          >
            {t("preview.clearHighlight")}
          </Button>
        </p>
      )}
      {/* ≥ 1280 px the pane is sticky beside the fields and exactly one screen tall: the scan box
          takes the height the zoom row and the highlight line leave, so nothing is cut off below */}
      <div className="max-h-[70vh] min-h-[16rem] overflow-auto glass-card !rounded-card xl:min-h-0 xl:max-h-none xl:flex-1">
        {file.loading && <LoadingState />}
        {file.error && (
          <ErrorState message={t("preview.error")} onRetry={file.retry} />
        )}
        {file.url && !isPdf && (
          <div className="relative" style={{ width: `${zoom}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={file.url}
              alt={t("preview.alt")}
              style={{ width: "100%", maxWidth: "none" }}
              className="block h-auto"
              onLoad={(e) =>
                setNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
            />
            {box && natural && natural.w > 0 && natural.h > 0 && (
              <div
                ref={boxRef}
                aria-hidden="true"
                data-testid="highlight-box"
                className="pointer-events-none absolute rounded-sm border-2 border-primary bg-primary/20"
                style={{
                  left: `${(box[0] / natural.w) * 100}%`,
                  top: `${(box[1] / natural.h) * 100}%`,
                  width: `${(box[2] / natural.w) * 100}%`,
                  height: `${(box[3] / natural.h) * 100}%`,
                }}
              />
            )}
          </div>
        )}
        {file.url && isPdf && (
          <iframe
            key={`${zoom}-${page}`}
            title={t("preview.alt")}
            src={`${file.url}#page=${page}&zoom=${zoom}`}
            className="h-[70vh] w-full xl:h-full"
          />
        )}
      </div>
      <p className="text-xs text-ink-muted">{t("preview.note")}</p>
    </section>
  );
}
