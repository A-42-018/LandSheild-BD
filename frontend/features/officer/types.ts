export interface OfficerStats {
  total_records: number;
  pending_review: number;
  high_risk: number;
  verified: number;
  open_alerts: number;
  pending_mutations: number;
  active_encumbrances: number;
  ledger_status: "INTACT" | "BROKEN";
  ledger_entries: number;
}

export type QueueFilter = "pending" | "low_confidence" | "high_risk" | "recent";
export type QueueSortKey = "created_at" | "status" | "land_id";

export interface QueueItem {
  id: string;
  land_id: string | null;
  document_type: string;
  processing_status: string;
  min_confidence: number | null;
  low_confidence: boolean;
  high_risk: boolean;
  created_at: string;
}

export interface QueueList {
  items: QueueItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface QueueParams {
  filter: QueueFilter | "";
  q: string;
  sort: QueueSortKey;
  order: "asc" | "desc";
  page: number; // 1-based
  /** sort the record databases by area (optional) */
  division?: string;
  district?: string;
  upazila?: string;
}

export const PAGE_SIZE = 20;
export const QUEUE_FILTERS: QueueFilter[] = ["pending", "low_confidence", "high_risk", "recent"];
export const SORT_KEYS: QueueSortKey[] = ["created_at", "status", "land_id"];

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

export type AlertStatus = "OPEN" | "UNDER_REVIEW" | "DISMISSED" | "ESCALATED";
export const ALERT_STATUSES: AlertStatus[] = ["OPEN", "UNDER_REVIEW", "ESCALATED", "DISMISSED"];

export interface AlertItem {
  id: string;
  land_id: string;
  alert_type: string;
  severity: string;
  risk_score: number;
  evidence: { code: string; severity: string; params: Record<string, unknown> }[];
  status: string;
  created_at: string;
}
export interface AlertList {
  items: AlertItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  actor: { name: string; role: string } | null;
  created_at: string;
}
export interface ActivityList {
  items: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
}

export const SIDE_LIST_SIZE = 8;
export const KNOWN_ACTIONS = [
  "LOGIN", "FAILED_LOGIN", "LOGOUT", "DOCUMENT_UPLOAD", "DOCUMENT_UPLOAD_DUPLICATE", "DOCUMENT_PROCESS_FAILED",
  "DOCUMENT_EXTRACTED", "DOCUMENT_EXTRACTION_EDIT", "DOCUMENT_REPROCESS_REQUEST", "DOCUMENT_APPROVE", "DOCUMENT_REJECT",
  "TRANSACTION_RECORDED", "TRANSACTION_FLAGGED", "RISK_ALERT_UPDATE", "VERIFICATION_CREATE", "USER_CREATE", "USER_UPDATE",
  "FEEDBACK_SUBMIT", "FEEDBACK_UPDATE",
];

export interface DecisionItem {
  id: string;
  document_id: string;
  land_id: string | null;
  document_type: string | null;
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  created_at: string;
}
export interface DecisionList {
  items: DecisionItem[];
  total: number;
  limit: number;
  offset: number;
}
