export const FEEDBACK_KINDS = ["GRIEVANCE", "FEEDBACK", "SUGGESTION"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_STATUSES = ["RECEIVED", "IN_REVIEW", "RESOLVED", "CLOSED"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** FB-YYYY-NNNNN, tolerant of case and surrounding spaces (the API normalises the same way). */
export const FEEDBACK_REF = /^FB-\d{4}-\d{5}$/;

export interface FeedbackReceipt {
  reference_no: string;
  status: FeedbackStatus;
  created_at: string;
}
export interface PublicFeedbackStatus {
  reference_no: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  response: string | null;
}
export interface FeedbackItem {
  id: string;
  reference_no: string;
  kind: FeedbackKind;
  subject: string;
  message: string;
  contact_email: string | null;
  related_ref: string | null;
  status: FeedbackStatus;
  response: string | null;
  created_at: string;
  updated_at: string;
}
export interface FeedbackList {
  items: FeedbackItem[];
  total: number;
  open: number;
  helpful: number;
  not_helpful: number;
  limit: number;
  offset: number;
}
