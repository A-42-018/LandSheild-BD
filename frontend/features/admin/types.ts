export interface AuditLogItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor: { name: string; role: string } | null;
  ip_hash: string | null; // already truncated by the API
  created_at: string;
}

export interface AuditLogList {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditParams {
  actor: string;
  action: string;
  entity: string;
  from: string; // YYYY-MM-DD or ""
  to: string;
  page: number;
}

export const AUDIT_PAGE_SIZE = 20;
export const AUDIT_ENTITIES = ["user", "document", "transaction", "fraud_alert", "verification_request"];

/* ---- P37 admin console ---- */
export type RoleCode = "CITIZEN" | "REVIEWER" | "OFFICER" | "ADMIN";
export const ADMIN_ROLES: RoleCode[] = ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"];
export const ADMIN_PAGE_SIZE = 20;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: RoleCode;
  preferred_language: string;
  is_active: boolean;
  created_at: string;
}
export interface AdminLandRecord {
  land_id: string;
  district: string;
  upazila: string;
  mouza: string;
  khatian_no: string;
  dag_no: string;
  area: number;
  area_unit: string;
  status: string;
  updated_at: string;
}
export interface AdminDocument {
  id: string;
  land_id: string | null;
  document_type: string;
  processing_status: string;
  ocr_confidence: number | null;
  uploaded_by: string | null;
  created_at: string;
}
export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface ListParams {
  q: string;
  filter: string; // role (users) or status (records/documents); "" = all
  active: string; // users only: "", "true", "false"
  sort: string;
  order: "asc" | "desc";
  page: number;
}
export interface UserDraft {
  name: string;
  email: string;
  password: string;
  role: RoleCode;
  preferred_language: "en" | "bn";
}
export const LAND_STATUSES = ["ACTIVE", "REVIEW_REQUIRED"];
export const DOC_STATUSES = ["UPLOADED", "PROCESSING", "EXTRACTED", "REVIEW_REQUIRED", "APPROVED", "REJECTED", "FAILED"];
export const DOC_TYPES = ["DEED", "KHATIAN", "MUTATION", "OTHER"];

export interface LedgerVerify {
  status: "INTACT" | "BROKEN";
  entries: number;
  broken_seq: number | null;
  reason: string | null;
  entity_type: string | null;
  entity_id: string | null;
}
