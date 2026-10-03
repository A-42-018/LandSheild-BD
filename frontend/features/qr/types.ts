export interface PublicCounts {
  ownership_records: number;
  transactions: number;
  flagged_transactions: number;
  open_alerts: number;
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
