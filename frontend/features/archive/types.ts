export const SURVEYS = ["CS", "SA", "RS", "BS"] as const;
export const ARCHIVE_PAGE_SIZE = 10;

export type ArchiveHit = {
  document_id: string;
  document_type: string;
  land_id: string | null;
  survey_type: string | null;
  district: string | null;
  upazila: string | null;
  mouza: string | null;
  khatian_no: string | null;
  snippet: string;
};

export type ArchiveSearch = { items: ArchiveHit[]; total: number; limit: number; offset: number };
export type ArchiveParams = { q: string; survey: string; district: string; page: number };
