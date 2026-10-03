export interface Evidence {
  code: string;
  severity: string;
  params: Record<string, unknown>;
}
export interface RiskAssessment {
  land_id: string;
  overall_score: number;
  risk_level: string;
  rule_score: number;
  /** Raw 0..1 anomaly hint (P49); null/absent when the ML step was skipped. */
  ml_score?: number | null;
  evidence: Evidence[];
  assessed_at: string;
}
