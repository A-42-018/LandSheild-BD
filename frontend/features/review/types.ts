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
  threshold: number;
  fields: ExtractedFieldOut[];
  edited_by_human: boolean;
  has_low_confidence: boolean;
  low_confidence_fields: string[];
  validation: { valid: boolean; errors: FieldError[] };
  /** true: the viewer uploaded this document (and is not ADMIN), so approving is refused */
  self_approval_blocked?: boolean;
}

/** Statuses for which GET /documents/{id}/extraction returns data. */
export const EXTRACTION_READY = ["EXTRACTED", "REVIEW_REQUIRED", "APPROVED", "REJECTED"];
export const IN_PROGRESS = ["UPLOADED", "PROCESSING"];
