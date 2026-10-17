import { intlLocale } from "@/lib/intl-locale";

const DHAKA_OFFSET_MS = 6 * 3_600_000; // Bangladesh is UTC+6 all year

export interface Cell {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
}

/** Calendar day (YYYY-MM-DD) of an instant, in Bangladesh time. */
export function dhakaDay(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : new Date(t + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function currentMonth(now: number = Date.now()): string {
  return dhakaDay(new Date(now).toISOString()).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Weeks of a month, Sunday first (Bangladesh's week starts on Sunday). Always full weeks. */
export function monthGrid(month: string): Cell[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = Date.UTC(y, m - 1, 1 - first.getUTCDay());
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = Math.ceil((first.getUTCDay() + days) / 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start + (w * 7 + d) * 86_400_000).toISOString().slice(0, 10);
      return { date, inMonth: monthOf(date) === month };
    }),
  );
}

/** Weekday names, Sunday first, in the active locale (রবি, সোম, …). */
export function weekdayNames(locale: string, style: "short" | "long" = "short"): string[] {
  const f = new Intl.DateTimeFormat(intlLocale(locale), { weekday: style, timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2023, 0, 1 + i)))); // 2023-01-01 was a Sunday
}

export function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function dayLabel(date: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** Time of day in Bangladesh time, e.g. "১০:৩০ AM" / "10:30 AM". */
export function timeLabel(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** Typed date + time (Bangladesh time) → ISO string with the +06:00 offset. */
export function toHearingIso(date: string, time: string): string {
  return `${date}T${time || "10:00"}:00+06:00`;
}
