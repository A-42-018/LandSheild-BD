import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import RiskCard from "./RiskCard";
import { EVIDENCE_CODES } from "./evidence";
import type { RiskAssessment } from "./types";

const HIGH: RiskAssessment = {
  land_id: "LP-10240",
  overall_score: 70,
  risk_level: "HIGH",
  rule_score: 70,
  assessed_at: "2026-10-01T10:00:00Z",
  evidence: [
    { code: "POSSIBLE_DUPLICATE_TRANSACTION", severity: "HIGH", params: { transaction_count: 2, total_area: 40, recorded_area: 20, area_unit: "decimal" } },
    { code: "SELLER_MISMATCH", severity: "HIGH", params: { transaction_date: "2019-06-20" } },
  ],
};

function show(risk: RiskAssessment, messages: any = en, locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RiskCard risk={risk} />
    </NextIntlClientProvider>,
  );
}

describe("RiskCard", () => {
  it("leads with the level (icon + word), score secondary, plain bar and every evidence item (EN)", () => {
    show(HIGH);
    const level = screen.getByTestId("risk-level");
    expect(level).toHaveAttribute("data-risk", "HIGH");
    expect(level).toHaveTextContent("Risk: High");
    expect(level.querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("risk-score")).toHaveTextContent("Risk score 70 of 100");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "70");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "Risk: High (70 / 100)");
    const items = within(screen.getByRole("list", { name: en.risk.evidenceTitle })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Possible duplicate transaction");
    expect(items[0]).toHaveTextContent("2 transactions");
    expect(items[0]).toHaveTextContent("40 decimal");
    expect(items[1]).toHaveTextContent("Potential inconsistency");
  });

  it("renders the same evidence in Bangla, with the level as ঝুঁকি: উচ্চ and Bangla digits in the score", () => {
    show(HIGH, bn, "bn");
    expect(screen.getByTestId("risk-level")).toHaveTextContent("ঝুঁকি: উচ্চ");
    expect(screen.getByTestId("risk-score")).toHaveTextContent("ঝুঁকির হিসাবে ১০০-এর মধ্যে ৭০");
    expect(screen.getByTestId("risk-score").textContent).not.toMatch(/[0-9]/);
    expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toBe("ঝুঁকি: উচ্চ (৭০ / ১০০)");
    const items = within(screen.getByRole("list", { name: bn.risk.evidenceTitle })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("সম্ভাব্য দ্বৈত লেনদেন");
    expect(items[0]).not.toHaveTextContent("{");
  });

  it("shows an empty evidence message for a clean parcel", () => {
    show({ ...HIGH, overall_score: 0, risk_level: "LOW", rule_score: 0, evidence: [] });
    expect(screen.getByText(en.risk.noEvidence)).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders ownership kinds and falls back for unknown codes without crashing", () => {
    show({
      ...HIGH,
      evidence: [
        { code: "INCONSISTENT_OWNERSHIP", severity: "MEDIUM", params: { kind: "GAP", first_end: "2012-03-15", second_start: "2013-01-01" } },
        { code: "INCONSISTENT_OWNERSHIP", severity: "MEDIUM", params: { kind: "OVERLAP", first_start: "2010-01-01", first_end: null, second_start: "2012-01-01", second_end: null } },
        { code: "SOMETHING_NEW", severity: "INFO", params: {} },
      ],
    });
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("gap in ownership records");
    expect(items[1]).toHaveTextContent("Ownership conflict detected");
    expect(items[2]).toHaveTextContent("SOMETHING_NEW");
  });

  it("shows the ML line with percent and points (EN) and hides it when ML was skipped", () => {
    const withMl: RiskAssessment = {
      ...HIGH,
      ml_score: 0.62,
      evidence: [
        ...HIGH.evidence,
        { code: "ML_ANOMALY", severity: "INFO", params: { score: 0.62, points: 9 } },
      ],
    };
    const { unmount } = show(withMl);
    const line = screen.getByTestId("risk-ml");
    expect(line).toHaveTextContent("62%");
    expect(line).toHaveTextContent("Adds 9 points to the score.");
    expect(line).toHaveTextContent("never sets a risk level on its own");
    expect(line.textContent).not.toContain("{");
    unmount();
    show({ ...HIGH, ml_score: null });
    expect(screen.queryByTestId("risk-ml")).toBeNull();
  });

  it("shows the ML line in Bangla and 'no points' when the hint added nothing", () => {
    show({ ...HIGH, ml_score: 0.1 }, bn, "bn");
    const line = screen.getByTestId("risk-ml");
    expect(line.textContent).toMatch(/অস্বাভাবিকতা যাচাই/);
    expect(line.textContent).toMatch(/ঝুঁকির হিসাবে কিছু যোগ হয়নি/);
    expect(line.textContent).not.toContain("{");
  });

  it("omits the ML line when the API sends no ml_score", () => {
    show(HIGH);
    expect(screen.queryByTestId("risk-ml")).toBeNull();
  });

  it("has message text for every known evidence code in both locales", () => {
    for (const code of EVIDENCE_CODES) {
      expect((en.risk.evidence as Record<string, string>)[code]).toBeTruthy();
      expect((bn.risk.evidence as Record<string, string>)[code]).toBeTruthy();
    }
  });
});
