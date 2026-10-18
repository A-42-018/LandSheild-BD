import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

/** The record after one edit, the way the API answers (value replaced, marked edited). */
function edited(path: string, value: unknown): LhdrRecord {
  const copy = JSON.parse(JSON.stringify(record));
  const segs = path.split("/").slice(1);
  let node = copy;
  for (const s of segs.slice(0, -1)) node = node[s];
  node[segs[segs.length - 1]] = { ...(node[segs[segs.length - 1]] ?? {}), value, edited_by_human: true, method: "human" };
  return copy;
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

const type = (id: string, text: string) => fireEvent.change(screen.getByTestId(`deed-${id}-input`), { target: { value: text } });
const open = async (id: string) => fireEvent.click(await screen.findByTestId(`deed-${id}-edit`));
const save = (id: string) => fireEvent.click(screen.getByTestId(`deed-${id}-save`));

describe("DeedView stays read-only without an editing context (H6a)", () => {
  it("has no edit buttons", () => {
    render(<NextIntlClientProvider locale="en" messages={en}><DeedView record={record} /></NextIntlClientProvider>);
    expect(screen.queryByTestId("deed-deed_no-edit")).not.toBeInTheDocument();
  });
});

describe("Editing single values of the digital deed (H6b)", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  it("deed no: sends one replace op by JSON pointer and shows the saved value as edited", async () => {
    const { patch } = setup({}, () => Promise.resolve(base({ record: edited("/registration/deed_no", "4783/খ") })));
    await open("deed_no");
    type("deed_no", "4783/খ");
    save("deed_no");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith("/documents/d1/extraction", {
      record: [{ op: "replace", path: "/registration/deed_no", value: "4783/খ" }],
    });
    await waitFor(() => expect(screen.getByTestId("deed-deed_no-value")).toHaveTextContent("4783/খ"));
    expect(screen.getByTestId("deed-deed_no")).toHaveTextContent("edited");
    expect(screen.queryByTestId("deed-deed_no-form")).not.toBeInTheDocument();
  });

  it("verbatim execution date: a text edit at /dates/execution/verbatim", async () => {
    const { patch } = setup();
    await open("execution_verbatim");
    type("execution_verbatim", "১৬ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ");
    save("execution_verbatim");
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][1]).toEqual({
      record: [{ op: "replace", path: "/dates/execution/verbatim", value: "১৬ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ" }],
    });
  });

  it("consideration amount: sent as a number, a non-number is refused before any request", async () => {
    const { patch } = setup();
    await open("amount");
    type("amount", "abc");
    save("amount");
    expect(await screen.findByText("Enter a number.")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
    type("amount", "1,600");
    save("amount");
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][1]).toEqual({ record: [{ op: "replace", path: "/consideration/amount", value: 1600 }] });
  });

  it("coded values are picked from a list; yes / no is sent as a boolean; clearing sends null", async () => {
    const { patch } = setup();
    await open("era");
    type("era", "BANGLADESH");
    save("era");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0][1]).toEqual({ record: [{ op: "replace", path: "/document/era", value: "BANGLADESH" }] });

    await open("encumbrance_free");
    type("encumbrance_free", "false");
    save("encumbrance_free");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1][1]).toEqual({ record: [{ op: "replace", path: "/title_recital/encumbrance_free", value: false }] });

    await open("pay_mode");
    type("pay_mode", "  ");
    save("pay_mode");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(3));
    expect(patch.mock.calls[2][1]).toEqual({ record: [{ op: "replace", path: "/consideration/mode", value: null }] });
  });

  it("title recital, execution (writer, stamp) and registration date use their own pointers", async () => {
    const { patch } = setup();
    await open("basis");
    type("basis", "উত্তরাধিকার");
    save("basis");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0][1].record[0].path).toBe("/title_recital/basis");

    await open("writer_name");
    type("writer_name", "আব্দুল জব্বার");
    save("writer_name");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1][1].record[0].path).toBe("/execution/deed_writer/name");

    await open("registration_verbatim");
    type("registration_verbatim", "২০ই ফাল্গুন ১৩৫০");
    save("registration_verbatim");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(3));
    expect(patch.mock.calls[2][1].record[0].path).toBe("/dates/registration/verbatim");
  });

  it("an unchanged value sends nothing", async () => {
    const { patch } = setup();
    await open("deed_no");
    save("deed_no");
    await waitFor(() => expect(screen.queryByTestId("deed-deed_no-form")).not.toBeInTheDocument());
    expect(patch).not.toHaveBeenCalled();
  });

  it("a refused save keeps the form open and shows the reason under the value", async () => {
    const { patch } = setup({}, () =>
      Promise.reject(new ApiError(422, "RECORD_VALIDATION_FAILED", "Record values are invalid", [
        { path: "/consideration/amount", code: "AMOUNT_NOT_POSITIVE", message: "consideration must be greater than 0" },
      ])),
    );
    await open("amount");
    type("amount", "0");
    save("amount");
    expect(await screen.findByText("The consideration must be greater than zero.")).toBeInTheDocument();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("deed-amount-form")).toBeInTheDocument();
  });

  it("a failure without details says the value was not saved", async () => {
    setup({}, () => Promise.reject(new ApiError(500, "INTERNAL", "boom")));
    await open("deed_no");
    type("deed_no", "9/ক");
    save("deed_no");
    expect(await screen.findByText("The value could not be saved. Try again.")).toBeInTheDocument();
  });

  it("shows the issues the API reports next to their value (errors and warnings)", async () => {
    setup({
      record_validation: {
        valid: false,
        errors: [{ path: "/dates/execution/verbatim", code: "MISSING_EXECUTION_DATE", message: "x" }],
        warnings: [{ path: "/document/era", code: "ERA_MISMATCH", message: "y" }],
      },
    });
    const date = await screen.findByTestId("deed-execution_verbatim-issue");
    expect(date).toHaveTextContent("The execution date as written is required.");
    expect(date).toHaveAttribute("data-severity", "error");
    const era = screen.getByTestId("deed-era-issue");
    expect(era).toHaveTextContent("The era does not match the execution date.");
    expect(era).toHaveAttribute("data-severity", "warning");
    expect(within(screen.getByTestId("deed-deed_no")).queryByTestId("deed-deed_no-issue")).not.toBeInTheDocument();
  });

  it("an unknown issue code falls back to the API message", async () => {
    setup({ record_validation: { valid: true, errors: [], warnings: [{ path: "/registration/office", code: "SOMETHING_NEW", message: "Office looks odd" }] } });
    expect(await screen.findByTestId("deed-office-issue")).toHaveTextContent("Office looks odd");
  });

  it("no edit buttons once the document is decided", async () => {
    setup({ processing_status: "APPROVED" });
    expect(await screen.findByTestId("deed-view")).toBeInTheDocument();
    expect(screen.queryByTestId("deed-deed_no-edit")).not.toBeInTheDocument();
  });
});
