const BN = "০১২৩৪৫৬৭৮৯";

/** Parse a user-typed number: Bangla digits, "," grouping and a decimal point or "٫" are accepted. NaN when invalid. */
export function parseNum(raw: string): number {
  const s = raw
    .trim()
    .replace(/[০-৯]/g, (d) => String(BN.indexOf(d)))
    .replace(/[,\s]/g, "")
    .replace("٫", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return Number.NaN;
  return Number(s);
}
