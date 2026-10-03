import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import Hero from "./Hero";
import { AuthProvider } from "@/features/auth/AuthContext";
import type { ApiClient } from "@/lib/api";
import Footer from "./Footer";
import Stats from "./Stats";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const client = (role: string | null) =>
  ({ refresh: vi.fn().mockImplementation(() => role ? Promise.resolve({ user: { id: "1", name: "U", email: "u@x.co", role, preferred_language: "en" } }) : Promise.reject(new Error("anon"))) }) as unknown as ApiClient;

const wrap = (ui: React.ReactNode, locale: "en" | "bn" = "en", role: string | null = "OFFICER") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
    <AuthProvider client={client(role)}>{ui}</AuthProvider>
  </NextIntlClientProvider>
);

describe("landing", () => {
  it("hero shows tagline, Verify Land + Upload Doc (officer) CTAs, icon card and disclaimer", async () => {
    render(wrap(<Hero />));
    expect(screen.getByText(en.common.tagline)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.landing.ctaVerify })).toHaveAttribute("href", "/verify");
    expect(await screen.findByRole("link", { name: en.landing.ctaUpload })).toHaveAttribute("href", "/officer/upload");
    expect(screen.queryByRole("link", { name: en.landing.ctaLogin })).not.toBeInTheDocument();
    expect(screen.getByText(en.landing.disclaimer)).toBeInTheDocument();
  });
  it.each(["CITIZEN", "REVIEWER", null])("hero hides Upload Doc for %s", async (role) => {
    render(wrap(<Hero />, "en", role));
    expect(screen.getByRole("link", { name: en.landing.ctaVerify })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("link", { name: en.landing.ctaUpload })).not.toBeInTheDocument();
  });
  it("renders in Bangla", async () => {
    render(wrap(<Hero />, "bn"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(bn.home.title);
    expect(screen.getByRole("link", { name: bn.landing.ctaVerify })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: bn.landing.ctaUpload })).toBeInTheDocument();
  });
  it("footer has labelled nav and disclaimer", () => {
    render(wrap(<Footer />));
    expect(screen.getByRole("navigation", { name: en.landing.footerNav })).toBeInTheDocument();
    expect(screen.getByText(en.landing.disclaimer)).toBeInTheDocument();
  });
});

import AboutPage from "../../app/[locale]/about/page";
import { Features, HowItWorks, Problem, Trust } from "./Sections";

vi.mock("next-intl/server", () => ({ setRequestLocale: () => {} }));

describe("landing sections (P32)", () => {
  it.each(["en", "bn"] as const)("renders all four sections with 6 steps (%s)", (loc) => {
    const m = loc === "en" ? en : bn;
    render(wrap(<><Problem /><HowItWorks /><Features /><Trust /></>, loc));
    expect(screen.getAllByTestId("how-step")).toHaveLength(6);
    expect(screen.getAllByTestId("feature")).toHaveLength(5);
    expect(screen.getAllByTestId("trust-item")).toHaveLength(5);
    for (const h of [m.landing.problem.title, m.landing.how.title, m.landing.features.title, m.landing.trust.title])
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
  });
  it("about page has purpose, limitations, demo data and non-legal notice", () => {
    render(wrap(<AboutPage params={{ locale: "en" }} />));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.about.title);
    for (const h of [en.about.purpose.title, en.about.limits.title, en.about.demo.title, en.about.notice.title])
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});

describe("landing UD4", () => {
  it.each(["en", "bn"] as const)("hero logo is decorative, stat tiles render, no remote images (%s)", (loc) => {
    const m = loc === "en" ? en : bn;
    const { container } = render(wrap(<><Hero /><Stats /></>, loc));
    expect(screen.getAllByTestId("stat")).toHaveLength(4);
    expect(screen.getByText(m.landing.stats.fields.label)).toBeInTheDocument();
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    for (const i of imgs) expect(i.getAttribute("src")).toMatch(/^\/brand\//);
  });
});
