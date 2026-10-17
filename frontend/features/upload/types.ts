export interface DocumentOut {
  id: string;
  land_id: string | null;
  document_type: string;
  processing_status: string;
  file_hash: string;
  file_type: string;
  created_at: string;
  failure_code?: string | null; // FAILED: OCR_UNAVAILABLE | OCR_TIMEOUT | ...
  /** last four digits of the NID entered per deed party, e.g. { buyer: "4821" } */
  party_nids?: Record<string, string>;
  office?: { name_en: string; name_bn: string; division_en: string; division_bn: string; district_en: string; district_bn: string; upazila_en: string | null; upazila_bn: string | null } | null;
}

export interface DocumentUploadOut extends DocumentOut {
  duplicate: boolean;
}

/** Statuses after which nothing changes without human action → stop polling. */
export const TERMINAL_STATUSES = ["EXTRACTED", "REVIEW_REQUIRED", "APPROVED", "REJECTED", "FAILED"];
export const POLL_MS = 2000;
