import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import ReportView from "./ReportView";
import GenerateReportButton from "./GenerateReportButton";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/report/v1",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const user = { id: "1", name: "C", email: "c@x.co", role: "CITIZEN", preferred_language: "en" };
const p = (name: string) => ({ name, father_name: null });
const land = (id: string) => ({
  land_id: id, district: "Dhaka", upazila: "Savar", mouza: "Ashulia", khatian_no: "610", dag_no: "210",
  area: 20, area_unit: "decimal", status: "ACTIVE", current_owners: [p("Hasan Ali")],
});
const own = (name: string, s: string, e: string | null, cur: boolean) => ({
  owner: p(name), start_date: s, end_date: e, is_current: cur, confidence: null, document: null,
});
const tx = (s: string, b: string, d: string, st = "RECORDED") => ({
  transaction_type: "SALE", transaction_date: d, seller: p(s), buyer: p(b), area: 20, area_unit: "decimal", status: st, document: null,
});
const base = (id: string, lid: string) => ({
  verification_id: id, land_id: lid, verification_status: "COMPLETED", overall_status: "ACTIVE",
  disclaimer_code: "DEMO_DECISION_SUPPORT", verified_at: "2026-10-02T09:30:00Z",
});

const CLEAN = {
  ...base("v-clean", "LP-10100"), risk_score: 0, risk_level: "LOW", land: land("LP-10100"),
  ownership: [own("Rahim Uddin", "2005-01-01", "2012-03-15", false), own("Karim Mia", "2012-03-15", null, true)],
  document_consistency: { status: "NO_ISSUES", total_documents: 0, by_status: {}, indicators: [] },
  transactions: [tx("Rahim Uddin", "Karim Mia", "2012-03-15")], evidence: [],
};
const DOUBLE = {
  ...base("v-dbl", "LP-10240"), risk_score: 70, risk_level: "HIGH", land: land("LP-10240"),
  ownership: [own("Rahim Uddin", "2005-01-01", null, true)],
  document_consistency: {
    status: "INCONSISTENCIES_FOUND", total_documents: 2, by_status: { APPROVED: 2 },
    indicators: [{ code: "DUPLICATE_DEED", severity: "HIGH", params: { deed_no: "D-1", count: 2 } }],
  },
  transactions: [tx("Rahim Uddin", "Karim Mia", "2019-06-20", "FLAGGED"), tx("Rahim Uddin", "Hasan Ali", "2019-07-01", "FLAGGED")],
  evidence: [
    { code: "POSSIBLE_DUPLICATE_TRANSACTION", severity: "HIGH", params: { transaction_count: 2, total_area: 40, recorded_area: 20, area_unit: "decimal" } },
    { code: "SELLER_MISMATCH", severity: "HIGH", params: { transaction_date: "2019-07-01" } },
  ],
};
const REPORTS: Record<string, any> = { "/verification/v-clean/report": CLEAN, "/verification/v-dbl/report": DOUBLE };

function client(get: (p: string) => Promise<any>, post?: any): ApiClient {
  return { refresh: vi.fn().mockResolvedValue({ user }), get, post } as unknown as ApiClient;
}
const okGet = (path: string) => (path in REPORTS ? Promise.resolve(REPORTS[path]) : Promise.reject(new ApiError(404, "VERIFICATION_NOT_FOUND", "x")));

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

describe("ReportView", () => {
  it("renders every R5 section for a clean parcel (LP-10100)", async () => {
    wrap(<ReportView id="v-clean" />, client(okGet));
    expect(await screen.findByText("LP-10100")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.report.title);
    expect(screen.getByRole("note")).toHaveTextContent(en.common.demoLabel);
    expect(screen.getByTestId("report-summary")).toHaveTextContent(en.status.ACTIVE);
    expect(screen.getByTestId("report-summary")).toHaveTextContent("v-clean");
    expect(screen.getByTestId("verified-at")).toHaveTextContent("2026");
    expect(screen.getByTestId("risk-score")).toHaveTextContent("0");
    expect(screen.getByTestId("risk-section")).toHaveTextContent(en.risk.noEvidence);
    expect(within(screen.getByRole("list", { name: en.result.ownership })).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByTestId("doc-consistency")).toHaveTextContent(en.report.docStatus.NO_ISSUES);
    expect(screen.getByTestId("doc-consistency")).toHaveTextContent(en.report.noIndicators);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByTestId("report-disclaimer")).toHaveTextContent(en.report.disclaimer.DEMO_DECISION_SUPPORT);
    expect(screen.getByTestId("qr-card")).toBeTruthy();
    expect(screen.getByRole("button", { name: en.report.print })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.report.backToResult })).toHaveAttribute("href", "/verify/result?land_id=LP-10100");
  });

  it("renders the double-sale report (LP-10240): HIGH 70, evidence, doc indicators, flagged txs", async () => {
    wrap(<ReportView id="v-dbl" />, client(okGet));
    expect(await screen.findByText("LP-10240")).toBeInTheDocument();
    expect(screen.getByTestId("risk-score")).toHaveTextContent("70");
    expect(screen.getAllByText(en.risk.level.HIGH).length).toBeGreaterThan(0);
    const ev = within(screen.getByTestId("risk-section")).getByRole("list", { name: en.risk.evidenceTitle });
    expect(within(ev).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/Possible duplicate transaction: 2 transactions/)).toBeInTheDocument();
    const dc = screen.getByTestId("doc-consistency");
    expect(dc).toHaveTextContent(en.report.docStatus.INCONSISTENCIES_FOUND);
    expect(dc).toHaveTextContent(`${en.status.APPROVED}: 2`);
    expect(dc.querySelector('[data-code="DUPLICATE_DEED"]')).not.toBeNull();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent(en.status.FLAGGED);
  });

  it("falls back to the default disclaimer and raw status for unknown codes", async () => {
    const odd = { ...CLEAN, disclaimer_code: "SOMETHING_NEW", document_consistency: { ...CLEAN.document_consistency, status: "WEIRD", by_status: { ODD: 1 } } };
    wrap(<ReportView id="x" />, client(() => Promise.resolve(odd)));
    expect(await screen.findByTestId("report-disclaimer")).toHaveTextContent(en.report.disclaimer.DEMO_DECISION_SUPPORT);
    expect(screen.getByTestId("doc-consistency")).toHaveTextContent("WEIRD");
    expect(screen.getByTestId("doc-consistency")).toHaveTextContent("ODD: 1");
  });

  it("renders in Bangla with the Bangla disclaimer and exact document values", async () => {
    wrap(<ReportView id="v-dbl" />, client(okGet), bn, "bn");
    await waitFor(() => expect(screen.getByText(bn.report.title)).toBeInTheDocument());
    expect(screen.getByTestId("report-disclaimer")).toHaveTextContent(bn.report.disclaimer.DEMO_DECISION_SUPPORT);
    expect(screen.getByTestId("doc-consistency")).toHaveTextContent(bn.report.docStatus.INCONSISTENCIES_FOUND);
    expect((await screen.findAllByText("Rahim Uddin")).length).toBeGreaterThan(0);
  });

  it("shows loading, not-found, not-ready, permission and generic error (with retry)", async () => {
    const a = wrap(<ReportView id="v-clean" />, client(() => new Promise(() => {})));
    expect(screen.getByRole("status")).toHaveTextContent(en.common.loading);
    a.unmount();
    const b = wrap(<ReportView id="nope" />, client(okGet));
    expect(await screen.findByText(en.report.notFound)).toBeInTheDocument();
    b.unmount();
    const c = wrap(<ReportView id="v" />, client(() => Promise.reject(new ApiError(409, "VERIFICATION_NOT_READY", "x"))));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.report.notReady);
    c.unmount();
    const d = wrap(<ReportView id="v" />, client(() => Promise.reject(new ApiError(403, "FORBIDDEN", "x"))));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.errors.permission);
    d.unmount();
    wrap(<ReportView id="v" />, client(() => Promise.reject(new ApiError(500, "X", "boom"))));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.report.loadError);
    expect(screen.getByRole("button", { name: en.common.retry })).toBeInTheDocument();
  });

  it("print button calls window.print", async () => {
    const spy = vi.spyOn(window, "print").mockImplementation(() => {});
    wrap(<ReportView id="v-clean" />, client(okGet));
    fireEvent.click(await screen.findByRole("button", { name: en.report.print }));
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("GenerateReportButton", () => {
  it("POSTs /verification and navigates to the report page", async () => {
    push.mockClear();
    const post = vi.fn().mockResolvedValue({ id: "v-new", land_id: "LP-10100", status: "COMPLETED" });
    wrap(<GenerateReportButton landId="LP-10100" />, client(okGet, post));
    fireEvent.click(screen.getByRole("button", { name: en.report.generate }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/report/v-new"));
    expect(post).toHaveBeenCalledWith("/verification", { land_id: "LP-10100" });
  });

  it("shows an error alert on failure and a permission message on 403", async () => {
    const a = wrap(<GenerateReportButton landId="LP-10100" />, client(okGet, vi.fn().mockRejectedValue(new ApiError(500, "VERIFICATION_FAILED", "x"))));
    fireEvent.click(screen.getByRole("button", { name: en.report.generate }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.report.generateError);
    a.unmount();
    wrap(<GenerateReportButton landId="LP-10100" />, client(okGet, vi.fn().mockRejectedValue(new ApiError(403, "FORBIDDEN", "x"))));
    fireEvent.click(screen.getByRole("button", { name: en.report.generate }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.errors.permission);
  });
});
