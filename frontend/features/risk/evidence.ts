import { formatDate } from "@/features/result/format";
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
  return {
    code: e.code,
    count: str(p.transaction_count),
    total: str(p.total_area),
    recorded: str(p.recorded_area),
    unit: unit(p.area_unit ?? p.parcel_unit),
    date: d(p.transaction_date),
    deedNo: str(p.deed_no),
    kind: str(p.kind),
    fromSurvey: str(p.from_survey),
    toSurvey: str(p.to_survey),
    unlinked: str(p.unlinked_owners),
    owners: str(p.owners_in_later_survey),
    reason: str(p.reason),
    heldDays: str(p.held_days),
    acquiredOn: d(p.acquired_on),
    referenceNo: str(p.reference_no),
    firstStart: d(p.first_start),
    firstEnd: d(p.first_end),
    secondStart: d(p.second_start),
    secondEnd: d(p.second_end),
    documentArea: str(p.document_area),
    previousArea: str(p.previous_area),
    windowDays: str(p.window_days),
    firstDate: d(p.first_date),
    lastDate: d(p.last_date),
    graceDays: str(p.grace_days),
    mutationArea: str(p.mutation_area),
    mutationUnit: unit(p.mutation_unit),
    deedArea: str(p.deed_area),
    deedUnit: unit(p.deed_unit),
    units: Array.isArray(p.units) ? (p.units as unknown[]).map(unit).join(", ") : "",
  };
}
