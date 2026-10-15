"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, ErrorState, LoadingState } from "@/components/ui";
import { useDocumentFile } from "./useReviewData";

const ZOOMS = [50, 75, 100, 150, 200, 300];

export default function DocumentPreview({ id, fileType }: { id: string; fileType: string }) {
  const t = useTranslations("review");
  const file = useDocumentFile(id);
  const [zi, setZi] = useState(2); // 100 %
  const zoom = ZOOMS[zi];
  const isPdf = fileType.toLowerCase() === "pdf";

  return (
    <section aria-label={t("preview.title")} data-testid="doc-preview" className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("preview.zoom")}>
        <Button variant="secondary" size="sm" aria-label={t("preview.zoomOut")} disabled={zi === 0} onClick={() => setZi(zi - 1)}>
          −
        </Button>
        <span aria-live="polite" data-testid="zoom-level" className="min-w-[3.5rem] text-center text-sm text-ink-muted">
          {zoom}%
        </span>
        <Button variant="secondary" size="sm" aria-label={t("preview.zoomIn")} disabled={zi === ZOOMS.length - 1} onClick={() => setZi(zi + 1)}>
          +
        </Button>
        <Button variant="ghost" size="sm" disabled={zoom === 100} onClick={() => setZi(2)}>
          {t("preview.reset")}
        </Button>
      </div>
      <div className="max-h-[70vh] min-h-[16rem] overflow-auto glass-card !rounded-card">
        {file.loading && <LoadingState />}
        {file.error && <ErrorState message={t("preview.error")} onRetry={file.retry} />}
        {file.url && !isPdf && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={t("preview.alt")} style={{ width: `${zoom}%`, maxWidth: "none" }} className="block h-auto" />
        )}
        {file.url && isPdf && (
          <iframe
            key={zoom}
            title={t("preview.alt")}
            src={`${file.url}#page=1&zoom=${zoom}`}
            className="h-[70vh] w-full"
          />
        )}
      </div>
      <p className="text-xs text-ink-muted">{t("preview.note")}</p>
    </section>
  );
}
