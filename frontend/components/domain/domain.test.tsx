import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import bn from "../../messages/bn.json";
import en from "../../messages/en.json";
import RiskBadge, { RISK_TONE } from "./RiskBadge";
import StatusBadge, { STATUS_TONE } from "./StatusBadge";

const wrap = (locale: "en" | "bn", ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
      {ui}
    </NextIntlClientProvider>,
  );

describe("StatusBadge", () => {
  it("maps REVIEW_REQUIRED to i18n text + review tone (EN/BN)", () => {
    const { unmount } = wrap("en", <StatusBadge code="REVIEW_REQUIRED" />);
    expect(screen.getByText("Review Required")).toHaveAttribute("data-tone", "review");
    unmount();
    wrap("bn", <StatusBadge code="REVIEW_REQUIRED" />);
    expect(screen.getByText("যাচাই প্রয়োজন")).toBeInTheDocument();
  });
  it("falls back to raw code for unknown values", () => {
    wrap("en", <StatusBadge code="WEIRD" />);
    expect(screen.getByText("WEIRD")).toHaveAttribute("data-tone", "pending");
  });
  it("every mapped code has EN and BN keys", () => {
    for (const code of Object.keys(STATUS_TONE)) {
      expect(en.status).toHaveProperty(code);
      expect(bn.status).toHaveProperty(code);
    }
  });
});

describe("RiskBadge", () => {
  it("maps HIGH → High / উচ্চ with critical tone", () => {
    const { unmount } = wrap("en", <RiskBadge level="HIGH" />);
    expect(screen.getByText("High")).toHaveAttribute("data-tone", "critical");
    unmount();
    wrap("bn", <RiskBadge level="HIGH" />);
    expect(screen.getByText("উচ্চ")).toBeInTheDocument();
  });
  it("LOW verified, MEDIUM review; keys exist in both locales", () => {
    expect(RISK_TONE.LOW).toBe("verified");
    expect(RISK_TONE.MEDIUM).toBe("review");
    for (const l of Object.keys(RISK_TONE)) {
      expect(en.risk.level).toHaveProperty(l);
      expect(bn.risk.level).toHaveProperty(l);
    }
  });
});
