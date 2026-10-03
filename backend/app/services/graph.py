"""Ownership graph (P44): read-only view derived from relational data (R5).

Nodes: Person / Land / Deed / Transaction. Edges: OWNS (current owner -> land), SOLD (seller -> tx),
BOUGHT (buyer -> tx), REFERS_TO (tx -> deed), TRANSFERRED (tx -> land).
A transaction is flagged when its status is FLAGGED or a risk rule cites it; every edge touching a
flagged transaction carries flagged=true. Nothing is written (no alerts/assessments).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.deed import Deed
from app.models.enums import TransactionStatus
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.models.user import User
from app.risk.config import ALERT_MIN_POINTS
from app.risk.context import load_land_context
from app.risk.rules import run_rules
from app.risk.scoring import points_for, score_evidence
from app.schemas.graph import GraphEdge, GraphNode, LandGraph
from app.services.land import _SEES_FATHER
from app.services.ownership import _land


def _risk_flagged_tx_ids(db: Session, land) -> set[str]:
    ids: set[str] = set()
    for ev in score_evidence(run_rules(load_land_context(db, land))).evidence:
        if points_for(ev.code) < ALERT_MIN_POINTS:
            continue
        p = ev.params
        if isinstance(p.get("transaction_id"), str):
            ids.add(p["transaction_id"])
        if isinstance(p.get("transaction_ids"), list):
            ids.update(i for i in p["transaction_ids"] if isinstance(i, str))
    return ids


def get_graph(db: Session, land_id: str, viewer: User) -> LandGraph:
    land = _land(db, land_id)
    show_father = viewer.role in _SEES_FATHER

    txs = db.scalars(
        select(Transaction)
        .where(Transaction.land_id == land.id)
        .order_by(
            Transaction.transaction_date.is_(None),
            Transaction.transaction_date,
            Transaction.created_at,
            Transaction.id,
        )
    ).all()
    deeds = db.scalars(
        select(Deed)
        .where(Deed.land_id == land.id)
        .order_by(Deed.transaction_date.is_(None), Deed.transaction_date, Deed.created_at, Deed.id)
    ).all()
    current = db.scalars(
        select(OwnershipHistory)
        .where(OwnershipHistory.land_id == land.id, OwnershipHistory.end_date.is_(None))
        .order_by(
            OwnershipHistory.start_date.is_(None),
            OwnershipHistory.start_date,
            OwnershipHistory.created_at,
            OwnershipHistory.id,
        )
    ).all()

    flagged_ids = _risk_flagged_tx_ids(db, land)
    flagged_ids |= {t.id for t in txs if t.status == TransactionStatus.FLAGGED.value}

    land_nid = f"land:{land.land_id}"
    nodes: dict[str, GraphNode] = {
        land_nid: GraphNode(
            id=land_nid,
            type="Land",
            label=land.land_id,
            props={"area": land.area, "area_unit": land.area_unit, "status": land.status},
        )
    }
    edges: list[GraphEdge] = []

    owner_ids = [h.owner_id for h in current] + [i for t in txs for i in (t.seller_id, t.buyer_id)]
    owner_ids += [i for d in deeds for i in (d.seller_id, d.buyer_id)]
    owners = (
        {o.id: o for o in db.scalars(select(Owner).where(Owner.id.in_(set(owner_ids)))).all()}
        if owner_ids
        else {}
    )

    def person(owner_id: str) -> str:
        nid = f"person:{owner_id}"
        if nid not in nodes:
            o = owners[owner_id]
            nodes[nid] = GraphNode(
                id=nid,
                type="Person",
                label=o.name,
                props={"father_name": o.father_name} if show_father else {},
            )
        return nid

    for h in current:
        edges.append(GraphEdge(source=person(h.owner_id), target=land_nid, type="OWNS"))

    deed_nid: dict[str, str] = {}
    for d in deeds:
        nid = f"deed:{d.id}"
        deed_nid[d.id] = nid
        nodes[nid] = GraphNode(
            id=nid,
            type="Deed",
            label=d.deed_no,
            props={
                "transaction_date": d.transaction_date.isoformat() if d.transaction_date else None,
                "area": d.area,
                "area_unit": d.area_unit,
                "status": d.status,
            },
        )
    referenced: set[str] = set()

    for t in txs:
        flagged = t.id in flagged_ids
        tid = f"tx:{t.id}"
        nodes[tid] = GraphNode(
            id=tid,
            type="Transaction",
            label=t.transaction_type,
            props={
                "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
                "area": t.area,
                "area_unit": t.area_unit,
                "status": t.status,
                "flagged": flagged,
            },
        )
        for src, dst, kind in (
            (person(t.seller_id), tid, "SOLD"),
            (person(t.buyer_id), tid, "BOUGHT"),
            (tid, land_nid, "TRANSFERRED"),
        ):
            edges.append(GraphEdge(source=src, target=dst, type=kind, flagged=flagged))
        if t.deed_id in deed_nid:
            referenced.add(t.deed_id)
            edges.append(
                GraphEdge(source=tid, target=deed_nid[t.deed_id], type="REFERS_TO", flagged=flagged)
            )

    for d in deeds:  # deeds not tied to a transaction still attach to the land
        if d.id not in referenced:
            edges.append(GraphEdge(source=deed_nid[d.id], target=land_nid, type="REFERS_TO"))

    return LandGraph(land_id=land.land_id, nodes=list(nodes.values()), edges=edges)
