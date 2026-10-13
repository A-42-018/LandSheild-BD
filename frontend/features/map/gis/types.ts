export type GisLevel = "division" | "district" | "upazila";
export type Bbox = [number, number, number, number]; // west, south, east, north

export interface GisProps {
  id: string;
  name: string;
  bn_name: string;
  division_id?: string;
  district_id?: string;
  bbox: Bbox;
  lat: number;
  long: number;
}

export interface GisFeatureDto {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: GisProps;
}

export interface GisCollectionDto {
  type: "FeatureCollection";
  features: GisFeatureDto[];
}

export interface GisCapabilitiesDto {
  mouza_enabled: boolean;
  mouza_enabled_division_id: string | null;
  mouza_enabled_division_name: string | null;
  counts: Record<string, number>;
  mouza_count: number;
  union_count?: number;
  mouza_source?: string | null;
  mouza_source_url?: string | null;
  mouza_sources?: { name: string; url: string }[];
}

export interface UnionDto {
  id: string;
  name: string;
  bn_name: string;
  mouza_count: number;
}

export interface UnionListDto {
  enabled: boolean;
  upazila_id: string;
  unions: UnionDto[];
}

/** One survey map sheet of a mouza, e.g. RS sheet 001. */
export interface SheetRefDto {
  sheet_no: string;
  survey?: string;
  plots?: number;
  /** Link to a scanned map PDF on a third-party site; absent for official-portal sheets. */
  url?: string;
}

export interface MouzaDto {
  id: string;
  code: string;
  name: string;
  bn_name: string;
  union_id?: string | null;
  jl_no: string | null;
  plot_count?: number | null;
  source_url?: string | null;
  sheets: SheetRefDto[];
}

export interface MouzaListDto {
  enabled: boolean;
  upazila_id: string;
  union_id?: string | null;
  mouzas: MouzaDto[];
}

export interface SearchHitDto {
  level: GisLevel | "union" | "mouza";
  id: string;
  name: string;
  bn_name: string;
  path: string;
  bbox: Bbox | null;
  division_id: string | null;
  district_id: string | null;
  upazila_id?: string | null;
  union_id?: string | null;
  jl_no?: string | null;
}

export interface SearchResultDto {
  hits: SearchHitDto[];
  out_of_scope_hint: boolean;
}

export interface GisSelection {
  divisionId: string;
  districtId: string;
  upazilaId: string;
  unionId: string;
  mouzaId: string;
}

export const EMPTY_SELECTION: GisSelection = { divisionId: "", districtId: "", upazilaId: "", unionId: "", mouzaId: "" };

/** Leaflet-style [[south, west], [north, east]] covering all of Bangladesh. */
export const BD_BOUNDS: [[number, number], [number, number]] = [
  [20.55, 88.0],
  [26.7, 92.75],
];

export function bboxToBounds(b: Bbox): [[number, number], [number, number]] {
  return [
    [b[1], b[0]],
    [b[3], b[2]],
  ];
}

/** "Khulna (খুলনা)" like the reference portal; English only when no Bangla name exists. */
export function gisLabel(p: { name: string; bn_name: string }): string {
  return p.bn_name && p.bn_name !== p.name ? `${p.name} (${p.bn_name})` : p.name;
}

/** Which boundary level the map shows for a selection (the level BELOW the deepest choice). */
export function viewLevel(sel: GisSelection): GisLevel {
  if (!sel.divisionId) return "division";
  if (!sel.districtId) return "district";
  return "upazila";
}

/** Selecting a level clears everything below it. */
export function select(sel: GisSelection, level: keyof GisSelection, id: string): GisSelection {
  switch (level) {
    case "divisionId":
      return { divisionId: id, districtId: "", upazilaId: "", unionId: "", mouzaId: "" };
    case "districtId":
      return { ...sel, districtId: id, upazilaId: "", unionId: "", mouzaId: "" };
    case "upazilaId":
      return { ...sel, upazilaId: id, unionId: "", mouzaId: "" };
    case "unionId":
      return { ...sel, unionId: id, mouzaId: "" };
    default:
      return { ...sel, mouzaId: id };
  }
}

/** Mouzas of the chosen union (all of the upazila when no union is chosen), in JL order from the API. */
export function mouzasInUnion(list: MouzaDto[], unionId: string): MouzaDto[] {
  return unionId ? list.filter((m) => m.union_id === unionId) : list;
}

/** "RS 001" - survey and sheet number as printed on the mouza map. */
export function sheetRef(s: SheetRefDto): string {
  return s.survey ? `${s.survey} ${s.sheet_no}` : s.sheet_no;
}

export const LEVEL_STYLE: Record<GisLevel, { color: string; weight: number }> = {
  division: { color: "#0B2545", weight: 3 },
  district: { color: "#1B7F4B", weight: 2 },
  upazila: { color: "#7A4E00", weight: 1.5 },
};

/** Same default the CSP allows (security-headers.mjs DEFAULT_TILE_URL). "off" or "" = no basemap. */
export const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function resolveTileUrl(env: string | undefined): string | undefined {
  if (env === undefined) return DEFAULT_TILE_URL;
  return env === "" || env.toLowerCase() === "off" ? undefined : env;
}
