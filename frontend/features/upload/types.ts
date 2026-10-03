export interface DocumentOut {
  id: string;
  land_id: string | null;
  document_type: string;
  processing_status: string;
  file_hash: string;
  file_type: string;
  created_at: string;
}

export interface DocumentUploadOut extends DocumentOut {
  duplicate: boolean;
}

/** Statuses after which nothing changes without human action → stop polling. */
export const TERMINAL_STATUSES = ["EXTRACTED", "REVIEW_REQUIRED", "APPROVED", "REJECTED", "FAILED"];
export const POLL_MS = 2000;
