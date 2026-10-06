import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import Hero from "./Hero";
import { AuthProvider } from "@/features/auth/AuthContext";
import type { ApiClient } from "@/lib/api";
import Footer from "./Footer";
import { HowItWorks, OfficerBand, ServiceTiles, Trust, WhatWeCheck } from "./Sections";
import AboutPage from "../../app/[locale]/about/page";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: () => {} }));

const client = (role: string | null) =>
  ({ refresh: vi.fn().mockImplementation(() => role ? Promise.resolve({ user: { id: "1", name: "U", email: "u@x.co", role, preferred_language: "en" } }) : Promise.reject(new Error("anon"))) }) as unknown as ApiClient;

const wrap = (ui: React.ReactNode, locale: "en" | "bn" = "en", role: string | null = "OFFICER") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider client={client(role)}>{ui}</AuthProvider>
    </QueryClientProvider>
  </NextIntlClientProvider>
);

describe("landing hero (U5)", () => {
  it.each(["en", "bn"] as const)("H1 + inline compact search form, no logo image (%s)", (loc) => {
    const m = loc === "en" ? en : bn;
    const { container } = render(wrap(<Hero />, loc));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(m.home.title);
    const form = screen.getByRole("form", { name: m.verify.title });
    expect(form).toBeInTheDocument();
    for (const l of [m.verify.district, m.verify.upazila, m.verify.mouza, m.verify.khatian, m.verify.dag])
      expect(screen.getByLabelText(new RegExp(`^${l}`))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(m.verify.submit) })).toBeInTheDocument();
    expect(screen.queryByText(m.verify.demoNote)).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("landing sections (U5)", () => {
  it.each(["en", "bn"] as const)("tiles, checks, 5 steps, officer band, trust (%s)", (loc) => {
    const m = loc === "en" ? en : bn;
    render(wrap(<><ServiceTiles /><WhatWeCheck /><HowItWorks /><OfficerBand /><Trust /></>, loc, null));
    const tiles = screen.getAllByTestId("service-tile");
    expect(tiles.map((a) => a.getAttribute("href"))).toEqual(["/verify", "/check", "/verify-document"]);
    expect(screen.getAllByTestId("check-item")).toHaveLength(6);
    expect(screen.getAllByTestId("how-step")).toHaveLength(5);
    expect(screen.getAllByTestId("officer-item")).toHaveLength(4);
    expect(screen.getAllByTestId("trust-item")).toHaveLength(5);
    for (const h of [m.landing.services.title, m.landing.checks.title, m.landing.how.title, m.landing.officer.title, m.landing.trust.title])
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: m.landing.officer.signIn })).toHaveAttribute("href", "/login");
  });
  it("officer band shows Upload for officers", async () => {
    render(wrap(<OfficerBand />));
    expect(await screen.findByRole("link", { name: en.landing.ctaUpload })).toHaveAttribute("href", "/officer/upload");
    expect(screen.queryByRole("link", { name: en.landing.officer.signIn })).not.toBeInTheDocument();
  });
  it.each(["CITIZEN", "REVIEWER"])("officer band hides Upload for %s", async (role) => {
    render(wrap(<OfficerBand />, "en", role));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("link", { name: en.landing.ctaUpload })).not.toBeInTheDocument();
  });
  it("footer has labelled nav and disclaimer", () => {
    render(wrap(<Footer />));
    expect(screen.getByRole("navigation", { name: en.landing.footerNav })).toBeInTheDocument();
    expect(screen.getByText(en.landing.disclaimer)).toBeInTheDocument();
  });
  it("about page has purpose, limitations, demo data and non-legal notice", () => {
    render(wrap(<AboutPage params={{ locale: "en" }} />));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.about.title);
    for (const h of [en.about.purpose.title, en.about.limits.title, en.about.demo.title, en.about.notice.title])
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});
