import { normalizeDigits } from "@/lib/intl-locale";

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
  year_from: number | null;
  year_to: number | null;
  historical: boolean;
};

export type ArchiveSearch = { items: ArchiveHit[]; total: number; limit: number; offset: number };
export type ArchiveParams = {
  q: string;
  survey: string;
  district: string;
  yearFrom: string;
  yearTo: string;
  page: number;
};

/** A typed year (ASCII or Bangla digits), or null when empty or not a four-digit year (1000-2200). */
export function parseYear(v: string): number | null {
  const t = normalizeDigits(v.trim());
  if (!/^\d{4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1000 && n <= 2200 ? n : null;
}

/** Both years given in the wrong order. */
export function yearsReversed(from: string, to: string): boolean {
  const a = parseYear(from);
  const b = parseYear(to);
  return a !== null && b !== null && a > b;
}

/** "1944" or "1940–1950"; null when the document has no year. */
export function yearLabel(hit: Pick<ArchiveHit, "year_from" | "year_to">): string | null {
  if (hit.year_from == null) return null;
  return hit.year_to == null || hit.year_to === hit.year_from ? String(hit.year_from) : `${hit.year_from}–${hit.year_to}`;
}

/** Where a hit opens: the document page (H7d). */
export function archiveHitHref(hit: Pick<ArchiveHit, "document_id">): string {
  return `/officer/documents/${hit.document_id}`;
}
