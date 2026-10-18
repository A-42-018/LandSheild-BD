import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { evidenceKey, evidenceValues } from "./evidence";
import type { Evidence } from "./types";

function sentence(e: Evidence, locale: "bn" | "en"): string {
  const t = createTranslator({ locale, messages: locale === "bn" ? bn : en });
  return t(evidenceKey(e.code) as never, evidenceValues(e, t as never, locale));
}

const DUP: Evidence = {
  code: "POSSIBLE_DUPLICATE_TRANSACTION",
  severity: "HIGH",
  params: { transaction_count: 2, total_area: 40, recorded_area: 20, area_unit: "decimal" },
};

describe("evidenceValues", () => {
  it("shows counts, areas and units in Bangla", () => {
    const s = sentence(DUP, "bn");
    expect(s).toContain("একই বিক্রেতার ২টি লেনদেনে ৪০ শতাংশ হস্তান্তর");
    expect(s).toContain("নথিভুক্ত পরিমাণ ২০ শতাংশ");
    expect(s).not.toMatch(/[0-9]/);
  });

  it("localizes day spans, owner counts and decimal areas", () => {
    const cases: Evidence[] = [
      { code: "REPEATED_SUSPICIOUS_TRANSACTIONS", severity: "MEDIUM", params: { transaction_count: 3, window_days: 180, first_date: "2024-01-05", last_date: "2024-05-01" } },
      { code: "REGISTERED_NOT_MUTATED", severity: "MEDIUM", params: { transaction_date: "2024-01-05", grace_days: 90 } },
      { code: "RAPID_RESALE", severity: "MEDIUM", params: { transaction_date: "2024-03-01", held_days: 45, acquired_on: "2024-01-15" } },
      { code: "AREA_MISMATCH", severity: "MEDIUM", params: { document_area: 12.5, previous_area: "10", area_unit: "katha" } },
      { code: "MUTATION_AREA_EXCEEDS_DEED", severity: "HIGH", params: { mutation_area: 33, mutation_unit: "decimal", deed_area: 0.25, deed_unit: "acre" } },
      { code: "SURVEY_CHAIN_GAP", severity: "MEDIUM", params: { from_survey: "CS", to_survey: "RS", unlinked_owners: 2, owners_in_later_survey: 5 } },
      { code: "HISTORICAL_CHAIN_GAP", severity: "MEDIUM", params: { transaction_date: "1944-03-01", from_survey: "CS", to_survey: "SA", document_id: "d1" } },
      { code: "HISTORICAL_SELLER_NOT_OWNER", severity: "MEDIUM", params: { transaction_date: "1944-03-01", surveys: ["CS"], document_id: "d1" } },
      { code: "HISTORICAL_DAG_CONFLICT", severity: "MEDIUM", params: { transaction_date: "1950-05-01", earlier_date: "1944-03-01", basis: "DAG", dags: ["123", "124"] } },
      { code: "HISTORICAL_CONSIDERATION_IMPLAUSIBLE", severity: "MEDIUM", params: { transaction_date: "1944-03-01", reason: "ABOVE_RANGE", currency: "INR", per_decimal: 9000, range_low: 0.5, range_high: 600 } },
    ];
    for (const e of cases) expect(sentence(e, "bn"), e.code).not.toMatch(/[0-9]/);
    expect(sentence(cases[3], "bn")).toContain("১২.৫ কাঠা");
    expect(sentence(cases[4], "bn")).toContain("৩৩ শতাংশ দলিলের পরিমাণ ০.২৫ একর");
  });

  it("keeps deed numbers as recorded and English digits in English", () => {
    const deed: Evidence = { code: "DUPLICATE_DEED", severity: "HIGH", params: { deed_no: "1234/2019", transaction_count: 2 } };
    expect(sentence(deed, "bn")).toContain("দলিল নম্বর 1234/2019 ২টি লেনদেনে");
    expect(sentence(DUP, "en")).toContain("2 transactions by the same seller convey 40 decimal, against 20 decimal recorded");
  });
});
