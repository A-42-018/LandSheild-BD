/** U2.4: plain-language guidance derived from the risk level and the kinds of evidence found. Pure, so it is easy to test. */
export type StepId = "report" | "confirmOffice" | "checkSigns" | "noPay" | "takeReport" | "caseDocs" | "lawyer" | "retry";

/** Evidence codes that mean an open case, khas land, acquisition or mortgage is on record. */
export const CASE_CODES = ["ACTIVE_LITIGATION", "KHAS_LAND", "UNDER_ACQUISITION", "ACTIVE_MORTGAGE"] as const;

export function hasOpenCase(codes: readonly string[]): boolean {
  return codes.some((c) => (CASE_CODES as readonly string[]).includes(c));
}

/** One to three concrete next steps, most urgent first. */
export function nextSteps(level: string | null | undefined, codes: readonly string[]): StepId[] {
  const flagged = hasOpenCase(codes);
  switch (level) {
    case "LOW":
      return ["confirmOffice", "report"];
    case "MEDIUM":
      return flagged ? ["checkSigns", "caseDocs", "confirmOffice"] : ["checkSigns", "confirmOffice", "report"];
    case "HIGH":
      return flagged ? ["noPay", "caseDocs", "takeReport"] : ["noPay", "takeReport", "lawyer"];
    default:
      return ["retry", "confirmOffice"];
  }
}
