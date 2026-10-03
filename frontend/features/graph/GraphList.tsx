"use client";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { COLUMN_ORDER, isFlaggedNode } from "./layout";
import { useGraphLabels } from "./labels";
import type { LandGraphDto } from "./types";

/** Accessible list fallback (mobile / keyboard): same nodes and selection, no canvas. */
export default function GraphList({
  graph,
  selectedId,
  onSelect,
}: {
  graph: LandGraphDto;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = useTranslations("graph");
  const L = useGraphLabels();
  return (
    <div className="flex flex-col gap-3">
      {COLUMN_ORDER.map((type) => {
        const items = graph.nodes.filter((n) => n.type === type);
        if (!items.length) return null;
        return (
          <section key={type} aria-label={L.nodeType(type)}>
            <h3 className="mb-1 text-sm font-semibold text-ink-muted">{L.nodeType(type)}</h3>
            <ul aria-label={t("listLabel", { type: L.nodeType(type) })} className="flex flex-col gap-2">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    aria-pressed={n.id === selectedId}
                    onClick={() => onSelect(n.id === selectedId ? null : n.id)}
                    className={cn(
                      "w-full rounded-lg border-2 px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isFlaggedNode(n) ? "border-critical bg-critical-soft" : "border-line bg-surface",
                      n.id === selectedId && "ring-2 ring-primary",
                    )}
                  >
                    <span className="font-semibold text-ink">{L.nodeText(n.type, n.label)}</span>
                    {isFlaggedNode(n) && <span className="ml-2 font-bold text-critical">⚑ {t("flagged")}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
