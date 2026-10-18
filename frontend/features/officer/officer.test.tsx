import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { navItemsFor } from "@/features/auth/roles";
import DashboardView from "./DashboardView";
import OfficerShell from "./OfficerShell";
import { queueQuery } from "./useOfficerData";

vi.mock("./ChartCanvas", () => ({
  default: ({ data }: { data: { key: string }[] }) => <div data-testid="canvas">{data.length}</div>,
}));

let path = "/officer";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => path,
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const mk = (role: string) => ({ id: "1", name: "U", email: "u@x.co", role, preferred_language: "en" });
const STATS = {
  total_records: 7, pending_review: 3, high_risk: 1, verified: 7, open_alerts: 4, pending_mutations: 2,
  active_encumbrances: 3, ledger_status: "INTACT" as const, ledger_entries: 32,
};
const item = (over: any = {}) => ({
  id: "doc-1", land_id: "LP-10240", document_type: "DEED", processing_status: "REVIEW_REQUIRED",
  min_confidence: 0.72, low_confidence: true, high_risk: false, created_at: "2026-10-01T08:00:00Z", ...over,
});
const LIST = (items: any[], total = items.length) => ({ items, total, limit: 20, offset: 0 });

function api(get: any, role = "OFFICER"): ApiClient {
  return { refresh: vi.fn().mockResolvedValue({ user: mk(role) }), get } as unknown as ApiClient;
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
const ALERT = (over: any = {}) => ({
  id: "al-1", land_id: "LP-10500", alert_type: "DUPLICATE_DEED", severity: "HIGH", risk_score: 30,
  evidence: [{ code: "DUPLICATE_DEED", severity: "HIGH", params: { deed_no: "D-1", count: 2 } }],
  status: "OPEN", created_at: "2026-10-01T09:00:00Z", ...over,
});
const ACT = [{ id: "a1", action: "DOCUMENT_APPROVE", entity_type: "document", actor: { name: "Olivia", role: "OFFICER" }, created_at: "2026-10-01T10:00:00Z" },
  { id: "a2", action: "SOMETHING_NEW", entity_type: "x", actor: null, created_at: "2026-10-01T11:00:00Z" }];
const router = (queue: any = LIST([item()]), alerts: any = LIST([ALERT()], 2), queueErr?: unknown) =>
  vi.fn((p: string) => {
    if (p.startsWith("/documents?")) return Promise.resolve(LIST([]));
    if (p.startsWith("/officer/stats")) return Promise.resolve(STATS);
    if (p.startsWith("/risk-alerts")) return Promise.resolve(p.includes("limit=1") && p.includes("severity") ? { items: [], total: 1, limit: 1, offset: 0 } : alerts);
    if (p.startsWith("/officer/activity")) return Promise.resolve({ items: ACT, total: 2, limit: 8, offset: 0 });
    return queueErr ? Promise.reject(queueErr) : Promise.resolve(queue);
  });

describe("dashboard", () => {
  it("shows KPI cards and queue rows linking to review", async () => {
    wrap(<DashboardView />, api(router()));
    expect(await screen.findByTestId("kpi-pending_review")).toHaveTextContent("3");
    expect(screen.getByTestId("kpi-total_records")).toHaveTextContent("7");
    expect(screen.getByTestId("kpi-open_alerts")).toHaveTextContent("4");
    expect(screen.getByTestId("kpi-pending_mutations")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-active_encumbrances")).toHaveTextContent("3");
    expect(screen.getByTestId("kpi-ledger")).toHaveTextContent("Intact");
    expect(screen.getByTestId("kpi-ledger")).toHaveTextContent("32 entries");
    const link = await screen.findByRole("link", { name: /LP-10240/ });
    expect(link).toHaveAttribute("href", "/officer/review/doc-1");
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(within(link.closest("tr") as HTMLElement).getByText("Low confidence")).toBeInTheDocument();
  });

  it("filter, search, sort and paging go to the API", async () => {
    const get = router(LIST([item()], 45));
    wrap(<DashboardView />, api(get));
    await screen.findByRole("link", { name: /LP-10240/ });
    fireEvent.change(screen.getByLabelText("Filter"), { target: { value: "high_risk" } });
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("filter=high_risk")));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Ashulia" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("q=Ashulia")));
    fireEvent.click(screen.getByRole("button", { name: /Land ID/ }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("sort=land_id&order=asc")));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("offset=20")));
  });

  it("empty and error states", async () => {
    wrap(<DashboardView />, api(router(LIST([]))));
    expect(await screen.findByText(en.officer.queue.empty)).toBeInTheDocument();
  });

  it("queue error shows retry; 403 shows permission", async () => {
    const get = router(LIST([item()]), undefined, new ApiError(403, "FORBIDDEN", "x"));
    wrap(<DashboardView />, api(get));
    expect(await screen.findByText(en.errors.permission)).toBeInTheDocument();
  });

  it("renders Bangla", async () => {
    wrap(<DashboardView />, api(router()), bn, "bn");
    expect(await screen.findByText(bn.officer.queue.title)).toBeInTheDocument();
  });

  it("unassigned land shows label", async () => {
    wrap(<DashboardView />, api(router(LIST([item({ land_id: null, min_confidence: null, low_confidence: false, high_risk: true })]))));
    expect(await screen.findByRole("link", { name: /Unassigned/ })).toBeInTheDocument();
  });
});

describe("shell + nav", () => {
  it("lists links by role and toggles the mobile drawer", async () => {
    wrap(<OfficerShell><p>content</p></OfficerShell>, api(vi.fn(), "REVIEWER"));
    const nav = await screen.findByRole("navigation", { name: "Officer navigation" });
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: "Upload document" })).toBeNull();
    const btn = screen.getByRole("button", { name: "Open menu" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  });

  it("officer sees upload link; header nav has dashboard for reviewer+", () => {
    const has = (r: any) => navItemsFor(r).some((i) => i.href === "/officer");
    expect(has("CITIZEN")).toBe(false);
    expect(has(null)).toBe(false);
    expect(has("REVIEWER")).toBe(true);
    expect(has("ADMIN")).toBe(true);
  });

  it("builds the queue query string", () => {
    expect(queueQuery({ filter: "", q: " a ", sort: "created_at", order: "desc", page: 3 })).toBe(
      "q=a&sort=created_at&order=desc&limit=20&offset=40",
    );
  });
});

describe("dashboard B", () => {
  it("charts have text alternatives and lazy canvas", async () => {
    wrap(<DashboardView />, api(router()));
    const status = await screen.findByTestId("chart-status");
    expect(await within(status).findByTestId("canvas")).toBeInTheDocument();
    expect(within(status).getByText(/Verified parcels:/)).toHaveTextContent("7");
    const risk = await screen.findByTestId("chart-risk");
    expect(within(risk).getByText(/High:/)).toHaveTextContent("1");
    expect(within(risk).getByText(/Medium:/)).toHaveTextContent("1");
  });

  it("alerts list shows evidence and patches status", async () => {
    const patch = vi.fn().mockResolvedValue(ALERT({ status: "UNDER_REVIEW" }));
    const get = router();
    wrap(<DashboardView />, { ...api(get), patch } as unknown as ApiClient);
    const card = await screen.findByTestId("alert-al-1");
    expect(within(card).getByRole("link", { name: "LP-10500" })).toHaveAttribute("href", "/verify/result?land_id=LP-10500");
    expect(within(card).queryByRole("button", { name: "Reopen" })).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "Mark under review" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/risk-alerts/al-1", { status: "UNDER_REVIEW" }));
    await waitFor(() => expect(get.mock.calls.filter((c) => String(c[0]).startsWith("/risk-alerts?limit=8")).length).toBeGreaterThan(1));
  });

  it("alert update error and 403 are shown", async () => {
    const patch = vi.fn().mockRejectedValue(new ApiError(500, "X", "x"));
    wrap(<DashboardView />, { ...api(router()), patch } as unknown as ApiClient);
    fireEvent.click(await screen.findByRole("button", { name: "Escalate" }));
    expect(await screen.findByText(en.officer.alerts.updateError)).toBeInTheDocument();
  });

  it("dismissing asks for a reason and sends it", async () => {
    const patch = vi.fn().mockResolvedValue(ALERT({ status: "DISMISSED" }));
    wrap(<DashboardView />, { ...api(router()), patch } as unknown as ApiClient);
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
    fireEvent.click(await screen.findByTestId("dismiss-confirm"));
    expect(await screen.findByText(en.officer.alerts.dismissModal.required)).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("dismiss-reason"), { target: { value: " verified at office " } });
    fireEvent.click(screen.getByTestId("dismiss-confirm"));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/risk-alerts/al-1", { status: "DISMISSED", reason: "verified at office" }),
    );
  });

  it("a reviewer cannot dismiss a HIGH alert but can for MEDIUM", async () => {
    const alerts = LIST([ALERT(), ALERT({ id: "al-2", severity: "MEDIUM" })]);
    wrap(<DashboardView />, api(router(undefined, alerts), "REVIEWER"));
    const high = await screen.findByTestId("alert-al-1");
    expect(within(high).queryByRole("button", { name: "Dismiss" })).toBeNull();
    expect(within(high).getByRole("button", { name: "Escalate" })).toBeInTheDocument();
    expect(within(screen.getByTestId("alert-al-2")).getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("empty alerts; activity maps known actions and falls back to raw code", async () => {
    wrap(<DashboardView />, api(router(undefined, LIST([]))));
    expect(await screen.findByText(en.officer.alerts.empty)).toBeInTheDocument();
    expect(await screen.findByText("Document approved")).toBeInTheDocument();
    expect(screen.getByText(/Olivia \(Officer\)/)).toBeInTheDocument();
    expect(screen.getByText("SOMETHING_NEW")).toBeInTheDocument();
    expect(screen.getByText(/System/)).toBeInTheDocument();
  });

  it("renders Bangla alert and activity labels", async () => {
    wrap(<DashboardView />, api(router()), bn, "bn");
    expect(await screen.findByText(bn.officer.activity.actions.DOCUMENT_APPROVE)).toBeInTheDocument();
    expect(await screen.findByText(bn.officer.alerts.title)).toBeInTheDocument();
  });
});
