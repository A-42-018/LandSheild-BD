import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import Hero from "./Hero";
import { qrTarget } from "./HeroSearch";
import { AuthProvider } from "@/features/auth/AuthContext";
import type { ApiClient } from "@/lib/api";
import Footer from "./Footer";
import Backdrop, { KANTHA_TILE } from "./Backdrop";
import { HelpStrip, HomeFaq, HowItWorks, NoticeBoard, ServiceTiles, Trust, WhatWeCheck } from "./Sections";
import { HOME_FAQ_IDS } from "@/features/info/pages";
import { NOTICES } from "@/features/notices/notices";
import AboutPage from "../../app/[locale]/about/page";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
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

beforeEach(() => push.mockClear());

describe("landing hero (U1.3)", () => {
  it.each(["en", "bn"] as const)("H1, intro and a tabbed search card with the land form open (%s)", (loc) => {
    const m = loc === "en" ? en : bn;
    const { container } = render(wrap(<Hero />, loc, null));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(m.home.title);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([m.home.search.tabs.land, m.home.search.tabs.track, m.home.search.tabs.doc]);
    expect(screen.getByRole("tab", { name: m.home.search.tabs.land })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("form", { name: m.verify.title })).toBeInTheDocument();
    for (const f of [m.verify.division, m.verify.district, m.verify.upazila, m.verify.mouza, m.verify.khatian, m.verify.dag])
      expect(screen.getByLabelText(new RegExp(`^${f}`))).toBeInTheDocument();
    expect(screen.getByTestId("hero-land-note")).toHaveTextContent(m.verify.signInNote);
    expect(container.querySelector("img")).toBeNull();
  });

  it("anonymous land search goes to /verify with the answers in the query", async () => {
    render(wrap(<Hero />, "en", null));
    fireEvent.change(screen.getByLabelText(/^District/), { target: { value: "Gazipur" } });
    fireEvent.change(screen.getByLabelText(/^Upazila/), { target: { value: "Sreepur" } });
    fireEvent.change(screen.getByLabelText(/^Mouza/), { target: { value: "Barmi" } });
    fireEvent.change(screen.getByLabelText(/^Khatian/), { target: { value: "১২৪৫" } });
    fireEvent.change(screen.getByLabelText(/^Dag/), { target: { value: "785" } });
    fireEvent.click(screen.getByRole("button", { name: en.verify.submit }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify?district=Gazipur&upazila=Sreepur&mouza=Barmi&khatian=1245&dag=785"));
  });

  it("mutation tab checks the number, then opens /track?no=", () => {
    render(wrap(<Hero />, "en", null));
    fireEvent.click(screen.getByRole("tab", { name: en.home.search.tabs.track }));
    const box = screen.getByLabelText(new RegExp(`^${en.track.number}`));
    fireEvent.change(box, { target: { value: "mut-2026" } });
    fireEvent.click(screen.getByRole("button", { name: en.track.submit }));
    expect(screen.getByText(en.track.errors.format)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: " mut-2026-0009 " } });
    fireEvent.click(screen.getByRole("button", { name: en.track.submit }));
    expect(push).toHaveBeenCalledWith("/track?no=MUT-2026-0009");
  });

  it("deed tab links to the copy check and opens a pasted QR link on this site", () => {
    render(wrap(<Hero />, "bn", null));
    fireEvent.click(screen.getByRole("tab", { name: bn.home.search.tabs.doc }));
    expect(screen.getByTestId("hero-doc-link")).toHaveAttribute("href", "/verify-document");
    fireEvent.change(screen.getByLabelText(new RegExp(`^${bn.home.search.qrLabel}`)), { target: { value: "https://evil.example/bn/v/LAND-0001?d=D1&h=abc&x=1" } });
    fireEvent.click(screen.getByRole("button", { name: bn.home.search.qrSubmit }));
    expect(push).toHaveBeenCalledWith("/v/LAND-0001?d=D1&h=abc");
  });

  it("qrTarget keeps only the /v/ path and seal, rejects junk", () => {
    expect(qrTarget("LAND-0001")).toBe("/v/LAND-0001");
    expect(qrTarget("http://localhost:3000/en/v/abc123/")).toBe("/v/abc123");
    expect(qrTarget("  ")).toBeNull();
    expect(qrTarget("hello world")).toBeNull();
    expect(qrTarget("../../admin")).toBeNull();
  });
});

describe("landing sections (U5)", () => {
  it.each(["en", "bn"] as const)("tiles, checks, 5 steps, trust; no officer band (%s)", (loc) => {
    const m = loc === "en" ? en : bn;
    render(wrap(<><ServiceTiles /><WhatWeCheck /><HowItWorks /><Trust /></>, loc, null));
    const tiles = screen.getAllByTestId("service-tile");
    expect(tiles.map((a) => a.getAttribute("href"))).toEqual(["/verify", "/check", "/track", "/verify-document"]);
    expect(screen.getAllByTestId("check-item")).toHaveLength(6);
    expect(screen.getAllByTestId("how-step")).toHaveLength(5);
    expect(screen.getAllByTestId("trust-item")).toHaveLength(5);
    for (const h of [m.landing.services.title, m.landing.checks.title, m.landing.how.title, m.landing.trust.title])
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: m.landing.officer.title })).not.toBeInTheDocument();
  });
  it("footer has labelled nav and disclaimer", () => {
    render(wrap(<Footer />));
    expect(screen.getByRole("navigation", { name: en.landing.footerNav })).toBeInTheDocument();
    expect(screen.getByText(en.landing.disclaimer)).toBeInTheDocument();
  });
  it("notice board lists every notice with a date and an anchor for the ticker links (U1.4)", () => {
    render(wrap(<NoticeBoard />, "bn"));
    const items = screen.getAllByTestId("notice-item");
    expect(items).toHaveLength(NOTICES.length);
    expect(items.map((li) => li.id)).toEqual(NOTICES.map((n) => `notice-${n.id}`));
    expect(items[0]).toHaveTextContent("১৪ অক্টোবর, ২০২৬");
  });
  it.each(["en", "bn"] as const)("home FAQ shows the top five as a collapsed accordion with a link to all (U1.5, %s)", (loc) => {
    const m = loc === "en" ? en : bn;
    render(wrap(<HomeFaq />, loc, null));
    expect(screen.getByRole("heading", { level: 2, name: m.landing.faq.title })).toBeInTheDocument();
    const items = screen.getAllByTestId("faq-item") as HTMLDetailsElement[];
    expect(items).toHaveLength(5);
    expect(items.map((d) => d.querySelector("summary")?.textContent)).toEqual(HOME_FAQ_IDS.map((id) => m.info.faq[id].q));
    expect(items.every((d) => !d.open)).toBe(true);
    fireEvent.click(items[0].querySelector("summary")!);
    expect(items[0].open).toBe(true);
    expect(screen.getByRole("link", { name: m.landing.faq.more })).toHaveAttribute("href", "/faq");
  });
  it("about page has purpose, limitations, demo data and non-legal notice", () => {
    render(wrap(<AboutPage params={{ locale: "en" }} />));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.about.title);
    for (const h of [en.about.purpose.title, en.about.limits.title, en.about.demo.title, en.about.notice.title])
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5); // 4 limits + the Home breadcrumb
  });
});

describe("hotline strip (U1.6)", () => {
  it("offers the hotline as a tap-to-call link with the number in the page language", () => {
    render(wrap(<HelpStrip />, "en", null));
    expect(screen.getByRole("heading", { name: en.landing.help.title })).toBeInTheDocument();
    expect(screen.getByTestId("hotline-link")).toHaveAttribute("href", "tel:16122");
    expect(screen.getByTestId("hotline-link")).toHaveTextContent("16122");
    expect(screen.getByRole("link", { name: en.landing.help.write })).toHaveAttribute("href", "/feedback");
  });

  it("uses Bangla digits in Bangla, still dialling 16122, and says the ministry does not run the demo", () => {
    render(wrap(<HelpStrip />, "bn", null));
    expect(screen.getByTestId("hotline-link")).toHaveTextContent("১৬১২২");
    expect(screen.getByTestId("hotline-link")).toHaveAttribute("href", "tel:16122");
    expect(screen.getByText(bn.landing.help.note)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: bn.landing.help.title }).textContent).not.toMatch(/[0-9]/);
  });
});

describe("Bangladeshi visual identity (U1.8)", () => {
  it("backdrop has a kantha stitch layer: dashed, faint, small tile, decorative only", () => {
    render(<Backdrop />);
    const backdrop = screen.getByTestId("landing-backdrop");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).toHaveClass("pointer-events-none", "print:hidden");
    const stitch = screen.getByTestId("kantha-layer").querySelector("pattern path")!;
    expect(stitch).toHaveAttribute("stroke-dasharray");
    expect(stitch).toHaveAttribute("stroke", "rgb(var(--kantha))");
    expect(new Blob([KANTHA_TILE]).size).toBeLessThan(10_000);
  });
  it("footer has the village → city strip just above it, hidden from assistive tech and print", () => {
    const { container } = render(wrap(<Footer />));
    const strip = screen.getByTestId("skyline-strip");
    expect(strip).toHaveAttribute("aria-hidden", "true");
    expect(strip).toHaveClass("pointer-events-none", "print:hidden");
    expect(strip.nextElementSibling).toBe(container.querySelector("footer"));
  });
});
