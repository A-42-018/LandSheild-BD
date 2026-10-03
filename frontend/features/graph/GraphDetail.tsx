"use client";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { formatArea, formatDate } from "@/features/result/format";
import { useUnitLabel } from "@/features/result/LandInfoCard";
import { connectionsOf, isFlaggedNode } from "./layout";
import { useGraphLabels } from "./labels";
import type { LandGraphDto } from "./types";

export default function GraphDetail({ graph, selectedId }: { graph: LandGraphDto; selectedId: string | null }) {
  const t = useTranslations("graph");
  const r = useTranslations("result");
  const locale = useLocale();
  const unit = useUnitLabel();
  const L = useGraphLabels();
  const node = graph.nodes.find((n) => n.id === selectedId);

  return (
    <Card title={t("detailTitle")} aria-live="polite" data-testid="graph-detail">
      {!node ? (
        <p className="text-sm text-ink-muted">{t("detailEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-3 text-sm text-ink">
          <div>
            <p className="text-xs font-semibold uppercase text-ink-muted">{L.nodeType(node.type)}</p>
            <p className="text-base font-semibold">{L.nodeText(node.type, node.label)}</p>
            {isFlaggedNode(node) && <p className="mt-1 font-bold text-critical">⚑ {t("flagged")}</p>}
          </div>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
            {typeof node.props.father_name === "string" && node.props.father_name && (
              <>
                <dt className="text-ink-muted">{r("fatherName")}</dt>
                <dd>{node.props.father_name}</dd>
              </>
            )}
            {typeof node.props.area === "number" && (
              <>
                <dt className="text-ink-muted">{r("area")}</dt>
                <dd>{formatArea(node.props.area, String(node.props.area_unit ?? ""), locale, unit(String(node.props.area_unit ?? "")))}</dd>
              </>
            )}
            {"transaction_date" in node.props && (
              <>
                <dt className="text-ink-muted">{r("date")}</dt>
                <dd>{formatDate(node.props.transaction_date as string | null, locale, r("unknownDate"))}</dd>
              </>
            )}
            {typeof node.props.status === "string" && (
              <>
                <dt className="text-ink-muted">{r("status")}</dt>
                <dd><StatusBadge code={node.props.status} /></dd>
              </>
            )}
          </dl>
          <div>
            <h3 className="mb-1 font-semibold">{t("connections")}</h3>
            <ul className="flex flex-col gap-1">
              {connectionsOf(graph, node.id).map((c, i) => (
                <li key={i} className={c.edge.flagged ? "font-semibold text-critical" : undefined}>
                  {c.direction === "out" ? "→" : "←"} {L.edgeType(c.edge.type)}: {L.nodeText(c.other!.type, c.other!.label)}
                  {c.edge.flagged && ` — ⚑ ${t("flagged")}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
