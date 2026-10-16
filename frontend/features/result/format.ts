import { intlLocale } from "@/lib/intl-locale";

// Date helpers live in lib/intl-locale; re-exported so existing imports keep working.
export { formatDate, formatDateTime } from "@/lib/intl-locale";

export function formatArea(area: number, unit: string, locale: string, unitLabel: string): string {
  return `${new Intl.NumberFormat(intlLocale(locale)).format(area)} ${unitLabel}`;
}
