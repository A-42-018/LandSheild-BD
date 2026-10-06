import { describe, expect, it } from "vitest";
import { parseNum } from "./num";
import { convert, convertAll, UNITS } from "./units";

describe("units", () => {
  it("known relations", () => {
    expect(convert(1, "acre", "decimal", "standard")).toBeCloseTo(100, 1);
    expect(convert(1, "decimal", "sqft", "standard")).toBeCloseTo(435.6, 0);
    expect(convert(1, "bigha", "katha", "standard")).toBeCloseTo(20, 6);
    expect(convert(1, "katha", "chhatak", "standard")).toBeCloseTo(16, 6);
    expect(convert(1, "decimal", "ojutangsho", "standard")).toBeCloseTo(100, 6);
    expect(convert(1, "hectare", "acre", "standard")).toBeCloseTo(2.4711, 3);
  });
  it("region only changes bigha", () => {
    expect(convert(1, "bigha", "decimal", "decimal33")).toBeCloseTo(33, 6);
    expect(convert(1, "bigha", "decimal", "standard")).toBeCloseTo(33.06, 1);
    expect(convert(5, "katha", "sqm", "standard")).toBe(convert(5, "katha", "sqm", "decimal33"));
  });
  it("round trips through every unit", () => {
    for (const a of UNITS) for (const b of UNITS) {
      expect(convert(convert(7.5, a, b, "standard"), b, a, "standard")).toBeCloseTo(7.5, 8);
    }
    expect(Object.keys(convertAll(1, "sqm", "standard"))).toHaveLength(UNITS.length);
  });
  it("parses Bangla digits and separators, rejects junk", () => {
    expect(parseNum("১২.৫")).toBe(12.5);
    expect(parseNum("1,250")).toBe(1250);
    expect(Number.isNaN(parseNum("abc"))).toBe(true);
    expect(Number.isNaN(parseNum("1.2.3"))).toBe(true);
    expect(Number.isNaN(parseNum(""))).toBe(true);
  });
});
