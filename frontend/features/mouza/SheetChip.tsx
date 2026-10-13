"use client";
import { Download, FileText, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { gisLabel, type MouzaDto, type SheetRefDto } from "@/features/map/gis/types";
import { scanFileName, UNKNOWN_SURVEY } from "./types";
import { useScanDownload } from "./useScanDownload";

/** "RS 001"; the mouzamap.tech "Unknown" survey label is translated. */
export function useSheetLabel() {
  const t = useTranslations("mouza");
  const survey = (s: string) => (s === UNKNOWN_SURVEY ? t("surveyUnknown") : s);
  return {
    survey,
    sheet: (s: SheetRefDto) => (s.survey ? `${survey(s.survey)} ${s.sheet_no}` : s.sheet_no),
  };
}

/**
 * One survey map sheet. A scanned sheet is a button that downloads its PDF (fetched by our backend from
 * free.mouzamap.tech, so the browser stays on this page). Official-portal sheets have no scan and show as text.
 * `copy` > 1 marks a second scan of the same survey and sheet number ("RS 001 (2)").
 */
export default function SheetChip({ sheet, mouza, label, copy = 1 }: { sheet: SheetRefDto; mouza: MouzaDto; label?: string; copy?: number }) {
  const t = useTranslations("mouza");
  const base = useSheetLabel().sheet(sheet);
  const name = copy > 1 ? `${base} (${copy})` : base; // a second scan of the same sheet number
  const { state, run } = useScanDownload();
  if (!sheet.url) {
    return (
      <span className="inline-flex items-center rounded-md border border-dashed border-line px-2 py-1 text-xs text-ink-muted" title={t("officialSheet")}>
        {name}
        {sheet.plots ? ` · ${t("plotCount", { count: sheet.plots })}` : ""}
      </span>
    );
  }
  const url = sheet.url;
  const what = t("downloadSheet", { sheet: name, mouza: gisLabel(mouza) });
  const busy = state === "busy";
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={() => void run(url, scanFileName(mouza, sheet, copy))}
        aria-label={what}
        title={what}
        aria-busy={busy || undefined}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-surface px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-progress disabled:opacity-70"
      >
        <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {label ?? name}
        {busy ? (
          <Loader2 aria-hidden="true" className="h-3 w-3 shrink-0 animate-spin motion-reduce:animate-none" />
        ) : (
          <Download aria-hidden="true" className="h-3 w-3 shrink-0 opacity-70" />
        )}
      </button>
      {busy && <span role="status" className="sr-only">{t("downloading")}</span>}
      {(state === "failed" || state === "limited" || state === "missing") && (
        <span role="alert" className="max-w-[16rem] text-xs text-critical">
          {t(state === "failed" ? "downloadFailed" : state === "limited" ? "downloadLimit" : "downloadMissing")}
        </span>
      )}
    </span>
  );
}
