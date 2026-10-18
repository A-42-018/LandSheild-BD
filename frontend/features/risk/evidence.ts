import { formatDate } from "@/features/result/format";
import { intlLocale, localDigits } from "@/lib/intl-locale";
import type { Evidence } from "./types";

type T = {
  (key: string, values?: Record<string, string>): string;
  has: (key: string) => boolean;
};

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/** Known evidence codes (must have risk.evidence.<CODE> in both locales). */
export const EVIDENCE_CODES = [
  "POSSIBLE_DUPLICATE_TRANSACTION",
  "SELLER_MISMATCH",
  "POSSIBLE_NAME_VARIANT",
  "DUPLICATE_DEED",
  "INCONSISTENT_OWNERSHIP",
  "AREA_MISMATCH",
  "REPEATED_SUSPICIOUS_TRANSACTIONS",
  "UNIT_MISMATCH",
  "LOW_EXTRACTION_CONFIDENCE",
  "ML_ANOMALY",
  "REGISTERED_NOT_MUTATED",
  "MUTATION_PARTY_MISMATCH",
  "MUTATION_WITHOUT_DEED",
  "MUTATION_AREA_EXCEEDS_DEED",
  "RECORD_INTEGRITY_FAILED",
  "DEED_NO_FORMAT_INVALID",
  "IMPOSSIBLE_DATE",
  "RAPID_RESALE",
  "ACTIVE_LITIGATION",
  "KHAS_LAND",
  "UNDER_ACQUISITION",
  "ACTIVE_MORTGAGE",
  "SURVEY_CHAIN_GAP",
] as const;

export function evidenceKey(code: string): string {
  return (EVIDENCE_CODES as readonly string[]).includes(code) ? `risk.evidence.${code}` : "risk.evidence.UNKNOWN";
}

export function evidenceValues(e: Evidence, t: T, locale: string): Record<string, string> {
  const p = e.params ?? {};
  const na = t("result.unknownDate");
  const unit = (u: unknown) => (t.has(`result.units.${str(u)}`) ? t(`result.units.${str(u)}`) : str(u));
  const d = (v: unknown) => formatDate(typeof v === "string" ? v : null, locale, na);
  // Counts and areas in the locale's digits; numeric strings (API decimals) too, anything else as-is but with local digits.
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const n = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "";
    const x = Number(v);
    return Number.isFinite(x) ? nf.format(x) : localDigits(str(v), locale);
  };
  return {
    code: e.code,
    count: n(p.transaction_count),
    total: n(p.total_area),
    recorded: n(p.recorded_area),
    unit: unit(p.area_unit ?? p.parcel_unit),
    date: d(p.transaction_date),
    deedNo: str(p.deed_no),
    kind: str(p.kind),
    fromSurvey: str(p.from_survey),
    toSurvey: str(p.to_survey),
    unlinked: n(p.unlinked_owners),
    owners: n(p.owners_in_later_survey),
    reason: str(p.reason),
    heldDays: n(p.held_days),
    acquiredOn: d(p.acquired_on),
    referenceNo: str(p.reference_no),
    firstStart: d(p.first_start),
    firstEnd: d(p.first_end),
    secondStart: d(p.second_start),
    secondEnd: d(p.second_end),
    documentArea: n(p.document_area),
    previousArea: n(p.previous_area),
    windowDays: n(p.window_days),
    firstDate: d(p.first_date),
    lastDate: d(p.last_date),
    graceDays: n(p.grace_days),
    mutationArea: n(p.mutation_area),
    mutationUnit: unit(p.mutation_unit),
    deedArea: n(p.deed_area),
    deedUnit: unit(p.deed_unit),
    units: Array.isArray(p.units) ? (p.units as unknown[]).map(unit).join(", ") : "",
  };
}
