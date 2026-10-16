import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import TopStrip from "./TopStrip";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/about",
  Link: ({ href, locale, children, ...rest }: any) => <a href={`/${locale}${href}`} {...rest}>{children}</a>,
}));

const wrap = (locale: "en" | "bn") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
    <TopStrip />
  </NextIntlClientProvider>
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T10:00:00Z"));
  window.localStorage.clear();
  document.documentElement.style.fontSize = "";
  document.documentElement.classList.remove("contrast");
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("TopStrip (U1.1)", () => {
  it("shows today's Bangla and Gregorian date in Bangla digits", () => {
    render(wrap("bn"));
    const strip = screen.getByTestId("top-strip");
    expect(strip).toHaveTextContent("২ কার্তিক ১৪৩৩ বঙ্গাব্দ");
    expect(strip).toHaveTextContent("১৭ অক্টোবর ২০২৬ খ্রিস্টাব্দ");
    expect(strip).toHaveTextContent("শনিবার");
  });

  it("English shows the Bangla-calendar date with Latin digits", () => {
    render(wrap("en"));
    expect(screen.getByTestId("top-strip")).toHaveTextContent("2 Kartik 1433 BS");
  });

  it("language pill lists বাং then EN, marks the current page language and keeps the path", () => {
    render(wrap("bn"));
    const lang = screen.getByRole("navigation", { name: bn.common.language });
    expect(within(lang).getAllByRole("link").map((a) => a.textContent)).toEqual(["বাং", "EN"]);
    expect(screen.getByRole("link", { name: "বাংলা" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/en/about");
  });

  it("text size steps 100 -> 112.5 -> 125, stops at the ends, resets with A, and is stored", () => {
    render(wrap("en"));
    const smaller = screen.getByRole("button", { name: en.strip.smaller });
    const larger = screen.getByRole("button", { name: en.strip.larger });
    const normal = screen.getByRole("button", { name: en.strip.normal });
    expect(smaller).toBeDisabled();
    expect(normal).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(larger);
    expect(document.documentElement.style.fontSize).toBe("112.5%");
    expect(window.localStorage.getItem("ls-text-size")).toBe("112.5");
    fireEvent.click(larger);
    expect(document.documentElement.style.fontSize).toBe("125%");
    expect(larger).toBeDisabled();
    fireEvent.click(smaller);
    expect(document.documentElement.style.fontSize).toBe("112.5%");
    fireEvent.click(normal);
    expect(document.documentElement.style.fontSize).toBe("");
    expect(normal).toHaveAttribute("aria-pressed", "true");
  });

  it("restores a saved text size and contrast choice", () => {
    window.localStorage.setItem("ls-text-size", "125");
    window.localStorage.setItem("ls-contrast", "high");
    render(wrap("en"));
    expect(screen.getByRole("button", { name: en.strip.larger })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.strip.contrast })).toHaveAttribute("aria-pressed", "true");
  });

  it("high contrast toggles the html class and the stored choice", () => {
    render(wrap("bn"));
    const btn = screen.getByRole("button", { name: bn.strip.contrast });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(document.documentElement.classList.contains("contrast")).toBe(true);
    expect(window.localStorage.getItem("ls-contrast")).toBe("high");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn);
    expect(document.documentElement.classList.contains("contrast")).toBe(false);
    expect(window.localStorage.getItem("ls-contrast")).toBeNull();
  });
});
