import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import type { ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { navItemsFor } from "@/features/auth/roles";
import MyDashboard from "./MyDashboard";
import MyShell from "./MyShell";
import MyProfile from "./MyProfile";
import WatchButton from "./WatchButton";
import { MyNotifications, MyReports, MySearches, MyWatchlist } from "./MyLists";

const replace = vi.fn();
let path = "/my";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => path,
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const user = (over: any = {}) => ({ id: "u1", name: "Rahima Begum", email: "rahima@x.test", role: "CITIZEN", preferred_language: "bn", phone: null, ...over });
const parcel = (id = "LP-10100") => ({ land_id: id, district: "Dhaka", upazila: "Savar", mouza: "Ashulia", khatian_no: "610", dag_no: "210", status: "ACTIVE" });
const SEARCH = { ...parcel(), search_count: 3, last_searched_at: "2026-10-16T08:00:00Z", watched: false };
const REPORT = { id: "v1", land_id: "LP-10100", mouza: "Ashulia", dag_no: "210", status: "COMPLETED", risk_level: "HIGH", created_at: "2026-10-16T09:00:00Z", completed_at: "2026-10-16T09:00:01Z" };
const NOTE = (over: any = {}) => ({ id: "n1", kind: "WATCH_TRANSACTION", land_id: "LP-10100", ref_id: "t1", data: { type: "SALE", status: "RECORDED" }, read_at: null, created_at: "2026-10-16T10:00:00Z", ...over });
const SUMMARY = { searches: 12, watching: 1, reports: 1, unread: 2, recent_searches: [SEARCH], recent_reports: [REPORT], latest_notifications: [NOTE()] };

interface Routes { [prefix: string]: unknown }
function client(routes: Routes = {}, u: any = user(), extra: Partial<Record<"post" | "patch" | "del", any>> = {}) {
  const all: Routes = {
    "/me/summary": SUMMARY,
    "/me/searches": { items: [SEARCH], total: 1 },
    "/me/watchlist": { items: [], limit: 20 },
    "/me/reports": { items: [REPORT], total: 1 },
    "/me/notifications": { items: [NOTE(), NOTE({ id: "n2", kind: "REPORT_READY", ref_id: "v1", data: { risk_level: "HIGH" }, read_at: "2026-10-16T11:00:00Z" })], total: 2, unread: 1 },
    ...routes,
  };
  const get = vi.fn((p: string) => {
    const key = Object.keys(all).find((k) => p.startsWith(k));
    return key ? Promise.resolve(all[key]) : Promise.reject(new Error(`no route ${p}`));
  });
  return {
    refresh: vi.fn().mockResolvedValue({ user: u }),
    get,
    post: extra.post ?? vi.fn().mockResolvedValue({}),
    patch: extra.patch ?? vi.fn(),
    del: extra.del ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as ApiClient & { get: typeof get };
}

function wrap(ui: React.ReactNode, c: ApiClient, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

async function noAxeViolations(node: HTMLElement) {
  const off = ["color-contrast", "region", "landmark-one-main", "page-has-heading-one"];
  const res = await axe.run(node, { rules: Object.fromEntries(off.map((id) => [id, { enabled: false }])), resultTypes: ["violations"] });
  expect(res.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
}

beforeEach(() => {
  replace.mockClear();
  path = "/my";
});

describe("citizen nav", () => {
  it("only citizens get the 'My land services' entry in the account menu", () => {
    expect(navItemsFor("CITIZEN").map((i) => i.href)).toContain("/my");
    for (const r of ["REVIEWER", "OFFICER", "ADMIN"] as const) expect(navItemsFor(r).map((i) => i.href)).not.toContain("/my");
  });
});

describe("MyShell", () => {
  it("lists the six sections, marks the current one and shows the unread count", async () => {
    path = "/my/notifications";
    wrap(<MyShell><p>body</p></MyShell>, client());
    const nav = screen.getByRole("navigation", { name: en.my.nav.label });
    expect(within(nav).getAllByRole("link")).toHaveLength(6);
    expect(within(nav).getByRole("link", { name: /Notifications/ })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByTestId("unread-badge")).toHaveTextContent("2");
  });

  it("shows the unread count in Bangla digits", async () => {
    wrap(<MyShell><p>body</p></MyShell>, client(), bn, "bn");
    expect(await screen.findByTestId("unread-badge")).toHaveTextContent("২");
  });
});

describe("MyDashboard", () => {
  it("greets the citizen, offers three big services and recent activity", async () => {
    const { container } = wrap(<MyDashboard />, client());
    expect(await screen.findByRole("heading", { level: 1, name: "Hello, Rahima Begum" })).toBeInTheDocument();
    expect(screen.getAllByTestId("my-action").map((a) => a.getAttribute("href"))).toEqual(["/verify", "/check", "/track"]);
    const stats = await screen.findAllByTestId("my-stat");
    expect(stats[0]).toHaveTextContent("12");
    expect(screen.getByText("New transaction recorded on LP-10100: Sale.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.my.searches.open })).toHaveAttribute("href", "/verify/result?land_id=LP-10100");
    await noAxeViolations(container);
  });

  it("uses Bangla words and digits in BN", async () => {
    wrap(<MyDashboard />, client(), bn, "bn");
    expect(await screen.findByRole("heading", { level: 1, name: "স্বাগতম, Rahima Begum" })).toBeInTheDocument();
    expect((await screen.findAllByTestId("my-stat"))[0]).toHaveTextContent("১২");
    expect(screen.getByText("LP-10100 জমিতে নতুন লেনদেন নথিভুক্ত হয়েছে: বিক্রয়।")).toBeInTheDocument();
  });

  it("shows a friendly empty state for a new account", async () => {
    wrap(<MyDashboard />, client({ "/me/summary": { ...SUMMARY, searches: 0, unread: 0, recent_searches: [], recent_reports: [], latest_notifications: [] } }));
    expect(await screen.findByText(en.my.dashboard.emptyRecent)).toBeInTheDocument();
  });
});

describe("MySearches", () => {
  it("lists parcels with a re-open link and clears history after confirming", async () => {
    const c = client();
    const { container } = wrap(<MySearches />, c);
    const list = await screen.findByTestId("search-history");
    expect(within(list).getByText("Ashulia, Savar, Dhaka")).toBeInTheDocument();
    expect(within(list).getByText(/Opened 3 times/)).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: en.my.searches.open })).toHaveAttribute("href", "/verify/result?land_id=LP-10100");
    await noAxeViolations(container);
    fireEvent.click(screen.getByRole("button", { name: en.my.searches.clear }));
    expect(c.del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.my.searches.clearConfirm }));
    await waitFor(() => expect(c.del).toHaveBeenCalledWith("/me/searches"));
  });

  it("points a citizen with no history to verify land", async () => {
    wrap(<MySearches />, client({ "/me/searches": { items: [], total: 0 } }));
    expect(await screen.findByText(en.my.searches.empty)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.my.searches.emptyAction })).toHaveAttribute("href", "/verify");
  });
});

describe("WatchButton", () => {
  it("adds a parcel to the watchlist", async () => {
    const c = client();
    wrap(<WatchButton landId="LP-10100" />, c);
    const btn = await screen.findByRole("button", { name: en.my.watch.add });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    await waitFor(() => expect(c.post).toHaveBeenCalledWith("/me/watchlist", { land_id: "LP-10100" }));
  });

  it("removes a watched parcel", async () => {
    const c = client({ "/me/watchlist": { items: [{ ...parcel(), note: null, created_at: "2026-10-16T08:00:00Z", unread: 0 }], limit: 20 } });
    wrap(<WatchButton landId="LP-10100" />, c);
    fireEvent.click(await screen.findByRole("button", { name: en.my.watch.remove }));
    await waitFor(() => expect(c.del).toHaveBeenCalledWith("/me/watchlist/LP-10100"));
  });

  it("is not shown to staff", async () => {
    const c = client({}, user({ role: "OFFICER" }));
    wrap(<><WatchButton landId="LP-10100" /><p>ready</p></>, c);
    await screen.findByText("ready");
    await waitFor(() => expect(c.refresh).toHaveBeenCalled());
    expect(screen.queryByRole("button")).toBeNull();
    expect(c.get).not.toHaveBeenCalled();
  });
});

describe("MyWatchlist / MyReports", () => {
  it("shows watched parcels with their new updates and the limit", async () => {
    const w = { ...parcel(), note: "Father's plot", created_at: "2026-10-16T08:00:00Z", unread: 2 };
    wrap(<MyWatchlist />, client({ "/me/watchlist": { items: [w], limit: 20 } }));
    const list = await screen.findByTestId("watchlist");
    expect(within(list).getByText("Note: Father's plot")).toBeInTheDocument();
    expect(within(list).getByText("2 new updates")).toBeInTheDocument();
    expect(screen.getByText("1 of 20 used")).toBeInTheDocument();
  });

  it("explains how to watch land when the list is empty", async () => {
    wrap(<MyWatchlist />, client());
    expect(await screen.findByText(en.my.watch.empty)).toBeInTheDocument();
    expect(screen.getByText(en.my.watch.emptyHint)).toBeInTheDocument();
  });

  it("lists reports with the risk word and a link to the report", async () => {
    const { container } = wrap(<MyReports />, client());
    const list = await screen.findByTestId("reports");
    expect(within(list).getByText(/High/)).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: en.my.reports.open })).toHaveAttribute("href", "/report/v1");
    await noAxeViolations(container);
  });
});

describe("MyNotifications", () => {
  it("writes one sentence per kind, links to the record and marks all read", async () => {
    const c = client();
    const { container } = wrap(<MyNotifications />, c);
    const rows = await screen.findAllByTestId("notification");
    expect(rows[0]).toHaveAttribute("data-unread", "true");
    expect(rows[1]).toHaveTextContent("Your report for LP-10100 is ready. Risk: High.");
    expect(within(rows[1]).getByRole("link", { name: en.my.notes.open })).toHaveAttribute("href", "/report/v1");
    expect(within(rows[0]).getByRole("link", { name: en.my.notes.open })).toHaveAttribute("href", "/verify/result?land_id=LP-10100");
    await noAxeViolations(container);
    fireEvent.click(screen.getByRole("button", { name: en.my.notes.markAll }));
    await waitFor(() => expect(c.post).toHaveBeenCalledWith("/me/notifications/read", {}));
  });

  it("opening an unread one marks just that one read", async () => {
    const c = client();
    wrap(<MyNotifications />, c);
    const rows = await screen.findAllByTestId("notification");
    fireEvent.click(within(rows[0]).getByRole("link", { name: en.my.notes.open }));
    await waitFor(() => expect(c.post).toHaveBeenCalledWith("/me/notifications/read", { ids: ["n1"] }));
  });
});

describe("MyProfile", () => {
  it("validates the mobile number in plain words and sends Bangla digits as ASCII", async () => {
    const patch = vi.fn().mockResolvedValue(user({ phone: "01711000000" }));
    wrap(<MyProfile />, client({}, user(), { patch }), bn, "bn");
    const phone = await screen.findByLabelText(bn.my.profile.phone);
    fireEvent.change(phone, { target: { value: "১২৩" } });
    fireEvent.click(screen.getByRole("button", { name: bn.my.profile.save }));
    expect(await screen.findByText(bn.my.profile.errors.phone)).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
    fireEvent.change(phone, { target: { value: "০১৭১১-০০০০০০" } });
    fireEvent.click(screen.getByRole("button", { name: bn.my.profile.save }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/me/profile", { phone: "01711000000" }));
    expect(replace).not.toHaveBeenCalled(); // language untouched: the site stays in Bangla
  });

  it("switches the site language when the citizen picks another one", async () => {
    const patch = vi.fn().mockResolvedValue(user({ preferred_language: "en" }));
    wrap(<MyProfile />, client({}, user(), { patch }), bn, "bn");
    fireEvent.change(await screen.findByLabelText(bn.my.profile.language), { target: { value: "en" } });
    fireEvent.click(screen.getByRole("button", { name: bn.my.profile.save }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/my", { locale: "en" }));
  });

  it("checks the new password twice and shows the server's reason", async () => {
    const { ApiError } = await import("@/lib/api");
    const post = vi.fn().mockRejectedValue(new ApiError(400, "WRONG_PASSWORD", "x"));
    const { container } = wrap(<MyProfile />, client({}, user(), { post }));
    fireEvent.change(await screen.findByLabelText(new RegExp(`^${en.my.profile.current}`)), { target: { value: "old-pass" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en.my.profile.new}`)), { target: { value: "brand-new-pass" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en.my.profile.confirm}`)), { target: { value: "brand-new-typo" } });
    fireEvent.click(screen.getByRole("button", { name: en.my.profile.changePassword }));
    expect(await screen.findByText(en.my.profile.errors.mismatch)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en.my.profile.confirm}`)), { target: { value: "brand-new-pass" } });
    fireEvent.click(screen.getByRole("button", { name: en.my.profile.changePassword }));
    expect(await screen.findByText(en.my.profile.errors.WRONG_PASSWORD)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith("/me/password", { current_password: "old-pass", new_password: "brand-new-pass" });
    await noAxeViolations(container);
  });
});
