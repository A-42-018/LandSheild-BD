"use client";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui";
import { gisLabel, type MouzaDto } from "@/features/map/gis/types";
import SheetChip, { useSheetLabel } from "./SheetChip";
import { copyNumbers, groupBySurvey } from "./types";

export interface MouzaDetailProps {
  mouza: MouzaDto | null;
  union?: string;
  place: string;
  /** Fallback source when the mouza names none (the official portal). */
  sourceUrl?: string | null;
  onClose: () => void;
}

/** Every survey sheet of one mouza, grouped by survey, each scanned sheet with a View PDF link. */
export default function MouzaDetail({ mouza, union, place, sourceUrl, onClose }: MouzaDetailProps) {
  const t = useTranslations("mouza");
  const label = useSheetLabel();
  if (!mouza) return null;
  const name = gisLabel(mouza);
  const source = mouza.source_url ?? sourceUrl ?? null;
  const groups = groupBySurvey(mouza.sheets);

  return (
    <Modal open onClose={onClose} title={name} className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <div className="flex flex-col gap-4" data-testid="mouza-detail">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-muted">{t("cols.jl")}</dt>
          <dd className="font-medium">{mouza.jl_no ?? "—"}</dd>
          <dt className="text-ink-muted">{t("cols.union")}</dt>
          <dd>{union ?? t("unionUnknown")}</dd>
          <dt className="text-ink-muted">{t("placeLabel")}</dt>
          <dd>{place}</dd>
          {source && (
            <>
              <dt className="text-ink-muted">{t("source")}</dt>
              <dd>
                <a href={source} target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">
                  {source.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </>
          )}
        </dl>
        <section className="flex flex-col gap-3" aria-label={t("sheetsTitle")}>
          <h3 className="text-base font-semibold">{t("sheetsTitle")}</h3>
          {groups.length === 0 && <p className="text-sm text-ink-muted">{t("noSheets")}</p>}
          {groups.map((g) => {
            const copies = copyNumbers(g.sheets);
            return (
            <div key={g.survey} className="flex flex-col gap-1.5">
              <h4 className="text-sm font-medium text-ink">
                {g.survey ? label.survey(g.survey) : t("surveyNone")}{" "}
                <span className="font-normal text-ink-muted">· {t("sheetCount", { count: g.sheets.length })}</span>
              </h4>
              <ul className="flex flex-wrap gap-1.5">
                {g.sheets.map((s, i) => (
                  <li key={`${s.sheet_no}-${i}`}>
                    <SheetChip
                      sheet={s}
                      mouza={mouza}
                      copy={copies[i]}
                      label={s.url ? (copies[i] > 1 ? t("downloadPdfCopy", { sheet: s.sheet_no, copy: copies[i] }) : t("downloadPdf", { sheet: s.sheet_no })) : undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
            );
          })}
        </section>
        {mouza.sheets.some((s) => s.url) && <p className="text-xs text-ink-muted">{t("scanNote")}</p>}
      </div>
    </Modal>
  );
}
