/** C1: land units. Factors are square metres (same base as backend risk/config.py AREA_TO_SQM).
 * Bigha is not the same everywhere in Bangladesh: two illustrative variants are offered and the
 * page tells the user to check their deed. Katha = 720 sq ft; chhatak = 45 sq ft (1 katha = 16 chhatak). */
export const SQFT = 0.09290304;
export const DECIMAL = 40.4686; // shatangsho
export const REGIONS = ["standard", "decimal33"] as const;
export type Region = (typeof REGIONS)[number];

export const UNITS = [
  "decimal", "katha", "bigha", "acre", "chhatak", "ojutangsho", "sqft", "sqyd", "sqm", "hectare",
] as const;
export type Unit = (typeof UNITS)[number];

const BASE: Record<Exclude<Unit, "bigha">, number> = {
  decimal: DECIMAL,
  katha: 720 * SQFT,
  acre: 4046.86,
  chhatak: 45 * SQFT,
  ojutangsho: DECIMAL / 100,
  sqft: SQFT,
  sqyd: 9 * SQFT,
  sqm: 1,
  hectare: 10000,
};

/** 1 bigha in m²: standard = 20 katha (14,400 sq ft); decimal33 = 33 decimal. */
const BIGHA: Record<Region, number> = { standard: 20 * 720 * SQFT, decimal33: 33 * DECIMAL };

export function sqmPer(unit: Unit, region: Region): number {
  return unit === "bigha" ? BIGHA[region] : BASE[unit];
}

export function convert(value: number, from: Unit, to: Unit, region: Region): number {
  return (value * sqmPer(from, region)) / sqmPer(to, region);
}

export function convertAll(value: number, from: Unit, region: Region): Record<Unit, number> {
  const out = {} as Record<Unit, number>;
  for (const u of UNITS) out[u] = convert(value, from, u, region);
  return out;
}
