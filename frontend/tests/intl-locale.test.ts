import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, intlLocale, localDigits, normalizeDigits } from "../lib/intl-locale";
import { normaliseLandId, LAND_ID_RE } from "../features/upload/validation";
import { parseNum } from "../features/tools/num";

const LATIN_DIGIT = /[0-9]/;

describe("lib/intl-locale (shared bn number/date helpers)", () => {
  it("normalizeDigits maps Bangla digits to ASCII and leaves the rest", () => {
    expect(normalizeDigits("০১২৩৪৫৬৭৮৯")).toBe("0123456789");
    expect(normalizeDigits("MUT-২০২৬-০০০১")).toBe("MUT-2026-0001");
    expect(normalizeDigits("abc 12")).toBe("abc 12");
  });

  it("localDigits and normalizeDigits round-trip", () => {
    expect(normalizeDigits(localDigits("610/2", "bn"))).toBe("610/2");
  });

  it("formatDate uses bn-BD with Bangla digits, en stays Latin", () => {
    expect(intlLocale("bn")).toBe("bn-BD");
    const bn = formatDate("2012-03-15", "bn", "-");
    expect(bn).toContain("২০১২");
    expect(bn).toContain("১৫");
    expect(bn).not.toMatch(LATIN_DIGIT);
    expect(formatDate("2012-03-15", "en", "-")).toContain("2012");
    expect(formatDate(null, "bn", "অজানা")).toBe("অজানা");
    expect(formatDate("not-a-date", "bn", "-")).toBe("not-a-date");
  });

  it("formatDate ignores the time part and does not shift the day by timezone", () => {
    expect(formatDate("2012-03-15T23:59:00+06:00", "en", "-")).toContain("15");
  });

  it("formatDateTime shows Bangla digits under bn", () => {
    const s = formatDateTime("2026-10-01T08:05:00Z", "bn", "-");
    expect(s).toContain("২০২৬");
    expect(s).not.toMatch(LATIN_DIGIT);
    expect(formatDateTime(undefined, "bn", "—")).toBe("—");
  });
});

describe("inputs accept Bangla digits", () => {
  it("land ID", () => {
    expect(normaliseLandId(" lp-১০১০০ ")).toBe("LP-10100");
    expect(LAND_ID_RE.test(normaliseLandId("LP-১০১০০"))).toBe(true);
  });
  it("tool numbers", () => {
    expect(parseNum("১,২৫০")).toBe(1250);
  });
});
