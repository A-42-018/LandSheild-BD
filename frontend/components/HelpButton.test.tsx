import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import HelpButton from "./HelpButton";

let path = "/";
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => path,
}));

const wrap = (locale: "en" | "bn") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
    <HelpButton />
    <button>elsewhere</button>
  </NextIntlClientProvider>
);

afterEach(() => {
  cleanup();
  path = "/";
});

describe("HelpButton (U1.6)", () => {
  it("starts closed: a named button, the panel is hidden", () => {
    render(wrap("en"));
    const btn = screen.getByRole("button", { name: en.help.button });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: en.help.links.faq })).not.toBeInTheDocument();
  });

  it("opens to FAQ, guide and feedback, with no phone link", () => {
    render(wrap("en"));
    fireEvent.click(screen.getByRole("button", { name: en.help.button }));
    expect(screen.getByRole("button", { name: en.help.button })).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: en.help.panelLabel });
    expect(within(panel).getByRole("link", { name: en.help.links.faq })).toHaveAttribute("href", "/faq");
    expect(within(panel).getByRole("link", { name: en.help.links.guide })).toHaveAttribute("href", "/guide");
    expect(within(panel).getByRole("link", { name: en.help.links.feedback })).toHaveAttribute("href", "/feedback");
    expect(panel.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it("Escape closes it and returns focus to the button", () => {
    render(wrap("en"));
    const btn = screen.getByRole("button", { name: en.help.button });
    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveFocus();
  });

  it("closes on a click outside and when the page changes", () => {
    const { rerender } = render(wrap("en"));
    const btn = screen.getByRole("button", { name: en.help.button });
    fireEvent.click(btn);
    fireEvent.mouseDown(screen.getByText("elsewhere"));
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    path = "/faq";
    rerender(wrap("en"));
    expect(screen.getByRole("button", { name: en.help.button })).toHaveAttribute("aria-expanded", "false");
  });

  it("passes axe, closed and open, in both locales", async () => {
    for (const locale of ["en", "bn"] as const) {
      const { container } = render(wrap(locale));
      const opts = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
      expect((await axe.run(container, opts)).violations.map((v) => v.id)).toEqual([]);
      fireEvent.click(screen.getByRole("button", { name: (locale === "en" ? en : bn).help.button }));
      expect((await axe.run(container, opts)).violations.map((v) => v.id)).toEqual([]);
      cleanup();
    }
  });
});
