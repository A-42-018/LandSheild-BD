import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import bn from "../../messages/bn.json";
import en from "../../messages/en.json";
import RiskIndicator, { RISK_ICON, RISK_LEVELS, RISK_TONE, type RiskIndicatorSize } from "./RiskIndicator";

const MESSAGES = { en, bn } as const;
type Locale = keyof typeof MESSAGES;

const wrap = (locale: Locale, ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );

const SIZES: RiskIndicatorSize[] = ["sm", "md", "lg"];

describe("RiskIndicator (U0.3): colour + icon + word", () => {
  for (const locale of ["en", "bn"] as const) {
    const m = MESSAGES[locale];
    for (const level of RISK_LEVELS) {
      for (const size of SIZES) {
        it(`${locale} ${level} ${size}: tone, icon and "${m.risk.label}: ${m.risk.level[level]}"`, () => {
          const { container } = wrap(locale, <RiskIndicator level={level} size={size} />);
          const root = container.firstElementChild as HTMLElement;
          expect(root).toHaveAttribute("data-risk", level);
          expect(root).toHaveAttribute("data-tone", RISK_TONE[level]);
          // colour comes from the tone classes, never inline styles
          expect(root.outerHTML).toMatch(new RegExp(`text-${RISK_TONE[level]}\\b`));
          // an icon, hidden from screen readers (the word carries the meaning)
          const svg = root.querySelector("svg");
          expect(svg).not.toBeNull();
          expect(svg!.closest("[aria-hidden='true']")).not.toBeNull();
          // the word and the "Risk:" prefix
          expect(screen.getByText(m.risk.level[level])).toBeVisible();
          expect(root).toHaveTextContent(`${m.risk.label}: ${m.risk.level[level]}`);
          // never a bare score
          expect(root.textContent).not.toMatch(/[0-9০-৯]/);
        });
      }
    }
  }

  it("uses a different icon shape per level", () => {
    expect(new Set(RISK_LEVELS.map((l) => RISK_ICON[l])).size).toBe(RISK_LEVELS.length);
    const shapes = RISK_LEVELS.map((level) => {
      const { container, unmount } = wrap("en", <RiskIndicator level={level} />);
      const html = container.querySelector("svg")!.innerHTML;
      unmount();
      return html;
    });
    expect(new Set(shapes).size).toBe(3);
  });

  it("maps LOW / MEDIUM / HIGH to verified / review / critical", () => {
    expect(RISK_TONE).toMatchObject({ LOW: "verified", MEDIUM: "review", HIGH: "critical" });
  });

  it("keeps the prefix for screen readers when the visible label is hidden", () => {
    const { container } = wrap("bn", <RiskIndicator level="HIGH" size="sm" showLabel={false} />);
    const prefix = screen.getByText(`${bn.risk.label}:`);
    expect(prefix).toHaveClass("sr-only");
    expect(container.firstElementChild).toHaveTextContent("ঝুঁকি: উচ্চ");
  });

  it("shows a neutral 'not known' (with icon) for null or unknown levels", () => {
    for (const level of [null, undefined, "", "WEIRD"]) {
      const { container, unmount } = wrap("en", <RiskIndicator level={level} />);
      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute("data-risk", "UNKNOWN");
      expect(root).toHaveAttribute("data-tone", "pending");
      expect(root.querySelector("svg")).not.toBeNull();
      expect(root).toHaveTextContent(`${en.risk.label}: ${en.risk.level.UNKNOWN}`);
      unmount();
    }
  });

  it("has the strings in both locales, with no Latin digits in Bangla", () => {
    for (const l of [...RISK_LEVELS, "UNKNOWN"] as const) {
      expect(en.risk.level[l]).toBeTruthy();
      expect(bn.risk.level[l]).toBeTruthy();
      expect(bn.risk.level[l]).not.toMatch(/[0-9]/);
    }
    expect(bn.risk.label).toBe("ঝুঁকি");
    expect(bn.risk.level).toMatchObject({ HIGH: "উচ্চ", MEDIUM: "মাঝারি", LOW: "নিম্ন" });
  });

  it("passes axe in every size, both locales", async () => {
    for (const locale of ["en", "bn"] as const) {
      const { container, unmount } = wrap(
        locale,
        <div>
          {SIZES.flatMap((size) => [...RISK_LEVELS, "UNKNOWN"].map((l) => <RiskIndicator key={`${size}-${l}`} level={l} size={size} showLabel={size !== "sm"} />))}
        </div>,
      );
      const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(res.violations.map((v) => v.id)).toEqual([]);
      unmount();
    }
  });
});
