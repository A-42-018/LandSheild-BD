// U6: score usability sessions. Usage: node scripts/usability-score.mjs <baseline-dir> <after-dir>
// Each dir holds tasks.csv (participant,persona,task,success,seconds,wrong_clicks,quote) and sus.csv (participant,q1..q10, each 1-5).
// Prints the before/after table of docs/usability.md. Pure functions are exported for tests/usability-score.test.ts.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const TASKS = ["t1", "t2", "t3", "t4", "t5"];
export const TARGET = { success: 90, sus: 75 };

/** Minimal CSV: quoted fields may hold commas; no embedded newlines. */
export function parseCsv(text) {
  const [head, ...lines] = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (l) => [...l.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => (m[2] ?? m[1]).trim());
  const keys = split(head);
  return lines.map((l) => Object.fromEntries(split(l).map((v, i) => [keys[i], v])));
}

/** SUS: odd items score-1, even items 5-score, sum x 2.5 (0-100). */
export function susScore(row) {
  let sum = 0;
  for (let i = 1; i <= 10; i++) {
    const v = Number(row[`q${i}`]);
    if (!(v >= 1 && v <= 5)) throw new Error(`SUS ${row.participant}: q${i} must be 1-5, got "${row[`q${i}`]}"`);
    sum += i % 2 ? v - 1 : 5 - v;
  }
  return sum * 2.5;
}

/** Lower median: for an even count, the smaller middle value (a real observed time, never an average of two). */
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)] : null);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const fmt = (v, d = 0) => (v == null ? "-" : v.toFixed(d));

export function summarise(tasks, sus) {
  const perTask = TASKS.map((t) => {
    const r = tasks.filter((x) => x.task === t);
    return {
      task: t,
      n: r.length,
      success: r.length ? (100 * r.filter((x) => x.success === "1").length) / r.length : null,
      seconds: median(r.map((x) => Number(x.seconds)).filter(Number.isFinite)),
      wrong: mean(r.map((x) => Number(x.wrong_clicks)).filter(Number.isFinite)),
    };
  });
  const all = tasks.filter((x) => TASKS.includes(x.task));
  const overall = all.length ? (100 * all.filter((x) => x.success === "1").length) / all.length : null;
  const scores = sus.map(susScore);
  return { perTask, overall, sus: mean(scores), participants: new Set(tasks.map((x) => x.participant)).size, susN: scores.length };
}

const read = (dir, f) => parseCsv(fs.readFileSync(path.join(dir, f), "utf8"));
export const load = (dir) => summarise(read(dir, "tasks.csv"), read(dir, "sus.csv"));

export function table(before, after) {
  const delta = (b, a, d = 0, unit = "") => (b == null || a == null ? "-" : `${a - b >= 0 ? "+" : ""}${(a - b).toFixed(d)}${unit}`);
  const out = ["| Task | Success before → after | Median s before → after | Wrong clicks before → after |", "|---|---|---|---|"];
  before.perTask.forEach((b, i) => {
    const a = after.perTask[i];
    out.push(`| ${b.task.toUpperCase()} | ${fmt(b.success)} % → ${fmt(a.success)} % (${delta(b.success, a.success, 0, " pt")}) | ${fmt(b.seconds)} → ${fmt(a.seconds)} (${delta(b.seconds, a.seconds)}) | ${fmt(b.wrong, 1)} → ${fmt(a.wrong, 1)} (${delta(b.wrong, a.wrong, 1)}) |`);
  });
  out.push("", `Overall success: ${fmt(before.overall)} % → ${fmt(after.overall)} % (target ≥ ${TARGET.success} %: ${after.overall >= TARGET.success ? "met" : "NOT met"})`);
  out.push(`SUS: ${fmt(before.sus, 1)} → ${fmt(after.sus, 1)} (target ≥ ${TARGET.sus}: ${after.sus >= TARGET.sus ? "met" : "NOT met"})`);
  out.push(`Participants: ${before.participants} before, ${after.participants} after (SUS forms: ${before.susN}, ${after.susN})`);
  return out.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [b, a] = process.argv.slice(2);
  if (!b || !a) {
    console.error("usage: node scripts/usability-score.mjs <baseline-dir> <after-dir>");
    process.exit(2);
  }
  console.log(table(load(b), load(a)));
}
