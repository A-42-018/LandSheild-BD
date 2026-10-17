import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, signIn } from "./fixtures";

/** U6 (Phase 6, Validate): the five usability tasks of docs/ui-ux-roadmap.md §7 driven as a Bangla-first, phone-sized,
 *  anonymous visitor. It does not replace sessions with real people (docs/usability.md). It records the shortest path
 *  per task (actions, seconds), screenshots for the mentor, and the automatable lines of the §8 checklist.
 *  Run: USABILITY=1 npm run e2e -- validate.spec.ts   → docs/usability/after/ */
test.skip(!process.env.USABILITY, "set USABILITY=1 to run the U6 validation pass");

const OUT = path.resolve(__dirname, "../../docs/usability/after");
const bn = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../messages/bn.json"), "utf8"));
const SAMPLE = (name: string) => path.resolve(__dirname, "../../database/sample_data", name);
const TARGET_MIN = 48;
/** Label text starts the accessible name ("জেলা *"); a bare substring would also hit "উপজেলা". */
const lbl = (s: string) => new RegExp(`^${s}(\\s|\\*|$)`);

type Row = { task: string; ok: boolean; actions: number; seconds: number; note: string };
const rows: Row[] = [];
/** `known`: a finding with a fix already on an unmerged branch; it is reported but does not fail the run. */
const checks: { id: string; ok: boolean; detail: string; known?: string }[] = [];

test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
test.describe.configure({ mode: "serial" });
test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
test.afterAll(() => {
  fs.writeFileSync(path.join(OUT, "automated.json"), JSON.stringify({ date: new Date().toISOString(), viewport: "360x800", locale: "bn", tasks: rows, checks }, null, 2));
});

/** Counts the user's actions (taps, typed fields, picked options) so the table reports the shortest path. */
function recorder(page: Page, task: string) {
  const t0 = Date.now();
  let actions = 0;
  return {
    act: () => void actions++,
    shot: (name: string) => page.screenshot({ path: path.join(OUT, `${task}-${name}.png`) }),
    done: (ok: boolean, note = "") => rows.push({ task, ok, actions, seconds: Math.round((Date.now() - t0) / 100) / 10, note }),
  };
}

/** Latin digits are allowed only inside codes the user must type exactly (roadmap §5); everything else is a finding. */
const CODE = /\b(?:LP|MUT|FB)-[\dA-Z-]+|CC BY 4\.0|\+?880\d+|https?:\/\/\S+|\S+@\S+/g;
async function latinDigits(page: Page): Promise<string[]> {
  const text = await page.locator("body").innerText();
  return text.split("\n").map((l) => l.replace(CODE, "")).filter((l) => /[0-9]/.test(l));
}

test("T1 public search: who owns this khatian, any case on it? (no login)", async ({ page }) => {
  const r = recorder(page, "t1-search");
  await page.goto("/bn", { waitUntil: "networkidle" });
  const form = page.getByRole("form", { name: bn.verify.title });
  await form.getByLabel(lbl(bn.verify.district)).selectOption("Dhaka"); r.act();
  await form.getByLabel(lbl(bn.verify.upazila)).selectOption("Savar"); r.act();
  await form.getByLabel(lbl(bn.verify.mouza)).fill("Ashulia"); r.act();
  await form.getByLabel(lbl(bn.verify.khatian)).fill("501"); r.act();
  await form.getByLabel(lbl(bn.verify.dag)).fill("101"); r.act();
  await form.getByRole("button", { name: bn.verify.submit }).click(); r.act();
  const summary = page.getByTestId("public-summary");
  await expect(summary).toBeVisible();
  await r.shot("summary");
  await expect(summary.getByTestId("summary-login")).toBeVisible(); // full report asks for sign-in
  const text = await summary.innerText();
  const masked = !/\b\d{10,17}\b/.test(text); // no NID-length numbers
  expect(masked, "summary must not show an NID").toBe(true);
  await expectNoHorizontalScroll(page);
  r.done(true, "summary + sign-in prompt for the full report");
});

test("T2 track: which step is my mutation application at?", async ({ page }) => {
  const r = recorder(page, "t2-track");
  await page.goto("/bn", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: bn.home.search.tabs.track }).click(); r.act();
  await page.getByLabel(bn.track.number).fill("MUT-2023-0007"); r.act();
  await page.getByRole("button", { name: bn.track.submit }).click(); r.act();
  await expect(page.getByTestId("track-result")).toBeVisible();
  await expect(page.getByTestId("track-steps")).toBeVisible();
  await r.shot("status");
  await expectNoHorizontalScroll(page);
  r.done(true, "plain status sentence + stepper");
});

test("T3 units: how many katha is 10 decimal?", async ({ page }) => {
  const r = recorder(page, "t3-units");
  await page.goto("/bn/tools", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: bn.tools.units.title }).first().click(); r.act();
  await page.getByLabel(bn.tools.units.value).fill("10"); r.act(); // default unit is decimal (শতাংশ)
  const row = page.getByTestId("unit-table").getByRole("row", { name: new RegExp(bn.tools.units.names.katha) });
  await expect(row).toBeVisible();
  await r.shot("table");
  await expectNoHorizontalScroll(page);
  r.done(true, `row "${(await row.innerText()).replace(/\s+/g, " ")}"`);
});

test("T4 QR: is this deed's QR code genuine?", async ({ page }) => {
  const r = recorder(page, "t4-qr");
  await page.goto("/bn", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: bn.home.search.tabs.doc }).click(); r.act();
  await page.getByLabel(bn.home.search.qrLabel).fill("LP-10240"); r.act();
  await page.getByRole("button", { name: bn.home.search.qrSubmit }).click(); r.act();
  await expect(page).toHaveURL(/\/bn\/v\/LP-10240/);
  await expect(page.getByTestId("public-summary")).toBeVisible();
  await r.shot("verdict");
  await expect(page.getByTestId("public-risk")).toBeVisible();
  await expectNoHorizontalScroll(page);
  r.done(true, "public QR page: risk word + seal state, no login");
});

test("T5 reviewer: approve one document, reject one with a reason", async ({ page }) => {
  const r = recorder(page, "t5-review");
  /** Setup (not timed): an officer uploads and processes a sample; the reviewer then takes it from /officer/review/{id}. */
  const upload = async (file: string) => {
    await page.goto("/en/officer/upload");
    await page.locator('input[type="file"]').setInputFiles(SAMPLE(file));
    const up = page.waitForResponse((x) => x.url().endsWith("/documents/upload") && x.request().method() === "POST");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    const id = (await (await up).json()).id as string;
    await page.getByTestId("start-processing").click();
    await page.getByRole("link", { name: "Open for review" }).click();
    await expect(page.getByTestId("extraction-panel")).toBeVisible({ timeout: 30_000 });
    return id;
  };
  await signIn(page, "officer");
  const [good, bad] = [await upload("Doc1.png"), await upload("Doc2.png")];
  await signIn(page, "reviewer");

  const t0 = Date.now();
  await page.goto(`/bn/officer/review/${good}`);
  await expect(page.getByTestId("extraction-panel")).toBeVisible({ timeout: 30_000 });
  await r.shot("review-screen");
  await page.getByTestId("approve-btn").click(); r.act();
  await expect(page.getByTestId("decision-banner")).toBeVisible();

  await page.goto(`/bn/officer/review/${bad}`);
  await expect(page.getByTestId("extraction-panel")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("reject-btn").click(); r.act();
  await page.getByLabel(bn.review.reject.reasonLabel).fill("Seller name does not match the khatian."); r.act();
  await r.shot("reject-dialog");
  await page.getByTestId("reject-confirm").click(); r.act();
  await expect(page.getByTestId("decision-banner")).toBeVisible();
  await expectNoHorizontalScroll(page);
  r.done(true, `two decisions in ${Math.round((Date.now() - t0) / 1000)} s incl. page loads`);
});

test("§8 checklist: automatable lines on the public Bangla pages", async ({ page }) => {
  const pages = ["", "/verify", "/track", "/tools", "/tools/units", "/verify-document", "/guide", "/faq", "/services", "/login", "/signup", "/map"];
  const latin: string[] = [];
  const latinMap: string[] = [];
  const small: string[] = [];
  const wide: string[] = [];
  for (const p of pages) {
    await page.goto(`/bn${p}`, { waitUntil: "networkidle" });
    if (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth > 1)) wide.push(p || "/");
    (p === "/map" ? latinMap : latin).push(...(await latinDigits(page)).map((l) => `${p || "/"}: ${l.trim().slice(0, 80)}`));
    const tiny = await page.evaluate((min) => {
      const vis = (el: Element) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      return [...document.querySelectorAll<HTMLElement>("button, a[href], input:not([type=hidden]), select, [role=tab]")]
        .filter((el) => vis(el) && !el.closest(".sr-only, [aria-hidden=true]") && !/skip|main/i.test(el.getAttribute("href") ?? ""))
        .filter((el) => el.getBoundingClientRect().height < min - 0.5 && getComputedStyle(el).display !== "inline")
        .map((el) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`);
    }, TARGET_MIN);
    small.push(...tiny.map((s) => `${p || "/"}: ${s}`));
  }
  checks.push({ id: "360px-no-horizontal-scroll", ok: wide.length === 0, detail: wide.join(", ") || `${pages.length} pages fit` });
  checks.push({ id: "bn-no-latin-digits (runtime)", ok: latin.length === 0, detail: latin.slice(0, 25).join(" | ") || "none outside codes" });
  checks.push({ id: "bn-no-latin-digits (map scale bar)", ok: latinMap.length === 0, detail: latinMap.join(" | ") || "none", known: "fixed on u4.2-map-bn-digits / u4.3-map-readout-bn-digits, not merged into this base" });
  checks.push({ id: "touch-targets-48px", ok: small.length === 0, detail: small.slice(0, 25).join(" | ") || "none under 48 px" });

  // §8 line 1: a visitor reaches search, track and QR from the homepage without logging in (T1, T2, T4 passed when serial run is green)
  checks.push({ id: "public-flows-no-login", ok: rows.filter((x) => /^t[124]/.test(x.task)).every((x) => x.ok), detail: "T1, T2, T4 ran anonymously" });
  const text = await (async () => { await page.goto("/bn/track"); return page.locator("body").innerText(); })();
  checks.push({ id: "demo-disclaimer-on-track", ok: text.includes(bn.track.demoNote), detail: bn.track.demoNote });

  const failed = checks.filter((c) => !c.ok && !c.known);
  expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
});
