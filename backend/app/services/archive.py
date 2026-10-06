"""Archive search (F5c): full-text search over the OCR text + fields of APPROVED documents.

SQLite uses an FTS5 virtual table (`archive_fts`) that is rebuilt lazily when the set of approved
documents changes (a signature row detects that). Other databases fall back to a LIKE scan, so
the route works the same everywhere. Search text never leaves the officer API (REVIEWER+).
"""

import hashlib

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.document import Document
from app.models.enums import DocumentStatus
from app.models.land_parcel import LandParcel
from app.schemas.archive import ArchiveHit, ArchiveSearchOut

SURVEYS = ("CS", "SA", "RS", "BS")
SIG = "__sig__"
_SNIPPET = 160

_COLUMNS = (
    "doc_id",
    "doc_type",
    "land_id",
    "survey",
    "district",
    "upazila",
    "mouza",
    "khatian",
    "body",
)
_UNINDEXED = _COLUMNS[:3] + ("survey",)


def _is_sqlite(db: Session) -> bool:
    return db.get_bind().dialect.name == "sqlite"


def _field(doc: Document, name: str) -> str | None:
    for f in (doc.extraction_json or {}).get("fields") or []:
        if isinstance(f, dict) and f.get("field") == name and f.get("value"):
            return str(f["value"])
    return None


def _row(doc: Document, land: LandParcel | None) -> dict:
    ex = doc.extraction_json or {}
    out = {
        "doc_id": doc.id,
        "doc_type": doc.document_type,
        "land_id": land.land_id if land else None,
        "survey": ex.get("survey_type") if ex.get("survey_type") in SURVEYS else None,
        "district": _field(doc, "district") or (land.district if land else None),
        "upazila": _field(doc, "upazila") or (land.upazila if land else None),
        "mouza": _field(doc, "mouza") or (land.mouza if land else None),
        "khatian": _field(doc, "khatian_no") or (land.khatian_no if land else None),
        "body": doc.ocr_text or "",
    }
    return out


def _approved(db: Session) -> list[tuple[Document, LandParcel | None]]:
    q = (
        select(Document, LandParcel)
        .outerjoin(LandParcel, LandParcel.id == Document.land_id)
        .where(Document.processing_status == DocumentStatus.APPROVED.value)
        .order_by(Document.created_at, Document.id)
    )
    return [(d, land) for d, land in db.execute(q).all()]


def _signature(rows: list[tuple[Document, LandParcel | None]]) -> str:
    h = hashlib.sha256()
    for d, land in rows:
        h.update(
            f"{d.id}:{d.file_hash}:{len(d.ocr_text or '')}:{land.id if land else ''};".encode()
        )
        h.update(repr(d.extraction_json.get("survey_type") if d.extraction_json else None).encode())
    return h.hexdigest()


def _ensure_index(db: Session) -> None:
    cols = ", ".join(c + (" UNINDEXED" if c in _UNINDEXED else "") for c in _COLUMNS)
    db.execute(text(f"CREATE VIRTUAL TABLE IF NOT EXISTS archive_fts USING fts5({cols})"))
    rows = _approved(db)
    sig = _signature(rows)
    have = db.execute(text("SELECT body FROM archive_fts WHERE doc_id = :s"), {"s": SIG}).scalar()
    if have == sig:
        return
    db.execute(text("DELETE FROM archive_fts"))
    ins = text(
        "INSERT INTO archive_fts ("
        + ", ".join(_COLUMNS)
        + ") VALUES ("
        + ", ".join(":" + c for c in _COLUMNS)
        + ")"
    )
    for d, land in rows:
        db.execute(ins, _row(d, land))
    db.execute(ins, {c: (SIG if c == "doc_id" else sig if c == "body" else None) for c in _COLUMNS})
    db.commit()


def _match_expr(q: str) -> str:
    words = [w.replace('"', "") for w in q.split()]
    words = [w for w in words if w]
    if not words:
        raise AppError("INVALID_QUERY", "Search text is empty", 422)
    return " ".join(f'"{w}"' for w in words[:12])


def _excerpt(body: str, words: list[str]) -> str:
    low = body.lower()
    pos = next((low.find(w.lower()) for w in words if low.find(w.lower()) >= 0), 0)
    start = max(0, pos - 40)
    return body[start : start + _SNIPPET].replace("\n", " ")


def _search_sqlite(db, q, survey, district, limit, offset) -> ArchiveSearchOut:
    _ensure_index(db)
    cond, params = ["archive_fts MATCH :m", "doc_id != :sig"], {"m": _match_expr(q), "sig": SIG}
    if survey:
        cond.append("survey = :survey")
        params["survey"] = survey
    if district:
        cond.append("lower(district) = lower(:district)")
        params["district"] = district.strip()
    where = " AND ".join(cond)
    total = (
        db.execute(text(f"SELECT count(*) FROM archive_fts WHERE {where}"), params).scalar() or 0
    )
    rows = db.execute(
        text(
            "SELECT doc_id, doc_type, land_id, survey, district, upazila, mouza, khatian, "
            f"snippet(archive_fts, 8, '[', ']', '…', 24) AS snip FROM archive_fts WHERE {where} "
            "ORDER BY rank, doc_id LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": limit, "offset": offset},
    ).all()
    return ArchiveSearchOut(
        items=[
            ArchiveHit(
                document_id=r[0], document_type=r[1], land_id=r[2], survey_type=r[3],
                district=r[4], upazila=r[5], mouza=r[6], khatian_no=r[7], snippet=r[8] or "",
            )
            for r in rows
        ],
        total=total, limit=limit, offset=offset,
    )  # fmt: skip


def _like(value: str) -> str:
    esc = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{esc.lower()}%"


def _search_generic(db, q, survey, district, limit, offset) -> ArchiveSearchOut:
    words = _match_expr(q).replace('"', "").split()
    hits = []
    for d, land in _approved(db):
        r = _row(d, land)
        if survey and r["survey"] != survey:
            continue
        if district and (r["district"] or "").lower() != district.strip().lower():
            continue
        hay = " ".join(str(v or "") for v in r.values()).lower()
        if all(w.lower() in hay for w in words):
            hits.append((r, _excerpt(r["body"], words)))
    page = hits[offset : offset + limit]
    return ArchiveSearchOut(
        items=[
            ArchiveHit(
                document_id=r["doc_id"], document_type=r["doc_type"], land_id=r["land_id"],
                survey_type=r["survey"], district=r["district"], upazila=r["upazila"],
                mouza=r["mouza"], khatian_no=r["khatian"], snippet=s,
            )
            for r, s in page
        ],
        total=len(hits), limit=limit, offset=offset,
    )  # fmt: skip


def search(
    db: Session, q: str, survey: str | None, district: str | None, limit: int, offset: int
) -> ArchiveSearchOut:
    if survey and survey not in SURVEYS:
        raise AppError("INVALID_SURVEY", "survey must be CS, SA, RS or BS", 422)
    fn = _search_sqlite if _is_sqlite(db) else _search_generic
    return fn(db, q.strip(), survey, district, limit, offset)
