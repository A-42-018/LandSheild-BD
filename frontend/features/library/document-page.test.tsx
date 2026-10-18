import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import DocumentPage from "./DocumentPage";
import LandDocuments from "./LandDocuments";
import { defaultVersion } from "./VersionPanel";
import { documentHref, reviewHref } from "./types";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/officer/documents/d1",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const user = { id: "1", name: "U", email: "u@x.co", role: "OFFICER", preferred_language: "en" };

// the sample deed's gold file, every value wrapped as a Field like the API returns it
const gold = JSON.parse(
  readFileSync(resolve(__dirname, "../../../database/sample_data/historical/Historical_Land_Deed.gold.json"), "utf8"),
);
function wrapField(v: any): any {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x !== null ? wrapField(x) : { value: x, confidence: 0.93 }));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wrapField(x)]));
  return { value: v, confidence: 0.93 };
}
const record = wrapField(gold);

const HASH = "f".repeat(64);
const RHASH = "a".repeat(64);
const doc = (over: any = {}) => ({
  id: "d1", land_id: "LP-10240", document_type: "DEED", processing_status: "APPROVED", file_hash: HASH, file_type: "png",
  created_at: "2026-10-01T08:00:00Z", ...over,
});
const version = (n: number, status: string, over: any = {}) => ({
  document_id: "d1", version: n, status, record_schema: "lhdr/1", created_by: n === 1 ? null : "Reviewer One",
  created_at: "2026-10-01T08:00:00Z", updated_at: "2026-10-01T09:00:00Z", approved_by: status === "APPROVED" ? "Officer Two" : null,
  approved_at: status === "APPROVED" ? "2026-10-02T10:00:00Z" : null, record_hash: status === "APPROVED" ? RHASH : null,
  signature: status === "APPROVED" ? "sig" : null, signature_status: status === "APPROVED" ? "VALID" : "UNSIGNED", file_hash: HASH, ...over,
});
const LIST = (items: any[]) => ({ document_id: "d1", file_hash: HASH, items });
const HISTORY = {
  document_id: "d1",
  versions: [
    { version: 1, status: "SUPERSEDED", record_schema: "lhdr/1", events: [{ kind: "CREATED", at: "2026-10-01T08:00:00Z", actor: null, changes: [] }] },
    {
      version: 2, status: "APPROVED", record_schema: "lhdr/1",
      events: [
        { kind: "CREATED", at: "2026-10-01T09:00:00Z", actor: { name: "Reviewer One", role: "REVIEWER" }, changes: [] },
        { kind: "EDIT", at: "2026-10-01T09:30:00Z", actor: { name: "Reviewer One", role: "REVIEWER" }, changes: [{ path: "/registration/deed_no", op: "replace", old: "4782", new: "4782/খ" }] },
        { kind: "APPROVE", at: "2026-10-02T10:00:00Z", actor: { name: "Officer Two", role: "OFFICER" }, changes: [] },
      ],
    },
  ],
};

function api(over: Record<string, any> = {}) {
  const routes: Record<string, any> = {
    "/documents/d1": doc(),
    "/documents/d1/records": LIST([version(1, "SUPERSEDED"), version(2, "APPROVED", { record })]),
    "/documents/d1/records/history": HISTORY,
    "/documents/d1/records/1": version(1, "SUPERSEDED", { record: { ...record, registration: { ...record.registration, deed_no: { value: "OLD/1", confidence: 0.7 } } } }),
    "/documents/d1/records/2": version(2, "APPROVED", { record }),
    ...over,
  };
  return vi.fn((p: string) => (p in routes ? (routes[p] instanceof Error ? Promise.reject(routes[p]) : Promise.resolve(routes[p])) : Promise.reject(new ApiError(404, "NOT_FOUND", "x"))));
}
function wrap(ui: React.ReactNode, get: any, messages: any = en, locale = "en") {
  const client = { refresh: vi.fn().mockResolvedValue({ user }), get, blob: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" })) } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("document links", () => {
  it("opens documents on the document page and reviews on the review screen", () => {
    expect(documentHref({ id: "x1" })).toBe("/officer/documents/x1");
    expect(reviewHref("x1")).toBe("/officer/review/x1");
  });
  it("shows the newest approved version first, else the newest", () => {
    expect(defaultVersion([])).toBeNull();
    expect(defaultVersion([version(1, "SUPERSEDED"), version(2, "APPROVED"), version(3, "DRAFT")] as any)).toBe(2);
    expect(defaultVersion([version(1, "MACHINE"), version(2, "DRAFT")] as any)).toBe(2);
  });
});

describe("document page (H7d)", () => {
  it("shows the original, the digital deed, the hashes and a valid signature for an approved document", async () => {
    wrap(<DocumentPage id="d1" />, api());
    expect(await screen.findByTestId("deed-view")).toBeInTheDocument();
    expect(screen.getByTestId("doc-preview")).toBeInTheDocument();
    expect(screen.getByTestId("deed-deed_no-value")).toHaveTextContent("4782/খ");
    expect(screen.getByTestId("version-status")).toHaveTextContent("Approved");
    expect(screen.getByTestId("signature-status")).toHaveAttribute("data-status", "VALID");
    expect(screen.getByTestId("signature-status")).toHaveTextContent("Signature valid ✓");
    expect(screen.getByTestId("file-hash")).toHaveTextContent(HASH);
    expect(screen.getByTestId("record-hash")).toHaveTextContent(RHASH);
    expect(screen.getByTestId("version-meta")).toHaveTextContent("Officer Two");
    // an approved document does not point back to the review screen
    expect(screen.queryByTestId("review-link")).toBeNull();
    expect(screen.queryByTestId("under-review-note")).toBeNull();
  });

  it("is read-only: no edit button on any value", async () => {
    const { container } = wrap(<DocumentPage id="d1" />, api());
    await screen.findByTestId("deed-view");
    expect(container.querySelector('[data-testid$="-edit"]')).toBeNull();
    expect(container.querySelector('[data-testid$="-remove-box"]')).toBeNull();
  });

  it("switches version through the picker and reads that version", async () => {
    const get = api();
    wrap(<DocumentPage id="d1" />, get);
    await screen.findByTestId("deed-view");
    fireEvent.change(screen.getByLabelText("Version"), { target: { value: "1" } });
    await waitFor(() => expect(screen.getByTestId("deed-deed_no-value")).toHaveTextContent("OLD/1"));
    expect(get).toHaveBeenCalledWith("/documents/d1/records/1");
    expect(screen.getByTestId("version-status")).toHaveTextContent("Superseded");
    expect(screen.getByTestId("signature-status")).toHaveAttribute("data-status", "UNSIGNED");
    expect(screen.getByTestId("version-meta")).toHaveTextContent("Automatic reading");
  });

  it("lists who changed what in the selected version", async () => {
    wrap(<DocumentPage id="d1" />, api());
    const hist = await screen.findByTestId("version-history");
    await within(hist).findByTestId("history-EDIT");
    expect(within(hist).getByTestId("history-CREATED")).toHaveTextContent("Version created");
    expect(within(hist).getByTestId("history-APPROVE")).toHaveTextContent("Officer Two");
    expect(within(hist).getByTestId("history-EDIT")).toHaveTextContent("/registration/deed_no");
    expect(within(hist).getByTestId("history-EDIT")).toHaveTextContent("4782 → 4782/খ");
  });

  it("links to the review screen while the document is under review", async () => {
    wrap(<DocumentPage id="d1" />, api({
      "/documents/d1": doc({ processing_status: "REVIEW_REQUIRED" }),
      "/documents/d1/records": LIST([version(1, "MACHINE", { record })]),
      "/documents/d1/records/1": version(1, "MACHINE", { record }),
    }));
    const link = await screen.findByTestId("review-link");
    expect(link).toHaveAttribute("href", "/officer/review/d1");
    expect(screen.getByTestId("under-review-note")).toBeInTheDocument();
    expect(await screen.findByTestId("deed-view")).toBeInTheDocument();
    expect(screen.getByTestId("version-status")).toHaveTextContent("Machine reading");
  });

  it("shows the 13 flat fields for a modern deed (core/1)", async () => {
    const core = { schema: "core/1", fields: [
      { field: "deed_no", value: "1234", confidence: 0.95 },
      { field: "mouza", value: null, confidence: 0.2 },
    ] };
    wrap(<DocumentPage id="d1" />, api({
      "/documents/d1/records": LIST([version(1, "APPROVED", { record_schema: "core/1", record: core })]),
      "/documents/d1/records/1": version(1, "APPROVED", { record_schema: "core/1", record: core }),
    }));
    expect(await screen.findByTestId("flat-view")).toBeInTheDocument();
    expect(screen.queryByTestId("deed-view")).toBeNull();
    expect(screen.getByTestId("flat-deed_no")).toHaveTextContent("1234");
    expect(screen.getByTestId("flat-mouza")).toHaveTextContent(en.review.valueNotFound);
  });

  it("says so when there is no digital version yet", async () => {
    wrap(<DocumentPage id="d1" />, api({
      "/documents/d1": doc({ processing_status: "UPLOADED" }),
      "/documents/d1/records": LIST([]),
    }));
    expect(await screen.findByText(en.library.doc.noVersions)).toBeInTheDocument();
    expect(screen.getAllByText(en.library.doc.reviewLink).length).toBeGreaterThan(0);
  });

  it("says when the document does not exist", async () => {
    wrap(<DocumentPage id="d1" />, api({ "/documents/d1": new ApiError(404, "DOCUMENT_NOT_FOUND", "x") }));
    expect(await screen.findByText(en.library.doc.notFound)).toBeInTheDocument();
  });

  it("shows an invalid signature as a warning", async () => {
    wrap(<DocumentPage id="d1" />, api({
      "/documents/d1/records": LIST([version(2, "APPROVED", { signature_status: "INVALID", record })]),
      "/documents/d1/records/2": version(2, "APPROVED", { signature_status: "INVALID", record }),
    }));
    expect(await screen.findByText("Signature does not match")).toBeInTheDocument();
  });

  it("renders in Bangla", async () => {
    wrap(<DocumentPage id="d1" />, api(), bn, "bn");
    expect(await screen.findByText(bn.library.doc.original)).toBeInTheDocument();
    expect(await screen.findByText(bn.library.doc.signature.VALID)).toBeInTheDocument();
  });
});

describe("land Documents list (H7d)", () => {
  const item = (over: any = {}) => ({
    id: "d1", land_id: "LP-10240", document_type: "DEED", processing_status: "APPROVED", file_type: "pdf",
    created_at: "2026-10-01T08:00:00Z", office: null, deed_no: "4782/খ", mouza: "ভবানীপুর", deed_date: "1944-02-27",
    deed_profile: "historical", historical: true, uploaded_by_me: false, digitised: true, approved_version: 2, versions: 2,
    needs_my_action: false,
    approved_record: { version: 2, record_schema: "lhdr/1", approved_at: "2026-10-02T10:00:00Z", approved_by: "Officer Two", signature_status: "VALID" },
    ...over,
  });

  it("lists every deed of the land in the order the API gives, each opening its document page", async () => {
    const get = api({
      "/lands/LP-10240/documents": {
        land_id: "LP-10240", total: 2,
        items: [item(), item({ id: "d2", deed_no: "991", historical: false, deed_date: "2019-05-01", approved_record: null, digitised: false, approved_version: null, processing_status: "REVIEW_REQUIRED" })],
      },
    });
    wrap(<LandDocuments landId="LP-10240" />, get);
    const first = await screen.findByTestId("land-doc-d1");
    expect(within(first).getByRole("link")).toHaveAttribute("href", "/officer/documents/d1");
    expect(within(first).getByText("Historical")).toBeInTheDocument();
    expect(within(first).getByText("Signature valid ✓")).toBeInTheDocument();
    const second = screen.getByTestId("land-doc-d2");
    expect(within(second).getByRole("link")).toHaveAttribute("href", "/officer/documents/d2");
    expect(within(second).getByText("Not yet")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^land-doc-/).map((x) => x.getAttribute("data-testid"))).toEqual(["land-doc-d1", "land-doc-d2"]);
    expect(get).toHaveBeenCalledWith("/lands/LP-10240/documents");
  });

  it("says when the land has no document", async () => {
    wrap(<LandDocuments landId="LP-10240" />, api({ "/lands/LP-10240/documents": { land_id: "LP-10240", items: [], total: 0 } }));
    expect(await screen.findByTestId("land-docs-empty")).toHaveTextContent(en.library.landDocs.empty);
  });

  it("shows a load error with a retry", async () => {
    wrap(<LandDocuments landId="LP-10240" />, api({ "/lands/LP-10240/documents": new ApiError(500, "SERVER_ERROR", "x") }));
    expect(await screen.findByText(en.library.landDocs.loadError)).toBeInTheDocument();
  });
});
