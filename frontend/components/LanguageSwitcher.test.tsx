import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import LanguageSwitcher from "./LanguageSwitcher";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/about",
  Link: ({ href, locale, children, ...rest }: any) => (
    <a href={`/${locale}${href}`} {...rest}>{children}</a>
  ),
}));

describe("LanguageSwitcher", () => {
  it("links to the same path in each locale and marks current", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <LanguageSwitcher />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/en/about");
    expect(screen.getByRole("link", { name: "বাংলা" })).toHaveAttribute("href", "/bn/about");
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "true");
  });
});
