export interface ExtractedFieldOut {
  field: string;
  value: string | null;
  confidence: number;
  source_bbox: number[] | null;
  edited_by_human: boolean;
  low_confidence: boolean;
}

export interface FieldError {
  field: string;
  code: string;
  params?: Record<string, unknown> | null;
}

/** Tesseract profile of a deed (H3): detected, or forced by a reviewer on reprocess. */
export type DeedProfile = "modern" | "historical";

/** LHDR v1 record of a historical deed (ai/extraction/lhdr.py). Every leaf is a Field; a plain value is tolerated. */
export interface LhdrSource {
  page: number;
  bbox?: number[] | null; // x, y, w, h
}
export interface LhdrCandidate {
  value: unknown;
  method?: string | null;
  confidence?: number | null;
}
export interface LhdrField<V = unknown> {
  value?: V | null;
  verbatim?: string | null;
  confidence?: number | null; // null / missing: not stated (hand-written record)
  source?: LhdrSource | null;
  method?: string | null; // text-layer | ocr+rules | llm | fused | human | computed
  legibility?: "clear" | "faded" | "damaged" | "illegible" | null;
  edited_by_human?: boolean;
  candidates?: LhdrCandidate[]; // H6d: the other reading when rules and the LLM disagree
  flags?: string[]; // H6d: DISAGREE, NOT_IN_TEXT
}
export type Leaf<V = unknown> = LhdrField<V> | V | null | undefined;

export interface LhdrDeedDate {
  verbatim?: Leaf<string>;
  calendar?: Leaf<string>;
  day?: Leaf<number>;
  month?: Leaf<number | string>;
  year?: Leaf<number>;
  gregorian_from?: Leaf<string>;
  gregorian_to?: Leaf<string>;
  precision?: Leaf<string>;
}
export interface LhdrRelative {
  name?: Leaf<string>;
  deceased?: Leaf<boolean>;
}
export interface LhdrAddress {
  village?: Leaf<string>;
  post?: Leaf<string>;
  union?: Leaf<string>;
  thana?: Leaf<string>;
  pargana?: Leaf<string>;
  district?: Leaf<string>;
}
export interface LhdrParty {
  role?: Leaf<string>;
  honorific?: Leaf<string>;
  name?: Leaf<string>;
  father?: LhdrRelative | null;
  husband?: LhdrRelative | null;
  mother?: Leaf<string>;
  address?: LhdrAddress | null;
  profession?: Leaf<string>;
  religion?: Leaf<string>;
  nationality?: Leaf<string>;
  share?: Leaf<string>;
}
export interface LhdrBoundaries {
  north?: Leaf<string>;
  south?: Leaf<string>;
  east?: Leaf<string>;
  west?: Leaf<string>;
}
export interface LhdrArea {
  value?: Leaf<number>;
  unit?: Leaf<string>;
  parts?: Record<string, Leaf<number>> | null;
  in_words?: Leaf<string>;
  decimal_equiv?: Leaf<number>;
}
export interface LhdrPlot {
  district?: Leaf<string>;
  thana?: Leaf<string>;
  pargana?: Leaf<string>;
  mouza?: Leaf<string>;
  jl_no?: Leaf<string>;
  survey?: Leaf<string>;
  khatian_no?: Leaf<string>;
  dag_no?: Leaf<string>[];
  area?: LhdrArea | null;
  land_class?: Leaf<string>;
  boundaries?: LhdrBoundaries | null;
}
export interface LhdrRecord {
  schema?: string;
  document?: { kind?: Leaf<string>; era?: Leaf<string>; pages?: Leaf<number> } | null;
  registration?: {
    deed_no?: Leaf<string>;
    deed_no_verbatim?: Leaf<string>;
    volume?: Leaf<string>;
    pages?: Leaf<string>;
    office?: Leaf<string>;
    year?: Leaf<number>;
    endorsement?: Leaf<string>;
  } | null;
  dates?: { execution?: LhdrDeedDate | null; registration?: LhdrDeedDate | null } | null;
  parties?: LhdrParty[];
  consideration?: {
    amount?: Leaf<number>;
    in_words?: Leaf<string>;
    currency_written?: Leaf<string>;
    era_currency?: Leaf<string>;
    mode?: Leaf<string>;
  } | null;
  schedule?: LhdrPlot[];
  title_recital?: {
    basis?: Leaf<string>;
    prior_deed?: Leaf<string>;
    nature?: Leaf<string>;
    encumbrance_free?: Leaf<boolean>;
  } | null;
  execution?: {
    seller_mark?: Leaf<string>;
    witnesses?: LhdrParty[];
    deed_writer?: { name?: Leaf<string>; licence_no?: Leaf<string>; address?: LhdrAddress | null } | null;
    stamps?: { type?: Leaf<string>; value?: Leaf<string> }[];
    seals?: Leaf<string>[];
  } | null;
}

/** One edit of the LHDR record (backend RecordOp, ai/extraction/lhdr_patch.py): JSON pointer + value. */
export interface RecordOp {
  op: "replace" | "add" | "remove";
  path: string;
  value?: unknown;
}

/** Why a record edit was refused (422 RECORD_PATCH_FAILED / RECORD_VALIDATION_FAILED details). */
export interface RecordApiError {
  path: string;
  code: string;
  message?: string;
}

/** H1 content issue of the record (GET /extraction → record_validation). */
export interface RecordIssue {
  path: string; // JSON pointer, e.g. /schedule/0/area/value
  code: string;
  message: string;
}

export interface ExtractionOut {
  document_id: string;
  processing_status: string;
  provider: string;
  ocr_source?: string | null; // demo | pdf-text | tesseract | mock
  extractor?: string | null; // rules | claude | mock
  model?: string | null;
  warnings?: string[];
  /** deeds only: null for khatian / porcha and for results from before detection existed */
  deed_profile?: DeedProfile | null;
  ocr_profile?: DeedProfile | null; // profile Tesseract read with (null = no image OCR)
  /** true: a reviewer chose deed_profile; false: the classifier detected it */
  profile_overridden?: boolean;
  /** H4/H5: LHDR record of a historical deed, its content issues and the saved version */
  record?: LhdrRecord | null;
  record_schema?: string | null;
  survey_type?: string | null; // SJ7: khatian / porcha only
  jl_no?: string | null;
  record_validation?: { valid: boolean; errors: RecordIssue[]; warnings: RecordIssue[] } | null;
  version?: number | null;
  version_status?: string | null; // MACHINE | DRAFT | APPROVED
  threshold: number;
  fields: ExtractedFieldOut[];
  edited_by_human: boolean;
  has_low_confidence: boolean;
  low_confidence_fields: string[];
  validation: { valid: boolean; errors: FieldError[] };
  /** true: the viewer uploaded this document (and is not ADMIN), so approving is refused */
  self_approval_blocked?: boolean;
  /** the record lies outside the area of the office it was filed under: approving is refused */
  area_conflict?: AreaConflict | null;
}

/** RECORD_OUTSIDE_AREA details (also sent ahead in ExtractionOut.area_conflict) */
export interface AreaConflict {
  office?: string;
  office_name_en?: string;
  office_name_bn?: string;
  district?: string | null;
  upazila?: string | null;
  /** set instead when the land itself is held by another office */
  land_id?: string;
}

/** Statuses for which GET /documents/{id}/extraction returns data. */
export const EXTRACTION_READY = ["EXTRACTED", "REVIEW_REQUIRED", "APPROVED", "REJECTED"];
export const IN_PROGRESS = ["UPLOADED", "PROCESSING"];
