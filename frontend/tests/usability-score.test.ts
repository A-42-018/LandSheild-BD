import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { parseCsv, summarise, susScore, table } from "../scripts/usability-score.mjs";

const sus = (qs: number[]) => Object.fromEntries([["participant", "P1"], ...qs.map((v, i) => [`q${i + 1}`, String(v)])]);

describe("usability scoring (U6)", () => {
  it("SUS: best answers = 100, worst = 0, all-neutral = 50", () => {
    expect(susScore(sus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]))).toBe(100);
    expect(susScore(sus([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]))).toBe(0);
    expect(susScore(sus(Array(10).fill(3)))).toBe(50);
  });
  it("SUS rejects an answer outside 1-5", () => {
    expect(() => susScore(sus([6, 1, 5, 1, 5, 1, 5, 1, 5, 1]))).toThrow(/q1/);
  });
  it("parses quoted fields that contain commas and Bangla", () => {
    const [r] = parseCsv('participant,task,quote\nP1,t1,"খতিয়ান, দাগ"\n');
    expect(r.quote).toBe("খতিয়ান, দাগ");
  });
  it("summarises success rate, median seconds and wrong clicks per task", () => {
    const rows = parseCsv("participant,persona,task,success,seconds,wrong_clicks,quote\nP1,a,t1,1,60,0,\nP2,a,t1,0,120,4,\nP3,a,t1,1,90,2,");
    const s = summarise(rows, []);
    const t1 = s.perTask[0];
    expect(t1.success).toBeCloseTo(66.67, 1);
    expect(t1.seconds).toBe(90);
    expect(t1.wrong).toBe(2);
    expect(s.perTask[1].n).toBe(0);
  });
  it("prints a before/after table with the targets", () => {
    const rows = parseCsv("participant,persona,task,success,seconds,wrong_clicks,quote\nP1,a,t1,1,60,0,");
    const s = summarise(rows, [sus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])]);
    const out = table(s, s);
    expect(out).toContain("| T1 |");
    expect(out).toMatch(/SUS: 100\.0 → 100\.0 \(target ≥ 75: met\)/);
  });
});
