import type { Evidence } from "@/features/risk/types";
import type { LandInfo, OwnershipEntry, TransactionEntry } from "@/features/result/types";

export interface DocumentConsistency {
  status: string;
  total_documents: number;
  by_status: Record<string, number>;
  indicators: Evidence[];
}
export interface VerificationOut {
  id: string;
  land_id: string;
  status: string;
  risk_score: number | null;
  risk_level: string | null;
  created_at: string;
  completed_at: string | null;
}
export interface VerificationReport {
  verification_id: string;
  land_id: string;
  verification_status: string;
  overall_status: string;
  risk_score: number;
  risk_level: string;
  land: LandInfo;
  ownership: OwnershipEntry[];
  document_consistency: DocumentConsistency;
  transactions: TransactionEntry[];
  evidence: Evidence[];
  disclaimer_code: string;
  verified_at: string;
}
