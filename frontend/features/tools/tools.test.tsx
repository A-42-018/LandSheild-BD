import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { CitizenTools } from "@/features/landing/Sections";
import FeeCalculator from "./FeeCalculator";
import InheritanceCalculator from "./InheritanceCalculator";
import ToolsHub from "./ToolsHub";
import UnitConverter from "./UnitConverter";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/tools",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const wrap = (ui: React.ReactNode, locale: "en" | "bn" = "en") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>{ui}</NextIntlClientProvider>
);
afterEach(cleanup);

const type = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });

describe("unit converter", () => {
  it("converts and re-converts when the unit or region changes", () => {
    render(wrap(<UnitConverter />));
    type("Area", "1");
    fireEvent.change(screen.getByLabelText("From unit"), { target: { value: "acre" } });
    const row = within(screen.getByTestId("unit-table")).getByText("Shatangsho (decimal)").closest("tr")!;
    expect(row).toHaveTextContent("100");
    fireEvent.change(screen.getByLabelText("From unit"), { target: { value: "bigha" } });
    fireEvent.change(screen.getByLabelText("Bigha definition"), { target: { value: "decimal33" } });
    expect(within(screen.getByTestId("unit-table")).getByText("Shatangsho (decimal)").closest("tr")).toHaveTextContent("33");
  });
  it("accepts Bangla digits, flags junk, renders Bangla numerals in bn", () => {
    render(wrap(<UnitConverter />, "bn"));
    type("পরিমাণ", "১০");
    expect(screen.getByTestId("unit-table")).toHaveTextContent("৪০৪.৬৮৬");
    type("পরিমাণ", "abc");
    expect(screen.getByText(bn.tools.units.invalid)).toBeInTheDocument();
    expect(screen.queryByTestId("unit-table")).toBeNull();
  });
});

describe("empty input", () => {
  it("unit converter: untouched is fine, an emptied field shows the error", () => {
    render(wrap(<UnitConverter />));
    expect(screen.queryByText(en.tools.units.invalid)).toBeNull();
    type("Area", "");
    expect(screen.getByText(en.tools.units.invalid)).toBeInTheDocument();
    expect(screen.queryByTestId("unit-table")).toBeNull();
  });
  it("fee calculator: untouched empty is fine, emptied again shows the error", () => {
    render(wrap(<FeeCalculator />));
    expect(screen.queryByText(en.tools.fees.invalid)).toBeNull();
    type("Deed value", "5");
    type("Deed value", "");
    expect(screen.getByText(en.tools.fees.invalid)).toBeInTheDocument();
  });
});

describe("fee calculator", () => {
  it("itemises a sale and totals it", () => {
    render(wrap(<FeeCalculator />));
    expect(screen.queryByTestId("fee-table")).toBeNull();
    type("Deed value", "1000000");
    fireEvent.change(screen.getByLabelText("Location of the land"), { target: { value: "city" } });
    expect(screen.getByTestId("fee-total")).toHaveTextContent("71,100");
    expect(screen.getByText("Stamp duty")).toBeInTheDocument();
    expect(screen.getByText(en.tools.fees.official)).toBeInTheDocument();
  });
  it("inheritance hides stamp duty; Bangla total uses Bangla numerals", () => {
    render(wrap(<FeeCalculator />, "bn"));
    type("দলিলমূল্য", "1000000");
    fireEvent.change(screen.getByLabelText("হস্তান্তরের ধরন"), { target: { value: "inheritance" } });
    expect(screen.queryByText("স্ট্যাম্প শুল্ক")).toBeNull();
    expect(screen.getByTestId("fee-total")).toHaveTextContent("২,১০০");
  });
});

describe("inheritance calculator", () => {
  it("wife + son + daughter", () => {
    render(wrap(<InheritanceCalculator />));
    type("Wives (0–4)", "1"); type("Sons", "1"); type("Daughters", "1");
    const t = screen.getByTestId("faraid-table");
    expect(within(t).getByText("Wife").closest("tr")).toHaveTextContent("1/8");
    expect(within(t).getByText("Son").closest("tr")).toHaveTextContent("7/12");
    expect(within(t).getByText("Daughter").closest("tr")).toHaveTextContent("7/24");
  });
  it("shows awl note, area and blocks husband + wives", () => {
    render(wrap(<InheritanceCalculator />));
    fireEvent.click(screen.getByLabelText("Husband"));
    type("Daughters", "2");
    fireEvent.click(screen.getByLabelText("Mother"));
    type("Plot area (optional)", "130");
    expect(screen.getByTestId("faraid-notes")).toHaveTextContent("reduced in proportion (awl)");
    expect(within(screen.getByTestId("faraid-table")).getByText("Husband").closest("tr")).toHaveTextContent("3/13");
    type("Wives (0–4)", "1");
    expect(screen.getByLabelText("Husband")).toBeDisabled();
  });
  it("asks for at least one heir at the start", () => {
    render(wrap(<InheritanceCalculator />));
    expect(screen.getByText(en.tools.faraid.errors.NO_HEIRS)).toBeInTheDocument();
    expect(screen.queryByTestId("faraid-table")).toBeNull();
  });
});

describe("hub, landing tiles, accessibility", () => {
  it("lists three tools and links them", () => {
    render(wrap(<ToolsHub />));
    expect(screen.getAllByTestId("tool-tile").map((a) => a.getAttribute("href"))).toEqual(["/tools/units", "/tools/fees", "/tools/inheritance"]);
    cleanup();
    render(wrap(<CitizenTools />, "bn"));
    expect(screen.getAllByTestId("tool-tile")).toHaveLength(3);
  });
  it.each(["en", "bn"] as const)("no axe violations (%s)", async (loc) => {
    for (const ui of [<UnitConverter key="u" />, <FeeCalculator key="f" />, <InheritanceCalculator key="i" />, <ToolsHub key="h" />]) {
      const { container, unmount } = render(wrap(ui, loc));
      const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false }, "landmark-one-main": { enabled: false }, "page-has-heading-one": { enabled: false } } });
      expect(r.violations.map((v) => v.id)).toEqual([]);
      unmount();
    }
  });
});
