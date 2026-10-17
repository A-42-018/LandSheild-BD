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
let unread = 0;
vi.mock("@/features/my/useMy", () => ({ useUnreadCount: () => ({ data: unread }) }));

const wrap = (ui: React.ReactNode, locale: "en" | "bn" = "en") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
    {ui}
  </NextIntlClientProvider>
);

beforeEach(() => {
  pathname = "/";
  unread = 0;
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
  it("has brand link, main nav and a single light/dark button; the strip controls live in TopStrip, not here", () => {
    render(wrap(<Navbar />));
    expect(screen.getByRole("link", { name: en.common.appName })).toHaveAttribute("href", "/");
    expect(screen.getByRole("navigation", { name: en.nav.main })).toBeInTheDocument();
    expect(screen.queryByTestId("top-strip")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: en.strip.textSize })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: en.common.language })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.theme.toDark })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: en.nav.services }));
    expect(screen.getByRole("link", { name: en.nav.map })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: en.nav.home })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: en.nav.tools })).not.toHaveAttribute("aria-current");
  });

  it("bar links point at their pages; the current page is marked (Home on /, Citizen tools under /tools)", () => {
    render(wrap(<Navbar />));
    expect(screen.getByRole("link", { name: en.nav.home })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: en.nav.tools })).toHaveAttribute("href", "/tools");
    expect(screen.getByRole("link", { name: en.nav.guide })).toHaveAttribute("href", "/guide");
    expect(screen.getByRole("link", { name: en.nav.notices })).toHaveAttribute("href", "/#notices-title");
    expect(screen.getByRole("link", { name: en.nav.contact })).toHaveAttribute("href", "/feedback");
    cleanup();
    pathname = "/tools/units";
    render(wrap(<Navbar />));
    expect(screen.getByRole("link", { name: en.nav.tools })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: en.nav.home })).not.toHaveAttribute("aria-current");
    // The notices anchor is on the home page; it is never "the current page".
    expect(screen.getByRole("link", { name: en.nav.notices })).not.toHaveAttribute("aria-current");
  });

  it("nav order: Home, Services ▾, Citizen tools, Guide, Notices, Contact", () => {
    render(wrap(<Navbar />));
    const nav = screen.getByRole("navigation", { name: en.nav.main });
    const labels = Array.from(nav.children).map((el) => el.textContent);
    expect(labels[0]).toBe(en.nav.home);
    expect(labels[1]).toContain(en.nav.services);
    expect(labels.slice(2)).toEqual([en.nav.tools, en.nav.guide, en.nav.notices, en.nav.contact]);
  });

  it("services dropdown: All services + public pages for anonymous; the signed-in pages are added by role", () => {
    const items = () => within(document.getElementById("services-menu-panel")!).getAllByRole("link", { hidden: true }).map((a) => a.textContent);
    render(wrap(<Navbar />));
    expect(items()).toEqual([en.nav.allServices, en.nav.verify, en.nav.track, en.nav.verifyDoc, en.nav.map]);
    auth = { status: "authenticated", user: { name: "O", role: "OFFICER" }, logout };
    cleanup();
    render(wrap(<Navbar />));
    expect(items()).toEqual([en.nav.allServices, en.nav.verify, en.nav.check, en.nav.track, en.nav.verifyDoc, en.nav.map]);
  });

  it("services dropdown opens and closes (button, Escape returns focus, outside click) and marks the trigger on a service page", () => {
    render(wrap(<Navbar />));
    const btn = screen.getByRole("button", { name: en.nav.services });
    const panel = document.getElementById("services-menu-panel")!;
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveAttribute("aria-controls", "services-menu-panel");
    expect(panel).toHaveAttribute("hidden");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveFocus();
    fireEvent.click(btn);
    fireEvent.mouseDown(document.body);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    cleanup();
    pathname = "/track";
    render(wrap(<Navbar />));
    fireEvent.click(screen.getByRole("button", { name: en.nav.services }));
    expect(screen.getByRole("link", { name: en.nav.track })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: en.nav.services })).toHaveClass("text-gold-strong");
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

  it("anonymous: Sign in ▾ asks who you are (citizen / officer); no account button, no sign out", () => {
    render(wrap(<Navbar />));
    const btn = screen.getByRole("button", { name: en.nav.login });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: en.nav.citizenLogin })).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: en.nav.citizenLogin })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: en.nav.officerLogin })).toHaveAttribute("href", "/officer-login");
    expect(screen.queryByRole("button", { name: en.nav.account })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.nav.logout })).not.toBeInTheDocument();
  });

  it("signed in: no Sign in ▾ in the header", () => {
    auth = { status: "authenticated", user: { name: "C", role: "CITIZEN" }, logout };
    render(wrap(<Navbar />));
    expect(screen.queryByRole("button", { name: en.nav.login })).not.toBeInTheDocument();
  });

  it("brand: Bangla spelling in bn, English in en, with the tagline under it", () => {
    render(wrap(<Navbar />, "bn"));
    expect(screen.getByRole("link", { name: bn.common.brand })).toHaveAttribute("href", "/");
    expect(screen.getByText(bn.common.subLine)).toBeInTheDocument();
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
    expect(screen.getAllByText(en.roles.OFFICER)).toHaveLength(2); // bar badge + panel
    expect(screen.getByRole("link", { name: en.nav.upload })).toHaveAttribute("aria-current", "page");
    // The role's own start page is the "My dashboard" shortcut, not a second list entry.
    expect(screen.getByRole("link", { name: en.nav.myDashboard })).toHaveAttribute("href", "/officer");
    expect(screen.getByRole("link", { name: en.nav.myDashboard })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("link", { name: en.nav.dashboard })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.nav.logout }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("role badge sits in the bar; the dashboard shortcut goes to each role's own start page", () => {
    for (const [role, href] of [["CITIZEN", "/my"], ["REVIEWER", "/officer/review"], ["OFFICER", "/officer"], ["ADMIN", "/admin"]] as const) {
      cleanup();
      auth = { status: "authenticated", user: { name: "U", role }, logout };
      render(wrap(<Navbar />, "bn"));
      expect(screen.getByTestId("role-badge")).toHaveTextContent(bn.roles[role]);
      fireEvent.click(screen.getByRole("button", { name: bn.nav.account }));
      expect(screen.getByRole("link", { name: bn.nav.myDashboard })).toHaveAttribute("href", href);
    }
    expect(bn.nav.myDashboard).toBe("আমার ড্যাশবোর্ড");
  });

  it("reviewer: the shortcut is the current page on আজকের কাজ, and the plain Dashboard entry is not listed twice", () => {
    auth = { status: "authenticated", user: { name: "R", role: "REVIEWER" }, logout };
    pathname = "/officer/review/abc";
    render(wrap(<Navbar />));
    fireEvent.click(screen.getByRole("button", { name: en.nav.account }));
    expect(screen.getByRole("link", { name: en.nav.myDashboard })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: en.nav.dashboard })).not.toBeInTheDocument();
  });

  it("bell: citizens only, links to the inbox and shows the unread count", () => {
    auth = { status: "authenticated", user: { name: "C", role: "CITIZEN" }, logout };
    render(wrap(<Navbar />));
    expect(screen.getByRole("link", { name: en.nav.bell })).toHaveAttribute("href", "/my/notifications");
    expect(screen.getByRole("link", { name: en.nav.bell })).not.toHaveAttribute("aria-current");
    expect(screen.queryByTestId("bell-badge")).not.toBeInTheDocument();
    cleanup();
    pathname = "/my/notifications";
    render(wrap(<Navbar />));
    expect(screen.getByRole("link", { name: en.nav.bell })).toHaveAttribute("aria-current", "page");
    cleanup();
    pathname = "/";
    unread = 3;
    render(wrap(<Navbar />));
    expect(screen.getByRole("link", { name: "Notifications, 3 unread" })).toBeInTheDocument();
    expect(screen.getByTestId("bell-badge")).toHaveTextContent("3");
    cleanup();
    unread = 120;
    render(wrap(<Navbar />));
    expect(screen.getByTestId("bell-badge")).toHaveTextContent("99+");
    cleanup();
    auth = { status: "authenticated", user: { name: "O", role: "OFFICER" }, logout };
    render(wrap(<Navbar />));
    expect(screen.queryByRole("link", { name: en.nav.bell })).not.toBeInTheDocument();
    cleanup();
    auth = { status: "anonymous", user: null, logout };
    render(wrap(<Navbar />));
    expect(screen.queryByRole("link", { name: en.nav.bell })).not.toBeInTheDocument();
  });

  it("account panel closes on Escape", () => {
    auth = { status: "authenticated", user: { name: "C", role: "CITIZEN" }, logout };
    render(wrap(<Navbar />));
    const btn = screen.getByRole("button", { name: en.nav.account });
    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape from a link inside the account panel or the phone menu gives focus back to its button (U5.4)", () => {
    auth = { status: "authenticated", user: { name: "C", role: "CITIZEN" }, logout };
    render(wrap(<Navbar />));
    const account = screen.getByRole("button", { name: en.nav.account });
    fireEvent.click(account);
    screen.getByRole("link", { name: en.nav.myDashboard }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(account).toHaveFocus();

    const menu = screen.getByRole("button", { name: en.nav.menuOpen });
    fireEvent.click(menu);
    document.getElementById("site-menu")!.querySelector<HTMLElement>("a[href]")!.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu).toHaveFocus();
    // Escape with focus outside a panel leaves focus where it is
    fireEvent.click(menu);
    menu.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu).toHaveFocus();
  });

  it("citizen does not see officer links in the account panel", () => {
    auth = { status: "authenticated", user: { name: "C", role: "CITIZEN" }, logout };
    render(wrap(<Navbar />));
    fireEvent.click(screen.getByRole("button", { name: en.nav.account }));
    expect(screen.queryByRole("link", { name: en.nav.upload })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en.nav.dashboard })).not.toBeInTheDocument();
    // Verify land is in the services dropdown now, not in the account panel.
    expect(screen.getByRole("link", { name: en.nav.verify, hidden: true })).toBeInTheDocument();
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

describe("Footer (U1.7)", () => {
  it.each(["en", "bn"] as const)("has one labelled nav with the five standard columns and a demo-project note (%s)", (loc) => {
    const m = loc === "en" ? en : bn;
    render(wrap(<Footer />, loc));
    const nav = screen.getByRole("navigation", { name: m.landing.footerNav });
    expect(nav).toBeInTheDocument();
    for (const h of [m.footer.importantLinks, m.footer.planning, m.footer.apps, m.footer.contactTitle, m.footer.techSupport]) expect(screen.getByText(h)).toBeInTheDocument();
    expect(screen.getByTestId("footer-demo-note")).toHaveTextContent(m.footer.demoProject);
    expect(screen.getByText(m.footer.demoNote)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "support@landshield.demo" })).toHaveAttribute("href", "mailto:support@landshield.demo");
    expect(screen.getByTestId("footer-hotline")).toHaveAttribute("href", "tel:16122");
    expect(screen.getByTestId("footer-hotline")).toHaveTextContent(loc === "bn" ? "১৬১২২" : "16122");
    expect(screen.getByRole("link", { name: m.nav.map })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: m.nav.track })).toHaveAttribute("href", "/track");
    expect(screen.getByText(m.landing.disclaimer)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(m.common.demoLabel.replace(/[.]/g, "\\."))) ).toBeInTheDocument();
    expect(nav.textContent).not.toMatch(/ভূমি মন্ত্রণালয়|Ministry of Land/);
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
