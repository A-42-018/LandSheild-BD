import { intlLocale } from "@/lib/intl-locale";

/** Format an ISO date (YYYY-MM-DD) in the active locale; null → fallback. */
export function formatDate(iso: string | null | undefined, locale: string, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

export function formatArea(area: number, unit: string, locale: string, unitLabel: string): string {
  return `${new Intl.NumberFormat(intlLocale(locale)).format(area)} ${unitLabel}`;
}

/** Format an ISO timestamp (date + time, UTC) in the active locale. */
export function formatDateTime(iso: string | null | undefined, locale: string, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(locale), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(d);
}
