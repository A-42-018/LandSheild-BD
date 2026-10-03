import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
const load = (l) => JSON.parse(readFileSync(join(dir, `${l}.json`), "utf8"));
const keys = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  );

const en = new Set(keys(load("en")));
const bn = new Set(keys(load("bn")));
const missingBn = [...en].filter((k) => !bn.has(k));
const missingEn = [...bn].filter((k) => !en.has(k));

if (missingBn.length || missingEn.length) {
  for (const k of missingBn) console.error(`missing in bn: ${k}`);
  for (const k of missingEn) console.error(`missing in en: ${k}`);
  process.exit(1);
}
console.log(`i18n parity OK (${en.size} keys)`);
