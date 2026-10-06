export type CheckStatus = "PASS" | "WARN" | "FAIL" | "UNKNOWN";

export interface CheckRowDto {
  code: string;
  status: CheckStatus;
  detail: Record<string, number | string>;
}

export interface PrePurchaseDto {
  land_id: string;
  rows: CheckRowDto[];
  verdict: "NO_INDICATORS" | "INDICATORS_FOUND";
}
