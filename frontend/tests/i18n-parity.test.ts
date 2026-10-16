import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import bn from "../messages/bn.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("messages", () => {
  it("en and bn have identical key sets", () => {
    expect(keys(bn).sort()).toEqual(keys(en).sort());
  });
  it("required namespaces exist", () => {
    for (const ns of ["common", "nav", "errors", "status", "risk"]) {
      expect(en).toHaveProperty(ns);
      expect(bn).toHaveProperty(ns);
    }
  });
});

import { intlLocale } from "../lib/intl-locale";

describe("brand + locale", () => {
  it("appName stays English in both locales; the Bangla spelling lives only in bn common.brand (header and footer logo)", () => {
    expect(bn.common.appName).toBe("LandShield BD");
    expect(en.common.appName).toBe("LandShield BD");
    expect(en.common.brand).toBe("LandShield BD");
    expect(bn.common.brand).toBe("ল্যান্ডশিল্ড বিডি");
    const { brand: _brand, ...rest } = bn.common;
    expect(JSON.stringify({ ...bn, common: rest })).not.toContain("ল্যান্ডশিল্ড");
  });
  it("maps bn to bn-BD for Intl", () => {
    expect(intlLocale("bn")).toBe("bn-BD");
    expect(intlLocale("en")).toBe("en");
    expect(new Intl.NumberFormat(intlLocale("bn")).format(12)).toBe("১২");
  });
});
