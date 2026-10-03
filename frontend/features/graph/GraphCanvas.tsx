"use client";
import { useCallback, useMemo } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { useTranslations } from "next-intl";
import EntityNode, { type EntityData } from "./EntityNode";
import { isFlaggedNode, layoutGraph } from "./layout";
import { useGraphLabels } from "./labels";
import type { LandGraphDto } from "./types";

const nodeTypes = { entity: EntityNode };
// Theme tokens (UD9): edges and labels follow light/dark instead of fixed hex.
const RED = "rgb(var(--critical))";
const GRAY = "rgb(var(--pending))";

export default function GraphCanvas({
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

  // Fires for mouse click AND keyboard (Enter/Space on a focused node); empty selection = pane click.
  const onSelection = useCallback(
    ({ nodes: sel }: { nodes: Node[] }) => {
      const id = sel[0]?.id ?? null;
      if (id !== selectedId) onSelect(id);
    },
    [onSelect, selectedId],
  );

  const nodes = useMemo<Node<EntityData>[]>(
    () =>
      layoutGraph(graph).map(({ node, x, y }) => ({
        id: node.id,
        type: "entity",
        position: { x, y },
        draggable: false,
        data: { node, flagged: isFlaggedNode(node), selected: node.id === selectedId },
      })),
    [graph, selectedId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e, i) => ({
        id: `${e.source}|${e.target}|${e.type}|${i}`,
        source: e.source,
        target: e.target,
        // Flagged edges are red AND thicker AND carry a text label (never colour only).
        label: e.flagged ? `${L.edgeType(e.type)} · ⚑ ${L.flagged()}` : L.edgeType(e.type),
        style: { stroke: e.flagged ? RED : GRAY, strokeWidth: e.flagged ? 3 : 1.5, strokeDasharray: e.flagged ? undefined : "4 3" },
        labelStyle: { fontSize: 11, fontWeight: e.flagged ? 700 : 500, fill: e.flagged ? RED : GRAY },
        labelBgStyle: { fill: "rgb(var(--surface))" },
        labelBgPadding: [4, 2] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color: e.flagged ? RED : GRAY },
        data: { flagged: e.flagged },
      })),
    [graph, L],
  );

  return (
    <div
      role="group"
      aria-label={t("canvasLabel")}
      data-testid="graph-canvas"
      className="h-[420px] w-full rounded-lg border border-line bg-surface-muted md:h-[520px]"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={1.5}
        panOnDrag
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onSelectionChange={onSelection}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
