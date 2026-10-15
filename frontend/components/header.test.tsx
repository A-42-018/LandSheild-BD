import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import { activeNavHref, NAV_ITEMS } from "@/features/auth/roles";
import Footer from "@/features/landing/Footer";
import Navbar from "@/features/landing/Navbar";
import { readTheme } from "@/lib/theme";

let pathname = "/";
let auth: { status: string; user: unknown; logout: () => Promise<void> };
const logout = vi.fn(async () => {});

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname,
  Link: ({ href, locale, children, ...rest }: any) => (
    <a href={locale ? `/${locale}${href}` : href} {...rest}>{children}</a>
  ),
}));
vi.mock("@/features/auth/AuthContext", () => ({ useAuth: () => auth }));

const wrap = (ui: React.ReactNode, locale: "en" | "bn" = "en") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
    {ui}
  </NextIntlClientProvider>
);

beforeEach(() => {
  pathname = "/";
  logout.mockClear();
  auth = { status: "anonymous", user: null, logout };
  window.localStorage.clear();
});

describe("activeNavHref", () => {
  it("picks the most specific match", () => {
    expect(activeNavHref("/officer/upload", NAV_ITEMS)).toBe("/officer/upload");
    expect(activeNavHref("/officer/review/abc", NAV_ITEMS)).toBe("/officer");
    expect(activeNavHref("/", NAV_ITEMS)).toBe("/");
    expect(activeNavHref("/about/", NAV_ITEMS)).toBe("/about");
    expect(activeNavHref("/nowhere", NAV_ITEMS)).toBeNull();
  });
});

describe("Navbar (UD3)", () => {
  it("has brand link, main nav, language switch and a single light/dark button; no top strip", () => {
    render(wrap(<Navbar />));
    expect(screen.getByRole("link", { name: en.common.appName })).toHaveAttribute("href", "/");
    expect(screen.getByRole("navigation", { name: en.nav.main })).toBeInTheDocument();
    expect(screen.queryByTestId("top-strip")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: en.strip.textSize })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: en.theme.toDark })).toBeInTheDocument();
  });

  it("language switch lists EN then BN inside the header", () => {
    render(wrap(<Navbar />));
    const lang = screen.getByRole("navigation", { name: en.common.language });
    expect(within(lang).getAllByRole("link").map((a) => a.textContent)).toEqual(["EN", "BN"]);
  });

  it("theme button toggles light and dark and stores the choice", () => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    render(wrap(<Navbar />));
    fireEvent.click(screen.getByRole("button", { name: en.theme.toDark }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("ls-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: en.theme.toLight }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("ls-theme")).toBe("light");
  });

  it("marks only the current page link", () => {
    pathname = "/map";
    auth = { status: "authenticated", user: { name: "C", role: "CITIZEN" }, logout };
    render(wrap(<Navbar />));
    expect(screen.getByRole("link", { name: en.nav.map })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: en.nav.home })).not.toHaveAttribute("aria-current");
  });

  it("service nav: Home for anonymous; Home, Verify land, Check before you buy, Parcel map when signed in", () => {
    render(wrap(<Navbar />));
    const nav = screen.getByRole("navigation", { name: en.nav.main });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual([en.nav.home, en.nav.track]);
    auth = { status: "authenticated", user: { name: "O", role: "OFFICER" }, logout };
    cleanup();
    render(wrap(<Navbar />));
    const nav2 = screen.getByRole("navigation", { name: en.nav.main });
    expect(within(nav2).getAllByRole("link").map((a) => a.textContent)).toEqual([en.nav.home, en.nav.verify, en.nav.check, en.nav.track, en.nav.map]);
  });

  it("theme default is light when nothing is stored (dark only by explicit choice)", () => {
    expect(readTheme()).toBe("light");
    window.localStorage.setItem("ls-theme", "dark");
    expect(readTheme()).toBe("dark");
  });

  it("header shows the Bangla sub-line", () => {
    render(wrap(<Navbar />));
    expect(screen.getByText(en.common.subLine)).toBeInTheDocument();
  });

  it("anonymous: user icon links to sign in, no sign out", () => {
    render(wrap(<Navbar />));
    expect(screen.getByRole("link", { name: en.nav.login })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: en.nav.account })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.nav.logout })).not.toBeInTheDocument();
  });

  it("signed in: user icon opens a panel with name, role, remaining links; sign out works", () => {
    auth = { status: "authenticated", user: { name: "Olivia Officer", role: "OFFICER" }, logout };
    pathname = "/officer/upload";
    render(wrap(<Navbar />));
    const btn = screen.getByRole("button", { name: en.nav.account });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("account-menu")).toHaveAttribute("hidden");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Olivia Officer")).toBeVisible();
    expect(screen.getByText(en.roles.OFFICER)).toBeVisible();
    expect(screen.getByRole("link", { name: en.nav.upload })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: en.nav.dashboard })).not.toHaveAttribute("aria-current");
    fireEvent.click(screen.getByRole("button", { name: en.nav.logout }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("account panel closes on Escape", () => {
    auth = { status: "authenticated", user: { name: "C", role: "CITIZEN" }, logout };
    render(wrap(<Navbar />));
    const btn = screen.getByRole("button", { name: en.nav.account });
    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("citizen does not see officer links in the account panel", () => {
    auth = { status: "authenticated", user: { name: "C", role: "CITIZEN" }, logout };
    render(wrap(<Navbar />));
    fireEvent.click(screen.getByRole("button", { name: en.nav.account }));
    expect(screen.queryByRole("link", { name: en.nav.upload })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en.nav.dashboard })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.nav.verify })).toBeInTheDocument();
  });

  it("mobile menu button toggles the panel, aria-expanded and closes on Escape", () => {
    render(wrap(<Navbar />));
    const btn = screen.getByRole("button", { name: en.nav.menuOpen });
    const panel = document.getElementById("site-menu")!;
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveAttribute("aria-controls", "site-menu");
    expect(panel).toHaveAttribute("data-open", "false");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: en.nav.menuClose })).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("data-open", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel).toHaveAttribute("data-open", "false");
  });

  it("renders in Bangla", () => {
    render(wrap(<Navbar />, "bn"));
    expect(screen.getByRole("navigation", { name: bn.nav.main })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: bn.nav.menuOpen })).toBeInTheDocument();
  });
});

describe("Footer (UD3)", () => {
  it.each(["en", "bn"] as const)("has one labelled nav with 4 columns: services, about, help, legal (%s)", (loc) => {
    const m = loc === "en" ? en : bn;
    render(wrap(<Footer />, loc));
    const nav = screen.getByRole("navigation", { name: m.landing.footerNav });
    expect(nav).toBeInTheDocument();
    for (const h of [m.footer.services, m.footer.aboutTitle, m.footer.help, m.footer.legal]) expect(screen.getByText(h)).toBeInTheDocument();
    expect(screen.getByText(new RegExp("support@landshield.demo"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: m.nav.map })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: m.nav.login })).toHaveAttribute("href", "/login");
    expect(screen.getByText(m.landing.disclaimer)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(m.common.demoLabel.replace(/[.]/g, "\\.")))).toBeInTheDocument();
  });
});

import PageHeaderCmp from "@/components/PageHeader";
describe("PageHeader v2", () => {
  it("renders the hero band by default and a plain header for variant=plain", () => {
    const { container, rerender } = render(
      <NextIntlClientProvider locale="en" messages={en}><PageHeaderCmp title="T" meta={["Ref 1"]} /></NextIntlClientProvider>,
    );
    expect(container.querySelector(".page-hero")).not.toBeNull();
    expect(screen.getByTestId("page-meta")).toHaveTextContent("Ref 1");
    rerender(<NextIntlClientProvider locale="en" messages={en}><PageHeaderCmp variant="plain" title="T" /></NextIntlClientProvider>);
    expect(container.querySelector(".page-hero")).toBeNull();
  });
});
