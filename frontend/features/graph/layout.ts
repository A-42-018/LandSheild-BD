import type { GraphNodeDto, LandGraphDto } from "./types";

/** Left → right columns: people → transactions → deeds → land. No layout library. */
export const COLUMN_ORDER = ["Person", "Transaction", "Deed", "Land"] as const;
export const COL_GAP = 280;
export const ROW_GAP = 110;
export const NODE_W = 200;

export interface Positioned {
  node: GraphNodeDto;
  x: number;
  y: number;
}

export function isFlaggedNode(n: GraphNodeDto): boolean {
  return n.props?.flagged === true;
}

export function layoutGraph(graph: LandGraphDto): Positioned[] {
  const cols = COLUMN_ORDER.map((type) => graph.nodes.filter((n) => n.type === type));
  const other = graph.nodes.filter((n) => !(COLUMN_ORDER as readonly string[]).includes(n.type));
  if (other.length) cols.push(other);
  const tallest = Math.max(1, ...cols.map((c) => c.length));
  const out: Positioned[] = [];
  cols.forEach((col, ci) => {
    const offset = ((tallest - col.length) * ROW_GAP) / 2;
    col.forEach((node, ri) => out.push({ node, x: ci * COL_GAP, y: offset + ri * ROW_GAP }));
  });
  return out;
}

/** Edges touching a node, resolved to the other endpoint (for the detail panel / list). */
export function connectionsOf(graph: LandGraphDto, id: string) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.edges
    .filter((e) => e.source === id || e.target === id)
    .map((e) => ({
      edge: e,
      direction: e.source === id ? ("out" as const) : ("in" as const),
      other: byId.get(e.source === id ? e.target : e.source),
    }))
    .filter((c) => c.other);
}
