import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  "/lands/LP-10100/mutations": { land_id: "LP-10100", mutations: [] },
  "/lands/LP-10001/mutations": { land_id: "LP-10001", mutations: [] },
  "/lands/LP-10100/risk": risk("LP-10100", 0, "LOW", []),
  "/lands/LP-10001/risk": risk("LP-10001", 0, "LOW", []),
  "/lands/LP-10001": { ...land("LP-10001", ["Jamal Hossain"]), khatian_no: "501", dag_no: "101", area: 15 },
  "/lands/LP-10001/ownership": { entries: [own("Jamal Hossain", "2008-01-10", null, true)] },
  "/lands/LP-10001/transactions": { transactions: [] },
  "/lands/LP-10100/encumbrances": {
    land_id: "LP-10100",
    encumbrances: [{ type: "COURT_CASE", status: "ACTIVE", started_at: "2025-11-01", resolved_at: null, reference_no: null, authority: null }],
  },
};

/** U2.4: record sections are collapsible; open one by its title. */
const openTab = async (name: string) => {
  const toggle = (await screen.findAllByTestId("section-toggle")).find((x) => x.textContent?.startsWith(name));
  if (!toggle) throw new Error(`no section "${name}"`);
  fireEvent.click(toggle);
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

describe("ResultView survey fields (SJ6)", () => {
  it("shows Survey, JL and sheet, and the amber notice only on SHEET_MISMATCH", async () => {
    const withSv = { ...land("LP-10100", ["Hasan Ali"]), survey_type: "RS", jl_no: "12", map_sheet_no: "7", warnings: ["SHEET_MISMATCH"] };
    wrap(client((path) => okGet(path === "/lands/LP-10100" ? "/lands/LP-10100" : path).then((d) => (path === "/lands/LP-10100" ? withSv : d))), "LP-10100");
    const info = await screen.findByTestId("land-info");
    expect(info).toHaveTextContent(en.result.survey);
    expect(info).toHaveTextContent(en.result.jlNo);
    expect(info).toHaveTextContent(en.result.sheetNo);
    expect(screen.getByTestId("sheet-warning")).toHaveTextContent(en.result.sheetMismatch);
  });

  it("shows no warning and no survey row for an old record", async () => {
    wrap(client(okGet), "LP-10100");
    await screen.findByTestId("land-info");
    expect(screen.queryByTestId("sheet-warning")).toBeNull();
    expect(screen.queryByText(en.result.jlNo)).toBeNull();
  });
});

describe("ResultView", () => {
  it("renders LP-10100: land info, ordered timeline, 2 transactions, banner, disclaimer, risk section", async () => {
    wrap(client(okGet), "LP-10100");
    expect(await screen.findByText("LP-10100")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(en.common.demoLabel);
    expect(screen.getByText(en.risk.disclaimer)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en.result.title);
    expect(screen.getByRole("navigation", { name: en.page.breadcrumb })).toBeInTheDocument();
    expect(screen.getByTestId("page-meta")).toHaveTextContent("LP-10100");
    await waitFor(() =>
      expect(screen.getAllByTestId("section-toggle").map((x) => x.textContent)).toEqual([
        en.result.landInfo, `${en.result.tabOwnership}3`, `${en.result.tabTransactions}2`, `${en.result.tabMutation}0`, `${en.result.tabEncumbrance}1`, `${en.result.tabEvidence}0`,
      ]),
    );
    expect(await screen.findByTestId("verdict-badge")).toHaveTextContent(en.risk.level.LOW);

    await openTab(en.result.tabOwnership);
    const items = within(await screen.findByRole("list", { name: en.result.ownership })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Rahim Uddin");
    expect(items[1]).toHaveTextContent("Karim Mia");
    expect(items[2]).toHaveTextContent("Hasan Ali");
    expect(items[2]).toHaveTextContent(en.result.current);
    expect(items[2]).toHaveTextContent(en.result.present);

    await openTab(en.result.tabTransactions);
    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2
    expect(rows[1]).toHaveTextContent("Rahim Uddin");
    expect(rows[1]).toHaveTextContent("Karim Mia");
    expect(rows[1]).toHaveTextContent(en.result.txType.SALE);
    expect(rows[2]).toHaveTextContent("Hasan Ali");

    await openTab(en.result.tabEvidence);
    expect(await screen.findByTestId("risk-section")).toHaveTextContent(en.risk.noEvidence);
  });

  it("leads with the verdict: big badge, three plain lines, then what to do now", async () => {
    wrap(client(okGet), "LP-10100");
    const verdict = await screen.findByTestId("verdict");
    expect(within(verdict).getByTestId("verdict-badge")).toHaveTextContent(en.risk.level.LOW);
    expect(within(verdict).getByText(en.result.verdict.headline.LOW)).toBeInTheDocument();
    const lines = within(within(verdict).getByTestId("verdict-summary")).getAllByRole("listitem");
    expect(lines.map((x) => x.textContent)).toEqual([en.result.verdict.level.LOW, "No warning signs were raised.", en.result.verdict.casesNone]);
    const steps = within(within(verdict).getByTestId("next-steps"));
    expect(steps.getByText(en.result.verdict.stepsTitle)).toBeInTheDocument();
    expect(steps.getAllByRole("listitem").map((x) => x.textContent)).toEqual([en.result.verdict.steps.confirmOffice, en.result.verdict.steps.report]);
    // order on the page: verdict → details sections
    const all = screen.getByTestId("verdict").compareDocumentPosition(screen.getByTestId("section-ownership"));
    expect(all & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("HIGH risk with an open case warns first, opens the evidence section and tells the user not to pay", async () => {
    const ev = [
      { code: "ACTIVE_LITIGATION", severity: "HIGH", params: { reference_no: "C-9" } },
      { code: "SELLER_MISMATCH", severity: "HIGH", params: { transaction_date: "2019-06-20" } },
    ];
    const get = (path: string) => (path === "/lands/LP-10100/risk" ? Promise.resolve(risk("LP-10100", 85, "HIGH", ev)) : okGet(path));
    wrap(client(get), "LP-10100");
    const verdict = await screen.findByTestId("verdict");
    await within(verdict).findByText(en.result.verdict.headline.HIGH);
    expect(within(verdict).getByTestId("verdict-badge")).toHaveAttribute("data-risk", "HIGH");
    expect(within(verdict).getByText("2 warning signs were raised.")).toBeInTheDocument();
    expect(within(verdict).getByText(en.result.verdict.casesSome)).toBeInTheDocument();
    const steps = within(verdict).getAllByRole("listitem").filter((x) => x.closest("ol"));
    expect(steps.map((x) => x.textContent)).toEqual([en.result.verdict.steps.noPay, en.result.verdict.steps.caseDocs, en.result.verdict.steps.takeReport]);
    expect(await screen.findByTestId("risk-section")).toBeInTheDocument(); // evidence section opened by itself
  });

  it("keeps the detail sections closed until opened (only the land facts start open)", async () => {
    wrap(client(okGet), "LP-10100");
    await screen.findByTestId("verdict");
    expect(screen.getByTestId("section-land")).toHaveAttribute("open");
    expect(screen.getByTestId("section-ownership")).not.toHaveAttribute("open");
    expect(screen.queryByRole("list", { name: en.result.ownership })).toBeNull();
    await openTab(en.result.tabOwnership);
    expect(await screen.findByRole("list", { name: en.result.ownership })).toBeInTheDocument();
  });

  it("still gives next steps when the risk check fails", async () => {
    const get = (path: string) => (path.endsWith("/risk") ? Promise.reject(new ApiError(500, "X", "boom")) : okGet(path));
    wrap(client(get), "LP-10100");
    const verdict = await screen.findByTestId("verdict");
    expect(await within(verdict).findByRole("alert")).toHaveTextContent(en.risk.loadError);
    expect(within(verdict).getByText(en.result.verdict.steps.retry)).toBeInTheDocument();
  });

  it("shows cases / encumbrances in their section", async () => {
    wrap(client(okGet), "LP-10100");
    await openTab(en.result.tabEncumbrance);
    const row = within(await screen.findByRole("table", { name: en.result.encumbrances })).getAllByRole("row")[1];
    expect(row).toHaveTextContent(en.result.encType.COURT_CASE);
    expect(row).toHaveTextContent(en.status.ACTIVE);
    expect(row).toHaveTextContent(en.result.notResolved);
  });

  it("renders the mutation history table with status, dates and khatian change", async () => {
    const get = (path: string) =>
      path === "/lands/LP-10100/mutations"
        ? Promise.resolve({
            land_id: "LP-10100",
            mutations: [{ mutation_no: "M-77", status: "APPLIED", applied_at: "2026-02-01T04:00:00Z", decided_at: null, previous_khatian_no: "501", new_khatian_no: "612", ac_land_office: "Savar AC Land" }],
          })
        : okGet(path);
    wrap(client(get), "LP-10100");
    await openTab(en.result.tabMutation);
    const tables = await screen.findAllByRole("table", { name: en.result.mutations });
    const row = within(tables[0]).getAllByRole("row")[1];
    expect(row).toHaveTextContent("M-77");
    expect(row).toHaveTextContent(en.status.APPLIED);
    expect(row).toHaveTextContent("501 → 612");
    expect(row).toHaveTextContent(en.result.notDecided);
    expect(row).toHaveTextContent("Savar AC Land");
  });

  it("shows empty mutation state", async () => {
    wrap(client(okGet), "LP-10100");
    await openTab(en.result.tabMutation);
    expect(await screen.findByText(en.result.noMutations)).toBeInTheDocument();
  });

  it("offers a generate-report action on the result page", async () => {
    wrap(client(okGet), "LP-10100");
    expect(await screen.findByRole("button", { name: en.report.generate })).toBeInTheDocument();
  });

  it("renders LP-10001: single owner and empty transactions state", async () => {
    wrap(client(okGet), "LP-10001");
    expect(await screen.findByText("LP-10001")).toBeInTheDocument();
    await openTab(en.result.tabOwnership);
    const items = within(await screen.findByRole("list", { name: en.result.ownership })).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Jamal Hossain");
    await openTab(en.result.tabTransactions);
    expect(await screen.findByText(en.result.noTransactions)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows loading while pending", () => {
    wrap(client(() => new Promise(() => {})), "LP-10100");
    expect(screen.getByRole("status")).toHaveTextContent(en.common.loading);
  });

  it("shows the empty state for an unknown land (404) and when land_id is missing", async () => {
    const a = wrap(client(okGet), "LP-99999");
    expect(await screen.findByText(en.result.notFound)).toBeInTheDocument();
    a.unmount();
    wrap(client(okGet), undefined);
    expect(screen.getByText(en.result.notFound)).toBeInTheDocument();
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
    await openTab(bn.result.tabTransactions);
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect((await screen.findAllByText("Rahim Uddin")).length).toBeGreaterThan(0);
  });
});

describe("read aloud (U4.4)", () => {
  const SPEECH = () => {
    const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [{ lang: "en-US" }, { lang: "bn-BD" }], addEventListener: vi.fn(), removeEventListener: vi.fn() };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    return synth;
  };

  afterEach(() => Reflect.deleteProperty(window, "speechSynthesis"));

  it("offers Listen once the record is loaded, and reads it without the action buttons", async () => {
    const synth = SPEECH();
    wrap(client(okGet), "LP-10100");
    fireEvent.click(await screen.findByRole("button", { name: `${en.readAloud.listen}: ${en.readAloud.subjectResult}` }));
    const said = synth.speak.mock.calls.map(([u]) => u.text).join(" ");
    expect(said).toContain("LP-10100");
    expect(said).not.toContain(en.result.newSearch);
  });

  it("is not shown for an unknown land", async () => {
    SPEECH();
    wrap(client(okGet), "LP-99999");
    await screen.findByText(en.result.notFound);
    expect(screen.queryByTestId("read-aloud")).not.toBeInTheDocument();
  });
});

describe("formatDate", () => {
  it("formats ISO dates and falls back for null", () => {
    expect(formatDate("2012-03-15", "en", "n/a")).toContain("2012");
    expect(formatDate(null, "en", "n/a")).toBe("n/a");
  });
});
