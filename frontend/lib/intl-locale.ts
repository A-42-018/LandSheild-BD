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
