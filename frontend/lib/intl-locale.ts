/** Map the route locale to the BCP-47 tag used for Intl (UI numerals/dates only; document values stay as extracted). */
export function intlLocale(locale: string): string {
  return locale === "bn" ? "bn-BD" : locale;
}
