import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient, type ApiUser } from "@/lib/api";
import { AuthProvider } from "./AuthContext";
import LoginForm, { DEMO_PASSWORD, safeNext } from "./LoginForm";
import RequireRole from "./RequireRole";
import { loginPathFor, navItemsFor, redirectFor, type NavItem } from "./roles";

const replace = vi.fn();
let search = "";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

const officer: ApiUser = { id: "1", name: "Officer", email: "o@x.co", role: "OFFICER", preferred_language: "en" };

function fakeClient(over: Partial<ApiClient> = {}): ApiClient {
  return {
    refresh: vi.fn().mockResolvedValue(null),
    login: vi.fn().mockResolvedValue({ user: officer }),
    logout: vi.fn().mockResolvedValue(undefined),
    ...over,
  } as unknown as ApiClient;
}

function wrap(ui: React.ReactNode, client: ApiClient, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  replace.mockClear();
  search = "";
});

describe("LoginForm", () => {
  it("an old /login?as=officer link shows the staff heading; the default heading is unchanged", () => {
    wrap(<LoginForm />, fakeClient());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.auth.loginTitle);
    cleanup();
    search = "as=officer";
    wrap(<LoginForm />, fakeClient());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.auth.staffTitle);
    expect(screen.getByText(en.auth.staffIntro)).toBeInTheDocument();
  });

  it("shows required errors and does not call login when empty", async () => {
    const c = fakeClient();
    wrap(<LoginForm />, c);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(en.auth.emailRequired)).toBeInTheDocument();
    expect(c.login).not.toHaveBeenCalled();
  });

  it("U5.4: a failed submit moves focus to the first empty field", () => {
    wrap(<LoginForm />, fakeClient());
    const submit = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(submit);
    expect(screen.getByLabelText(/Email/)).toHaveFocus();
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "a@b.co" } });
    submit.focus();
    fireEvent.click(submit);
    expect(screen.getByLabelText(/^Password/)).toHaveFocus();
  });

  it("shows the demo accounts and password, and fills each on click", () => {
    wrap(<LoginForm audience="staff" />, fakeClient());
    const hint = screen.getByTestId("demo-accounts");
    expect(hint).toHaveTextContent(en.auth.demoTitle);
    expect(hint).toHaveTextContent(DEMO_PASSWORD);
    fireEvent.click(screen.getByRole("button", { name: /reviewer@demo\.landshield\.test/ }));
    expect(screen.getByLabelText(/Email/)).toHaveValue("reviewer@demo.landshield.test");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.auth.demoPassword) }));
    expect(screen.getByLabelText(/^Password/)).toHaveValue(DEMO_PASSWORD);
    expect(screen.getByText(en.auth.notice)).toBeInTheDocument();
  });

  it("logs in the demo officer and redirects to safe next", async () => {
    search = "next=/dashboard";
    const c = fakeClient();
    wrap(<LoginForm />, c);
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "officer@demo.landshield.test" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(c.login).toHaveBeenCalledWith("officer@demo.landshield.test", "pw");
  });

  it("shows invalid-credentials and rate-limit errors (BN keys exist)", async () => {
    const c = fakeClient({ login: vi.fn().mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "x")) as any });
    wrap(<LoginForm />, c, bn, "bn");
    fireEvent.change(screen.getByLabelText(new RegExp(bn.auth.email)), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText(new RegExp(bn.auth.password)), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: bn.auth.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(bn.auth.invalidCredentials);
  });

  it.each([
    ["CITIZEN", "/my"],
    ["REVIEWER", "/officer/review"],
    ["OFFICER", "/officer"],
    ["ADMIN", "/admin"],
  ] as const)("lands a %s on %s when there is no ?next=", async (role, home) => {
    const c = fakeClient({ login: vi.fn().mockResolvedValue({ user: { ...officer, role } }) as any });
    wrap(<LoginForm />, c);
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(home));
  });

  it("citizen page offers only the citizen demo account; staff page the staff ones", () => {
    const { unmount } = wrap(<LoginForm />, fakeClient());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.auth.loginTitle);
    expect(screen.getByTestId("demo-accounts")).toHaveTextContent("citizen@demo.landshield.test");
    expect(screen.getByTestId("demo-accounts")).not.toHaveTextContent("officer@demo.landshield.test");
    unmount();
    wrap(<LoginForm audience="staff" />, fakeClient());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.auth.staffTitle);
    const hint = screen.getByTestId("demo-accounts");
    for (const r of ["reviewer", "officer", "admin"]) expect(hint).toHaveTextContent(`${r}@demo.landshield.test`);
    expect(hint).not.toHaveTextContent("citizen@demo.landshield.test");
    expect(screen.getByRole("link", { name: en.authShell.tabStaff })).toHaveAttribute("aria-current", "page");
  });

  it("safeNext blocks open redirects", () => {
    expect(safeNext("/x?y=1")).toBe("/x?y=1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("RequireRole", () => {
  it("sends anonymous users on a staff-only page to the staff sign-in with next", async () => {
    wrap(<RequireRole roles={["OFFICER"]}>secret</RequireRole>, fakeClient());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/officer-login?next=%2Fdashboard"));
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("keeps the query in next, so a home-page search survives sign-in (U1.3)", async () => {
    window.history.pushState({}, "", "/dashboard?district=Gazipur&dag=785");
    try {
      wrap(<RequireRole>secret</RequireRole>, fakeClient());
      await waitFor(() => expect(replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent("/dashboard?district=Gazipur&dag=785")}`));
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("sends anonymous users on a page open to citizens to /login with next", async () => {
    wrap(<RequireRole roles={["CITIZEN", "OFFICER"]}>secret</RequireRole>, fakeClient());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fdashboard"));
  });

  it("shows permission message for wrong role", async () => {
    const c = fakeClient({ refresh: vi.fn().mockResolvedValue({ user: { ...officer, role: "CITIZEN" } }) as any });
    wrap(<RequireRole roles={["OFFICER"]}>secret</RequireRole>, c);
    expect(await screen.findByRole("alert")).toHaveTextContent(en.errors.permission);
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders children for an allowed role", async () => {
    const c = fakeClient({ refresh: vi.fn().mockResolvedValue({ user: officer }) as any });
    wrap(<RequireRole roles={["REVIEWER", "OFFICER"]}>secret</RequireRole>, c);
    expect(await screen.findByText("secret")).toBeInTheDocument();
  });
});

describe("redirectFor / loginPathFor", () => {
  it("maps each role to its home", () => {
    expect(redirectFor("CITIZEN")).toBe("/my");
    expect(redirectFor("REVIEWER")).toBe("/officer/review");
    expect(redirectFor("OFFICER")).toBe("/officer");
    expect(redirectFor("ADMIN")).toBe("/admin");
    expect(redirectFor(null)).toBe("/");
  });
  it("picks the staff sign-in only when no citizen may enter", () => {
    expect(loginPathFor(["REVIEWER", "OFFICER", "ADMIN"])).toBe("/officer-login");
    expect(loginPathFor(["ADMIN"])).toBe("/officer-login");
    expect(loginPathFor(["CITIZEN", "OFFICER"])).toBe("/login");
    expect(loginPathFor(undefined)).toBe("/login");
    expect(loginPathFor([])).toBe("/login");
  });
});

describe("navItemsFor", () => {
  const items: NavItem[] = [
    { href: "/", labelKey: "nav.home" },
    { href: "/q", labelKey: "q", roles: ["REVIEWER", "OFFICER", "ADMIN"] },
    { href: "/u", labelKey: "u", roles: ["ADMIN"] },
  ];
  it("filters by role", () => {
    expect(navItemsFor(null, items).map((i) => i.href)).toEqual(["/"]);
    expect(navItemsFor("CITIZEN", items).map((i) => i.href)).toEqual(["/"]);
    expect(navItemsFor("OFFICER", items).map((i) => i.href)).toEqual(["/", "/q"]);
    expect(navItemsFor("ADMIN", items).map((i) => i.href)).toEqual(["/", "/q", "/u"]);
  });
});
