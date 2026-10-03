// P53: flag user-visible literal text in JSX (text nodes + common text attributes).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = /(node_modules|\.next|tests?|\.test\.)/;
const ATTRS = ["aria-label", "title", "placeholder", "alt", "label"];
// strings that are allowed to be literal (brand, units, symbols)
const ALLOW = new Set([
  "LandShield BD", "EN", "BN", "LandShield",
  "ifahimreza/bangladesh-geojson", // third-party data source name (proper noun)
  "LP-10100", // example land ID format, not prose
]);

const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    if (SKIP.test(p)) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(p) ? [p] : [];
  });

const hits = [];
for (const dir of ["app", "components", "features"]) {
  for (const file of walk(join(root, dir))) {
    const src = readFileSync(file, "utf8");
    // JSX text nodes: >text< containing a letter, not an expression
    for (const m of src.matchAll(/>\s*([^<>{}\n]*[A-Za-z\u0980-\u09FF][^<>{}\n]*)\s*</g)) {
      const t = m[1].trim();
      if (!t || ALLOW.has(t) || /^[\w.-]+$/.test(t) && /[=;()]/.test(t)) continue;
      if (/^(Promise|api\.\w+)$/.test(t)) continue; // TS generics, not JSX text
      if (/=>|&&|\|\||\?|:\s*$|^\/\/|^import |^return /.test(t)) continue;
      hits.push([file, "text", t]);
    }
    for (const a of ATTRS) {
      for (const m of src.matchAll(new RegExp(`\\s${a}="([^"{}]+)"`, "g"))) {
        if (!ALLOW.has(m[1]) && /[A-Za-z\u0980-\u09FF]/.test(m[1])) hits.push([file, a, m[1]]);
      }
    }
  }
}
for (const [f, k, t] of hits) console.error(`${relative(root, f)} [${k}] ${t}`);
if (hits.length) process.exit(1);
console.log("no hardcoded JSX strings");
