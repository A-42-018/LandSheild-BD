"""H8c: the digital deed as a PDF (WeasyPrint = the assumed H8a engine, decision D7 still open).

`build_view` turns one record version into plain sections A-I (engine independent, tested without
any PDF library). `render_html` lays them out; `render_pdf` needs WeasyPrint + Pango and raises
PDF_ENGINE_UNAVAILABLE (503) without them. NIDs are printed as the last 4 digits only. A version
that is not approved is marked "DRAFT - NOT APPROVED" on every page.
"""
from __future__ import annotations

import re
from html import escape
from pathlib import Path
from typing import Any

from ai.extraction import lhdr
from app.core.errors import AppError

FONTS = Path(__file__).resolve().parents[3] / "ai" / "fonts"
FONT_FILES = ("NotoSansBengali-Regular.ttf", "FreeSans.ttf")
DRAFT_MARK = "DRAFT – NOT APPROVED"
DRAFT_MARK_BN = "খসড়া – অনুমোদিত নয়"
SEE_JSON = "—"

ROLES = {"SELLER": "বিক্রেতা", "BUYER": "ক্রেতা", "DONOR": "দাতা", "DONEE": "গ্রহীতা",
         "MORTGAGOR": "বন্ধকদাতা", "MORTGAGEE": "বন্ধকগ্রহীতা", "WITNESS": "সাক্ষী"}  # fmt: skip


def mask_nid(value: object) -> str:
    """`••••1234`: only the last 4 digits survive (any digit script); fewer than 4 -> all masked."""
    digits = re.sub(r"\D", "", str(value or "").translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")))
    return "••••" + digits[-4:] if len(digits) >= 4 else "••••"


def _txt(v: Any) -> str:
    if v is None or v == "" or v == [] or v == {}:
        return ""
    if isinstance(v, bool):
        return "হ্যাঁ" if v else "না"
    if isinstance(v, list):
        return ", ".join(x for x in (_txt(i) for i in v) if x)
    return str(v)


def _row(bn: str, en: str, v: Any) -> tuple[str, str, str]:
    return (bn, en, _txt(v))


def _addr(a: dict | None) -> str:
    a = a or {}
    keys = ("village", "post", "union", "thana", "pargana", "district")
    return ", ".join(_txt(a.get(k)) for k in keys if a.get(k))


def _date(d: dict | None) -> str:
    d = d or {}
    out = _txt(d.get("verbatim")) or " ".join(_txt(d.get(k)) for k in ("day", "month", "year") if d.get(k))
    if d.get("gregorian_from"):
        g = _txt(d["gregorian_from"])
        if d.get("gregorian_to") and d["gregorian_to"] != d["gregorian_from"]:
            g += f" – {_txt(d['gregorian_to'])}"
        out = f"{out} ({g})" if out else g
    return out


def _party(p: dict) -> list[tuple[str, str, str]]:
    rel = p.get("father") or p.get("husband") or {}
    rows = [
        _row("ভূমিকা", "Role", ROLES.get(_txt(p.get("role")), _txt(p.get("role")))),
        _row("নাম", "Name", " ".join(x for x in (_txt(p.get("honorific")), _txt(p.get("name"))) if x)),
        _row("পিতা / স্বামী", "Father / husband", (_txt(rel.get("name")) + (" (মৃত)" if rel.get("deceased") else "")).strip()),
        _row("মাতা", "Mother", p.get("mother")),
        _row("ঠিকানা", "Address", _addr(p.get("address"))),
        _row("পেশা", "Profession", p.get("profession")),
        _row("ধর্ম", "Religion", p.get("religion")),
        _row("অংশ", "Share", p.get("share")),
    ]  # fmt: skip
    if p.get("nid"):
        rows.append(_row("জাতীয় পরিচয়পত্র", "NID", mask_nid(p["nid"])))
    return [r for r in rows if r[2]]


def _plot(p: dict) -> list[tuple[str, str, str]]:
    a, b = p.get("area") or {}, p.get("boundaries") or {}
    area = " ".join(x for x in (_txt(a.get("value")), _txt(a.get("unit"))) if x) or _txt(a.get("parts"))
    rows = [
        _row("জেলা", "District", p.get("district")), _row("থানা", "Thana", p.get("thana")),
        _row("মৌজা", "Mouza", p.get("mouza")), _row("জে.এল. নং", "JL no", p.get("jl_no")),
        _row("জরিপ", "Survey", p.get("survey")), _row("খতিয়ান নং", "Khatian no", p.get("khatian_no")),
        _row("দাগ নং", "Dag no", p.get("dag_no")), _row("পরিমাণ", "Area", area),
        _row("শতক", "Decimal equivalent", a.get("decimal_equiv")), _row("জমির শ্রেণি", "Land class", p.get("land_class")),
        _row("উত্তরে", "North", b.get("north")), _row("দক্ষিণে", "South", b.get("south")),
        _row("পূর্বে", "East", b.get("east")), _row("পশ্চিমে", "West", b.get("west")),
    ]  # fmt: skip
    return [r for r in rows if r[2]]


def build_view(schema: str, record: dict) -> list[dict]:
    """Sections `[{key, title_bn, title_en, blocks: [rows]}]`; a block is a list of (bn, en, value).
    Empty sections are dropped. `core/1` records (modern deeds) become one flat section."""
    if schema != lhdr.SCHEMA:
        fields = [(_txt(f.get("field")), _txt(f.get("field")), _txt(f.get("value"))) for f in record.get("fields", [])]
        return [{"key": "core", "title_bn": "দলিলের তথ্য", "title_en": "Deed fields",
                 "blocks": [[r for r in fields if r[2]]]}]  # fmt: skip
    r = lhdr.plain(lhdr.parse(record))
    d, reg, dt = r.get("document", {}), r.get("registration", {}), r.get("dates", {})
    con, tr, ex, mm = r.get("consideration", {}), r.get("title_recital", {}), r.get("execution", {}), r.get("modern_mapping", {})
    wr = ex.get("deed_writer") or {}
    sections = [
        ("A", "দলিলের ধরন", "Document", [[
            _row("ধরন", "Kind", d.get("kind")), _row("যুগ", "Era", d.get("era")),
            _row("ভাষা", "Languages", d.get("languages")), _row("পৃষ্ঠা", "Pages", d.get("pages")),
        ]]),
        ("B", "নিবন্ধন", "Registration", [[
            _row("দলিল নং", "Deed no", reg.get("deed_no")), _row("মূল লেখা", "As written", reg.get("deed_no_verbatim")),
            _row("বালাম / বহি", "Volume", reg.get("volume")), _row("পৃষ্ঠা", "Pages", reg.get("pages")),
            _row("সাব-রেজিস্ট্রি অফিস", "Office", reg.get("office")), _row("সন", "Year", reg.get("year")),
        ]]),
        ("C", "তারিখ", "Dates", [[
            _row("সম্পাদনের তারিখ", "Execution", _date(dt.get("execution"))),
            _row("নিবন্ধনের তারিখ", "Registration", _date(dt.get("registration"))),
        ]]),
        ("D", "পক্ষগণ", "Parties", [_party(p) for p in r.get("parties", [])]),
        ("E", "প্রতিদান", "Consideration", [[
            _row("পরিমাণ", "Amount", " ".join(x for x in (_txt(con.get("amount")), _txt(con.get("currency_written"))) if x)),
            _row("কথায়", "In words", con.get("in_words")), _row("মুদ্রা", "Currency", con.get("era_currency")),
            _row("পরিশোধ", "Mode", con.get("mode")),
        ]]),
        ("F", "তপশিল", "Schedule", [_plot(p) for p in r.get("schedule", [])]),
        ("G", "স্বত্বের বিবরণ", "Title recital", [[
            _row("ভিত্তি", "Basis", tr.get("basis")), _row("পূর্ববর্তী দলিল", "Prior deed", tr.get("prior_deed")),
            _row("প্রকৃতি", "Nature", tr.get("nature")), _row("নিষ্কণ্টক", "Free of encumbrance", tr.get("encumbrance_free")),
        ]]),
        ("H", "সম্পাদন", "Execution", [
            [_row("বিক্রেতার চিহ্ন", "Seller's mark", ex.get("seller_mark")),
             _row("দলিল লেখক", "Deed writer", wr.get("name")), _row("লাইসেন্স নং", "Licence no", wr.get("licence_no")),
             _row("স্ট্যাম্প", "Stamps", "; ".join(f"{_txt(s.get('type'))} {_txt(s.get('value'))}".strip() for s in ex.get("stamps", []))),
             _row("সিল", "Seals", ex.get("seals"))],
            *[_party({**w, "role": "WITNESS"}) for w in ex.get("witnesses", [])],
        ]),
        ("I", "বর্তমান নাম", "Modern mapping", [[
            _row("বিভাগ", "Division", mm.get("division")), _row("জেলা", "District", mm.get("district")),
            _row("উপজেলা", "Upazila", mm.get("upazila")),
        ]]),
    ]  # fmt: skip
    out = []
    for key, bn, en, blocks in sections:
        blocks = [b for b in blocks if b]
        if blocks:
            out.append({"key": key, "title_bn": bn, "title_en": en, "blocks": blocks})
    return out


def _font_uri() -> str:
    for name in FONT_FILES:
        if (FONTS / name).exists():
            return (FONTS / name).as_uri()
    raise AppError("PDF_FONT_MISSING", "No Bangla font is installed for the PDF", 503)


def render_html(view: list[dict], meta: dict) -> str:
    """meta: deed_no, version, draft, approved_at, approver, record_hash, file_hash, signature,
    key_id, document_id, verify_url (H8d, QR + address; none on a draft). Everything is escaped."""
    e = lambda v: escape(_txt(v))  # noqa: E731
    draft = bool(meta.get("draft"))
    body = []
    for s in view:
        body.append(f"<section><h2><span class=k>{s['key']}</span> {e(s['title_bn'])} <small>{e(s['title_en'])}</small></h2>")
        for i, block in enumerate(s["blocks"], 1):
            if len(s["blocks"]) > 1:
                body.append(f"<h3>{i}</h3>")
            body.append("<table>" + "".join(
                f"<tr><th>{e(bn)} <small>{e(en)}</small></th><td>{e(val)}</td></tr>" for bn, en, val in block
            ) + "</table>")
        body.append("</section>")
    status = e(DRAFT_MARK) + " · " + e(DRAFT_MARK_BN) if draft else "অনুমোদিত · Approved"
    foot = [
        ("দলিল নং / Deed no", meta.get("deed_no")), ("সংস্করণ / Version", meta.get("version")),
        ("অনুমোদনের তারিখ / Approved at", meta.get("approved_at") or SEE_JSON),
        ("অনুমোদনকারী কর্মকর্তা / Approving officer", meta.get("approver") or SEE_JSON),
        ("রেকর্ড SHA-256 / Record", meta.get("record_hash") or SEE_JSON),
        ("মূল ফাইল SHA-256 / Original file", meta.get("file_hash")),
        ("স্বাক্ষর (Ed25519) / Signature", meta.get("signature") or SEE_JSON), ("Key id", meta.get("key_id")),
    ]  # fmt: skip
    foot_html = "".join(f"<tr><th>{e(k)}</th><td class=h>{e(v)}</td></tr>" for k, v in foot)
    url = _txt(meta.get("verify_url"))
    qr = ""
    if url and not draft:  # a draft has no public page
        img = qr_data_uri(url)
        qr = (
            "<div class=qr>"
            + (f"<img src='{escape(img, quote=True)}' alt='QR'>" if img else "")
            + f"<div>যাচাই করতে স্ক্যান করুন · Scan to verify<br><span class=h>{e(url)}</span></div></div>"
        )
    top = f"@top-center{{content:'{DRAFT_MARK}';color:#b00020;font-weight:bold;font-size:12pt}}" if draft else ""
    css = (
        f"@font-face{{font-family:Bn;src:url('{_font_uri()}')}}"
        f"@page{{size:A4;margin:22mm 16mm 20mm;{top}"
        f"@bottom-center{{content:'{_css_str(_txt(meta.get('deed_no')))} · v{_txt(meta.get('version'))} · ' counter(page) '/' counter(pages);"
        "font-size:8pt;font-family:Bn}}"
        "body{font-family:Bn;font-size:11pt;color:#111}h1{font-size:18pt;margin:0 0 2mm}"
        "h2{font-size:13pt;border-bottom:1px solid #0A3527;color:#0A3527;margin:6mm 0 2mm}h3{font-size:10pt;margin:3mm 0 1mm}"
        "small{font-size:8pt;color:#555;font-weight:normal}.k{background:#0A3527;color:#fff;padding:0 2mm}"
        "table{width:100%;border-collapse:collapse}th{width:38%;text-align:left;font-weight:normal;vertical-align:top;padding:1mm 2mm}"
        "td{padding:1mm 2mm;border-bottom:.3px solid #ccc}section{break-inside:auto}tr{break-inside:avoid}"
        ".h{font-size:7.5pt;word-break:break-all}.st{font-size:12pt;font-weight:bold;margin-bottom:3mm}"
        ".foot{margin-top:8mm;border-top:2px solid #0A3527;break-inside:avoid}"
        ".qr{display:flex;align-items:center;gap:4mm;margin-top:3mm;font-size:9pt}.qr img{width:28mm;height:28mm}"
    )
    return (
        f"<html lang='bn'><head><meta charset='utf-8'><title>{e(meta.get('deed_no'))}</title><style>{css}</style></head><body>"
        f"<h1>ডিজিটাল দলিল · Digital deed</h1><div class=st>{status}</div>{''.join(body)}"
        f"<div class=foot><h2>যাচাইকরণ · Integrity</h2><table>{foot_html}</table>{qr}</div></body></html>"
    )


def record_url(site_url: str, record_id: str, locale: str = "bn") -> str:
    """H8d: the public verify page of one record version (`/{locale}/v/r/{record id}`)."""
    return f"{(site_url or '').rstrip('/')}/{locale}/v/r/{record_id}"


def qr_data_uri(url: str) -> str:
    """The QR code of `url` as an SVG data URI, or "" when segno is not installed (the PDF then
    prints the address as text only)."""
    try:
        import segno  # noqa: PLC0415
    except ImportError:
        return ""
    return segno.make(url, error="m").svg_data_uri(scale=3, border=1, dark="#0A3527")


def _css_str(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ")


def render_pdf(html: str) -> bytes:
    try:
        from weasyprint import HTML  # noqa: PLC0415
    except (ImportError, OSError):  # missing package or missing Pango
        raise AppError("PDF_ENGINE_UNAVAILABLE", "The PDF engine is not installed on this server", 503) from None
    return HTML(string=html).write_pdf()


def deed_pdf(schema: str, record: dict, meta: dict) -> bytes:
    return render_pdf(render_html(build_view(schema, record), meta))
