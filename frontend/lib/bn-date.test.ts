import { describe, expect, it } from "vitest";
import { dhakaParts, formatDates, toBanglaDate } from "./bn-date";

const bd = (y: number, m: number, d: number) => {
  const b = toBanglaDate(y, m, d);
  return `${b.day}/${b.monthIndex + 1}/${b.year}`;
};

describe("toBanglaDate (Bangladesh revised calendar)", () => {
  it.each([
    ["Pohela Boishakh", [2026, 4, 14], "1/1/1433"],
    ["day before Pohela Boishakh", [2026, 4, 13], "30/12/1432"],
    ["Pohela Falgun", [2026, 2, 14], "1/11/1432"],
    ["Language Martyrs' Day = 8 Falgun", [2026, 2, 21], "8/11/1432"],
    ["Independence Day = 12 Choitro", [2026, 3, 26], "12/12/1432"],
    ["Victory Day = 2 Poush", [2026, 12, 16], "2/9/1433"],
    ["1 January is still Poush", [2027, 1, 1], "18/9/1433"],
    ["1 Magh", [2027, 1, 14], "1/10/1433"],
    ["today's anchor, 17 Oct 2026", [2026, 10, 17], "2/7/1433"],
    ["31 December", [2026, 12, 31], "17/9/1433"],
  ] as const)("%s", (_n, [y, m, d], want) => {
    expect(bd(y, m, d)).toBe(want);
  });

  it("every day of a year maps to a day 1-31 and consecutive days never skip or repeat", () => {
    let prev = toBanglaDate(2026, 4, 14);
    for (let i = 1; i < 365; i++) {
      const g = new Date(Date.UTC(2026, 3, 14 + i));
      const cur = toBanglaDate(g.getUTCFullYear(), g.getUTCMonth() + 1, g.getUTCDate());
      const sameMonth = cur.monthIndex === prev.monthIndex;
      expect(cur.day).toBe(sameMonth ? prev.day + 1 : 1);
      prev = cur;
    }
  });

  it("Falgun has 30 days in a leap year and 29 otherwise", () => {
    expect(bd(2028, 3, 14)).toBe("30/11/1434"); // 2028 is a leap year
    expect(bd(2027, 3, 14)).toBe("29/11/1433");
  });
});

describe("formatDates", () => {
  const now = new Date("2026-10-17T10:00:00Z"); // Saturday in Dhaka

  it("uses Dhaka time, not the machine's", () => {
    expect(dhakaParts(new Date("2026-10-16T19:00:00Z"))).toEqual({ year: 2026, month: 10, day: 17 });
  });

  it("Bangla: Bangla digits, month name, বঙ্গাব্দ and খ্রিস্টাব্দ", () => {
    const d = formatDates(now, "bn");
    expect(d.bangla).toBe("২ কার্তিক ১৪৩৩ বঙ্গাব্দ");
    expect(d.gregorian).toBe("১৭ অক্টোবর ২০২৬ খ্রিস্টাব্দ");
    expect(d.weekday).toBe("শনিবার");
    expect(`${d.bangla}${d.gregorian}`).not.toMatch(/[0-9]/);
  });

  it("English: Latin digits and transliterated month", () => {
    const d = formatDates(now, "en");
    expect(d.bangla).toBe("2 Kartik 1433 BS");
    expect(d.gregorian).toBe("17 October 2026");
    expect(d.weekday).toBe("Saturday");
  });
});
