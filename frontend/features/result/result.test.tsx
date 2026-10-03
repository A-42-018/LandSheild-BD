import { render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import ResultView from "./ResultView";
import { formatDate } from "./format";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/verify/result",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const user = { id: "1", name: "C", email: "c@x.co", role: "CITIZEN", preferred_language: "en" };
const p = (name: string) => ({ name, father_name: null });
const land = (id: string, owners: string[]) => ({
  land_id: id, district: "Dhaka", upazila: "Savar", mouza: "Ashulia", khatian_no: "610", dag_no: "210",
  area: 20, area_unit: "decimal", status: "ACTIVE", current_owners: owners.map(p),
});
const own = (name: string, s: string, e: string | null, cur: boolean) => ({
  owner: p(name), start_date: s, end_date: e, is_current: cur, confidence: null, document: null,
});
const tx = (s: string, b: string, d: string) => ({
  transaction_type: "SALE", transaction_date: d, seller: p(s), buyer: p(b), area: 20, area_unit: "decimal", status: "RECORDED", document: null,
});

const risk = (id: string, s: number, l: string, evidence: any[]) => ({
  land_id: id, overall_score: s, risk_level: l, rule_score: s, evidence, assessed_at: "2026-10-01T10:00:00Z",
});

const DATA: Record<string, any> = {
  "/lands/LP-10100": land("LP-10100", ["Hasan Ali"]),
  "/lands/LP-10100/ownership": {
    entries: [own("Rahim Uddin", "2005-01-01", "2012-03-15", false), own("Karim Mia", "2012-03-15", "2019-06-20", false), own("Hasan Ali", "2019-06-20", null, true)],
  },
  "/lands/LP-10100/transactions": { transactions: [tx("Rahim Uddin", "Karim Mia", "2012-03-15"), tx("Karim Mia", "Hasan Ali", "2019-06-20")] },
  "/lands/LP-10100/risk": risk("LP-10100", 0, "LOW", []),
  "/lands/LP-10001/risk": risk("LP-10001", 0, "LOW", []),
  "/lands/LP-10001": { ...land("LP-10001", ["Jamal Hossain"]), khatian_no: "501", dag_no: "101", area: 15 },
  "/lands/LP-10001/ownership": { entries: [own("Jamal Hossain", "2008-01-10", null, true)] },
  "/lands/LP-10001/transactions": { transactions: [] },
};

function client(get: (path: string) => Promise<any>): ApiClient {
  return { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient;
}
const okGet = (path: string) => (path in DATA ? Promise.resolve(DATA[path]) : Promise.reject(new ApiError(404, "LAND_NOT_FOUND", "x")));

function wrap(c: ApiClient, landId?: string, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}>
          <ResultView landId={landId} />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("ResultView", () => {
  it("renders LP-10100: land info, ordered timeline, 2 transactions, banner, disclaimer, risk section", async () => {
    wrap(client(okGet), "LP-10100");
    expect(await screen.findByText("LP-10100")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(en.common.demoLabel);
    expect(screen.getByText(en.risk.disclaimer)).toBeInTheDocument();
    expect(screen.getByTestId("risk-section")).toHaveTextContent(en.risk.noEvidence);

    const items = within(await screen.findByRole("list", { name: en.result.ownership })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Rahim Uddin");
    expect(items[1]).toHaveTextContent("Karim Mia");
    expect(items[2]).toHaveTextContent("Hasan Ali");
    expect(items[2]).toHaveTextContent(en.result.current);
    expect(items[2]).toHaveTextContent(en.result.present);

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2
    expect(rows[1]).toHaveTextContent("Rahim Uddin");
    expect(rows[1]).toHaveTextContent("Karim Mia");
    expect(rows[1]).toHaveTextContent(en.result.txType.SALE);
    expect(rows[2]).toHaveTextContent("Hasan Ali");
  });

  it("offers a generate-report action on the result page", async () => {
    wrap(client(okGet), "LP-10100");
    expect(await screen.findByRole("button", { name: en.report.generate })).toBeInTheDocument();
  });

  it("renders LP-10001: single owner and empty transactions state", async () => {
    wrap(client(okGet), "LP-10001");
    expect(await screen.findByText("LP-10001")).toBeInTheDocument();
    const items = within(await screen.findByRole("list", { name: en.result.ownership })).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Jamal Hossain");
    expect(await screen.findByText(en.result.noTransactions)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows loading while pending", () => {
    wrap(client(() => new Promise(() => {})), "LP-10100");
    expect(screen.getByRole("status")).toHaveTextContent(en.common.loading);
  });

  it("shows the empty state for an unknown land (404) and when land_id is missing", async () => {
    const a = wrap(client(okGet), "LP-99999");
    expect(await screen.findByText(en.common.empty)).toBeInTheDocument();
    a.unmount();
    wrap(client(okGet), undefined);
    expect(screen.getByText(en.common.empty)).toBeInTheDocument();
  });

  it("shows an error state with retry, and a permission message on 403", async () => {
    const get = vi.fn().mockRejectedValue(new ApiError(500, "X", "boom"));
    const a = wrap(client(get), "LP-10100");
    expect(await screen.findByRole("alert")).toHaveTextContent(en.result.loadError);
    expect(screen.getByRole("button", { name: en.common.retry })).toBeInTheDocument();
    a.unmount();
    wrap(client(vi.fn().mockRejectedValue(new ApiError(403, "FORBIDDEN", "x"))), "LP-10100");
    expect(await screen.findByRole("alert")).toHaveTextContent(en.errors.permission);
  });

  it("renders in Bangla with translated labels and keeps document values exact", async () => {
    wrap(client(okGet), "LP-10100", bn, "bn");
    await waitFor(() => expect(screen.getByText(bn.result.landInfo)).toBeInTheDocument());
    expect(screen.getByText(bn.risk.disclaimer)).toBeInTheDocument();
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect((await screen.findAllByText("Rahim Uddin")).length).toBeGreaterThan(0);
  });
});

describe("formatDate", () => {
  it("formats ISO dates and falls back for null", () => {
    expect(formatDate("2012-03-15", "en", "n/a")).toContain("2012");
    expect(formatDate(null, "en", "n/a")).toBe("n/a");
  });
});
