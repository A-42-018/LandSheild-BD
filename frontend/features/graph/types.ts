export type NodeType = "Person" | "Land" | "Deed" | "Transaction";
export type EdgeType = "OWNS" | "SOLD" | "BOUGHT" | "REFERS_TO" | "TRANSFERRED";

export interface GraphNodeDto {
  id: string;
  type: NodeType | string;
  label: string;
  props: Record<string, unknown>;
}
export interface GraphEdgeDto {
  source: string;
  target: string;
  type: EdgeType | string;
  flagged: boolean;
}
export interface LandGraphDto {
  land_id: string;
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
}
