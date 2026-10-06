/** C5: Hanafi inheritance shares (as applied to Muslim estates in Bangladesh), exact fractions.
 * Covered: husband/wives, sons, daughters, father, mother, full brothers/sisters. Fixed shares, residue
 * (asaba), awl (over-subscription) and radd (return to sharers, never to a spouse), exclusion by son/father,
 * and the umariyyatan rule. NOT covered (UI says consult a lawyer): grandparents, grandchildren,
 * half-siblings, wills, missing persons, other religions' succession laws. Guidance, not a legal ruling. */
export type Frac = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
export const frac = (n: number | bigint, d: number | bigint = 1): Frac => {
  const nn = BigInt(n), dd = BigInt(d);
  const g = gcd(nn, dd) || 1n;
  return { n: nn / g, d: dd / g };
};
export const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
export const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);
export const cmp = (a: Frac, b: Frac) => { const x = a.n * b.d - b.n * a.d; return x === 0n ? 0 : x > 0n ? 1 : -1; };
export const toNum = (a: Frac) => Number(a.n) / Number(a.d);
export const ZERO = frac(0);
export const ONE = frac(1);

export type Heirs = {
  husband: boolean; wives: number; sons: number; daughters: number;
  father: boolean; mother: boolean; brothers: number; sisters: number;
};
export const EMPTY: Heirs = { husband: false, wives: 0, sons: 0, daughters: 0, father: false, mother: false, brothers: 0, sisters: 0 };
export type HeirKey = "husband" | "wife" | "son" | "daughter" | "father" | "mother" | "brother" | "sister";
export type Share = { heir: HeirKey; count: number; total: Frac; each: Frac };
export type Result = { shares: Share[]; sum: Frac; awl: boolean; radd: boolean; umariyyatan: boolean; excluded: HeirKey[] };

export function validate(h: Heirs): string | null {
  if (h.husband && h.wives > 0) return "SPOUSE_BOTH";
  if (h.wives > 4) return "WIVES_MAX";
  for (const k of ["wives", "sons", "daughters", "brothers", "sisters"] as const) {
    if (!Number.isInteger(h[k]) || h[k] < 0 || h[k] > 30) return "COUNT_RANGE";
  }
  const any = h.husband || h.wives || h.sons || h.daughters || h.father || h.mother || h.brothers || h.sisters;
  return any ? null : "NO_HEIRS";
}

export function faraid(h: Heirs): Result {
  const err = validate(h);
  if (err) throw new RangeError(err);
  const desc = h.sons + h.daughters > 0;
  const maleDesc = h.sons > 0;
  const excluded: HeirKey[] = [];
  const sibExcluded = maleDesc || h.father;
  let brothers = h.brothers, sisters = h.sisters;
  if (sibExcluded) {
    if (brothers) excluded.push("brother");
    if (sisters) excluded.push("sister");
    brothers = 0; sisters = 0;
  }
  const sibs = brothers + sisters;
  const fixed = new Map<HeirKey, Frac>(); // total fixed share per group
  const spouse = h.husband || h.wives > 0;

  if (h.husband) fixed.set("husband", desc ? frac(1, 4) : frac(1, 2));
  if (h.wives) fixed.set("wife", desc ? frac(1, 8) : frac(1, 4));

  let umar = false;
  if (h.mother) {
    const parentsOnly = !desc && sibs < 2 && spouse && h.father && h.mother && sibs === 0;
    if (parentsOnly) {
      umar = true;
      const spouseShare = fixed.get("husband") ?? fixed.get("wife") ?? ZERO;
      fixed.set("mother", div(sub(ONE, spouseShare), frac(3)));
    } else fixed.set("mother", desc || sibs >= 2 ? frac(1, 6) : frac(1, 3));
  }
  if (h.father && desc) fixed.set("father", frac(1, 6));
  if (h.daughters && !h.sons) fixed.set("daughter", h.daughters === 1 ? frac(1, 2) : frac(2, 3));
  const sisterResidue = sisters > 0 && brothers === 0 && h.daughters > 0 && !h.sons; // asaba ma'a al-ghayr
  if (sisters && !brothers && !sibExcluded && !sisterResidue) {
    fixed.set("sister", sisters === 1 ? frac(1, 2) : frac(2, 3));
  }

  let sum = ZERO;
  for (const v of fixed.values()) sum = add(sum, v);
  let residue = cmp(sum, ONE) < 0 ? sub(ONE, sum) : ZERO;

  const total = new Map<HeirKey, Frac>(fixed);
  const put = (k: HeirKey, f: Frac) => total.set(k, add(total.get(k) ?? ZERO, f));
  let radd = false;
  if (cmp(residue, ZERO) > 0) {
    if (h.sons) {
      const units = BigInt(2 * h.sons + h.daughters);
      put("son", mul(residue, frac(2n * BigInt(h.sons), units)));
      if (h.daughters) put("daughter", mul(residue, frac(BigInt(h.daughters), units)));
    } else if (h.father) put("father", residue);
    else if (brothers) {
      const units = BigInt(2 * brothers + sisters);
      put("brother", mul(residue, frac(2n * BigInt(brothers), units)));
      if (sisters) put("sister", mul(residue, frac(BigInt(sisters), units)));
    } else if (sisterResidue) put("sister", residue);
    else {
      const sharers = [...fixed.keys()].filter((k) => k !== "husband" && k !== "wife");
      if (sharers.length) {
        radd = true;
        let base = ZERO;
        for (const k of sharers) base = add(base, fixed.get(k) as Frac);
        for (const k of sharers) put(k, mul(residue, div(fixed.get(k) as Frac, base)));
      }
      // only a spouse and nobody else: the rest is left unassigned (state/other heirs), not invented
    }
    residue = ZERO;
  }

  let all = ZERO;
  for (const v of total.values()) all = add(all, v);
  let awl = false;
  if (cmp(all, ONE) > 0) {
    awl = true;
    for (const [k, v] of total) total.set(k, div(v, all));
    all = ONE;
  }
  const count: Record<HeirKey, number> = {
    husband: h.husband ? 1 : 0, wife: h.wives, son: h.sons, daughter: h.daughters,
    father: h.father ? 1 : 0, mother: h.mother ? 1 : 0, brother: brothers, sister: sisters,
  };
  const order: HeirKey[] = ["husband", "wife", "son", "daughter", "father", "mother", "brother", "sister"];
  const shares: Share[] = order
    .filter((k) => total.has(k) && count[k] > 0)
    .map((k) => ({ heir: k, count: count[k], total: total.get(k) as Frac, each: div(total.get(k) as Frac, frac(count[k])) }));
  return { shares, sum: all, awl, radd, umariyyatan: umar, excluded };
}

export const fracStr = (f: Frac) => (f.d === 1n ? String(f.n) : `${f.n}/${f.d}`);
