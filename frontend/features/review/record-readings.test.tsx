import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
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

// the sample deed's gold file with every value wrapped as a Field, like the API returns it
const gold = JSON.parse(
  readFileSync(resolve(__dirname, "../../../database/sample_data/historical/Historical_Land_Deed.gold.json"), "utf8"),
);
function wrap(v: any): any {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x !== null ? wrap(x) : { value: x, confidence: 0.93 }));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wrap(x)]));
  return { value: v, confidence: 0.93 };
}
const record: LhdrRecord = wrap(gold);

const reviewer = { id: "1", name: "R", email: "r@x.co", role: "REVIEWER", preferred_language: "en" };
const doc = { id: "d1", land_id: "LP-10001", document_type: "DEED", processing_status: "REVIEW_REQUIRED",
  file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z", party_nids: { buyer: "0077" } };

function base(over: Partial<ExtractionOut> = {}): ExtractionOut {
  return {
    document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "rules", threshold: 0.85,
    deed_profile: "historical", record,
    fields: [{ field: "deed_no", value: "4782/খ", confidence: 0.95, source_bbox: null, edited_by_human: false, low_confidence: false }],
    edited_by_human: false, has_low_confidence: false, low_confidence_fields: [],
    validation: { valid: true, errors: [] }, ...over,
  };
}

function setup(ext: Partial<ExtractionOut> = {}, patch?: (body: any) => Promise<ExtractionOut>) {
  const full = base(ext);
  const patchFn = vi.fn((_path: string, body: any) => (patch ? patch(body) : Promise.resolve(full)));
  const get = vi.fn((path: string) =>
    Promise.resolve(path.endsWith("/extraction") ? full : { ...doc, processing_status: full.processing_status }),
  );
  const client = { refresh: vi.fn().mockResolvedValue({ user: reviewer }), get, patch: patchFn, post: vi.fn(),
    blob: vi.fn().mockResolvedValue(new Blob(["x"])) } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}><ReviewView id="d1" /></AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { patch: patchFn };
}



const withReg = (deed_no: any, volume?: any): LhdrRecord => ({
  ...record,
  registration: { ...record.registration, deed_no, ...(volume ? { volume } : {}) },
});
const disagreeing = withReg({
  value: "4782/খ",
  confidence: 0.6,
  method: "ocr+rules",
  flags: ["DISAGREE"],
  candidates: [{ value: "4732/খ", method: "llm", confidence: 0.55 }],
  source: { page: 1, bbox: [100, 200, 300, 50] },
});

describe("both readings, flags and source highlight (H6d)", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  it("shows the flag and the other reading; picking it sends one replace op", async () => {
    const { patch } = setup({ record: disagreeing });
    expect(await screen.findByTestId("deed-deed_no-flag-DISAGREE")).toHaveTextContent("Two readings differ");
    const cands = screen.getByTestId("deed-deed_no-candidates");
    expect(cands).toHaveTextContent("4732/খ");
    expect(cands).toHaveTextContent("llm");
    fireEvent.click(screen.getByTestId("deed-deed_no-candidate-use"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0][1].record).toEqual([{ op: "replace", path: "/registration/deed_no", value: "4732/খ" }]);
  });

  it("a refused pick keeps the picker and says why", async () => {
    const err = new ApiError(422, "RECORD_VALIDATION_FAILED", "x", [{ path: "/registration/deed_no", code: "DEED_NO_FORMAT_INVALID" }] as any);
    setup({ record: disagreeing }, () => Promise.reject(err));
    fireEvent.click(await screen.findByTestId("deed-deed_no-candidate-use"));
    expect(await screen.findByTestId("deed-deed_no-candidate-error")).toBeInTheDocument();
    expect(screen.getByTestId("deed-deed_no-candidates")).toBeInTheDocument();
  });

  it("the picker is read-only (no button) when the document is not reviewable", async () => {
    setup({ record: disagreeing, processing_status: "APPROVED" });
    expect(await screen.findByTestId("deed-deed_no-candidates")).toBeInTheDocument();
    expect(screen.queryByTestId("deed-deed_no-candidate-use")).not.toBeInTheDocument();
  });

  it("NOT_IN_TEXT and unknown flags show; a value without flags or candidates shows neither", async () => {
    setup({ record: withReg({ value: "1", flags: ["NOT_IN_TEXT", "WEIRD"] }) });
    expect(await screen.findByTestId("deed-deed_no-flag-NOT_IN_TEXT")).toHaveTextContent("Not found in the OCR text");
    expect(screen.getByTestId("deed-deed_no-flag-WEIRD")).toHaveTextContent("WEIRD");
    expect(screen.queryByTestId("deed-deed_no-candidates")).not.toBeInTheDocument();
    expect(screen.queryByTestId("deed-volume-candidates")).not.toBeInTheDocument();
  });

  it("clicking Show on page draws the box over the image, and Clear removes it", async () => {
    setup({ record: disagreeing });
    const img = (await screen.findByAltText("Uploaded document")) as HTMLImageElement;
    Object.defineProperty(img, "naturalWidth", { value: 1000 });
    Object.defineProperty(img, "naturalHeight", { value: 2000 });
    fireEvent.load(img);
    expect(screen.queryByTestId("highlight-box")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("deed-deed_no-locate"));
    const box = await screen.findByTestId("highlight-box");
    expect(box.style.left).toBe("10%");
    expect(box.style.top).toBe("10%");
    expect(box.style.width).toBe("30%");
    expect(box.style.height).toBe("2.5%");
    expect(screen.getByTestId("highlight-status")).toHaveTextContent("page 1");
    expect(screen.getByTestId("deed-deed_no-locate")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("highlight-clear"));
    expect(screen.queryByTestId("highlight-box")).not.toBeInTheDocument();
  });

  it("Escape clears the highlight", async () => {
    setup({ record: disagreeing });
    fireEvent.click(await screen.findByTestId("deed-deed_no-locate"));
    expect(await screen.findByTestId("highlight-status")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("highlight-status")).not.toBeInTheDocument());
  });

  it("a value without a bbox has no Show on page button", async () => {
    setup({ record: withReg({ value: "1", source: { page: 2 } }) });
    expect(await screen.findByTestId("deed-deed_no")).toBeInTheDocument();
    expect(screen.queryByTestId("deed-deed_no-locate")).not.toBeInTheDocument();
  });

  it("a page other than 1 on an image says the box cannot be drawn", async () => {
    setup({ record: withReg({ value: "1", source: { page: 2, bbox: [1, 1, 5, 5] } }) });
    const img = (await screen.findByAltText("Uploaded document")) as HTMLImageElement;
    Object.defineProperty(img, "naturalWidth", { value: 100 });
    Object.defineProperty(img, "naturalHeight", { value: 100 });
    fireEvent.load(img);
    fireEvent.click(await screen.findByTestId("deed-deed_no-locate"));
    expect(screen.getByTestId("highlight-status")).toHaveTextContent("cannot be drawn");
    expect(screen.queryByTestId("highlight-box")).not.toBeInTheDocument();
  });
});
