import { normalizeDigits } from "@/lib/intl-locale";

export type TrackStepName = "APPLIED" | "REVIEW" | "HEARING" | "DECIDED";
export type TrackStepState = "done" | "current" | "pending" | "skipped";

export interface TrackStepDto {
  step: TrackStepName;
  state: TrackStepState;
  at: string | null;
}
export interface MutationStatusDto {
  mutation_no: string;
  status: string;
  fast_track: boolean;
  office: string | null;
  applied_at: string;
  days_pending: number | null;
  steps: TrackStepDto[];
}

/** MUT-YYYY-NNNN, tolerant of case, surrounding spaces and Bangla digits (the API normalises case and spaces the same way). */
export const MUTATION_NO = /^MUT-\d{4}-\d{4}$/;
export const normaliseNo = (s: string) => normalizeDigits(s).trim().toUpperCase();
