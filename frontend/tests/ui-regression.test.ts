import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// UD9 regression: theme tokens are checked from the REAL app/globals.css (not a copy), so a palette
// edit that breaks contrast, dark parity or the forced-light print palette fails here.
const ROOT = process.cwd();
const css = readFileSync(resolve(ROOT, "app/globals.css"), "utf8");

type Vars = Record<string, [number, number, number]>;

function block(selector: RegExp): string {
  const m = selector.exec(css);
  if (!m) throw new Error(`block not found: ${selector}`);
  let depth = 1;
  let i = m.index + m[0].length;
  const start = i;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

function vars(body: string): Vars {
  const out: Vars = {};
  for (const m of body.matchAll(/--([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

const light = vars(block(/:root\s*\{/));
const dark = vars(block(/:root\.dark\s*\{/));
const print = vars(block(/@media print\s*\{\s*:root,\s*:root\.dark\s*\{/));

function lum([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Same pairs as the contrast table in docs/ui.md.
const PAIRS: [string, string][] = [
  ["ink", "surface"],
  ["ink", "surface-muted"],
  ["ink-muted", "surface"],
  ["ink-muted", "surface-muted"],
  ["primary", "surface"],
  ["primary", "surface-muted"],
  ["primary-fg", "primary"],
  ["primary-fg", "primary-hover"],
  ["primary", "primary-soft"],
  ["link", "surface"],
  ["link", "surface-muted"],
  ["verified", "verified-soft"],
  ["verified", "surface"],
  ["review", "review-soft"],
  ["critical", "critical-soft"],
  ["critical", "surface"],
  ["critical-fg", "critical"],
  ["pending", "pending-soft"],
];

describe("theme tokens (globals.css)", () => {
  it("parses a non-trivial palette for light, dark and print", () => {
    expect(Object.keys(light).length).toBeGreaterThan(20);
    expect(Object.keys(dark).length).toBeGreaterThan(20);
    expect(Object.keys(print).length).toBeGreaterThan(10);
  });

  it("dark overrides every colour variable that light defines", () => {
    const missing = Object.keys(light).filter((k) => !(k in dark));
    expect(missing).toEqual([]);
  });

  it("print re-declares the light palette (print is always light; page background is pure white)", () => {
    for (const [k, v] of Object.entries(print)) {
      if (k === "surface-muted") expect(v).toEqual([255, 255, 255]);
      else expect(light[k], `--${k}`).toEqual(v);
    }
  });

  it.each(PAIRS)("light: %s on %s ≥ 4.5", (fg, bg) => {
    expect(ratio(light[fg], light[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PAIRS)("dark: %s on %s ≥ 4.5", (fg, bg) => {
    expect(ratio(dark[fg], dark[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PAIRS)("print: %s on %s ≥ 4.5", (fg, bg) => {
    if (!(fg in print) || !(bg in print)) return;
    expect(ratio(print[fg], print[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("U1 flat tokens: Formal Green primary, flat header, accent usable on the surface", () => {
    expect(light.primary).toEqual([0, 106, 78]);
    expect(light["primary-hover"]).toEqual([0, 86, 63]);
    expect(light.link).toEqual([15, 61, 122]);
    expect(light.strip).toEqual([14, 31, 54]);
    expect(light.accent).toEqual([176, 132, 20]);
    expect(dark["header-from"]).toEqual([0, 86, 63]);
    for (const set of [light, dark]) {
      expect(set["header-from"]).toEqual(set["header-to"]);
      expect(set["glass-from"]).toEqual(set["glass-to"]);
      expect(set["grad-from"]).toEqual(set["grad-to"]);
      expect(ratio(set.accent, set.surface)).toBeGreaterThanOrEqual(3); // focus accent on page surface (UI >= 3)
      expect(ratio([255, 255, 255], set.strip)).toBeGreaterThanOrEqual(4.5);
    }
    expect(css).not.toMatch(/\.header-glass\s*\{[^}]*backdrop-filter/);
    expect(css).not.toMatch(/\.header-gradient\s*\{[^}]*linear-gradient/);
  });

  it("white header text clears 4.5 on both header ends in both themes", () => {
    const white: [number, number, number] = [255, 255, 255];
    for (const set of [light, dark]) {
      expect(ratio(white, set["header-from"])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(white, set["header-to"])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("print forces a white page and A4", () => {
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*A4/);
    expect(css).toMatch(/@media print[\s\S]*html,\s*body\s*\{[^}]*background:\s*#fff\s*!important/);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe("source hygiene (both themes)", () => {
  const files = ["components", "features", "app"].flatMap((d) => walk(resolve(ROOT, d)));

  it("no solid text-white / text-black outside the always-dark header, strip, footer and map overlay", () => {
    const allowed = /(Navbar|TopStrip|Footer|HeaderNav|HeaderMenu|UserMenu|ThemeToggle|LanguageSwitcher|MapView)\.tsx$/;
    const bad = files.filter((f) => !allowed.test(f)).filter((f) => /\btext-(white|black)\b(?!\/)/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("no hard-coded hex colours in JSX components (map/graph data modules excluded)", () => {
    const bad = files
      .filter((f) => f.endsWith(".tsx"))
      // MapCanvas: map data colours. Illustrations: fixed-palette landing artwork, identical in both themes on purpose.
      .filter((f) => !/(MapCanvas|landing\/Illustrations)\.tsx$/.test(f))
      .filter((f) => /["'`]#[0-9a-fA-F]{3,8}["'`]/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("tailwind uses the class dark-mode strategy and the theme script is external", () => {
    expect(readFileSync(resolve(ROOT, "tailwind.config.ts"), "utf8")).toMatch(/darkMode:\s*"class"/);
    expect(readFileSync(resolve(ROOT, "public/theme-init.js"), "utf8")).toContain("ls-theme");
  });
});
