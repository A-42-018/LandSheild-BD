export const MUTATION_STATUSES = ["APPLIED", "UNDER_REVIEW", "HEARING", "APPEALED", "APPROVED", "REJECTED"] as const;
export type MutationStatusCode = (typeof MUTATION_STATUSES)[number];
export const REASON_REQUIRED: MutationStatusCode[] = ["HEARING", "REJECTED"];
export const CHECK_CODES = [
  "SELLER_IS_RECORDED_OWNER",
  "NO_OPEN_HIGH_ALERT",
  "NO_ACTIVE_CASE",
  "NOT_KHAS_OR_ACQUIRED",
  "AREA_WITHIN_SELLER_HOLDING",
  "DOCUMENT_HUMAN_APPROVED",
] as const;
export type CheckResult = "PASS" | "FAIL" | "NOT_CHECKED";
export const PAGE_SIZE = 20;

export interface MutationQueueItem {
  id: string;
  mutation_no: string;
  land_id: string;
  status: string;
  fast_track: boolean;
  applicant: string;
  area: number;
  area_unit: string;
  applied_at: string;
  status_changed_at: string;
  decided_at: string | null;
  source: string;
  hearing_at?: string | null;
}

export interface MutationList {
  total: number;
  items: MutationQueueItem[];
}

export interface MutationDetailData extends MutationQueueItem {
  survey_type?: string | null;
  jl_no?: string | null;
  previous_khatian_no: string | null;
  new_khatian_no: string | null;
  ac_land_office: string | null;
  checklist: Record<string, string> | null;
  deed_no: string | null;
  transaction_id: string | null;
  allowed_transitions: string[];
  holder_office?: {
    name_en: string; name_bn: string;
    division_en: string; division_bn: string;
    district_en: string; district_bn: string;
    upazila_en: string | null; upazila_bn: string | null;
  } | null;
  recommendation?: "APPROVE" | "REJECT" | null;
  recommendation_note?: string | null;
  recommended_by_name?: string | null;
  recommended_at?: string | null;
  appeal_reason?: string | null;
  appealed_at?: string | null;
  can_recommend?: boolean;
  can_appeal?: boolean;
}

export function daysSince(iso: string, now: number = Date.now()): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / 86_400_000));
}
