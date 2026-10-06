import { describe, expect, it } from "vitest";
import { cmp, EMPTY, faraid, frac, fracStr, ONE, type Heirs } from "./faraid";

const run = (o: Partial<Heirs>) => faraid({ ...EMPTY, ...o });
const each = (o: Partial<Heirs>) => Object.fromEntries(run(o).shares.map((s) => [s.heir, fracStr(s.each)]));
const tot = (o: Partial<Heirs>) => Object.fromEntries(run(o).shares.map((s) => [s.heir, fracStr(s.total)]));

describe("faraid", () => {
  it("wife + son + daughter", () => {
    expect(tot({ wives: 1, sons: 1, daughters: 1 })).toEqual({ wife: "1/8", son: "7/12", daughter: "7/24" });
  });
  it("husband + 2 daughters + mother: awl to 13", () => {
    const r = run({ husband: true, daughters: 2, mother: true });
    expect(r.awl).toBe(true);
    expect(tot({ husband: true, daughters: 2, mother: true })).toEqual({ husband: "3/13", daughter: "8/13", mother: "2/13" });
  });
  it("wife + father + mother: umariyyatan", () => {
    const r = run({ wives: 1, father: true, mother: true });
    expect(r.umariyyatan).toBe(true);
    expect(tot({ wives: 1, father: true, mother: true })).toEqual({ wife: "1/4", father: "1/2", mother: "1/4" });
  });
  it("only daughters: radd", () => {
    expect(run({ daughters: 3 }).radd).toBe(true);
    expect(each({ daughters: 3 })).toEqual({ daughter: "1/3" });
  });
  it("one daughter: 1/2 then radd gives her everything", () => {
    expect(tot({ daughters: 1 })).toEqual({ daughter: "1" });
  });
  it("son excludes brothers and sisters", () => {
    const r = run({ sons: 1, brothers: 2, sisters: 1 });
    expect(r.excluded).toEqual(["brother", "sister"]);
    expect(r.shares.map((s) => s.heir)).toEqual(["son"]);
  });
  it("father excludes siblings; father with daughter takes 1/6 + residue", () => {
    expect(tot({ father: true, daughters: 1, brothers: 1 })).toEqual({ daughter: "1/2", father: "1/2" });
  });
  it("father with son: 1/6 fixed, rest 2:1", () => {
    expect(tot({ father: true, sons: 1, daughters: 1 })).toEqual({ son: "5/9", daughter: "5/18", father: "1/6" });
  });
  it("mother and father only", () => {
    expect(tot({ father: true, mother: true })).toEqual({ father: "2/3", mother: "1/3" });
  });
  it("husband + sister: 1/2 each", () => {
    expect(tot({ husband: true, sisters: 1 })).toEqual({ husband: "1/2", sister: "1/2" });
  });
  it("two or more siblings cut the mother to 1/6; brother and sister share the rest 2:1", () => {
    expect(tot({ mother: true, brothers: 1, sisters: 1 })).toEqual({ mother: "1/6", brother: "5/9", sister: "5/18" });
  });
  it("sisters with a daughter are residuary", () => {
    expect(tot({ daughters: 1, sisters: 2 })).toEqual({ daughter: "1/2", sister: "1/2" });
  });
  it("two wives split the wives' share", () => {
    expect(each({ wives: 2, sons: 1 })).toEqual({ wife: "1/16", son: "7/8" });
  });
  it("shares always add to exactly 1 (or less only for spouse-only estates)", () => {
    const heirs: Partial<Heirs>[] = [
      { wives: 1, sons: 2, daughters: 3, father: true, mother: true },
      { husband: true, mother: true, sisters: 2 },
      { husband: true, daughters: 2, father: true, mother: true },
      { wives: 4, mother: true, brothers: 2 },
      { sisters: 3 },
    ];
    for (const h of heirs) expect(cmp(run(h).sum, ONE)).toBe(0);
    expect(cmp(run({ wives: 1 }).sum, ONE)).toBeLessThanOrEqual(0);
  });
  it("rejects impossible input", () => {
    expect(() => faraid({ ...EMPTY })).toThrow("NO_HEIRS");
    expect(() => run({ husband: true, wives: 1 })).toThrow("SPOUSE_BOTH");
    expect(() => run({ wives: 5 })).toThrow("WIVES_MAX");
    expect(() => run({ sons: -1, mother: true })).toThrow("COUNT_RANGE");
    expect(frac(2, 4)).toEqual(frac(1, 2));
  });
});
