"""Citizen area (U3.2): search history, watched parcels, notifications, profile.

Data is only collected for CITIZEN accounts (staff look parcels up as part of their job, so their
lookups are not "my searches"). Every read is scoped to the signed-in user.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.passwords import hash_password, verify_password
from app.core.ratelimit import check_rate
from app.models.citizen import Notification, SearchHistory, WatchlistItem
from app.models.encumbrance import LandEncumbrance
from app.models.enums import Role
from app.models.land_parcel import LandParcel
from app.models.mutation import MutationRecord
from app.models.transaction import Transaction
from app.models.user import User
from app.models.verification import VerificationRequest
from app.schemas.me import (
    MeSummary,
    NotificationItem,
    NotificationList,
    ParcelBrief,
    PasswordChange,
    ProfileUpdate,
    ReportItem,
    ReportList,
    SearchItem,
    SearchList,
    WatchCreate,
    WatchItem,
    WatchList,
)
from app.services import audit
from app.services import ownership as own_svc

WATCH_LIMIT = 20
# Opening the same parcel again within this window (search → result page) counts once.
REPEAT_WINDOW = timedelta(seconds=60)
PASSWORD_TRIES_PER_MIN = 5


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _brief(land: LandParcel) -> dict:
    return ParcelBrief(
        land_id=land.land_id,
        district=land.district,
        upazila=land.upazila,
        mouza=land.mouza,
        khatian_no=land.khatian_no,
        dag_no=land.dag_no,
        status=land.status,
    ).model_dump()


# ---- writes from elsewhere -------------------------------------------------------------------
def record_lookup(db: Session, user: User, land_code: str) -> None:
    """Remember that a citizen opened this parcel. Never fails the lookup it rides on."""
    if user.role != Role.CITIZEN.value:
        return
    land_pk = db.scalar(select(LandParcel.id).where(LandParcel.land_id == land_code))
    if land_pk is None:
        return
    now = _now()
    row = db.scalar(
        select(SearchHistory).where(
            SearchHistory.user_id == user.id, SearchHistory.land_id == land_pk
        )
    )
    if row is None:
        db.add(SearchHistory(user_id=user.id, land_id=land_pk, last_searched_at=now))
    elif now - _aware(row.last_searched_at) >= REPEAT_WINDOW:
        row.search_count += 1
        row.last_searched_at = now
    else:
        return
    try:
        db.commit()
    except IntegrityError:  # two tabs racing on the first lookup: the other one won
        db.rollback()


def notify(
    db: Session,
    user: User,
    kind: str,
    *,
    land_id: str | None = None,
    ref_id: str | None = None,
    data: dict | None = None,
) -> None:
    """Queue an inbox entry for a citizen (caller commits)."""
    if user.role != Role.CITIZEN.value:
        return
    db.add(Notification(user_id=user.id, kind=kind, land_id=land_id, ref_id=ref_id, data=data))


def _claim(db: Session, watch_id: str, since: datetime, now: datetime) -> bool:
    """Move a watch's window from `since` to `now`; False if another request already moved it.

    Two requests (the menu badge and the inbox) often check at the same moment. Only the one
    whose conditional update wins writes notifications for (since, now], so nothing doubles.
    The caller commits the claim together with those notifications: the row lock makes the
    other request wait, so when it reads the inbox the new entries are already there."""
    won = db.execute(
        update(WatchlistItem)
        .where(WatchlistItem.id == watch_id, WatchlistItem.checked_at == since)
        .values(checked_at=now)
    ).rowcount
    return won == 1


def sync_watch_alerts(db: Session, user: User) -> None:
    """Turn records added to watched parcels since the last check into notifications."""
    watches = db.execute(
        select(
            WatchlistItem.id, WatchlistItem.land_id, WatchlistItem.checked_at, LandParcel.land_id
        )
        .join(LandParcel, LandParcel.id == WatchlistItem.land_id)
        .where(WatchlistItem.user_id == user.id)
    ).all()
    db.commit()  # end the read transaction before claiming (SQLite cannot upgrade a stale read)
    for watch_id, land_pk, since, code in watches:
        now = _now()
        if not _claim(db, watch_id, since, now):
            db.rollback()
            continue

        def add(kind: str, ref: str, data: dict, code: str = code) -> None:
            db.add(Notification(user_id=user.id, kind=kind, land_id=code, ref_id=ref, data=data))

        def window(col, since: datetime = since, now: datetime = now):
            return (col > since) & (col <= now)

        for tx in db.scalars(
            select(Transaction)
            .where(Transaction.land_id == land_pk, window(Transaction.created_at))
            .order_by(Transaction.created_at)
        ):
            add("WATCH_TRANSACTION", tx.id, {"type": tx.transaction_type, "status": tx.status})
        for m in db.scalars(
            select(MutationRecord)
            .where(
                MutationRecord.land_id == land_pk,
                window(MutationRecord.created_at) | window(MutationRecord.status_changed_at),
            )
            .order_by(MutationRecord.status_changed_at)
        ):
            new_one = _aware(m.created_at) > _aware(since)
            kind = "WATCH_MUTATION" if new_one else "WATCH_MUTATION_STATUS"
            add(kind, m.id, {"mutation_no": m.mutation_no, "status": m.status})
        for e in db.scalars(
            select(LandEncumbrance)
            .where(LandEncumbrance.land_id == land_pk, window(LandEncumbrance.created_at))
            .order_by(LandEncumbrance.created_at)
        ):
            add("WATCH_ENCUMBRANCE", e.id, {"type": e.type, "status": e.status})
        db.commit()


# ---- reads -----------------------------------------------------------------------------------
def _watched_codes(db: Session, user: User) -> set[str]:
    return set(
        db.scalars(
            select(LandParcel.land_id)
            .join(WatchlistItem, WatchlistItem.land_id == LandParcel.id)
            .where(WatchlistItem.user_id == user.id)
        )
    )


def list_searches(db: Session, user: User, limit: int, offset: int) -> SearchList:
    base = select(SearchHistory).where(SearchHistory.user_id == user.id)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(
        base.order_by(SearchHistory.last_searched_at.desc()).limit(limit).offset(offset)
    ).all()
    watched = _watched_codes(db, user)
    items = [
        SearchItem(
            **_brief(r.land),
            search_count=r.search_count,
            last_searched_at=r.last_searched_at,
            watched=r.land.land_id in watched,
        )
        for r in rows
    ]
    return SearchList(items=items, total=total)


def clear_searches(db: Session, user: User, ip: str | None) -> None:
    removed = db.execute(delete(SearchHistory).where(SearchHistory.user_id == user.id)).rowcount
    audit.log(db, user, "SEARCH_HISTORY_CLEAR", "user", user.id, new={"removed": removed}, ip=ip)
    db.commit()


def _unread_by_land(db: Session, user: User) -> dict[str, int]:
    rows = db.execute(
        select(Notification.land_id, func.count())
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .group_by(Notification.land_id)
    ).all()
    return {code: n for code, n in rows if code}


def list_watchlist(db: Session, user: User) -> WatchList:
    sync_watch_alerts(db, user)
    rows = db.scalars(
        select(WatchlistItem)
        .where(WatchlistItem.user_id == user.id)
        .order_by(WatchlistItem.created_at.desc())
    ).all()
    unread = _unread_by_land(db, user)
    items = [
        WatchItem(
            **_brief(w.land),
            note=w.note,
            created_at=w.created_at,
            unread=unread.get(w.land.land_id, 0),
        )
        for w in rows
    ]
    return WatchList(items=items, limit=WATCH_LIMIT)


def _watch_item(w: WatchlistItem) -> WatchItem:
    return WatchItem(**_brief(w.land), note=w.note, created_at=w.created_at, unread=0)


def add_watch(db: Session, user: User, body: WatchCreate, ip: str | None) -> tuple[WatchItem, bool]:
    """Returns (item, created). Watching a parcel twice only updates the note."""
    land = own_svc._land(db, body.land_id)  # 404 LAND_NOT_FOUND
    row = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.user_id == user.id, WatchlistItem.land_id == land.id
        )
    )
    if row is not None:
        if body.note is not None and body.note != row.note:
            row.note = body.note
            db.commit()
        return _watch_item(row), False
    count = db.scalar(select(func.count()).where(WatchlistItem.user_id == user.id)) or 0
    if count >= WATCH_LIMIT:
        raise AppError("WATCHLIST_FULL", "Watchlist is full", 409, {"limit": WATCH_LIMIT})
    row = WatchlistItem(user_id=user.id, land_id=land.id, note=body.note, checked_at=_now())
    db.add(row)
    db.flush()
    audit.log(db, user, "WATCHLIST_ADD", "land_parcel", land.land_id, ip=ip)
    db.commit()
    db.refresh(row)
    return _watch_item(row), True


def remove_watch(db: Session, user: User, land_code: str, ip: str | None) -> None:
    key = " ".join(land_code.split())
    row = db.scalar(
        select(WatchlistItem)
        .join(LandParcel, LandParcel.id == WatchlistItem.land_id)
        .where(WatchlistItem.user_id == user.id, LandParcel.land_id == key)
    )
    if row is None:
        raise AppError("WATCH_NOT_FOUND", "Parcel is not on your watchlist", 404)
    db.delete(row)
    audit.log(db, user, "WATCHLIST_REMOVE", "land_parcel", key, ip=ip)
    db.commit()


def _report_items(db: Session, user: User, limit: int, offset: int) -> list[ReportItem]:
    rows = db.execute(
        select(VerificationRequest, LandParcel)
        .join(LandParcel, LandParcel.id == VerificationRequest.land_id)
        .where(VerificationRequest.requested_by == user.id)
        .order_by(VerificationRequest.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [
        ReportItem(
            id=r.id,
            land_id=land.land_id,
            mouza=land.mouza,
            dag_no=land.dag_no,
            status=r.status,
            risk_level=r.result_summary,
            created_at=r.created_at,
            completed_at=r.completed_at,
        )
        for r, land in rows
    ]


def _report_count(db: Session, user: User) -> int:
    return db.scalar(select(func.count()).where(VerificationRequest.requested_by == user.id)) or 0


def list_reports(db: Session, user: User, limit: int, offset: int) -> ReportList:
    return ReportList(items=_report_items(db, user, limit, offset), total=_report_count(db, user))


def _unread(db: Session, user: User) -> int:
    return (
        db.scalar(
            select(func.count()).where(
                Notification.user_id == user.id, Notification.read_at.is_(None)
            )
        )
        or 0
    )


def list_notifications(
    db: Session, user: User, unread_only: bool, limit: int, offset: int
) -> NotificationList:
    sync_watch_alerts(db, user)
    base = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        base = base.where(Notification.read_at.is_(None))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(
        base.order_by(Notification.created_at.desc(), Notification.id).limit(limit).offset(offset)
    ).all()
    return NotificationList(
        items=[NotificationItem.model_validate(n) for n in rows],
        total=total,
        unread=_unread(db, user),
    )


def mark_read(db: Session, user: User, ids: list[str] | None) -> int:
    stmt = update(Notification).where(
        Notification.user_id == user.id, Notification.read_at.is_(None)
    )
    if ids is not None:
        stmt = stmt.where(Notification.id.in_(ids))
    db.execute(stmt.values(read_at=_now()))
    db.commit()
    return _unread(db, user)


def summary(db: Session, user: User) -> MeSummary:
    sync_watch_alerts(db, user)
    searches = list_searches(db, user, 3, 0)
    latest = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id)
        .limit(3)
    ).all()
    return MeSummary(
        searches=searches.total,
        watching=db.scalar(select(func.count()).where(WatchlistItem.user_id == user.id)) or 0,
        reports=_report_count(db, user),
        unread=_unread(db, user),
        recent_searches=searches.items,
        recent_reports=_report_items(db, user, 3, 0),
        latest_notifications=[NotificationItem.model_validate(n) for n in latest],
    )


# ---- profile ---------------------------------------------------------------------------------
def update_profile(db: Session, user: User, body: ProfileUpdate, ip: str | None) -> User:
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if "phone" in changes and changes["phone"] == "":
        changes["phone"] = None
    if not changes:
        raise AppError("NO_CHANGES", "Nothing to update", 422)
    changed = sorted(k for k, v in changes.items() if getattr(user, k) != v)
    if not changed:
        return user  # no-op: nothing written, nothing audited
    for k in changed:
        setattr(user, k, changes[k])
    # field names only: the phone number itself stays out of the audit log
    audit.log(db, user, "PROFILE_UPDATE", "user", user.id, new={"fields": changed}, ip=ip)
    db.commit()
    return user


def change_password(db: Session, user: User, body: PasswordChange, ip: str | None) -> None:
    check_rate("password-change", user.id, PASSWORD_TRIES_PER_MIN)
    if not verify_password(body.current_password, user.password_hash):
        raise AppError("WRONG_PASSWORD", "Current password is incorrect", 400)
    if body.new_password == body.current_password:
        raise AppError("PASSWORD_UNCHANGED", "New password must differ from the current one", 422)
    user.password_hash = hash_password(body.new_password)
    audit.log(db, user, "PASSWORD_CHANGE", "user", user.id, ip=ip)
    db.commit()
