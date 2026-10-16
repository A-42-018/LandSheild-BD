import type { MutationStatusDto } from "./types";

export const SENTENCE_STATUSES = ["APPLIED", "UNDER_REVIEW", "HEARING", "APPEALED", "APPROVED", "REJECTED"] as const;
export type SentenceStatus = (typeof SENTENCE_STATUSES)[number];

export interface StatusSentence {
  /** `track.sentence.<status>`; `UNKNOWN` when the API sends a status this page does not know. */
  status: SentenceStatus | "UNKNOWN";
  /** Whole days since the application, only while it is still open. */
  days: number | null;
  office: string | null;
}

/** The parts of the SMS-style line; the view joins them in this order, one short sentence each. */
export function statusSentence(d: Pick<MutationStatusDto, "status" | "days_pending" | "office">): StatusSentence {
  const known = (SENTENCE_STATUSES as readonly string[]).includes(d.status);
  return {
    status: known ? (d.status as SentenceStatus) : "UNKNOWN",
    days: d.days_pending,
    office: d.office,
  };
}
