import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import RiskCard from "./RiskCard";
import { evidenceValues } from "./evidence";
import type { RiskAssessment } from "./types";

// Runtime numbers from the API must show Bangla digits in bn (the bn.json check only covers static copy).
const t = Object.assign((k: string) => k, { has: () => false });

describe("evidenceValues numbers", () => {
  it("formats counts and areas with the locale's digits", () => {
    const params = {
      transaction_count: 2, total_area: 20, recorded_area: 12.5, held_days: 9, window_days: 90,
      grace_days: 30, document_area: 1500, previous_area: "7.25", mutation_area: 3, deed_area: 2,
      unlinked_owners: 4, owners_in_later_survey: 11,
    };
    const bnVals = evidenceValues({ code: "X", severity: "HIGH", params }, t, "bn");
    expect(bnVals).toMatchObject({
      count: "২", total: "২০", recorded: "১২.৫", heldDays: "৯", windowDays: "৯০", graceDays: "৩০",
      documentArea: "১,৫০০", previousArea: "৭.২৫", mutationArea: "৩", deedArea: "২", unlinked: "৪", owners: "১১",
    });
    const enVals = evidenceValues({ code: "X", severity: "HIGH", params }, t, "en");
    expect(enVals).toMatchObject({ count: "2", total: "20", recorded: "12.5", documentArea: "1,500" });
  });

  it("leaves missing params empty", () => {
    expect(evidenceValues({ code: "X", severity: "LOW", params: {} }, t, "bn")).toMatchObject({ count: "", total: "", windowDays: "" });
  });
});

const RISK: RiskAssessment = {
  land_id: "LP-10240",
  overall_score: 70,
  risk_level: "HIGH",
  rule_score: 70,
  assessed_at: "2026-10-01T10:00:00Z",
  evidence: [
    { code: "POSSIBLE_DUPLICATE_TRANSACTION", severity: "HIGH", params: { transaction_count: 2, total_area: 20, recorded_area: 10, area_unit: "decimal" } },
    { code: "DUPLICATE_DEED", severity: "HIGH", params: { deed_no: "দলিল", transaction_count: 3 } },
    { code: "AREA_MISMATCH", severity: "MEDIUM", params: { document_area: 15, previous_area: 12, area_unit: "decimal" } },
    { code: "REPEATED_SUSPICIOUS_TRANSACTIONS", severity: "MEDIUM", params: { window_days: 90, transaction_count: 4, first_date: "2024-01-05", last_date: "2024-03-20" } },
    { code: "REGISTERED_NOT_MUTATED", severity: "MEDIUM", params: { transaction_date: "2024-01-05", grace_days: 30 } },
    { code: "RAPID_RESALE", severity: "MEDIUM", params: { transaction_date: "2024-01-05", held_days: 12, acquired_on: "2023-12-24" } },
    { code: "MUTATION_AREA_EXCEEDS_DEED", severity: "MEDIUM", params: { mutation_area: 5, mutation_unit: "decimal", deed_area: 4, deed_unit: "decimal" } },
    { code: "SURVEY_CHAIN_GAP", severity: "LOW", params: { from_survey: "সিএস", to_survey: "আরএস", unlinked_owners: 2, owners_in_later_survey: 6 } },
  ],
};

describe("RiskCard evidence digits", () => {
  it("shows no Latin digits in the Bangla evidence text", () => {
    render(
      <NextIntlClientProvider locale="bn" messages={bn}>
        <RiskCard risk={RISK} />
      </NextIntlClientProvider>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(RISK.evidence.length);
    expect(items[0]).toHaveTextContent("একই বিক্রেতার ২টি লেনদেনে ২০");
    for (const li of items) expect(li.textContent).not.toMatch(/[0-9]/);
  });

  it("keeps Latin digits in English", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <RiskCard risk={RISK} />
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByRole("listitem")[0].textContent).toMatch(/2 transactions/);
  });
});
