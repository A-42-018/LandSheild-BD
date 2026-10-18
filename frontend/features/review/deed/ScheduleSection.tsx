"use client";
import { useTranslations } from "next-intl";
import { Map as MapIcon } from "lucide-react";
import { Card } from "@/components/ui";
import BoundaryCompass from "./BoundaryCompass";
import FieldValue, { FieldGrid } from "./FieldValue";
import { AddItem, ContainerIssues, RemoveButton } from "./ListControls";
import { asField } from "./asField";
import { useEnumText } from "./useDeedLabels";
import type { LhdrPlot, LhdrRecord } from "../types";

const SURVEYS = ["CS", "SA", "RS", "BS", "DIARA", "OTHER"];

function PlotCard({ plot, i, threshold }: { plot: LhdrPlot; i: number; threshold: number }) {
  const t = useTranslations("review.deed");
  const survey = useEnumText("surveys");
  const id = `plot${i}`;
  const base = `/schedule/${i}`;
  const a = plot.area;
  const dags = plot.dag_no ?? [];
  const parts = Object.entries(a?.parts ?? {})
    .map(([k, v]) => `${asField(v)?.value ?? ""} ${k}`)
    .join(" ");
  return (
    <article data-testid={`deed-plot-${i}`} className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <h4 className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink">
        {t("plotN", { n: i + 1 })}
        <RemoveButton id={id} path={base} what={t("plotN", { n: i + 1 })} />
      </h4>
      <FieldGrid>
        <FieldValue id={`${id}_district`} label={t("district")} field={plot.district} threshold={threshold} path={`${base}/district`} />
        <FieldValue id={`${id}_thana`} label={t("thana")} field={plot.thana} threshold={threshold} path={`${base}/thana`} />
        <FieldValue id={`${id}_pargana`} label={t("pargana")} field={plot.pargana} threshold={threshold} path={`${base}/pargana`} />
        <FieldValue id={`${id}_mouza`} label={t("mouza")} field={plot.mouza} threshold={threshold} path={`${base}/mouza`} />
        <FieldValue id={`${id}_jl`} label={t("jlNo")} field={plot.jl_no} threshold={threshold} path={`${base}/jl_no`} />
        <FieldValue id={`${id}_survey`} label={t("survey")} field={plot.survey} threshold={threshold} format={survey} path={`${base}/survey`} kind="select" options={SURVEYS} />
        <FieldValue id={`${id}_khatian`} label={t("khatianNo")} field={plot.khatian_no} threshold={threshold} path={`${base}/khatian_no`} />
        <FieldValue id={`${id}_area`} label={t("areaValue")} field={a?.value} threshold={threshold} path={`${base}/area/value`} kind="number" />
        <FieldValue id={`${id}_unit`} label={t("areaUnit")} field={a?.unit} threshold={threshold} path={`${base}/area/unit`} />
        {parts && <FieldValue id={`${id}_parts`} label={t("areaParts")} field={parts} threshold={threshold} />}
        <FieldValue id={`${id}_area_words`} label={t("areaWords")} field={a?.in_words} threshold={threshold} path={`${base}/area/in_words`} />
        <FieldValue id={`${id}_decimal`} label={t("decimalEquiv")} field={a?.decimal_equiv} threshold={threshold} path={`${base}/area/decimal_equiv`} kind="number" />
        <FieldValue id={`${id}_class`} label={t("landClass")} field={plot.land_class} threshold={threshold} path={`${base}/land_class`} />
      </FieldGrid>
      <div className="flex flex-col gap-1" data-testid={`deed-dags-${id}`}>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("dagNo")}</h5>
        {dags.length === 0 && <p className="text-sm text-ink-muted">{t("none")}</p>}
        <FieldGrid>
          {dags.map((d, j) => (
            <div key={j} className="flex min-w-0 basis-full items-start justify-between gap-2">
              <FieldValue id={`${id}_dag${j}`} label={t("dagN", { n: j + 1 })} field={d} threshold={threshold} path={`${base}/dag_no/${j}`} />
              <RemoveButton id={`${id}_dag${j}`} path={`${base}/dag_no/${j}`} what={t("dagN", { n: j + 1 })} />
            </div>
          ))}
        </FieldGrid>
        <AddItem id={`${id}_dag`} path={`${base}/dag_no/-`} title={t("addDag")} text={{ label: t("dagNo"), required: true }} build={(_s, v) => v} />
      </div>
      <BoundaryCompass b={plot.boundaries} id={id} path={base} threshold={threshold} />
    </article>
  );
}

/** F. Schedule (তপশিল): one card per plot with dag list and boundary compass; plots can be added and removed (H6c). */
export default function ScheduleSection({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  const plots = record.schedule ?? [];
  return (
    <Card title={t("sections.schedule")} icon={<MapIcon />} data-testid="deed-section-schedule">
      <div className="flex flex-col gap-3">
        <ContainerIssues paths={["/schedule"]} />
        {plots.length === 0 ? (
          <p className="text-sm text-ink-muted" data-testid="deed-schedule-empty">{t("none")}</p>
        ) : (
          plots.map((p, i) => <PlotCard key={i} plot={p} i={i} threshold={threshold} />)
        )}
        <AddItem id="plot" path="/schedule/-" title={t("addPlot")} build={() => ({})} />
      </div>
    </Card>
  );
}
