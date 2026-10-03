"use client";
import { Handle, Position, type NodeProps } from "reactflow";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { useGraphLabels } from "./labels";
import type { GraphNodeDto } from "./types";

export const TYPE_STYLE: Record<string, string> = {
  Person: "border-primary bg-primary-soft",
  Transaction: "border-review bg-review-soft",
  Deed: "border-pending bg-pending-soft",
  Land: "border-verified bg-verified-soft",
};

export interface EntityData {
  node: GraphNodeDto;
  flagged: boolean;
  selected: boolean;
}

export default function EntityNode({ data }: NodeProps<EntityData>) {
  const L = useGraphLabels();
  const t = useTranslations("graph");
  const { node, flagged, selected } = data;
  return (
    <div
      data-testid={`gnode-${node.id}`}
      data-flagged={flagged ? "true" : "false"}
      className={cn(
        "w-[200px] rounded-lg border-2 px-3 py-2 text-left shadow-card",
        flagged ? "border-critical bg-critical-soft" : (TYPE_STYLE[node.type] ?? "border-line bg-surface"),
        selected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <p className="text-xs font-semibold uppercase text-ink-muted">{L.nodeType(node.type)}</p>
      <p className="truncate text-sm font-semibold text-ink">{L.nodeText(node.type, node.label)}</p>
      {flagged && <p className="mt-1 text-xs font-bold text-critical">⚑ {t("flagged")}</p>}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
