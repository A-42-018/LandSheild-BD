export interface MapPropsDto {
  land_id: string;
  dag_no: string;
  khatian_no: string;
  /** Place, sent by the public map so a visitor's "details" link can run the public search (U2.3). */
  district?: string;
  upazila?: string;
  mouza?: string;
  /** Signed-in map only: the public map (U2.3) carries outlines and numbers, nothing else. */
  area?: number;
  area_unit?: string;
  status?: string;
  risk_level?: string;
}

export interface MapFeatureDto {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: MapPropsDto;
}

export interface MapCollectionDto {
  type: "FeatureCollection";
  features: MapFeatureDto[];
}

export const RISK_FILTERS = ["ALL", "LOW", "MEDIUM", "HIGH"] as const;
export type RiskFilter = (typeof RISK_FILTERS)[number];

/** Design-token hex values (tailwind.config.ts); colour is never the only signal (text badge + legend). */
export const RISK_COLOR: Record<string, string> = {
  LOW: "#1B7F4B",
  MEDIUM: "#B26A00",
  HIGH: "#B42318",
};
export const NEUTRAL_COLOR = "#5B6B80";

export function riskColor(level: string | undefined): string {
  return (level && RISK_COLOR[level]) || NEUTRAL_COLOR;
}

export function filterFeatures(features: MapFeatureDto[], filter: RiskFilter): MapFeatureDto[] {
  return filter === "ALL" ? features : features.filter((f) => f.properties.risk_level === filter);
}
