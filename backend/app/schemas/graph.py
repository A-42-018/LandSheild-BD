from typing import Any

from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: str
    type: str  # Person | Land | Deed | Transaction
    label: str
    props: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str  # OWNS | SOLD | BOUGHT | REFERS_TO | TRANSFERRED
    flagged: bool = False


class LandGraph(BaseModel):
    land_id: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
