"""Archive search (F5c, H9e): full-text search over the OCR text + fields of APPROVED documents.

SQLite uses an FTS5 virtual table (`archive_fts`) that is rebuilt lazily when the set of approved
documents (or an approved digital record) changes (a signature row detects that). Postgres (H5 / D6)
does the same with a table `archive_index` holding a `tsvector` under a GIN index ('simple'
configuration: no stemming, which Bangla has none of; Bangla digits are indexed as ASCII digits,
which the parser otherwise drops). Other databases fall back to a scan in Python, so the route works
the same everywhere. Search text never leaves the officer API (REVIEWER+).

H9e: a document with an approved lhdr/1 record also indexes its party names (and their fathers),
villages, mouza, thana, district, khatian and dag numbers, and carries the Gregorian year range of
the deed (`year_from`..`year_to`), which the year filter overlaps with.
"""

import hashlib

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ai.extraction import lhdr
from app.core.errors import AppError
from app.models.document import Document
from app.models.document_record import DocumentRecord
from app.models.enums import DocumentStatus, RecordStatus
from app.models.land_parcel import LandParcel
from app.schemas.archive import ArchiveHit, ArchiveSearchOut

SURVEYS = ("CS", "SA", "RS", "BS")
SIG = "__sig__"
_SNIPPET = 160
_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_TO_BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")

_COLUMNS = (
    "doc_id",
    "doc_type",
    "land_id",
    "survey",
    "district",
    "upazila",
    "mouza",
    "khatian",
    "body",  # keep at index 8: the FTS5 snippet() call reads this column
    "year_from",
    "year_to",
    "historical",
)
_UNINDEXED = _COLUMNS[:4] + _COLUMNS[9:]
_TEXT_COLS = ("district", "upazila", "mouza", "khatian", "body")


def _field(doc: Document, name: str) -> str | None:
    for f in (doc.extraction_json or {}).get("fields") or []:
        if isinstance(f, dict) and f.get("field") == name and f.get("value"):
            return str(f["value"])
    return None


# ---------------------------------------------------------------- LHDR fields (H9e)


def _records(db: Session) -> dict[str, tuple[int, dict]]:
    """document id -> (version, plain record) of the newest APPROVED lhdr/1 record."""
    rows = db.scalars(
        select(DocumentRecord)
        .join(Document, Document.id == DocumentRecord.document_id)
        .where(
            Document.processing_status == DocumentStatus.APPROVED.value,
            DocumentRecord.status == RecordStatus.APPROVED.value,
            DocumentRecord.record_schema == lhdr.SCHEMA,
        )
        .order_by(DocumentRecord.version)
    ).all()
    out: dict[str, tuple[int, dict]] = {}
    for r in rows:
        try:
            out[r.document_id] = (r.version, lhdr.plain(lhdr.parse(r.record_json)))
        except Exception:  # a record that does not parse is simply not indexed
            continue
    return out


def _year(value) -> int | None:
    try:
        y = int(str(value)[:4])
    except (TypeError, ValueError):
        return None
    return y if 1000 <= y <= 2200 else None


def _lhdr_facts(rec: dict, doc: Document) -> dict:
    """Search words, places and the year range of one plain LHDR record. Names stay in the index
    only (officer API); nothing here is returned except the years."""
    words: list[str] = []
    for p in rec.get("parties") or []:
        addr = p.get("address") or {}
        father = p.get("father") or {}
        words += [p.get("name"), father.get("name"), p.get("mother"), addr.get("village")]
    plots = rec.get("schedule") or []
    for pl in plots:
        words += [pl.get("mouza"), pl.get("thana"), pl.get("district"), pl.get("khatian_no")]
        words += [str(d) for d in (pl.get("dag_no") or [])]
    reg = (rec.get("registration") or {}).get("deed_no")
    words.append(reg)
    first = plots[0] if plots else {}
    years: list[int] = []
    for d in (rec.get("dates") or {}).values():
        if isinstance(d, dict):
            years += [y for y in (_year(d.get("gregorian_from")), _year(d.get("gregorian_to"))) if y]
    if not years:  # the reviewer fixed the flat deed date but the record has no Gregorian range
        years = [y for y in (_year(_field(doc, "deed_date")),) if y]
    joined = " ".join(str(w) for w in words if w)
    return {
        "words": joined,
        "mouza": first.get("mouza"),
        "district": first.get("district"),
        "upazila": first.get("thana"),
        "khatian": first.get("khatian_no"),
        "year_from": min(years) if years else None,
        "year_to": max(years) if years else None,
    }


def _row(doc: Document, land: LandParcel | None, rec: dict | None = None) -> dict:
    ex = doc.extraction_json or {}
    facts = _lhdr_facts(rec, doc) if rec else {}
    body = doc.ocr_text or ""
    if facts.get("words"):  # digits in both scripts: as written and as typed in the search box
        w = facts["words"]
        variants = [w] + [v for v in (w.translate(_BN_DIGITS), w.translate(_TO_BN_DIGITS)) if v != w]
        body = body + "\n" + " ".join(variants)
    return {
        "doc_id": doc.id,
        "doc_type": doc.document_type,
        "land_id": land.land_id if land else None,
        "survey": ex.get("survey_type") if ex.get("survey_type") in SURVEYS else None,
        "district": _field(doc, "district") or (land.district if land else None) or facts.get("district"),
        "upazila": _field(doc, "upazila") or (land.upazila if land else None) or facts.get("upazila"),
        "mouza": _field(doc, "mouza") or (land.mouza if land else None) or facts.get("mouza"),
        "khatian": _field(doc, "khatian_no") or (land.khatian_no if land else None) or facts.get("khatian"),
        "body": body,
        "year_from": facts.get("year_from"),
        "year_to": facts.get("year_to"),
        "historical": 1 if rec else 0,
    }  # fmt: skip


def _approved(db: Session, office_cond=None) -> tuple[list, dict]:
    q = (
        select(Document, LandParcel)
        .outerjoin(LandParcel, LandParcel.id == Document.land_id)
        .where(Document.processing_status == DocumentStatus.APPROVED.value)
        .order_by(Document.created_at, Document.id)
    )
    if office_cond is not None:
        q = q.where(office_cond)
    recs = _records(db)
    rows = [(d, land, (recs.get(d.id) or (0, None))[1]) for d, land in db.execute(q).all()]
    return rows, recs


def _signature(rows, recs) -> str:
    h = hashlib.sha256()
    for d, land, _rec in rows:
        h.update(
            f"{d.id}:{d.file_hash}:{len(d.ocr_text or '')}:{land.id if land else ''};".encode()
        )
        h.update(repr(d.extraction_json.get("survey_type") if d.extraction_json else None).encode())
        h.update(f"rec{(recs.get(d.id) or (0,))[0]}".encode())  # an approved correction re-indexes
        h.update(repr(d.extraction_json.get("fields") if d.extraction_json else None).encode())
    return h.hexdigest()


def _year_cond(col_from: str, col_to: str, year_from, year_to, cast: bool, params: dict) -> list[str]:
    """Overlap of [year_from, year_to] with the document's years; undated documents drop out."""
    c = (lambda c: f"CAST({c} AS INTEGER)") if cast else (lambda c: c)
    out = []
    if year_from is not None:
        out.append(f"{c(col_to)} >= :yf")
        params["yf"] = year_from
    if year_to is not None:
        out.append(f"{c(col_from)} <= :yt")
        params["yt"] = year_to
    return out


def _hit(r: dict, snippet: str) -> ArchiveHit:
    return ArchiveHit(
        document_id=r["doc_id"], document_type=r["doc_type"], land_id=r["land_id"],
        survey_type=r["survey"], district=r["district"], upazila=r["upazila"],
        mouza=r["mouza"], khatian_no=r["khatian"], snippet=snippet,
        year_from=int(r["year_from"]) if r["year_from"] is not None else None,
        year_to=int(r["year_to"]) if r["year_to"] is not None else None,
        historical=bool(r["historical"]),
    )  # fmt: skip


_SELECT = (
    "doc_id, doc_type, land_id, survey, district, upazila, mouza, khatian, "
    "CAST(year_from AS INTEGER), CAST(year_to AS INTEGER), CAST(historical AS INTEGER)"
)


def _from_db_row(r, snippet: str) -> ArchiveHit:
    keys = ("doc_id", "doc_type", "land_id", "survey", "district", "upazila", "mouza", "khatian",
            "year_from", "year_to", "historical")  # fmt: skip
    return _hit(dict(zip(keys, r[:11])), snippet)


# ---------------------------------------------------------------- SQLite FTS5


def _ensure_index(db: Session) -> None:
    cols = ", ".join(c + (" UNINDEXED" if c in _UNINDEXED else "") for c in _COLUMNS)
    have_cols = {r[1] for r in db.execute(text("PRAGMA table_info(archive_fts)")).all()}
    if have_cols and "year_from" not in have_cols:  # an index built before H9e: rebuild it
        db.execute(text("DROP TABLE archive_fts"))
    db.execute(text(f"CREATE VIRTUAL TABLE IF NOT EXISTS archive_fts USING fts5({cols})"))
    rows, recs = _approved(db)
    sig = _signature(rows, recs)
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
    for d, land, rec in rows:
        db.execute(ins, _row(d, land, rec))
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


def _search_sqlite(db, q, survey, district, limit, offset, yf=None, yt=None) -> ArchiveSearchOut:
    _ensure_index(db)
    cond, params = ["archive_fts MATCH :m", "doc_id != :sig"], {"m": _match_expr(q), "sig": SIG}
    if survey:
        cond.append("survey = :survey")
        params["survey"] = survey
    if district:
        cond.append("lower(district) = lower(:district)")
        params["district"] = district.strip()
    cond += _year_cond("year_from", "year_to", yf, yt, True, params)
    where = " AND ".join(cond)
    total = (
        db.execute(text(f"SELECT count(*) FROM archive_fts WHERE {where}"), params).scalar() or 0
    )
    rows = db.execute(
        text(
            f"SELECT {_SELECT}, snippet(archive_fts, 8, '[', ']', '…', 24) AS snip "
            f"FROM archive_fts WHERE {where} ORDER BY rank, doc_id LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": limit, "offset": offset},
    ).all()
    return ArchiveSearchOut(
        items=[_from_db_row(r, r[11] or "") for r in rows], total=total, limit=limit, offset=offset
    )


# ---------------------------------------------------------------- Postgres

_PG_LOCK = 0x4C534152  # pg_advisory_xact_lock key: one index rebuild at a time
_PG_COLS = ("doc_id", "doc_type", "land_id", "survey", "district", "upazila", "mouza", "khatian",
            "year_from", "year_to", "historical")  # fmt: skip


def _ensure_pg_index(db: Session) -> None:
    db.execute(text(
        "CREATE TABLE IF NOT EXISTS archive_index (doc_id varchar(64) PRIMARY KEY, doc_type text, "
        "land_id text, survey text, district text, upazila text, mouza text, khatian text, "
        "body text, tsv tsvector)"
    ))  # fmt: skip
    for col in ("year_from integer", "year_to integer", "historical integer"):  # H9e
        db.execute(text(f"ALTER TABLE archive_index ADD COLUMN IF NOT EXISTS {col}"))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_archive_tsv ON archive_index USING GIN (tsv)"))
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _PG_LOCK})
    rows, recs = _approved(db)
    sig = _signature(rows, recs)
    have = db.execute(text("SELECT body FROM archive_index WHERE doc_id = :s"), {"s": SIG}).scalar()
    if have == sig:
        db.commit()
        return
    db.execute(text("DELETE FROM archive_index"))
    ins = text(
        "INSERT INTO archive_index (" + ", ".join(_PG_COLS) + ", body, tsv) VALUES ("
        + ", ".join(":" + c for c in _PG_COLS) + ", :body, to_tsvector('simple', :words))"
    )  # fmt: skip
    for d, land, rec in rows:
        r = _row(d, land, rec)
        words = " ".join(str(r[c] or "") for c in _TEXT_COLS).translate(_BN_DIGITS)
        db.execute(ins, {**{c: r[c] for c in _PG_COLS}, "body": r["body"], "words": words})
    blank = {c: None for c in _PG_COLS}
    db.execute(ins, {**blank, "doc_id": SIG, "body": sig, "words": ""})
    db.commit()


def _search_postgres(db, q, survey, district, limit, offset, yf=None, yt=None) -> ArchiveSearchOut:
    _ensure_pg_index(db)
    words = _match_expr(q).replace('"', "").translate(_BN_DIGITS)
    cond = ["tsv @@ plainto_tsquery('simple', :q)", "doc_id != :sig"]
    params: dict = {"q": words, "sig": SIG}
    if survey:
        cond.append("survey = :survey")
        params["survey"] = survey
    if district:
        cond.append("lower(district) = lower(:district)")
        params["district"] = district.strip()
    cond += _year_cond("year_from", "year_to", yf, yt, False, params)
    where = " AND ".join(cond)
    total = (
        db.execute(text(f"SELECT count(*) FROM archive_index WHERE {where}"), params).scalar() or 0
    )
    rows = db.execute(
        text(
            f"SELECT {_SELECT.replace('CAST(historical AS INTEGER)', 'COALESCE(historical, 0)')}, "
            "ts_headline('simple', body, plainto_tsquery('simple', :q), "
            "'StartSel=[, StopSel=], MaxWords=24, MinWords=8, MaxFragments=1') AS snip "
            f"FROM archive_index WHERE {where} "
            "ORDER BY ts_rank(tsv, plainto_tsquery('simple', :q)) DESC, doc_id "
            "LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": limit, "offset": offset},
    ).all()
    return ArchiveSearchOut(
        items=[_from_db_row(r, (r[11] or "").replace("\n", " ")) for r in rows],
        total=total, limit=limit, offset=offset,
    )  # fmt: skip


# ---------------------------------------------------------------- any database / office-scoped


def _search_generic(
    db, q, survey, district, limit, offset, office_cond=None, yf=None, yt=None
) -> ArchiveSearchOut:
    words = _match_expr(q).replace('"', "").split()
    hits = []
    rows, _recs = _approved(db, office_cond)
    for d, land, rec in rows:
        r = _row(d, land, rec)
        if survey and r["survey"] != survey:
            continue
        if district and (r["district"] or "").lower() != district.strip().lower():
            continue
        if yf is not None and not (r["year_to"] is not None and r["year_to"] >= yf):
            continue
        if yt is not None and not (r["year_from"] is not None and r["year_from"] <= yt):
            continue
        hay = " ".join(str(v or "") for v in r.values()).lower()
        if all(w.lower() in hay for w in words):
            hits.append((r, _excerpt(r["body"], words)))
    page = hits[offset : offset + limit]
    return ArchiveSearchOut(
        items=[_hit(r, s) for r, s in page], total=len(hits), limit=limit, offset=offset
    )


def search(
    db: Session, q: str, survey: str | None, district: str | None, limit: int, offset: int,
    office_cond=None, year_from: int | None = None, year_to: int | None = None,
) -> ArchiveSearchOut:
    if survey and survey not in SURVEYS:
        raise AppError("INVALID_SURVEY", "survey must be CS, SA, RS or BS", 422)
    if year_from is not None and year_to is not None and year_from > year_to:
        raise AppError("INVALID_YEARS", "year_from must not be after year_to", 422)
    if office_cond is not None:  # office-scoped or area-sorted: filter the approved documents
        return _search_generic(
            db, q.strip(), survey, district, limit, offset, office_cond, year_from, year_to
        )
    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        return _search_sqlite(db, q.strip(), survey, district, limit, offset, year_from, year_to)
    if dialect == "postgresql":
        return _search_postgres(db, q.strip(), survey, district, limit, offset, year_from, year_to)
    return _search_generic(db, q.strip(), survey, district, limit, offset, None, year_from, year_to)
