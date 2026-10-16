/** Map the route locale to the BCP-47 tag used for Intl (UI numerals/dates only; document values stay as extracted). */
export function intlLocale(locale: string): string {
  return locale === "bn" ? "bn-BD" : locale;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Show ASCII digits as Bangla digits under `bn` (display only; stored and typed values stay ASCII). */
export function localDigits(value: string | number | null | undefined, locale: string): string {
  const s = value === null || value === undefined ? "" : String(value);
  return locale === "bn" ? s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]) : s;
}

/** Bangla digits → ASCII digits; everything else untouched. Use on typed input before validating or sending. */
export function normalizeDigits(s: string): string {
  return s.replace(/[০-৯]/g, (c) => String(BN_DIGITS.indexOf(c)));
}

/** Format an ISO date (YYYY-MM-DD) in the active locale; null → fallback. */
export function formatDate(iso: string | null | undefined, locale: string, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

/** Format an ISO timestamp (date + time, UTC) in the active locale. */
export function formatDateTime(iso: string | null | undefined, locale: string, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(locale), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(d);
}
