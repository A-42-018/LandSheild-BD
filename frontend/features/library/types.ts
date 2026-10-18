export type LibraryTab = "mine" | "office" | "action";
export type LibrarySortKey = "created_at" | "status" | "deed_date";
export type LibraryProfile = "modern" | "historical";

export const LIBRARY_TABS: LibraryTab[] = ["mine", "office", "action"];
export const LIBRARY_SORTS: LibrarySortKey[] = ["created_at", "status", "deed_date"];
export const LIBRARY_STATUSES = ["UPLOADED", "PROCESSING", "EXTRACTED", "REVIEW_REQUIRED", "APPROVED", "REJECTED", "FAILED"] as const;
export const LIBRARY_TYPES = ["DEED", "KHATIAN", "PORCHA", "MUTATION", "OTHER"] as const;
export const LIBRARY_PAGE_SIZE = 20;
export const RECENT_SIZE = 5;

/** One row of GET /documents (H7a `LibraryItem`). */
export interface LibraryItem {
  id: string;
  land_id: string | null;
  document_type: string;
  processing_status: string;
  file_type: string; // jpg | png | pdf
  created_at: string;
  office: { id?: string; name_en: string; name_bn: string } | null;
  deed_no: string | null;
  mouza: string | null;
  deed_date: string | null;
  deed_profile: string | null;
  historical: boolean;
  uploaded_by_me: boolean;
  digitised: boolean;
  approved_version: number | null;
  versions: number;
  needs_my_action: boolean;
}

export interface LibraryList {
  items: LibraryItem[];
  total: number;
  limit: number;
  offset: number;
}

/** Everything the page keeps in the URL. Empty string = filter not set. */
export interface LibraryParams {
  tab: LibraryTab;
  status: string;
  type: string;
  profile: "" | LibraryProfile;
  division: string;
  district: string;
  upazila: string;
  date_from: string;
  date_to: string;
  q: string;
  sort: LibrarySortKey;
  order: "asc" | "desc";
  page: number; // 1-based
}

export const DEFAULT_PARAMS: LibraryParams = {
  tab: "mine", status: "", type: "", profile: "", division: "", district: "", upazila: "",
  date_from: "", date_to: "", q: "", sort: "created_at", order: "desc", page: 1,
};

/** Where a row opens: the document page (H7d). */
export function documentHref(item: Pick<LibraryItem, "id">): string {
  return `/officer/documents/${item.id}`;
}

/** The review screen of a document (still being reviewed). */
export function reviewHref(id: string): string {
  return `/officer/review/${id}`;
}

/** Statuses in which the document is not finished: the document page then links to the review screen. */
export const UNDER_REVIEW = ["UPLOADED", "PROCESSING", "EXTRACTED", "REVIEW_REQUIRED", "FAILED"];

export type SignatureStatus = "VALID" | "INVALID" | "UNSIGNED";

/** One digital record version (GET /documents/{id}/records[/{n}], backend `RecordVersionOut`). */
export interface RecordVersion {
  document_id: string;
  version: number;
  status: "MACHINE" | "DRAFT" | "APPROVED" | "SUPERSEDED";
  record_schema: string; // lhdr/1 | core/1
  created_by: string | null; // null = the extraction job
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
  record_hash: string | null;
  signature: string | null;
  signature_status: SignatureStatus;
  file_hash: string;
  record?: Record<string, unknown> | null; // single-version read only
}

export interface RecordVersionList {
  document_id: string;
  file_hash: string;
  items: RecordVersion[];
}

/** GET /documents/{id}/records/history (H7b): who changed what, per version. */
export interface RecordChange {
  path: string;
  op?: string | null;
  old?: string | null;
  new?: string | null;
}
export interface RecordHistoryEvent {
  kind: "CREATED" | "EDIT" | "CORRECTION_START" | "BASELINE" | "APPROVE";
  at: string;
  actor: { name: string; role: string } | null; // null = the extraction job
  changes: RecordChange[];
}
export interface RecordHistoryVersion {
  version: number;
  status: string;
  record_schema: string;
  events: RecordHistoryEvent[];
}
export interface RecordHistory {
  document_id: string;
  versions: RecordHistoryVersion[];
}

/** GET /lands/{land_id}/documents (H7b). */
export interface LandDocumentItem extends LibraryItem {
  approved_record: {
    version: number;
    record_schema: string;
    approved_at: string | null;
    approved_by: string | null;
    signature_status: SignatureStatus;
  } | null;
  /** The past chain-of-title link this document created on the land (H9b). */
  chain_link?: { start_date: string | null; end_date: string | null } | null;
}
export interface LandDocuments {
  land_id: string;
  items: LandDocumentItem[];
  total: number;
}
