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

export interface ExtractionOut {
  document_id: string;
  processing_status: string;
  provider: string;
  ocr_source?: string | null; // demo | pdf-text | tesseract | mock
  extractor?: string | null; // rules | claude | mock
  model?: string | null;
  warnings?: string[];
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
