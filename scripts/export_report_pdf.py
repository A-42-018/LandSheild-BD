#!/usr/bin/env python
"""Export a verification report to PDF with headless Chromium (demo backup, P47).

Chromium prints through the same @media print stylesheet as the "Download PDF"
button, so Bangla shaping matches the browser. Requires running backend + frontend:

  pip install playwright && playwright install chromium
  DEMO_PASSWORD=<pw> python scripts/export_report_pdf.py --land-id LP-10240 --locale bn

Demo Dataset — Not an Official Government Land Record.
"""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--land-id", default="LP-10240", help="parcel code, e.g. LP-10240")
    ap.add_argument("--locale", choices=["en", "bn"], default="en")
    ap.add_argument("--email", default="reviewer@demo.landshield.test")
    ap.add_argument("--frontend", default=os.getenv("FRONTEND_URL", "http://localhost:3000"))
    ap.add_argument("--api", default=os.getenv("API_URL", "http://localhost:8001/api/v1"))
    ap.add_argument("--out", default=None, help="output path (default docs/backup/report-<land>-<locale>.pdf)")
    ap.add_argument("--timeout", type=int, default=30, help="seconds to wait for the report to render")
    args = ap.parse_args()

    password = os.getenv("DEMO_PASSWORD")
    if not password:
        print("error: set DEMO_PASSWORD (the password used by scripts/seed.py)", file=sys.stderr)
        return 2
    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("error: pip install playwright && playwright install chromium", file=sys.stderr)
        return 2

    out = Path(args.out) if args.out else ROOT / "docs" / "backup" / f"report-{args.land_id}-{args.locale}.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)
    api = args.api.rstrip("/")
    ms = args.timeout * 1000

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            ctx = browser.new_context(locale="bn-BD" if args.locale == "bn" else "en-US")
            # API login stores the httpOnly refresh cookie in the context; the report page
            # restores its session from it (access token is memory-only in the app).
            res = ctx.request.post(f"{api}/auth/login", data={"email": args.email, "password": password})
            if not res.ok:
                print(f"error: login failed ({res.status})", file=sys.stderr)
                return 1
            token = res.json()["access_token"]
            auth = {"Authorization": f"Bearer {token}"}
            res = ctx.request.post(f"{api}/verification", data={"land_id": args.land_id}, headers=auth)
            if not res.ok:
                print(f"error: could not create verification ({res.status})", file=sys.stderr)
                return 1
            vid = res.json()["id"]

            page = ctx.new_page()
            page.goto(f"{args.frontend.rstrip('/')}/{args.locale}/report/{vid}", wait_until="networkidle")
            page.wait_for_selector('[data-testid="report-disclaimer"]', timeout=ms)
            page.evaluate("document.fonts.ready")
            page.emulate_media(media="print")
            page.pdf(path=str(out), format="A4", print_background=True, prefer_css_page_size=True)
            browser.close()
    except PlaywrightError as exc:
        print(f"error: {str(exc).splitlines()[0]}", file=sys.stderr)
        return 1

    print(f"pdf ok: {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
