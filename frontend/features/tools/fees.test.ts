import { describe, expect, it } from "vitest";
import { calcFees } from "./fees";

describe("fees", () => {
  it("sale in a city: percent items + fixed mutation fee", () => {
    const { lines, total } = calcFees("sale", "city", 1_000_000);
    const by = Object.fromEntries(lines.map((l) => [l.code, l.amount]));
    expect(by).toEqual({ registration: 10000, stampDuty: 15000, localTax: 30000, sourceTax: 15000, mutation: 1100 });
    expect(total).toBe(71100);
  });
  it("location class changes only the local and source tax", () => {
    const a = calcFees("sale", "union", 1_000_000).lines.map((l) => l.code + l.amount);
    expect(a).toContain("localTax10000");
    expect(a).toContain("sourceTax5000");
  });
  it("inheritance has no stamp duty or local tax", () => {
    const codes = calcFees("inheritance", "city", 5_000_000).lines.map((l) => l.code);
    expect(codes).toEqual(["registration", "mutation"]);
  });
  it("gift has no local tax; zero value leaves only fixed fees; invalid rejected", () => {
    expect(calcFees("gift", "city", 100).lines.map((l) => l.code)).not.toContain("localTax");
    expect(calcFees("sale", "city", 0).total).toBe(1100);
    expect(() => calcFees("sale", "city", -1)).toThrow();
    expect(() => calcFees("sale", "city", Number.NaN)).toThrow();
  });
});
