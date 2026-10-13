import type { SortState } from "@/components/ui";
import { gisLabel, type MouzaDto, type SheetRefDto } from "@/features/map/gis/types";
import { intlLocale } from "@/lib/intl-locale";

export type MouzaSortKey = "jl" | "name" | "sheets";

/** Sort dropdown values; the same sorts are reachable from the table headers. */
export const SORT_OPTIONS = ["jl-asc", "jl-desc", "name-asc", "name-desc", "sheets-desc", "sheets-asc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const DEFAULT_SORT: SortState = { key: "jl", dir: "asc" };
export const MOUZA_PAGE_SIZE = 25;

/** Label the mouzamap.tech index gives sheets whose survey type is not in the file or folder name. */
export const UNKNOWN_SURVEY = "Unknown";

export const sortOption = (s: SortState): SortOption => `${s.key}-${s.dir}` as SortOption;

export function parseSort(v: string): SortState {
  const [key, dir] = v.split("-");
  return { key, dir: dir === "desc" ? "desc" : "asc" };
}

// historical order: CS (1888-1940) → SA (1956-62) → RS → BS / city surveys, then local types
const SURVEY_ORDER = ["CS", "CS-SA", "SA", "RS", "BRS", "আরএস (বিআরএস)", "BS", "BDS", "DIARA", "PS", UNKNOWN_SURVEY];

function surveyRank(s: string): number {
  const i = SURVEY_ORDER.indexOf(s);
  return i === -1 ? SURVEY_ORDER.length - 1 : i; // unlisted labels sort just before Unknown
}

export function compareSurveys(a: string, b: string): number {
  return surveyRank(a) - surveyRank(b) || a.localeCompare(b);
}

/** Distinct survey labels of a mouza list with how many mouzas have each, in survey order. */
export function surveysOf(ms: MouzaDto[]): { survey: string; mouzas: number }[] {
  const counts = new Map<string, number>();
  for (const m of ms) {
    for (const s of new Set(m.sheets.map((x) => x.survey).filter(Boolean) as string[])) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([survey, mouzas]) => ({ survey, mouzas }))
    .sort((a, b) => compareSurveys(a.survey, b.survey));
}

/** The sheets shown for a mouza under the survey filter ("" = every survey). */
export function visibleSheets(m: MouzaDto, survey: string): SheetRefDto[] {
  return survey ? m.sheets.filter((s) => s.survey === survey) : m.sheets;
}

const BN_DIGITS: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };

/** Case-, Unicode-form- and digit-script-insensitive text for matching ("১২" finds JL 012). */
export function foldText(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[০-৯]/g, (d) => BN_DIGITS[d])
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

const stripZeros = (s: string) => s.replace(/^0+(?=\d)/, "");

/** Mouza name (English or Bangla) contains the query, or the query is exactly its JL no. */
export function matchesQuery(m: MouzaDto, q: string): boolean {
  const needle = foldText(q);
  if (!needle) return true;
  if (/^\d+$/.test(needle)) return stripZeros(m.jl_no ?? "") === stripZeros(needle);
  return foldText(m.name).includes(needle) || foldText(m.bn_name).includes(needle);
}

export interface MouzaFilters {
  q: string;
  survey: string;
  scannedOnly: boolean;
}

export function filterMouzas(ms: MouzaDto[], f: MouzaFilters): MouzaDto[] {
  return ms.filter((m) => {
    if (!matchesQuery(m, f.q)) return false;
    const sheets = visibleSheets(m, f.survey);
    if (f.survey && sheets.length === 0) return false;
    return !f.scannedOnly || sheets.some((s) => s.url);
  });
}

const jlNumber = (m: MouzaDto) => (m.jl_no && /^\d+$/.test(m.jl_no) ? Number(m.jl_no) : Number.POSITIVE_INFINITY);

/** Sorted copy. Name sort uses the Bangla name in Bangla; ties fall back to JL no. and then name. */
export function sortMouzas(ms: MouzaDto[], sort: SortState, locale: string, survey = ""): MouzaDto[] {
  const collator = new Intl.Collator(intlLocale(locale), { numeric: true, sensitivity: "base" });
  const nameOf = (m: MouzaDto) => (locale === "bn" && m.bn_name ? m.bn_name : m.name);
  const byJl = (a: MouzaDto, b: MouzaDto) => jlNumber(a) - jlNumber(b) || collator.compare(nameOf(a), nameOf(b));
  const sign = sort.dir === "desc" ? -1 : 1;
  const primary = (a: MouzaDto, b: MouzaDto): number => {
    if (sort.key === "name") return collator.compare(nameOf(a), nameOf(b));
    if (sort.key === "sheets") return visibleSheets(a, survey).length - visibleSheets(b, survey).length;
    return jlNumber(a) - jlNumber(b);
  };
  return [...ms].sort((a, b) => sign * primary(a, b) || byJl(a, b));
}

/** Sheets grouped by survey (survey order), sheet numbers in numeric order inside each group. */
export function groupBySurvey(sheets: SheetRefDto[]): { survey: string; sheets: SheetRefDto[] }[] {
  const groups = new Map<string, SheetRefDto[]>();
  for (const s of sheets) {
    const key = s.survey ?? "";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups]
    .sort(([a], [b]) => compareSurveys(a, b))
    .map(([survey, list]) => ({
      survey,
      sheets: [...list].sort((a, b) => a.sheet_no.localeCompare(b.sheet_no, undefined, { numeric: true })),
    }));
}

/** Which copy of its survey and sheet number each sheet is (1 = the first): a mouza can hold two scans of one sheet. */
export function copyNumbers(sheets: SheetRefDto[]): number[] {
  const seen = new Map<string, number>();
  return sheets.map((s) => {
    const key = `${s.survey ?? ""}|${s.sheet_no}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n;
  });
}

/** Name of a downloaded scan, e.g. "Alipur (আলীপুর) JL 001 BS 001.pdf"; characters files cannot hold are dropped. */
export function scanFileName(m: MouzaDto, s: SheetRefDto, copy = 1): string {
  const parts = [gisLabel(m), m.jl_no ? `JL ${m.jl_no}` : "", [s.survey, s.sheet_no].filter(Boolean).join(" "), copy > 1 ? `(${copy})` : ""];
  return `${parts.filter(Boolean).join(" ").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim()}.pdf`;
}
