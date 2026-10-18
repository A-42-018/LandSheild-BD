export interface PublicCounts {
  ownership_records: number;
  transactions: number;
  flagged_transactions: number;
  open_alerts: number;
  active_encumbrances?: number;
  pending_mutations?: number;
}
export interface PublicVerifyDto {
  land_id: string;
  district: string;
  upazila: string;
  mouza: string;
  status: string;
  risk_level: string;
  counts: PublicCounts;
  last_verified_at: string | null;
}

export interface PublicSealDto {
  deed_id: string;
  hash12: string;
}
export type SignatureState = "VALID" | "INVALID" | "UNSIGNED" | "NOT_FOUND";
export interface PublicSignatureDto {
  state: SignatureState;
}

/** H8d: GET /public/records/{id} — what the PDF's QR code opens. No personal data. */
export interface PublicRecordDto {
  state: "VALID" | "INVALID";
  deed_no: string | null;
  version: number;
  approved_at: string | null;
  superseded: boolean;
}
