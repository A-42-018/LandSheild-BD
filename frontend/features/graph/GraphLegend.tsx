"use client";
import { useTranslations } from "next-intl";
import { TYPE_STYLE } from "./EntityNode";
import { COLUMN_ORDER } from "./layout";
import { useGraphLabels } from "./labels";

export default function GraphLegend() {
  const t = useTranslations("graph");
  const L = useGraphLabels();
  return (
    <section aria-label={t("legendTitle")} className="glass-card p-3">
      <h2 className="mb-2 text-sm font-semibold text-ink">{t("legendTitle")}</h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink">
        {COLUMN_ORDER.map((type) => (
          <li key={type} className="flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block h-4 w-6 rounded border-2 ${TYPE_STYLE[type]}`} />
            {L.nodeType(type)}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0 w-6 border-t-[3px] border-critical" />
          <span className="font-semibold text-critical">⚑ {t("flaggedEdge")}</span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0 w-6 border-t-2 border-dashed border-pending" />
          {t("normalEdge")}
        </li>
      </ul>
    </section>
  );
}
