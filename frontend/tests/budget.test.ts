import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { BUDGET, check, homeScripts } from "../scripts/check-budget.mjs";
// @ts-expect-error plain .mjs config
import nextConfig from "../next.config.mjs";

/** A fake .next + public folder: the home page loads one script of `jsBytes` bytes (plus a stylesheet, which must not count). */
function fixture(jsBytes: number, heroBytes = 1000) {
  const dir = mkdtempSync(join(tmpdir(), "budget-"));
  const next = join(dir, ".next");
  const pub = join(dir, "public");
  mkdirSync(join(next, "static", "chunks"), { recursive: true });
  mkdirSync(join(pub, "landing"), { recursive: true });
  // varied bytes, so gzip cannot shrink them to nothing
  const noise = (n: number) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 2654435761) % 251));
  writeFileSync(join(next, "static", "chunks", "a.js"), noise(jsBytes));
  writeFileSync(join(next, "app-build-manifest.json"), JSON.stringify({ pages: { "/[locale]/page": ["static/chunks/a.js", "static/css/x.css"] } }));
  for (const name of Object.keys(BUDGET.images)) writeFileSync(join(pub, name), Buffer.alloc(heroBytes));
  return { nextDir: next, publicDir: pub };
}

describe("performance budget (U5.3)", () => {
  it("sets the roadmap limit: home JavaScript under 200 KB", () => {
    expect(BUDGET.homeJs).toBe(200 * 1024);
  });

  it("passes a small home page and counts only scripts", () => {
    const f = fixture(5000);
    expect(homeScripts(f.nextDir)).toHaveLength(1);
    const r = check(f);
    expect(r.ok).toBe(true);
    expect(r.rows[0].bytes).toBeLessThan(BUDGET.homeJs);
  });

  it("fails when the home scripts pass the limit", () => {
    const r = check({ ...fixture(5000), budget: { ...BUDGET, homeJs: 100 } });
    expect(r.ok).toBe(false);
    expect(r.rows[0].bytes).toBeGreaterThan(100);
  });

  it("fails when a hero photo grows, or goes missing", () => {
    expect(check(fixture(5000, 200 * 1024)).ok).toBe(false);
    const f = fixture(5000);
    expect(check({ ...f, publicDir: join(f.publicDir, "nowhere") }).ok).toBe(false);
  });

  it("reports a build that has not run, not a pass", () => {
    expect(() => homeScripts(join(tmpdir(), "no-such-next-dir"))).toThrow();
  });

  it("caches the public images, icons and guide media for a day, and the worker never", async () => {
    const rules: { source: string; headers: { key: string; value: string }[] }[] = await nextConfig.headers();
    const cache = (src: string) => rules.filter((r) => r.source === src).flatMap((r) => r.headers).find((h) => h.key === "Cache-Control")?.value;
    for (const dir of ["landing", "guide", "icons", "brand"]) expect(cache(`/${dir}/:path*`)).toMatch(/max-age=86400/);
    expect(cache("/sw.js")).toMatch(/no-cache/);
  });
});
