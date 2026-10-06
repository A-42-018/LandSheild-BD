/** C2: fee calculator. ALL RATES ARE ILLUSTRATIVE DEMO VALUES, not the current official schedule.
 * One config; change the numbers here and every line updates. */
export const FEE_CONFIG = {
  as_of: "2026-10-06",
  source: "Illustrative demo rates; confirm with the Sub-Registry and AC Land office",
} as const;

export const TRANSFERS = ["sale", "gift", "inheritance"] as const;
export const LOCATIONS = ["city", "pourashava", "union"] as const;
export type Transfer = (typeof TRANSFERS)[number];
export type Location = (typeof LOCATIONS)[number];

type Rate = { percent: number } | { fixed: number };
type Item = { code: string; rate: (loc: Location) => Rate };

const ITEMS: Record<Transfer, Item[]> = {
  sale: [
    { code: "registration", rate: () => ({ percent: 1 }) },
    { code: "stampDuty", rate: () => ({ percent: 1.5 }) },
    { code: "localTax", rate: (l) => ({ percent: l === "city" ? 3 : l === "pourashava" ? 2 : 1 }) },
    { code: "sourceTax", rate: (l) => ({ percent: l === "city" ? 1.5 : l === "pourashava" ? 1 : 0.5 }) },
    { code: "mutation", rate: () => ({ fixed: 1100 }) },
  ],
  gift: [
    { code: "registration", rate: () => ({ percent: 1 }) },
    { code: "stampDuty", rate: () => ({ percent: 1 }) },
    { code: "mutation", rate: () => ({ fixed: 1100 }) },
  ],
  inheritance: [
    { code: "registration", rate: () => ({ fixed: 1000 }) }, // partition deed (bontonnama)
    { code: "mutation", rate: () => ({ fixed: 1100 }) },
  ],
};

export type FeeLine = { code: string; kind: "percent" | "fixed"; rate: number; amount: number };

export function calcFees(transfer: Transfer, location: Location, deedValue: number): { lines: FeeLine[]; total: number } {
  if (!Number.isFinite(deedValue) || deedValue < 0) throw new RangeError("deedValue");
  const lines = ITEMS[transfer].map((i): FeeLine => {
    const r = i.rate(location);
    return "percent" in r
      ? { code: i.code, kind: "percent", rate: r.percent, amount: Math.round((deedValue * r.percent) / 100) }
      : { code: i.code, kind: "fixed", rate: r.fixed, amount: r.fixed };
  });
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}
