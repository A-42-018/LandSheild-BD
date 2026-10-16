import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import { NOTICES } from "@/features/notices/notices";
import NoticeTicker from "./NoticeTicker";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

const wrap = (locale: "en" | "bn") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
    <NoticeTicker />
  </NextIntlClientProvider>
);

afterEach(cleanup);

describe("NoticeTicker (U1.4)", () => {
  const flagged = NOTICES.filter((n) => n.ticker);

  it("scrolls only the notices flagged for the ticker, each linking to its card on the board", () => {
    render(wrap("en"));
    const region = screen.getByRole("region", { name: en.ticker.label });
    const links = within(region).getAllByRole("link", { name: /\d{4}/ }); // the copy for the loop is hidden from this query
    expect(links).toHaveLength(flagged.length);
    for (const [i, n] of flagged.entries()) {
      expect(links[i]).toHaveAttribute("href", `/#notice-${n.id}`);
      expect(links[i]).toHaveTextContent(en.landing.notices.items[n.id].title);
    }
    expect(screen.queryByText(en.landing.notices.items.n3.title, { selector: "a span" })).not.toBeInTheDocument();
  });

  it("the loop copy is hidden from screen readers and out of the tab order", () => {
    const { container } = render(wrap("en"));
    const copy = container.querySelector(".ticker-copy")!;
    expect(copy).toHaveAttribute("aria-hidden", "true");
    for (const a of copy.querySelectorAll("a")) expect(a).toHaveAttribute("tabindex", "-1");
  });

  it("shows Bangla dates with Bangla digits", () => {
    render(wrap("bn"));
    const region = screen.getByRole("region", { name: bn.ticker.label });
    expect(region).toHaveTextContent("১৪ অক্টো");
    expect(region).toHaveTextContent("২০২৬");
    expect(region.textContent).not.toMatch(/[0-9]/);
  });

  it("pause button toggles the paused state and its name", () => {
    render(wrap("en"));
    const region = screen.getByTestId("notice-ticker");
    const btn = screen.getByRole("button", { name: en.ticker.pause });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(region).toHaveAttribute("data-paused", "false");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: en.ticker.play })).toHaveAttribute("aria-pressed", "true");
    expect(region).toHaveAttribute("data-paused", "true");
  });

  it("links to the whole notice list", () => {
    render(wrap("en"));
    expect(screen.getByRole("link", { name: en.ticker.all })).toHaveAttribute("href", "/#notices-title");
  });

  it("passes axe in both locales", async () => {
    for (const locale of ["en", "bn"] as const) {
      const { container } = render(wrap(locale));
      const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(res.violations.map((v) => v.id)).toEqual([]);
      cleanup();
    }
  });
});
