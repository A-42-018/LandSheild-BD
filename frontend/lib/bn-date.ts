import { intlLocale, localDigits } from "@/lib/intl-locale";

/** Bangladesh revised Bangla calendar (বঙ্গাব্দ). Month starts in Gregorian order: [month, day, index into the 12 Bangla months].
 *  Boishakh–Bhadro 31 days, Ashwin–Poush 30, Magh 31, Falgun 29 (30 in a Gregorian leap year), Choitro 30. */
const STARTS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 14, 9], // Magh
  [2, 14, 10], // Falgun
  [3, 15, 11], // Choitro
  [4, 14, 0], // Boishakh
  [5, 15, 1], // Joishtho
  [6, 15, 2], // Asharh
  [7, 16, 3], // Srabon
  [8, 16, 4], // Bhadro
  [9, 16, 5], // Ashwin
  [10, 16, 6], // Kartik
  [11, 15, 7], // Ogrohayon
  [12, 15, 8], // Poush
];

export type BanglaDate = { year: number; monthIndex: number; day: number };

const DAY_MS = 86_400_000;

/** Bangla-calendar date for a Gregorian calendar date (month is 1-12). */
export function toBanglaDate(year: number, month: number, day: number): BanglaDate {
  // The latest month that has already started this Gregorian year; before 14 Jan we are still in last year's Poush.
  let start: readonly [number, number, number] = [12, 15, 8];
  let startYear = year - 1;
  for (const s of STARTS) {
    if (month * 100 + day >= s[0] * 100 + s[1]) {
      start = s;
      startYear = year;
    }
  }
  const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(startYear, start[0] - 1, start[1])) / DAY_MS);
  return { year: month * 100 + day >= 414 ? year - 593 : year - 594, monthIndex: start[2], day: days + 1 };
}

const MONTHS_EN = ["Boishakh", "Joishtho", "Asharh", "Srabon", "Bhadro", "Ashwin", "Kartik", "Ogrohayon", "Poush", "Magh", "Falgun", "Choitro"];
const MONTHS_BN = ["বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র"];

/** Today's date in Dhaka, as the Gregorian parts the calendar maths needs. */
export function dhakaParts(now: Date): { year: number; month: number; day: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { year: n("year"), month: n("month"), day: n("day") };
}

export type DateLabels = { weekday: string; bangla: string; gregorian: string };

/** Header-strip labels: weekday, Bangla-calendar date and Gregorian date, in the page locale (Dhaka time). */
export function formatDates(now: Date, locale: string): DateLabels {
  const { year, month, day } = dhakaParts(now);
  const b = toBanglaDate(year, month, day);
  const bn = locale === "bn";
  const tag = bn ? intlLocale(locale) : "en-GB"; // day month year in both languages
  const weekday = new Intl.DateTimeFormat(tag, { timeZone: "Asia/Dhaka", weekday: "long" }).format(now);
  const gregorian = new Intl.DateTimeFormat(tag, { timeZone: "Asia/Dhaka", day: "numeric", month: "long", year: "numeric" }).format(now);
  const monthName = (bn ? MONTHS_BN : MONTHS_EN)[b.monthIndex];
  return {
    weekday,
    bangla: bn
      ? `${localDigits(b.day, "bn")} ${monthName} ${localDigits(b.year, "bn")} বঙ্গাব্দ`
      : `${b.day} ${monthName} ${b.year} BS`,
    gregorian: bn ? `${gregorian.replace(",", "")} খ্রিস্টাব্দ` : gregorian,
  };
}
