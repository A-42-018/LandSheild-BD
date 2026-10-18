import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import DeedView from "./deed/DeedView";
import ReviewView from "./ReviewView";
import type { ExtractionOut, LhdrRecord } from "./types";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// the sample deed's gold file (plain values), every value wrapped as a Field like the API returns it
const gold = JSON.parse(
  readFileSync(resolve(__dirname, "../../../database/sample_data/historical/Historical_Land_Deed.gold.json"), "utf8"),
);
const LISTS = new Set(["dag_no", "languages", "witnesses", "stamps", "seals", "parties", "schedule"]);
function wrap(v: any, key = ""): any {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x !== null ? wrap(x) : { value: x, confidence: 0.93 }));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wrap(x, k)]));
  return { value: v, confidence: 0.93 };
}
const record: LhdrRecord = wrap(gold);
// one value read worse than the rest, one with a different verbatim text, one edited by a human
record.registration!.deed_no = { value: "4782/খ", verbatim: "৪৭৮২/খ", confidence: 0.72 };
record.registration!.deed_no_verbatim = { value: "৪৭৮২/খ", confidence: 0.93, edited_by_human: true };
record.consideration!.in_words = { value: "এক হাজার পাঁচশত", confidence: 0.8, legibility: "faded" };

const wrapIn = (locale: string, messages: any, ui: React.ReactNode) => (
  <NextIntlClientProvider locale={locale} messages={messages}>{ui}</NextIntlClientProvider>
);

describe("DeedView (H6a, read-only digital deed)", () => {
  it("renders every section of the sample deed in English", () => {
    render(wrapIn("en", en, <DeedView record={record} />));
    for (const s of ["registration", "dates", "parties", "consideration", "schedule", "title", "execution"]) {
      expect(screen.getByTestId(`deed-section-${s}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("deed-deed_no-value")).toHaveTextContent("4782/খ");
    expect(screen.getByTestId("deed-execution_verbatim-value")).toHaveTextContent("১৫ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ");
    expect(screen.getByTestId("deed-execution_calendar-value")).toHaveTextContent("Bangla (Bongabdo)");
    expect(screen.getByTestId("deed-execution_from-value")).toHaveTextContent("1944-02-26");
    expect(screen.getByTestId("deed-amount-value")).toHaveTextContent("1500");
    expect(screen.getByTestId("deed-era_currency-value")).toHaveTextContent("INR");
    expect(screen.getByTestId("deed-kind-value")).toHaveTextContent("Sale (saf kabala)");
    expect(screen.getByTestId("deed-encumbrance_free-value")).toHaveTextContent("Yes");
  });

  it("shows both parties as cards with their role, parents and address", () => {
    render(wrapIn("en", en, <DeedView record={record} />));
    const seller = screen.getByTestId("deed-party-party0");
    expect(seller).toHaveAttribute("data-role", "SELLER");
    expect(within(seller).getByTestId("deed-party0_role-value")).toHaveTextContent("Seller");
    expect(within(seller).getByTestId("deed-party0_name-value")).toHaveTextContent("কফিল উদ্দিন");
    expect(within(seller).getByTestId("deed-party0_father-value")).toHaveTextContent("সমসের আলী");
    expect(within(seller).getByTestId("deed-party0_father_deceased-value")).toHaveTextContent("Yes");
    expect(within(seller).getByTestId("deed-party0_thana-value")).toHaveTextContent("রূপগঞ্জ");
    const buyer = screen.getByTestId("deed-party-party1");
    expect(buyer).toHaveAttribute("data-role", "BUYER");
    expect(within(buyer).getByTestId("deed-party1_name-value")).toHaveTextContent("রামকান্ত দাশ");
  });

  it("shows the schedule plot with its area and the four boundaries", () => {
    render(wrapIn("en", en, <DeedView record={record} />));
    const plot = screen.getByTestId("deed-plot-0");
    expect(within(plot).getByTestId("deed-plot0_mouza-value")).toHaveTextContent("ভবানীপুর");
    expect(within(plot).getByTestId("deed-plot0_khatian-value")).toHaveTextContent("120");
    expect(within(plot).getByTestId("deed-plot0_dag0-value")).toHaveTextContent("455");
    expect(within(plot).getByTestId("deed-plot0_survey-value")).toHaveTextContent("CS");
    expect(within(plot).getByTestId("deed-plot0_area-value")).toHaveTextContent("0.5");
    expect(within(plot).getByTestId("deed-plot0_unit-value")).toHaveTextContent("acre");
    const b = within(plot).getByTestId("deed-boundaries-plot0");
    expect(within(b).getByTestId("deed-plot0_north-value")).toHaveTextContent("আব্দুল করিমের জমি");
    expect(within(b).getByTestId("deed-plot0_west-value")).toHaveTextContent("রহিম সেখের জমি");
  });

  it("shows the verbatim text, confidence band, edited mark and legibility", () => {
    render(wrapIn("en", en, <DeedView record={record} />));
    const deedNo = screen.getByTestId("deed-deed_no");
    expect(deedNo).toHaveAttribute("data-band", "low");
    expect(deedNo).toHaveTextContent("Low · 72%");
    expect(screen.getByTestId("deed-deed_no-verbatim")).toHaveTextContent("As written: ৪৭৮২/খ");
    // same text as the value: no second line
    expect(screen.queryByTestId("deed-deed_no_verbatim-verbatim")).not.toBeInTheDocument();
    expect(screen.getByTestId("deed-deed_no_verbatim")).toHaveTextContent("edited");
    expect(screen.getByTestId("deed-in_words-legibility")).toHaveTextContent("Faded");
    expect(screen.getByTestId("deed-amount")).toHaveAttribute("data-band", "high");
  });

  it("says 'Not read' for a value the deed does not show and tolerates a bare record", () => {
    render(wrapIn("en", en, <DeedView record={{ schema: "lhdr/1", registration: { deed_no: "12/ক" } }} />));
    expect(screen.getByTestId("deed-deed_no-value")).toHaveTextContent("12/ক");
    expect(screen.getByTestId("deed-deed_no")).not.toHaveAttribute("data-band");
    expect(screen.getByTestId("deed-office-value")).toHaveTextContent("Not read");
    expect(screen.getByTestId("deed-parties-empty")).toBeInTheDocument();
    expect(screen.getByTestId("deed-schedule-empty")).toBeInTheDocument();
  });

  it("renders in Bangla with the Bangla labels", () => {
    render(wrapIn("bn", bn, <DeedView record={record} />));
    expect(screen.getByTestId("deed-section-schedule")).toHaveTextContent("তপশিল");
    expect(screen.getByTestId("deed-section-parties")).toHaveTextContent("পক্ষসমূহ");
    expect(screen.getByTestId("deed-party-party0")).toHaveTextContent("বিক্রেতা");
    expect(screen.getByTestId("deed-execution_calendar-value")).toHaveTextContent("বাংলা (বঙ্গাব্দ)");
    expect(screen.getByTestId("deed-deed_no")).toHaveTextContent("কম · 72%");
    expect(screen.queryByText(/review\.deed/)).not.toBeInTheDocument();
  });

  it("has the same label keys in English and Bangla", () => {
    const keys = (o: any, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(bn.review.deed).sort()).toEqual(keys(en.review.deed).sort());
  });
});

// ---- ExtractionPanel switches on deed_profile -------------------------------------------------

const reviewer = { id: "1", name: "R", email: "r@x.co", role: "REVIEWER", preferred_language: "en" };
const doc = { id: "d1", land_id: "LP-10001", document_type: "DEED", processing_status: "REVIEW_REQUIRED",
  file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z", party_nids: { buyer: "0077" } };

function setup(ext: Partial<ExtractionOut>) {
  const full: ExtractionOut = {
    document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "mock", threshold: 0.85,
    fields: [{ field: "mouza", value: "Ashulia", confidence: 0.95, source_bbox: null, edited_by_human: false, low_confidence: false }],
    edited_by_human: false, has_low_confidence: false, low_confidence_fields: [],
    validation: { valid: true, errors: [] }, ...ext,
  };
  const get = vi.fn((path: string) => Promise.resolve(path.endsWith("/extraction") ? full : doc));
  const client = { refresh: vi.fn().mockResolvedValue({ user: reviewer }), get, patch: vi.fn(), post: vi.fn(), blob: vi.fn().mockResolvedValue(new Blob(["x"])) } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}><ReviewView id="d1" /></AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("ExtractionPanel: digital deed vs flat rows", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  it("historical deed with a record: sectioned view, flat rows kept in a collapsed block", async () => {
    setup({ deed_profile: "historical", record });
    expect(await screen.findByTestId("deed-view")).toBeInTheDocument();
    expect(screen.getByTestId("core-fields")).not.toHaveAttribute("open");
    expect(within(screen.getByTestId("core-fields")).getByTestId("field-mouza")).toBeInTheDocument();
  });

  it("modern deed: the 13 flat rows only", async () => {
    setup({ deed_profile: "modern" });
    expect(await screen.findByTestId("field-mouza")).toBeInTheDocument();
    expect(screen.queryByTestId("deed-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("core-fields")).not.toBeInTheDocument();
  });

  it("historical deed without a record yet: flat rows", async () => {
    setup({ deed_profile: "historical", record: null });
    expect(await screen.findByTestId("field-mouza")).toBeInTheDocument();
    expect(screen.queryByTestId("deed-view")).not.toBeInTheDocument();
  });
});
