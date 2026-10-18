import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import ResultView from "./ResultView";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/verify/result",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const p = (name: string) => ({ name, father_name: null });
const DATA: Record<string, any> = {
  "/lands/LP-10240": { land_id: "LP-10240", district: "Dhaka", upazila: "Savar", mouza: "Ashulia", khatian_no: "610", dag_no: "210", area: 20, area_unit: "decimal", status: "ACTIVE", current_owners: [p("Hasan Ali")] },
  "/lands/LP-10240/ownership": { entries: [] },
  "/lands/LP-10240/transactions": { transactions: [] },
  "/lands/LP-10240/mutations": { land_id: "LP-10240", mutations: [] },
  "/lands/LP-10240/encumbrances": { land_id: "LP-10240", encumbrances: [] },
  "/lands/LP-10240/risk": { land_id: "LP-10240", overall_score: 0, risk_level: "LOW", rule_score: 0, evidence: [], assessed_at: "2026-10-01T10:00:00Z" },
  "/lands/LP-10240/documents": {
    land_id: "LP-10240", total: 1,
    items: [{
      id: "d1", land_id: "LP-10240", document_type: "DEED", processing_status: "APPROVED", file_type: "pdf", created_at: "2026-10-01T08:00:00Z",
      office: null, deed_no: "4782/খ", mouza: "ভবানীপুর", deed_date: "1944-02-27", deed_profile: "historical", historical: true,
      uploaded_by_me: false, digitised: true, approved_version: 1, versions: 1, needs_my_action: false,
      approved_record: { version: 1, record_schema: "lhdr/1", approved_at: "2026-10-02T10:00:00Z", approved_by: "O", signature_status: "VALID" },
    }],
  },
};

function setup(role: string) {
  const get = vi.fn((path: string) => (path in DATA ? Promise.resolve(DATA[path]) : Promise.reject(new ApiError(404, "NOT_FOUND", "x"))));
  const user = { id: "1", name: "U", email: "u@x.co", role, preferred_language: "en" };
  const client = { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <ResultView landId="LP-10240" />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return get;
}

describe("ResultView Documents section (H7d, staff only)", () => {
  it("shows the Documents section to an officer and lists the land's deeds", async () => {
    const get = setup("OFFICER");
    const toggle = (await screen.findAllByTestId("section-toggle")).find((x) => x.textContent?.startsWith(en.result.tabDocuments));
    expect(toggle).toBeTruthy();
    expect(await screen.findByText(`1`, { selector: "span.rounded-full" })).toBeInTheDocument();
    fireEvent.click(toggle as HTMLElement);
    const row = await screen.findByTestId("land-doc-d1");
    expect(row.querySelector("a")).toHaveAttribute("href", "/officer/documents/d1");
    expect(get).toHaveBeenCalledWith("/lands/LP-10240/documents");
  });

  it("does not show the section or call the endpoint for a citizen", async () => {
    const get = setup("CITIZEN");
    await screen.findAllByTestId("section-toggle");
    expect(screen.queryByTestId("section-documents")).toBeNull();
    expect(get.mock.calls.map((c) => c[0])).not.toContain("/lands/LP-10240/documents");
  });
});
