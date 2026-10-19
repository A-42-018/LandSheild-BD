/**
 * U4.1: pictures and videos for /guide. Run through scripts/guide_media.sh (it starts the servers this expects).
 *
 * Every guide is a short flow of three steps. The same flow makes
 *   - one phone screenshot per step, in Bangla and in English, with the thing to press outlined in gold
 *     → frontend/public/guide/{bn,en}/<id>-s<n>.webp
 *   - one video on the Bangla screens with a Bangla voice-over (macOS voice "Piya") and captions in both languages
 *     → frontend/public/guide/video/<id>.mp4, <id>.webp (poster), <id>.bn.vtt, <id>.en.vtt
 *   - the video lengths → frontend/features/guide/media.json
 * The words come from messages `guide.items.<id>`: what the page says is what the voice says.
 *
 *   WEB=http://localhost:3051 API=http://localhost:8011/api/v1 node scripts/record_guides.cjs [guide ids…]
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const FRONT = path.join(ROOT, "frontend");
const { chromium, request: http } = require(path.join(FRONT, "node_modules/playwright"));
const MSG = { bn: require(path.join(FRONT, "messages/bn.json")), en: require(path.join(FRONT, "messages/en.json")) };
const OUT = path.join(FRONT, "public/guide");
const MEDIA_JSON = path.join(FRONT, "features/guide/media.json");
const SAMPLE = (f) => path.join(ROOT, "database/sample_data", f);
const WEB = process.env.WEB || "http://localhost:3051";
const API = process.env.API || "http://localhost:8011/api/v1";
const PASSWORD = process.env.DEMO_PASSWORD || "LandShield2026!";
const VIEW = { width: 390, height: 700 }; // keep in sync with SHOT in features/guide/guides.ts
const VOICE = "Piya";
const STEPS = ["s1", "s2", "s3"];

/** Outline for "press here": gold ring, plus no floating help button over the picture. */
const STYLE = `
  .guide-hl { outline: 4px solid #d4a017 !important; outline-offset: 3px !important; border-radius: 12px;
              box-shadow: 0 0 0 10px rgb(212 160 23 / 0.25) !important; }
  [data-testid="help-button"] { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }`;

/** Playwright writes a video frame only on repaint; a 1 px tick keeps video time equal to wall time (captions stay in sync). */
const TICK = () => {
  setInterval(() => {
    let k = document.getElementById("guide-tick");
    if (!k) {
      k = document.createElement("div");
      k.id = "guide-tick";
      k.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;z-index:2147483647;pointer-events:none;background:#888";
      document.documentElement.appendChild(k);
    }
    k.style.opacity = k.style.opacity === "0.01" ? "0.02" : "0.01";
  }, 100);
};

// ---------------------------------------------------------------- flows
/** Form field by its visible label; required fields add a marker after the text, and "জেলা" is inside "উপজেলা". */
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const field = (scope, label) => scope.getByLabel(new RegExp(`^\\s*${esc(label)}(\\s|\\*|$)`));
// Each step: act(page, ctx) does what the step says and returns the elements to outline.
// ctx.type(locator, text) types slowly in a video and fills instantly for a screenshot. ctx.m = messages of the locale.

const land = { district: "Dhaka", upazila: "Savar", mouza: "Ashulia", khatian: "501", dag: "101" };
const khas = { district: "Narayanganj", upazila: "Rupganj", mouza: "Bhulta", khatian: "1310", dag: "910" };

async function fillArea(page, ctx, l, ns) {
  const v = ctx.m.verify;
  await field(page, v.district).selectOption(l.district);
  await ctx.pause(0.5);
  await field(page, v.upazila).selectOption(l.upazila);
  await ctx.pause(0.5);
  const mouza = field(page, v.mouza);
  await ctx.type(mouza, l.mouza);
  await mouza.press("Escape").catch(() => {});
  await page.locator("body").click({ position: { x: 2, y: 200 } }).catch(() => {}); // close the suggestions
  return [field(page, v.district), field(page, v.upazila), mouza];
}

const FLOWS = {
  verify: {
    start: "/verify",
    steps: [
      async (page, ctx) => fillArea(page, ctx, land),
      async (page, ctx) => {
        const v = ctx.m.verify;
        await ctx.type(field(page, v.khatian), ctx.num(land.khatian));
        await ctx.type(field(page, v.dag), ctx.num(land.dag));
        return [field(page, v.khatian), field(page, v.dag), page.getByRole("button", { name: v.submit })];
      },
      async (page, ctx) => {
        await page.getByRole("button", { name: ctx.m.verify.submit }).click();
        const card = page.getByTestId("public-summary");
        await card.waitFor();
        return [card];
      },
    ],
  },
  check: {
    start: "/login",
    steps: [
      async (page, ctx) => {
        const a = ctx.m.auth;
        return [field(page, a.email), field(page, a.password)];
      },
      async (page, ctx) => {
        const a = ctx.m.auth;
        await ctx.type(field(page, a.email), "citizen@demo.landshield.test");
        await ctx.type(field(page, a.password), PASSWORD);
        await page.getByRole("button", { name: a.submit, exact: true }).click();
        await page.waitForURL((u) => !u.pathname.endsWith("/login"));
        await ctx.go("/check");
        await fillArea(page, ctx, khas);
        await ctx.type(field(page, ctx.m.verify.khatian), ctx.num(khas.khatian));
        await ctx.type(field(page, ctx.m.verify.dag), ctx.num(khas.dag));
        const btn = page.getByRole("button", { name: ctx.m.check.submit });
        return [btn];
      },
      async (page, ctx) => {
        await page.getByRole("button", { name: ctx.m.check.submit }).click();
        const row = page.locator('[data-testid^="check-row-"][data-status="FAIL"]').first();
        await page.getByTestId("check-result").waitFor();
        return [row];
      },
    ],
  },
  track: {
    start: "/",
    steps: [
      async (page, ctx) => {
        const tab = page.getByRole("tab", { name: ctx.m.home.search.tabs.track });
        await tab.click();
        return [tab];
      },
      async (page, ctx) => {
        const box = field(page, ctx.m.track.number);
        await ctx.type(box, ctx.num("MUT-2023-0007"));
        return [box, page.getByTestId("hero-search").getByRole("button", { name: ctx.m.track.submit })];
      },
      async (page, ctx) => {
        await page.getByTestId("hero-search").getByRole("button", { name: ctx.m.track.submit }).click();
        await page.waitForURL(/\/track/);
        const steps = page.getByTestId("track-steps");
        await steps.waitFor();
        return [steps];
      },
    ],
  },
  verifyDoc: {
    start: "/verify-document",
    setup: recordDoc1,
    steps: [
      async (page) => [page.getByTestId("doc-file")],
      async (page, ctx) => {
        await page.getByTestId("doc-file").setInputFiles(SAMPLE("Doc1_altered.png"));
        await ctx.pause(0.6);
        return [page.getByTestId("doc-file-chip"), page.getByRole("button", { name: ctx.m.verifyDoc.submit })];
      },
      async (page, ctx) => {
        await page.getByRole("button", { name: ctx.m.verifyDoc.submit }).click();
        const res = page.getByTestId("doc-verify-result");
        await res.waitFor({ timeout: 60_000 });
        return [res];
      },
    ],
  },
  map: {
    start: "/map",
    steps: [
      async (page) => {
        const map = page.getByTestId("map-canvas");
        await map.waitFor();
        await page.waitForTimeout(1500); // tiles
        return [map];
      },
      async (page, ctx) => {
        const g = ctx.m.map.gis;
        await page.getByRole("button", { name: g.showMenu }).click();
        const panel = page.locator("#gis-menu-panel");
        const pick = async (label, text) => {
          const sel = field(panel, label);
          await sel.scrollIntoViewIfNeeded();
          const value = await sel.locator("option").evaluateAll((o, t) => o.find((x) => x.textContent.includes(t))?.value, text);
          await sel.selectOption(value);
          await ctx.pause(0.8);
          return sel;
        };
        const picked = [await pick(g.division, "Dhaka"), await pick(g.district, "Dhaka"), await pick(g.upazila, "Savar")];
        await page.waitForTimeout(1500); // fly to the upazila
        return picked;
      },
      async (page, ctx) => {
        await page.getByRole("button", { name: ctx.m.map.gis.hideMenu }).click();
        const show = page.getByRole("button", { name: ctx.m.map.showOnMapFor.replace("{landId}", "LP-10001") });
        await show.scrollIntoViewIfNeeded();
        await ctx.pause(1);
        await show.click();
        const popup = page.locator(".leaflet-popup");
        await popup.waitFor();
        await page.waitForTimeout(1200); // fly to the plot
        return [popup];
      },
    ],
  },
  tools: {
    start: "/tools",
    steps: [
      async (page) => [page.getByTestId("tool-tile")],
      async (page, ctx) => {
        const u = ctx.m.tools.units;
        await page.getByTestId("tool-tile").first().click();
        await page.waitForURL(/\/tools\/units/);
        const value = field(page, u.value);
        await value.fill("");
        await ctx.type(value, ctx.num("10"));
        const from = field(page, u.from);
        await from.selectOption("decimal");
        return [value, from];
      },
      async (page) => {
        const table = page.getByTestId("unit-table");
        return [table.locator("tr").filter({ hasText: /কাঠা|Katha|katha/ }).first()];
      },
    ],
  },
};

// ---------------------------------------------------------------- helpers

/** The deed-copy guide needs a recorded deed to compare with: an officer uploads Doc1 and a reviewer approves it (off camera).
 *  Safe to repeat: a second upload returns the same document, and an approved one is left alone. */
async function recordDoc1() {
  const api = await http.newContext();
  const token = async (role) => {
    const r = await api.post(`${API}/auth/login`, { data: { email: `${role}@demo.landshield.test`, password: PASSWORD } });
    if (!r.ok()) throw new Error(`sign-in as ${role}: ${r.status()}`);
    return { Authorization: `Bearer ${(await r.json()).access_token}` };
  };
  const officer = await token("officer");
  // every upload names a land office; Doc1 lies in Gazipur, so file it under a Gazipur district office
  const offices = await (await api.get(`${API}/offices?division=Dhaka&district=Gazipur`)).json();
  const up = await api.post(`${API}/documents/upload`, {
    headers: officer,
    multipart: {
      file: { name: "Doc1.png", mimeType: "image/png", buffer: fs.readFileSync(SAMPLE("Doc1.png")) },
      office_id: offices.items[0].id,
    },
  });
  const { id } = await up.json();
  const status = async () => (await (await api.get(`${API}/documents/${id}`, { headers: officer })).json()).processing_status;
  if ((await status()) === "UPLOADED") await api.post(`${API}/documents/${id}/process`, { headers: officer });
  for (let i = 0; i < 60 && (await status()) === "PROCESSING"; i++) await hold(0.5);
  if ((await status()) !== "APPROVED") {
    const r = await api.post(`${API}/documents/${id}/approve`, { headers: await token("reviewer") });
    if (!r.ok()) throw new Error(`approve Doc1: ${r.status()} ${await r.text()}`);
  }
  await api.dispose();
}

function hold(seconds) {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

async function outline(page, targets) {
  const handles = [];
  for (const t of targets) for (const h of await t.elementHandles()) handles.push(h);
  await page.evaluate((els) => {
    document.querySelectorAll(".guide-hl").forEach((e) => e.classList.remove("guide-hl"));
    els.forEach((e) => e.classList.add("guide-hl"));
    if (!els.length) return;
    const rects = els.map((e) => e.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top)) + window.scrollY;
    const bottom = Math.max(...rects.map((r) => r.bottom)) + window.scrollY;
    const room = window.innerHeight;
    const y = bottom - top > room - 140 ? top - 90 : (top + bottom) / 2 - room / 2 + 20;
    window.scrollTo({ top: Math.max(0, y), behavior: "instant" });
  }, handles);
  await page.waitForTimeout(250);
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

function newCtx(page, locale, flow, video) {
  const prefix = `/${locale}`;
  return {
    locale,
    /** Numbers as a citizen would type them on this page: Bangla digits on Bangla pages (the forms accept both). */
    num: (text) => (locale === "bn" ? text.replace(/[0-9]/g, (d) => BN_DIGITS[d]) : text),
    m: MSG[locale],
    flow,
    pause: (s) => (video ? page.waitForTimeout(s * 1000) : Promise.resolve()),
    type: async (loc, text) => {
      await loc.scrollIntoViewIfNeeded();
      if (video) {
        await loc.click();
        await loc.pressSequentially(text, { delay: 110 });
      } else await loc.fill(text);
    },
    go: async (p) => {
      await page.goto(WEB + prefix + (p === "/" ? "" : p), { waitUntil: "networkidle" });
      await page.addStyleTag({ content: STYLE });
    },
  };
}

async function newPage(browser, locale, video) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: locale === "bn" ? "bn-BD" : "en-US",
    colorScheme: "light",
    reducedMotion: "reduce", // no ticker scroll or reveal fades in the pictures
  });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("ls-theme", "light"); } catch {}
  });
  if (video) await ctx.addInitScript(TICK);
  const page = await ctx.newPage();
  page.on("load", () => page.addStyleTag({ content: STYLE }).catch(() => {}));
  return { ctx, page };
}

// ---------------------------------------------------------------- pictures

async function shoot(browser, id, locale) {
  const flow = FLOWS[id];
  const { ctx, page } = await newPage(browser, locale, null);
  const c = newCtx(page, locale, flow, false);
  await c.go(flow.start);
  fs.mkdirSync(path.join(OUT, locale), { recursive: true });
  for (let i = 0; i < flow.steps.length; i++) {
    const targets = await flow.steps[i](page, c);
    await page.waitForLoadState("networkidle").catch(() => {});
    await outline(page, targets);
    const png = path.join(os.tmpdir(), `guide-${id}-${locale}-${i}.png`);
    await page.screenshot({ path: png });
    execFileSync("cwebp", ["-quiet", "-q", "72", "-m", "6", png, "-o", path.join(OUT, locale, `${id}-${STEPS[i]}.webp`)]);
    fs.rmSync(png);
    await outline(page, []);
  }
  await ctx.close();
}

// ---------------------------------------------------------------- video

/** Frames straight from Chrome's screencast, each with its time. (Playwright 1.48's recordVideo crashes with current Chrome.) */
async function capture(page, dir) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp * 1000 });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: VIEW.width * 2, maxHeight: VIEW.height * 2 });
  return { frames, stop: () => cdp.send("Page.stopScreencast").catch(() => {}) };
}

/** ffmpeg concat list: every frame shown until the next one, from `from` to `to` (epoch ms). */
function frameList(frames, from, to, file) {
  const first = Math.max(0, frames.findIndex((f) => f.t > from) - 1);
  const used = frames.slice(first).filter((f) => f.t < to);
  const out = ["ffconcat version 1.0"];
  used.forEach((f, i) => {
    const start = Math.max(f.t, from);
    const end = i + 1 < used.length ? used[i + 1].t : to;
    out.push(`file '${f.file}'`, `duration ${((end - start) / 1000).toFixed(3)}`);
  });
  out.push(`file '${used[used.length - 1].file}'`);
  fs.writeFileSync(file, out.join("\n") + "\n");
}

function lines(id, locale) {
  const g = MSG[locale].guide;
  const it = g.items[id];
  return [
    `${it.title}। ${it.intro}`.replace(/। /g, locale === "bn" ? "। " : ". ").replace(/\.\. /g, ". "),
    ...STEPS.map((s, i) => {
      const n = locale === "bn" ? "১২৩"[i] : String(i + 1);
      const sep = locale === "bn" ? "। " : ". ";
      return `${g.step.replace("{n}", n)}${sep}${it.steps[s].title}${sep}${it.steps[s].body}`;
    }),
  ];
}

function speak(text, file) {
  // say reads "‘…’" quotes aloud oddly, and needs no punctuation help
  execFileSync("say", ["-v", VOICE, "-r", "170", "-o", file, text.replace(/[‘’"]/g, "")]);
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
}

const stamp = (ms) => {
  const t = Math.max(0, Math.round(ms));
  const h = String(Math.floor(t / 3600000)).padStart(2, "0");
  const m = String(Math.floor((t % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((t % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}.${String(t % 1000).padStart(3, "0")}`;
};

/** One cue per sentence, each lasting its share of the spoken line (by length). */
function vtt(cues, texts) {
  const out = ["WEBVTT", ""];
  let n = 1;
  cues.forEach((c, i) => {
    const parts = texts[i].split(/(?<=[।.?!])\s+/).filter(Boolean);
    const total = parts.reduce((a, p) => a + p.length, 0);
    let at = c.start;
    for (const p of parts) {
      const len = ((c.end - c.start) * p.length) / total;
      out.push(String(n++), `${stamp(at)} --> ${stamp(at + len)}`, p, "");
      at += len;
    }
  });
  return out.join("\n");
}

async function record(browser, id) {
  const flow = FLOWS[id];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `guide-${id}-`));
  const bnLines = lines(id, "bn");
  const enLines = lines(id, "en");
  const audio = bnLines.map((t, i) => {
    const f = path.join(tmp, `line${i}.aiff`);
    return { file: f, seconds: speak(t, f) };
  });

  const { ctx, page } = await newPage(browser, "bn", true);
  const c = newCtx(page, "bn", flow, true);
  const shots = path.join(tmp, "frames");
  fs.mkdirSync(shots);
  const cap = await capture(page, shots);
  await c.go(flow.start);
  await page.waitForTimeout(600);
  const cues = [];
  const say = async (i, act) => {
    const start = Date.now();
    const targets = act ? await act(page, c) : [];
    await page.waitForLoadState("networkidle").catch(() => {});
    await outline(page, targets);
    const end = start + audio[i].seconds * 1000;
    const left = end + 700 - Date.now();
    if (left > 0) await hold(left / 1000);
    cues.push({ start, end });
    await outline(page, []);
  };
  await say(0, null);
  for (let i = 0; i < flow.steps.length; i++) await say(i + 1, flow.steps[i]);
  await hold(0.8);
  const stopAt = Date.now();
  await cap.stop();
  await ctx.close();

  // start just before the intro line (the page has loaded by then)
  const from = cues[0].start - 300;
  const shifted = cues.map((q) => ({ start: q.start - from, end: q.end - from }));
  const list = path.join(tmp, "frames.txt");
  frameList(cap.frames, from, stopAt, list);
  const vid = path.join(OUT, "video");
  fs.mkdirSync(vid, { recursive: true });
  const args = ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list];
  audio.forEach((a) => args.push("-i", a.file));
  const mix = audio.map((_, i) => `[${i + 1}:a]adelay=${Math.round(shifted[i].start)}:all=1[a${i}]`).join(";");
  args.push(
    "-filter_complex", `${mix};${audio.map((_, i) => `[a${i}]`).join("")}amix=inputs=${audio.length}:normalize=0[aout]`,
    "-map", "0:v", "-map", "[aout]",
    "-t", ((stopAt - from) / 1000).toFixed(3),
    "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-pix_fmt", "yuv420p", "-r", "25",
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart",
    path.join(vid, `${id}.mp4`),
  );
  execFileSync("ffmpeg", args);
  const poster = path.join(tmp, "poster.png");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "1", "-i", path.join(vid, `${id}.mp4`), "-frames:v", "1", poster]);
  execFileSync("cwebp", ["-quiet", "-q", "70", poster, "-o", path.join(vid, `${id}.webp`)]);
  fs.writeFileSync(path.join(vid, `${id}.bn.vtt`), vtt(shifted, bnLines));
  fs.writeFileSync(path.join(vid, `${id}.en.vtt`), vtt(shifted, enLines));
  fs.rmSync(tmp, { recursive: true, force: true });
  return Math.round((stopAt - from) / 1000);
}

// ---------------------------------------------------------------- main

(async () => {
  const only = process.argv.slice(2);
  const ids = Object.keys(FLOWS).filter((id) => !only.length || only.includes(id));
  const media = fs.existsSync(MEDIA_JSON) ? JSON.parse(fs.readFileSync(MEDIA_JSON, "utf8")) : {};
  // one browser per language, so the browser's own controls (the file picker button) speak it too
  const launch = (lang) => chromium.launch({ channel: process.env.GUIDE_BROWSER_CHANNEL || "chrome", args: [`--lang=${lang}`] });
  const browsers = { bn: await launch("bn"), en: await launch("en-US") };
  try {
    for (const id of ids) {
      if (FLOWS[id].setup) await FLOWS[id].setup();
      for (const locale of ["bn", "en"]) {
        process.stdout.write(`${id} ${locale} pictures… `);
        await shoot(browsers[locale], id, locale);
        console.log("ok");
      }
      process.stdout.write(`${id} video… `);
      media[id] = { seconds: await record(browsers.bn, id) };
      console.log(`${media[id].seconds} s`);
    }
  } finally {
    await Promise.all(Object.values(browsers).map((b) => b.close()));
  }
  const sorted = Object.fromEntries(Object.keys(FLOWS).filter((k) => media[k]).map((k) => [k, media[k]]));
  fs.writeFileSync(MEDIA_JSON, JSON.stringify(sorted, null, 2) + "\n");
  process.exit(0); // a Playwright handle can keep Node alive after everything is closed
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
