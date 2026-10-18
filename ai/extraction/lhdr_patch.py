# ruff: noqa: E501
"""Reviewer edits to an LHDR v1 record by JSON pointer (H5).

    {"op": "replace", "path": "/schedule/0/boundaries/north", "value": "খাল"}
    {"op": "add",     "path": "/parties/-", "value": {"role": "WITNESS", "name": "..."}}
    {"op": "remove",  "path": "/execution/witnesses/1"}

- A path that ends at a `Field` (or at its `/value`) edits the normalised value; `/verbatim` and
  `/legibility` edit those. A Field's machine metadata (confidence, source, method, candidates...) is
  not editable. `/schema` and `/core` (derived) are not editable either.
- Missing objects on the way are created (`/schedule/0/boundaries/north` when there are no boundaries
  yet); list items must exist, except `add` at `-` (append) or at index == length.
- Every value an edit touches is marked `method: human, edited_by_human: true`; a value edit also
  clears the H4 review flags (the reviewer has decided). A replace that changes nothing is skipped.
- After each op the whole record is validated by the LHDR models (wrong shape -> PatchError).

`core_ops(record, field, value)` turns an edit of one of the 13 core fields into record ops, so a
record-backed document never has core fields that disagree with its record (derive.py reads them).
"""
from __future__ import annotations

import copy
import json
import types
from dataclasses import dataclass, field
from typing import Annotated, Any, Union, get_args, get_origin

import pydantic
from pydantic import BaseModel

from ai.extraction import lhdr
from ai.extraction.derive import core_paths
from ai.extraction.lhdr import LHDR, MUTUAL_ROLES, TRANSFEREE_ROLES, TRANSFEROR_ROLES, Field

OPS = ("replace", "add", "remove")
FIELD_EDITABLE = ("value", "verbatim", "legibility")
LOCKED_ROOTS = ("schema", "core")
MAX_STRING = 500
MAX_LIST = 100
MAX_VALUE_BYTES = 8_000


@dataclass
class PatchError(Exception):
    code: str  # INVALID_PATH PATH_NOT_EDITABLE NOT_FOUND NOT_A_LIST VALUE_TOO_LARGE LIST_TOO_LONG RECORD_INVALID NO_RECORD_TARGET
    path: str
    index: int | None = None  # which op of the request
    params: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {"path": self.path, "code": self.code}
        if self.index is not None:
            out["index"] = self.index
        if self.params:
            out["params"] = self.params
        return out


def dump(rec: LHDR) -> dict:
    """The stored JSON form of a record (as H4 stores it)."""
    return rec.model_dump(mode="json", by_alias=True, exclude_none=True)


# ---- JSON pointer + schema types ----------------------------------------------------------------


def pointer(path: str) -> list[str]:
    """RFC 6901 segments ("~1" = "/", "~0" = "~")."""
    if not isinstance(path, str) or not path.startswith("/") or len(path) > 200:
        raise PatchError("INVALID_PATH", str(path)[:200])
    return [s.replace("~1", "/").replace("~0", "~") for s in path[1:].split("/")]


def _unwrap(tp: Any) -> Any:
    while True:
        origin = get_origin(tp)
        if origin is Annotated:
            tp = get_args(tp)[0]
        elif origin in (Union, types.UnionType):
            args = [a for a in get_args(tp) if a is not type(None)]
            if len(args) != 1:
                return tp  # e.g. int | float inside a Field
            tp = args[0]
        else:
            return tp


def _is_field(tp: Any) -> bool:
    return isinstance(tp, type) and issubclass(tp, Field)


def _is_model(tp: Any) -> bool:
    return isinstance(tp, type) and issubclass(tp, BaseModel) and not _is_field(tp)


def _attr(model: type[BaseModel], seg: str) -> tuple[str, Any] | None:
    """(python name, annotation) of the model field whose JSON key is `seg`."""
    for name, info in model.model_fields.items():
        if (info.alias or name) == seg:
            return name, info.annotation
    return None


def _index(seg: str, size: int, path: str, allow_end: bool = False) -> int:
    if seg == "-" and allow_end:
        return size
    if not seg.isdigit() or (len(seg) > 1 and seg[0] == "0"):
        raise PatchError("INVALID_PATH", path)
    i = int(seg)
    if i > size or (i == size and not allow_end):
        raise PatchError("NOT_FOUND", path)
    return i


def _type_at(segs: list[str], path: str) -> Any:
    """Schema type at the pointer; raises INVALID_PATH for keys the format does not have."""
    tp: Any = LHDR
    for k, seg in enumerate(segs):
        tp = _unwrap(tp)
        if _is_field(tp):
            if k != len(segs) - 1 or seg not in FIELD_EDITABLE:
                raise PatchError("PATH_NOT_EDITABLE", path)
            return ("field-part", seg)
        if _is_model(tp):
            found = _attr(tp, seg)
            if found is None:
                raise PatchError("INVALID_PATH", path)
            tp = found[1]
        elif get_origin(tp) is list:
            if not (seg == "-" or seg.isdigit()):
                raise PatchError("INVALID_PATH", path)
            tp = get_args(tp)[0]
        elif get_origin(tp) is dict:
            tp = get_args(tp)[1]
        else:
            raise PatchError("INVALID_PATH", path)
    return _unwrap(tp)


def _obj_at(obj: Any, segs: list[str]) -> Any:
    """Value at the pointer in a parsed record (None when absent)."""
    for seg in segs:
        if obj is None:
            return None
        if isinstance(obj, BaseModel):
            found = _attr(type(obj), seg)
            obj = getattr(obj, found[0]) if found else None
        elif isinstance(obj, list):
            obj = obj[int(seg)] if seg.isdigit() and int(seg) < len(obj) else None
        elif isinstance(obj, dict):
            obj = obj.get(seg)
        else:
            return None
    return obj


def _mark_human(obj: Any, value_edit: bool, flag: str | None = None) -> None:
    if isinstance(obj, Field):
        if flag is not None:  # a machine correction (record_assist): keep method, add a review hint
            obj.flags = [*obj.flags, flag] if flag not in obj.flags else obj.flags
            return
        obj.edited_by_human = True
        if value_edit:
            obj.method = "human"
            obj.flags = []
        return
    if isinstance(obj, BaseModel):
        for name in type(obj).model_fields:
            _mark_human(getattr(obj, name), value_edit, flag)
    elif isinstance(obj, list):
        for v in obj:
            _mark_human(v, value_edit, flag)
    elif isinstance(obj, dict):
        for v in obj.values():
            _mark_human(v, value_edit, flag)


def edited(obj: Any) -> bool:
    """True when any Field in the record was edited by a person."""
    if isinstance(obj, Field):
        return obj.edited_by_human
    if isinstance(obj, BaseModel):
        return any(edited(getattr(obj, n)) for n in type(obj).model_fields)
    if isinstance(obj, list):
        return any(edited(v) for v in obj)
    if isinstance(obj, dict):
        return any(edited(v) for v in obj.values())
    return False


# ---- applying ops -------------------------------------------------------------------------------


def _clean(v: Any, path: str) -> Any:
    """Collapse whitespace, "" -> None, size limits."""
    if isinstance(v, str):
        v = " ".join(v.split())
        if len(v) > MAX_STRING:
            raise PatchError("VALUE_TOO_LARGE", path, params={"max": MAX_STRING})
        return v or None
    if isinstance(v, list):
        if len(v) > MAX_LIST:
            raise PatchError("LIST_TOO_LONG", path, params={"max": MAX_LIST})
        return [_clean(x, path) for x in v]
    if isinstance(v, dict):
        return {str(k): _clean(x, path) for k, x in v.items()}
    return v


def _container(data: dict, segs: list[str], path: str) -> Any:
    """Walk raw JSON to the parent of the last segment, creating missing objects on the way."""
    node: Any = data
    for k, seg in enumerate(segs):
        tp = _type_at(segs[: k + 1], path)
        if isinstance(node, list):
            node = node[_index(seg, len(node), path)]
            continue
        if not isinstance(node, dict):
            raise PatchError("NOT_FOUND", path)
        if node.get(seg) is None:
            if _is_field(tp) or _is_model(tp) or get_origin(tp) is dict:
                node[seg] = {}
            elif get_origin(tp) is list:
                node[seg] = []
            else:
                raise PatchError("NOT_FOUND", path)
        node = node[seg]
    return node


def _apply_raw(data: dict, op: str, segs: list[str], value: Any, path: str) -> None:
    target = _type_at(segs, path)
    parent_segs, last = segs[:-1], segs[-1]
    if isinstance(target, tuple):  # /…/verbatim of a Field
        if op != "replace":
            raise PatchError("PATH_NOT_EDITABLE", path)
        _container(data, parent_segs, path)[last] = value
        return
    parent = _container(data, parent_segs, path)
    if op == "add":
        if isinstance(parent, list):
            if len(parent) >= MAX_LIST:
                raise PatchError("LIST_TOO_LONG", path, params={"max": MAX_LIST})
            parent.insert(_index(last, len(parent), path, allow_end=True), value)
        elif isinstance(parent, dict) and get_origin(_unwrap(_type_at(parent_segs, path))) is dict:
            parent[last] = value  # area parts: {"kani": 2}
        else:
            raise PatchError("NOT_A_LIST", path)
        return
    if op == "remove":
        if isinstance(parent, list):
            parent.pop(_index(last, len(parent), path))
        elif isinstance(parent, dict) and parent.get(last) is not None:
            del parent[last]
        else:
            raise PatchError("NOT_FOUND", path)
        return
    # replace
    if isinstance(parent, list):
        i = _index(last, len(parent), path)
        if _is_field(target) and not isinstance(value, dict) and isinstance(parent[i], dict):
            parent[i] = {**parent[i], "value": value}
        else:
            parent[i] = value
        return
    cur = parent.get(last)
    if _is_field(target) and not isinstance(value, dict):
        parent[last] = {**cur, "value": value} if isinstance(cur, dict) else {"value": value}
    elif _is_field(target) and isinstance(value, dict):
        if set(value) - set(FIELD_EDITABLE):
            raise PatchError("PATH_NOT_EDITABLE", path)
        parent[last] = {**(cur if isinstance(cur, dict) else {}), **value}
    else:
        parent[last] = value


def _pydantic_errors(e: pydantic.ValidationError) -> list[dict]:
    return [
        {"path": "/" + "/".join(str(x) for x in err["loc"] if not str(x).startswith("function-")), "msg": err["msg"]}
        for err in e.errors()[:10]
    ]


def apply(record: dict | LHDR, ops: list[dict], flag: str | None = None) -> tuple[LHDR, list[dict]]:
    """Apply ops in order. Returns the new record and the changes made [{op, path, old, new}].
    Raises PatchError (with the op index) and leaves `record` unchanged. `flag` marks a machine
    edit instead of a human one: the touched Fields keep their method and get that flag."""
    rec = record if isinstance(record, LHDR) else lhdr.parse(record)
    data = dump(rec)
    changes: list[dict] = []
    for i, o in enumerate(ops):
        op, path = o.get("op", "replace"), o.get("path", "")
        try:
            if op not in OPS:
                raise PatchError("INVALID_OP", str(path)[:200], params={"allowed": list(OPS)})
            segs = pointer(path)
            if segs[0] in LOCKED_ROOTS or segs == [""]:
                raise PatchError("PATH_NOT_EDITABLE", path)
            value = _clean(o.get("value"), path)
            if len(json.dumps(value, ensure_ascii=False)) > MAX_VALUE_BYTES:
                raise PatchError("VALUE_TOO_LARGE", path, params={"max": MAX_VALUE_BYTES})
            old = lhdr.plain(_obj_at(rec, segs))
            cand = copy.deepcopy(data)
            _apply_raw(cand, op, segs, value, path)
            try:
                new_rec = lhdr.parse(cand)
            except pydantic.ValidationError as e:
                raise PatchError("RECORD_INVALID", path, params={"errors": _pydantic_errors(e)}) from None
        except PatchError as e:
            e.index = i
            raise
        if op == "add" and segs[-1] == "-":
            parent = _obj_at(new_rec, segs[:-1])
            segs = [*segs[:-1], str(len(parent) - 1)] if isinstance(parent, list) else segs
        if op == "remove":
            changes.append({"op": op, "path": path, "old": old, "new": None})
        else:
            part = isinstance(_obj_at(new_rec, segs[:-1]), Field)  # …/value, …/verbatim of a Field
            node = _obj_at(new_rec, segs[:-1] if part else segs)
            new = lhdr.plain(_obj_at(new_rec, segs))
            if op == "replace" and new == old:
                continue  # nothing changed: keep the machine metadata as it is
            _mark_human(node, value_edit=not part or segs[-1] == "value", flag=flag)
            changes.append({"op": op, "path": "/" + "/".join(s.replace("~", "~0").replace("/", "~1") for s in segs), "old": old, "new": new})
        rec, data = new_rec, dump(new_rec)
    return rec, changes


# ---- the 13 core fields -> record ops -----------------------------------------------------------


def _area_value(v: str) -> int | float:
    f = float(v)
    return int(f) if f.is_integer() else f


def _party_index(rec: LHDR, roles: tuple) -> int | None:
    return next((i for i, p in enumerate(rec.parties) if p.role.value in roles), None)


def core_ops(rec: LHDR, name: str, value: str | None) -> list[dict]:
    """Record ops that make derive_core(rec)[name] == value. `value` is already normalised the way
    the flat PATCH normalises it (ASCII digits, ISO date, lower-case unit)."""
    path = core_paths(rec).get(name)
    if name == "deed_date":
        base = path or "/dates/execution"
        ops = [
            {"op": "replace", "path": f"{base}/gregorian_from", "value": value},
            {"op": "replace", "path": f"{base}/gregorian_to", "value": value},
        ]
        if value is not None:
            ops.append({"op": "replace", "path": f"{base}/precision", "value": "day"})
            d = rec.dates and getattr(rec.dates, base.rsplit("/", 1)[1])
            if not (d and d.calendar and d.calendar.value):
                ops.append({"op": "replace", "path": f"{base}/calendar", "value": "gregorian"})
        return ops if path or value is not None else []
    v: Any = _area_value(value) if name == "land_area" and value is not None else value
    if path:
        return [{"op": "replace", "path": path, "value": v}]
    if value is None:
        return []  # nothing to clear
    if name in ("seller", "owner_name", "buyer", "father_name"):
        roles = TRANSFEREE_ROLES if name == "buyer" else TRANSFEROR_ROLES
        i = _party_index(rec, roles)
        if i is None and name == "owner_name":
            i = _party_index(rec, MUTUAL_ROLES)
        if name == "father_name":
            if i is None:
                raise PatchError("NO_RECORD_TARGET", "/parties", params={"field": name})
            return [{"op": "replace", "path": f"/parties/{i}/father/name", "value": v}]
        if i is None:
            return [{"op": "add", "path": "/parties/-", "value": {"role": "BUYER" if name == "buyer" else "SELLER", "name": v}}]
        return [{"op": "replace", "path": f"/parties/{i}/name", "value": v}]
    if name == "deed_no":
        return [{"op": "replace", "path": "/registration/deed_no", "value": v}]
    ops = [] if rec.schedule else [{"op": "add", "path": "/schedule/-", "value": {}}]
    if name == "dag_no":
        if rec.schedule and rec.schedule[0].dag_no:
            return [{"op": "replace", "path": "/schedule/0/dag_no/0", "value": v}]
        return [*ops, {"op": "add", "path": "/schedule/0/dag_no/0", "value": v}]
    key = {"upazila": "thana", "land_area": "area/value", "area_unit": "area/unit"}.get(name, name)
    return [*ops, {"op": "replace", "path": f"/schedule/0/{key}", "value": v}]


def apply_core(rec: LHDR, edits: dict[str, str | None], flag: str | None = None) -> tuple[LHDR, list[dict]]:
    """Write flat core-field edits into the record, one field at a time (paths can move)."""
    changes: list[dict] = []
    for name, value in edits.items():
        try:
            rec, ch = apply(rec, core_ops(rec, name, value), flag)
        except PatchError as e:
            e.params = {**e.params, "field": name}
            raise
        changes += ch
    return rec, changes

