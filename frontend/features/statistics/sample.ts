/** Sample figures for the public তথ্যচিত্র page (U4.3). Made up for the demo: NOT an official government record.
 *  Change the numbers here and the date below together; KPI totals are summed from the rows, so they always agree. */
export const SAMPLE_UPDATED = "2026-10-15";

export type DivisionId = "Barishal" | "Chattogram" | "Dhaka" | "Khulna" | "Mymensingh" | "Rajshahi" | "Rangpur" | "Sylhet";

export interface DivisionRow {
  /** English division name, same as `DIVISIONS[].value` in lib/geo.ts. */
  id: DivisionId;
  verifications: number;
  applications: number;
  settled: number;
}

export const DIVISION_ROWS: DivisionRow[] = [
  { id: "Dhaka", verifications: 4820, applications: 1260, settled: 1034 },
  { id: "Chattogram", verifications: 3150, applications: 840, settled: 672 },
  { id: "Rajshahi", verifications: 2210, applications: 615, settled: 520 },
  { id: "Khulna", verifications: 1980, applications: 540, settled: 459 },
  { id: "Rangpur", verifications: 1760, applications: 488, settled: 405 },
  { id: "Mymensingh", verifications: 1430, applications: 395, settled: 324 },
  { id: "Sylhet", verifications: 1340, applications: 362, settled: 290 },
  { id: "Barishal", verifications: 1120, applications: 310, settled: 251 },
];

export const sum = (key: "verifications" | "applications" | "settled") => DIVISION_ROWS.reduce((n, r) => n + r[key], 0);

export function totals() {
  const applications = sum("applications");
  const settled = sum("settled");
  return { verifications: sum("verifications"), applications, settled, settledShare: applications ? settled / applications : 0 };
}

/** Schematic tile map: each division's cell on a 3 × 3 grid, roughly where it lies (north up). Not to scale. */
export const TILE_POSITION: Record<DivisionId, { row: 1 | 2 | 3; col: 1 | 2 | 3 }> = {
  Rangpur: { row: 1, col: 1 },
  Mymensingh: { row: 1, col: 2 },
  Sylhet: { row: 1, col: 3 },
  Rajshahi: { row: 2, col: 1 },
  Dhaka: { row: 2, col: 2 },
  Khulna: { row: 3, col: 1 },
  Barishal: { row: 3, col: 2 },
  Chattogram: { row: 3, col: 3 },
};

/** Land checks per division in three bands (one hue, light → dark). The value is printed on every tile, so colour is never the only cue. */
export const BANDS = [
  { id: "low", min: 0 },
  { id: "mid", min: 1500 },
  { id: "high", min: 3000 },
] as const;
export type BandId = (typeof BANDS)[number]["id"];

export function bandOf(value: number): BandId {
  let band: BandId = "low";
  for (const b of BANDS) if (value >= b.min) band = b.id;
  return band;
}
