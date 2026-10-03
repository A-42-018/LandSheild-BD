import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ThemeToggle from "./ThemeToggle";

const setup = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ThemeToggle />
    </NextIntlClientProvider>,
  );

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("switches to dark, stores the choice and marks the button pressed", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: en.theme.dark }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("ls-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: en.theme.dark })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches back to light", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: en.theme.dark }));
    fireEvent.click(screen.getByRole("button", { name: en.theme.light }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("ls-theme")).toBe("light");
  });

  it("restores the saved mode on mount", () => {
    window.localStorage.setItem("ls-theme", "dark");
    setup();
    expect(screen.getByRole("button", { name: en.theme.dark })).toHaveAttribute("aria-pressed", "true");
  });

  it("is a labelled group", () => {
    setup();
    expect(screen.getByRole("group", { name: en.theme.label })).toBeInTheDocument();
  });
});

describe("ThemeToggle header variant", () => {
  const setupBrand = () =>
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ThemeToggle variant="onBrand" />
      </NextIntlClientProvider>,
    );

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("shows only sun and moon (no system button)", () => {
    setupBrand();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: en.theme.system })).not.toBeInTheDocument();
  });

  it("toggles dark and back", () => {
    setupBrand();
    fireEvent.click(screen.getByRole("button", { name: en.theme.dark }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: en.theme.dark })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: en.theme.light })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: en.theme.light }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
