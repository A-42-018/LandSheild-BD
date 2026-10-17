// U5.3 performance budget. Run after `next build` (`npm run build && npm run check:budget`).
//   - Home page JavaScript < 200 KB gzipped: what a phone on 3G downloads before the page works.
//   - Hero photo files stay small: they are the biggest thing on the first screen.
// Exits 1 when a limit is passed, so it can gate a deploy.
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

const KB = 1024;
export const BUDGET = {
  homeJs: 200 * KB,
  // public/landing: phones get hero-800, wider screens hero-1456 (see .hero-banner in app/globals.css)
  images: { "landing/hero-800.webp": 40 * KB, "landing/hero-1456.webp": 90 * KB },
};
/** Lighthouse "Fast 3G": 1.6 Mbit/s down, 150 ms round trip. */
const FAST_3G_BYTES_PER_S = (1.6 * 1000 * 1000) / 8;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Gzipped size of every script the home page loads, biggest first. */
export function homeScripts(nextDir = join(root, ".next"), page = "/[locale]/page") {
  const manifest = JSON.parse(readFileSync(join(nextDir, "app-build-manifest.json"), "utf8")).pages;
  const files = manifest[page];
  if (!files) throw new Error(`${page} is not in app-build-manifest.json (did \`next build\` run?)`);
  return files
    .filter((f) => f.endsWith(".js"))
    .map((f) => ({ file: f, bytes: gzipSync(readFileSync(join(nextDir, f)), { level: 9 }).length }))
    .sort((a, b) => b.bytes - a.bytes);
}

export function check({ nextDir = join(root, ".next"), publicDir = join(root, "public"), budget = BUDGET } = {}) {
  const scripts = homeScripts(nextDir);
  const js = scripts.reduce((n, s) => n + s.bytes, 0);
  const rows = [{ name: "home page JS (gzip)", bytes: js, limit: budget.homeJs, top: scripts.slice(0, 3) }];
  for (const [name, limit] of Object.entries(budget.images)) {
    const path = join(publicDir, name);
    rows.push({ name, bytes: existsSync(path) ? statSync(path).size : Infinity, limit });
  }
  return { rows, ok: rows.every((r) => r.bytes <= r.limit), seconds3g: js / FAST_3G_BYTES_PER_S };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const kb = (n) => `${(n / KB).toFixed(1)} KB`;
  let result;
  try {
    result = check();
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  for (const r of result.rows) {
    console.log(`${r.bytes <= r.limit ? "ok  " : "OVER"} ${r.name}: ${kb(r.bytes)} of ${kb(r.limit)}`);
    for (const t of r.top ?? []) console.log(`       ${kb(t.bytes).padStart(8)}  ${t.file}`);
  }
  console.log(`home JS on Fast 3G (1.6 Mbit/s): about ${result.seconds3g.toFixed(1)} s to download`);
  process.exit(result.ok ? 0 : 1);
}
