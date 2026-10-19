"use client";
import { useLocale, useTranslations } from "next-intl";
import { Compass, Landmark, Layers, MapPin, Map as MapIcon, Ruler, ShieldCheck, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { districtName, upazilaName } from "@/lib/geo";
import { localDigits } from "@/lib/intl-locale";
import { formatArea } from "./format";
import type { LandInfo } from "./types";

export function useUnitLabel() {
  const t = useTranslations("result.units");
  return (u: string) => (t.has(u) ? t(u) : u);
}

/** Survey label from `archive.surveys.*`; falls back to the raw code. */
export function useSurveyLabel() {
  const t = useTranslations("archive.surveys");
  return (s: string) => (t.has(s) ? t(s) : s);
}

/** D6: amber notice, never an error: the record is still shown. */
export function SheetWarning({ warnings }: { warnings?: string[] }) {
  const t = useTranslations("result");
  if (!warnings?.includes("SHEET_MISMATCH")) return null;
  return (
    <p role="status" data-testid="sheet-warning" className="mb-3 flex items-start gap-2 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      {t("sheetMismatch")}
    </p>
  );
}

/** Record fields as icon-tile rows under the land ID and place. `bare` drops the card frame when a collapsible section already supplies the title (U2.4). */
export default function LandInfoCard({ land, chip, bare }: { land: LandInfo; chip?: React.ReactNode; bare?: boolean }) {
  const t = useTranslations("result");
  const locale = useLocale();
  const unit = useUnitLabel();
  const survey = useSurveyLabel();
  const rows: [string, React.ReactNode, LucideIcon][] = [
    [t("district"), districtName(land.district, locale), MapPin],
    [t("upazila"), upazilaName(land.district, land.upazila, locale), MapPin],
    [t("mouza"), land.mouza, MapIcon],
    ...(land.survey_type ? ([[t("survey"), survey(land.survey_type), Layers]] as [string, React.ReactNode, LucideIcon][]) : []),
    ...(land.jl_no ? ([[t("jlNo"), localDigits(land.jl_no, locale), Compass]] as [string, React.ReactNode, LucideIcon][]) : []),
    ...(land.map_sheet_no ? ([[t("sheetNo"), localDigits(land.map_sheet_no, locale), MapIcon]] as [string, React.ReactNode, LucideIcon][]) : []),
    [t("khatian"), localDigits(land.khatian_no, locale), Compass],
    [t("dag"), localDigits(land.dag_no, locale), Compass],
    [t("area"), formatArea(land.area, land.area_unit, locale, unit(land.area_unit)), Ruler],
    [t("status"), <StatusBadge key="s" code={land.status} />, ShieldCheck],
  ];
  const place = [districtName(land.district, locale), upazilaName(land.district, land.upazila, locale), land.mouza].filter(Boolean).join(" · ");
  const body = (
    <>
      <SheetWarning warnings={land.warnings} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xl font-bold text-ink sm:text-2xl">
            <span className="sr-only">{t("landId")}: </span>
            {land.land_id}
          </p>
          <p className="text-sm text-ink-muted">{place}</p>
        </div>
        {chip && <div className="scale-110 origin-right" data-testid="record-chip">{chip}</div>}
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([k, v, Icon]) => (
          <div key={k} className="rounded-xl border border-line/70 bg-surface/60 p-3">
            <dt className="flex items-center gap-2 text-xs text-ink-muted">
              <span aria-hidden="true" className="icon-tile !h-7 !w-7 !rounded-lg"><Icon className="h-3.5 w-3.5" /></span>
              {k}
            </dt>
            <dd className="mt-1 ps-9 font-medium text-ink">{v}</dd>
          </div>
        ))}
        <div className="rounded-xl border border-line/70 bg-surface/60 p-3 sm:col-span-2 lg:col-span-4">
          <dt className="flex items-center gap-2 text-xs text-ink-muted">
            <span aria-hidden="true" className="icon-tile !h-7 !w-7 !rounded-lg"><Users className="h-3.5 w-3.5" /></span>
            {t("currentOwners")}
          </dt>
          <dd className="mt-1 ps-9 font-medium text-ink">
            {land.current_owners.length === 0 ? (
              t("noOwners")
            ) : (
              <ul>
                {land.current_owners.map((o, i) => (
                  <li key={`${o.name}-${i}`}>
                    {o.name}
                    {o.father_name && (
                      <span className="font-normal text-ink-muted"> · {t("fatherName")}: {o.father_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </>
  );
  if (bare) return <div data-testid="land-info">{body}</div>;
  return (
    <Card title={t("landInfo")} icon={<Landmark />} variant="record">
      {body}
    </Card>
  );
}
