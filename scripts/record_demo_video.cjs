/**
 * S2: record the Round-1 demo video (≤ 3:00) by driving the local app with Playwright.
 * Follows roadmap card S2 / docs/demo-script.md §A. Captions are drawn in the page and also
 * written as docs/video/LandShield-BD-demo.en.srt; ffmpeg turns the WebM into an MP4.
 *
 * Needs a FRESH seeded local run (scripts/demo_reset.sh, mock OCR) on :8001 + :3000, and the same
 * DATABASE_URL in this process (the tamper step edits SQLite directly).
 *   cd frontend && DATABASE_URL=sqlite:///<abs path>/landshield.db node ../scripts/record_demo_video.cjs
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { chromium } = require(path.resolve("node_modules/playwright"));

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs/video");
const WEB = "http://localhost:3000";
const SAMPLE = (f) => path.join(ROOT, "database/sample_data", f);
const PY = process.env.PYTHON || path.join(ROOT, "backend/.venv/bin/python");
const SIZE = { width: 1280, height: 720 };

const CAPTION_JS = () => {
  setInterval(() => {
    let d = document.getElementById("demo-cap");
    if (!d) {
      d = document.createElement("div");
      d.id = "demo-cap";
      d.style.cssText =
        "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:1080px;z-index:2147483647;" +
        "background:rgba(15,23,42,.88);color:#fff;font:600 20px/1.35 Inter,system-ui,sans-serif;padding:10px 18px;" +
        "border-radius:6px;text-align:center;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.25)";
      document.documentElement.appendChild(d);
    }
    const t = sessionStorage.getItem("demo-cap") || "";
    if (d.textContent !== t) d.textContent = t;
    d.style.display = t ? "block" : "none";
    // Playwright only writes frames when something repaints; a 1-px tick keeps video time = wall time (SRT stays in sync).
    let k = document.getElementById("demo-tick");
    if (!k) {
      k = document.createElement("div");
      k.id = "demo-tick";
      k.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;z-index:2147483647;pointer-events:none";
      document.documentElement.appendChild(k);
    }
    k.style.opacity = k.style.opacity === "0.01" ? "0.02" : "0.01";
    k.style.background = "#888";
  }, 100);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // Sign in off-camera, then reuse the refresh cookie in the recorded context.
  const login = await browser.newContext();
  const lp = await login.newPage();
  await lp.goto(`${WEB}/en/login`);
  await lp.getByLabel("Email").fill("admin@demo.landshield.test");
  await lp.getByLabel("Password").fill(process.env.DEMO_PASSWORD || "LandShield2026!");
  await lp.getByRole("button", { name: "Sign in", exact: true }).click();
  await lp.waitForURL((u) => !u.pathname.endsWith("/login"));
  const storageState = await login.storageState();
  await login.close();

  const ctx = await browser.newContext({ viewport: SIZE, storageState, recordVideo: { dir: OUT, size: SIZE } });
  await ctx.addInitScript(CAPTION_JS);
  const t0 = Date.now(); // the video starts when the page is created
  const page = await ctx.newPage();
  const cues = [];
  const wait = (s) => page.waitForTimeout(s * 1000);
  const cap = async (text) => {
    const now = Date.now() - t0;
    if (cues.length && cues[cues.length - 1].end == null) cues[cues.length - 1].end = now;
    if (text) cues.push({ start: now, end: null, text });
    await page.evaluate((t) => sessionStorage.setItem("demo-cap", t), text || "").catch(() => {});
  };
  const go = async (url) => {
    // In-app navigation keeps the in-memory session (no "Checking your session" flash); first load uses goto.
    const pushed = await page
      .evaluate((u) => { const r = window.next && window.next.router; if (r && r.push) { r.push(u); return true; } return false; }, url)
      .catch(() => false);
    if (pushed) {
      await page.waitForURL(WEB + url);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(0.4);
    } else {
      await page.goto(WEB + url, { waitUntil: "networkidle" });
    }
    await page.getByText(/Checking your session|সেশন/).first().waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    const last = cues[cues.length - 1];
    if (last && last.end == null) await page.evaluate((t) => sessionStorage.setItem("demo-cap", t), last.text);
  };
  const scroll = async (px, steps = 10) => {
    for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, px / steps); await wait(0.12); }
  };
  const top = () => page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

  async function uploadAndReview(file) {
    await go("/en/officer/upload");
    await page.locator('input[type="file"]').setInputFiles(SAMPLE(file));
    await wait(1.2);
    // every upload names a land office: the samples lie in Gazipur (Dhaka division)
    const box = page.getByTestId("office-sortlist");
    await box.getByLabel("Division").selectOption("Dhaka");
    await box.getByLabel("Zila (District)").selectOption("Gazipur");
    const office = box.getByLabel("Land office");
    await office.locator("option").nth(1).waitFor({ state: "attached" }); // the list has loaded
    await office.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await page.getByTestId("upload-result").waitFor();
    await wait(1);
    await page.getByTestId("start-processing").click();
    await page.getByRole("link", { name: "Open for review" }).click({ timeout: 30000 });
    await page.getByTestId("extraction-panel").waitFor({ timeout: 30000 });
  }
  async function approve() {
    await page.getByTestId("approve-btn").scrollIntoViewIfNeeded();
    await wait(1);
    await page.getByTestId("approve-btn").click();
    await page.getByTestId("decision-banner").waitFor();
  }

  // 0:00 problem
  await go("/en");
  await cap("Bangladesh: ~80% of court cases are land disputes. One plot can be sold twice, and deed and khatian drift apart.");
  await wait(7);
  await scroll(500);
  await cap("LandShield BD: Scan → Verify → Detect → Mutate → Citizen check. All data here is synthetic (demo).");
  await wait(6);

  // 0:15 Doc1 upload → OCR → extraction → confidence
  await cap("An officer uploads a sale deed: Doc1, Rahim sells plot LP-10234 to Karim.");
  await uploadAndReview("Doc1.png");
  await cap("OCR + field extraction: each field gets a confidence score; a human reviews before anything is saved.");
  await wait(4);
  await scroll(450, 14);
  await wait(5);

  // 0:45 approve → mutation fast track
  await cap("Approve: the deed is hashed, Ed25519-signed and added to a hash-chained ledger. e-Mutation starts automatically.");
  await approve();
  await wait(5);
  await go("/en/officer/mutations");
  await page.getByRole("tab", { name: "Under review" }).click();
  await cap("e-Mutation queue: Doc1 passed all six pre-checks → fast track (Under review).");
  await wait(6);

  // 1:00 Doc2 → double sale HIGH + mutation to hearing
  await cap("Doc2: the same seller sells the same plot again, this time to Hasan.");
  await uploadAndReview("Doc2.png");
  await wait(2);
  await approve();
  await wait(1.5);
  await go("/en/verify/result?land_id=LP-10234");
  await page.getByRole("tab").last().click();
  await page.getByRole("tablist").evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" }));
  await cap("Possible double sale → HIGH 70, with the evidence for every indicator. An indicator for review, not a legal finding.");
  await wait(9);
  await go("/en/officer/mutations");
  await page.getByRole("tab", { name: "Hearing" }).click();
  await cap("Doc2's mutation failed the pre-checks, so it goes to a hearing instead of the fast track.");
  await wait(6);

  // 1:30 graph
  await go("/en/verify/graph?land_id=LP-10234");
  await cap("Ownership graph: one seller linked to two buyers of the same plot.");
  await wait(1.5);
  await scroll(260);
  await wait(6);

  // 1:45 Check before you buy (khas land)
  await go("/en/check");
  await cap("Check Before You Buy: a buyer checks plot LP-10900 before paying.");
  await page.getByLabel("District").selectOption("Narayanganj");
  await page.getByLabel("Upazila").selectOption("Rupganj");
  await page.getByLabel("Mouza").pressSequentially("Bhulta", { delay: 60 });
  await page.getByLabel("Khatian No.").pressSequentially("1310", { delay: 60 });
  await page.getByLabel("Dag No.").pressSequentially("910", { delay: 60 });
  await page.getByRole("button", { name: /Run checklist/ }).click();
  await page.getByText(/^Checklist/).first().waitFor();
  await page.getByText(/^Checklist/).first().evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" }));
  await cap("Plain-language checklist: this plot is recorded as khas (government) land → consult the AC Land office.");
  await wait(9);

  // 2:10 verify a copy + ledger tamper
  await go("/en/verify-document");
  await cap("Verify a copy: someone changed the land area on a copy of Doc1.");
  await page.getByTestId("doc-file").setInputFiles(SAMPLE("Doc1_altered.png"));
  await wait(1);
  await page.locator('form button[type="submit"]').click();
  await page.getByTestId("doc-verify-result").waitFor();
  await page.getByTestId("doc-verify-result").evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" }));
  await cap("ALTERED: the copy does not match the signed record (land area).");
  await wait(7);

  await cap("Every approved record is chained with SHA-256 in a ledger.");
  await go("/en/officer/admin");
  await page.getByRole("tab", { name: "Ledger integrity" }).click();
  await wait(2.5);
  execFileSync(PY, [path.join(ROOT, "scripts/tamper_demo.py"), "--land", "LP-10100"], { env: process.env, stdio: "ignore" });
  await cap("Now someone edits the database directly, bypassing the app…");
  await wait(2.5);
  const ledger = page.getByTestId("ledger-card");
  await ledger.getByRole("button").first().click();
  await page.getByTestId("ledger-result").waitFor();
  await cap("…and the hash-chained ledger exposes it: chain BROKEN at the edited entry.");
  await wait(6);
  execFileSync(PY, [path.join(ROOT, "scripts/tamper_demo.py"), "--restore"], { env: process.env, stdio: "ignore" });
  await ledger.getByRole("button").first().click();
  await page.waitForTimeout(800);
  await cap("Original value restored → INTACT.");
  await wait(4);

  // 2:35 Bangla + QR public page
  await go("/bn/verify/result?land_id=LP-10234");
  await cap("Full Bangla interface · সম্পূর্ণ বাংলা ইন্টারফেস");
  await wait(3);
  await page.getByRole("tab").last().click();
  await page.getByRole("tablist").evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" }));
  await wait(4);
  await go("/bn/v/LP-10234");
  await cap("QR public page: a signed summary with no personal data.");
  await wait(6);

  // 2:50 closing
  await go("/en");
  await cap("Land records should be searchable, connected, verifiable and risk-aware. LandShield BD · Team DEEDGUARD");
  await wait(7);
  await cap("");
  await wait(0.5);

  const tEnd = Date.now() - t0;
  const video = page.video();
  await ctx.close();
  await browser.close();

  const webm = path.join(OUT, "LandShield-BD-demo.webm");
  fs.renameSync(await video.path(), webm);
  const ts = (ms) => {
    const z = (n, w = 2) => String(n).padStart(w, "0");
    return `${z(Math.floor(ms / 3600000))}:${z(Math.floor(ms / 60000) % 60)}:${z(Math.floor(ms / 1000) % 60)},${z(ms % 1000, 3)}`;
  };
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", webm]).toString());
  // Video time runs ~2-3 % slower than wall time (measured): scale cue times linearly to the real video length.
  const k = (dur * 1000) / tEnd;
  const v = (ms) => Math.round(ms * k);
  const srt = cues.map((c, i) => `${i + 1}\n${ts(v(c.start))} --> ${ts(v(c.end))}\n${c.text}\n`).join("\n");
  const srtPath = path.join(OUT, "LandShield-BD-demo.en.srt");
  fs.writeFileSync(srtPath, srt);
  const mp4 = path.join(OUT, "LandShield-BD-demo.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-i", srtPath, "-map", "0:v", "-map", "1:s",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "25", "-c:s", "mov_text",
    "-metadata:s:s:0", "language=eng", "-movflags", "+faststart", mp4]);
  fs.unlinkSync(webm);
  console.log(`video ${dur.toFixed(1)} s (subtitle scale ${k.toFixed(4)}) → ${path.relative(ROOT, mp4)}`);
})().catch((e) => { console.error(e); process.exit(1); });
