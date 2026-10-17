import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import ReviewView from "./ReviewView";
import type { ExtractionOut } from "./types";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const reviewer = { id: "1", name: "R", email: "r@x.co", role: "REVIEWER", preferred_language: "en" };
const FIELDS = ["owner_name", "father_name", "khatian_no", "dag_no", "mouza", "district", "upazila", "land_area", "area_unit", "deed_no", "deed_date", "seller", "buyer"];

const doc = (status = "REVIEW_REQUIRED", partyNids: Record<string, string> = { buyer: "0077" }) => ({
  id: "d1", land_id: "LP-10001", document_type: "DEED", processing_status: status,
  file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z", party_nids: partyNids,
});

function extraction(over: Record<string, any> = {}, top: Partial<ExtractionOut> = {}): ExtractionOut {
  const fields = FIELDS.map((f) => ({
    field: f, value: `v-${f}`, confidence: 0.95, source_bbox: null, edited_by_human: false,
    low_confidence: false, ...(over[f] ?? {}),
  }));
  return {
    document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "mock", threshold: 0.85,
    fields, edited_by_human: false, has_low_confidence: false, low_confidence_fields: [],
    validation: { valid: true, errors: [] }, ...top,
  };
}

function setup(opts: { status?: string; ext?: ExtractionOut; patch?: any; post?: any; messages?: any; locale?: string; partyNids?: Record<string, string> } = {}) {
  const ext = opts.ext ?? extraction();
  const get = vi.fn((path: string) => Promise.resolve(path.endsWith("/extraction") ? ext : doc(opts.status, opts.partyNids)));
  const patch = opts.patch ?? vi.fn().mockResolvedValue(ext);
  const post = opts.post ?? vi.fn().mockResolvedValue(doc());
  const blob = vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" }));
  const client = { refresh: vi.fn().mockResolvedValue({ user: reviewer }), get, patch, post, blob } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale={opts.locale ?? "en"} messages={opts.messages ?? en}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <ReviewView id="d1" />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { get, patch, post };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("inline editing", () => {
  it("edits one field and sends a single-field PATCH, then shows the saved value", async () => {
    const saved = extraction({ khatian_no: { value: "777", edited_by_human: true } });
    const { patch } = setup({ patch: vi.fn().mockResolvedValue(saved) });
    fireEvent.click(await screen.findByTestId("edit-khatian_no"));
    fireEvent.change(screen.getByTestId("input-khatian_no"), { target: { value: "777" } });
    fireEvent.click(screen.getByTestId("save-khatian_no"));
    await waitFor(() => expect(screen.getByTestId("value-khatian_no")).toHaveTextContent("777"));
    expect(patch).toHaveBeenCalledWith("/documents/d1/extraction", { fields: [{ field: "khatian_no", value: "777" }] });
    expect(screen.getByTestId("field-khatian_no")).toHaveTextContent(en.review.edited);
  });

  it("clearing a value sends null", async () => {
    const { patch } = setup();
    fireEvent.click(await screen.findByTestId("edit-buyer"));
    fireEvent.change(screen.getByTestId("input-buyer"), { target: { value: "  " } });
    fireEvent.click(screen.getByTestId("save-buyer"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/documents/d1/extraction", { fields: [{ field: "buyer", value: null }] }));
  });

  it("shows server field-level errors in the active language and keeps the input open", async () => {
    const err = new ApiError(422, "EXTRACTION_VALIDATION_FAILED", "x", [{ field: "land_area", code: "NOT_A_NUMBER" }]);
    setup({ patch: vi.fn().mockRejectedValue(err) });
    fireEvent.click(await screen.findByTestId("edit-land_area"));
    fireEvent.change(screen.getByTestId("input-land_area"), { target: { value: "abc" } });
    fireEvent.click(screen.getByTestId("save-land_area"));
    expect(await screen.findByText(en.review.errors.NOT_A_NUMBER)).toBeInTheDocument();
    expect(screen.getByTestId("input-land_area")).toHaveAttribute("aria-invalid", "true");
  });

  it("falls back to a generic message on network failure", async () => {
    setup({ patch: vi.fn().mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "x")) });
    fireEvent.click(await screen.findByTestId("edit-mouza"));
    fireEvent.change(screen.getByTestId("input-mouza"), { target: { value: "New" } });
    fireEvent.click(screen.getByTestId("save-mouza"));
    expect(await screen.findByText(en.review.actions.saveFailed)).toBeInTheDocument();
  });

  it("cancel leaves the value unchanged without calling the API", async () => {
    const { patch } = setup();
    fireEvent.click(await screen.findByTestId("edit-mouza"));
    fireEvent.change(screen.getByTestId("input-mouza"), { target: { value: "zzz" } });
    fireEvent.click(within(screen.getByTestId("field-mouza")).getByRole("button", { name: en.review.cancel }));
    expect(screen.getByTestId("value-mouza")).toHaveTextContent("v-mouza");
    expect(patch).not.toHaveBeenCalled();
  });
});

describe("approve / reject / reprocess", () => {
  const invalid = () =>
    extraction({ seller: { value: null, confidence: 0, low_confidence: true } }, {
      validation: { valid: false, errors: [{ field: "seller", code: "REQUIRED" }] },
      has_low_confidence: true, low_confidence_fields: ["seller"],
    });

  it("disables Approve while validation fails and shows the field error", async () => {
    const { post } = setup({ ext: invalid() });
    const btn = await screen.findByTestId("approve-btn");
    expect(btn).toBeDisabled();
    expect(screen.getByTestId("approve-blocked")).toHaveTextContent(en.review.actions.approveBlocked);
    expect(screen.getByTestId("error-seller")).toHaveTextContent(en.review.errors.REQUIRED);
    fireEvent.click(btn);
    expect(post).not.toHaveBeenCalled();
  });

  it("approves a valid extraction", async () => {
    const { post } = setup();
    const btn = await screen.findByTestId("approve-btn");
    expect(btn).toBeEnabled();
    expect(screen.queryByTestId("approve-blocked")).toBeNull();
    fireEvent.click(btn);
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/approve"));
  });

  it("shows an alert when approve is rejected by the server", async () => {
    setup({ post: vi.fn().mockRejectedValue(new ApiError(422, "EXTRACTION_INVALID", "x", [{ field: "seller", code: "REQUIRED" }])) });
    fireEvent.click(await screen.findByTestId("approve-btn"));
    expect(await screen.findByText(en.review.actions.approveFailed)).toBeInTheDocument();
  });

  it("keeps approve disabled until the new owner's NID is entered, then saves it with PATCH", async () => {
    const saved = { ...doc(), party_nids: { buyer: "0077" } };
    const patch = vi.fn((path: string) => Promise.resolve(path.endsWith("/party-nids") ? saved : extraction()));
    setup({ partyNids: {}, patch });
    const approve = await screen.findByTestId("approve-btn");
    expect(approve).toBeDisabled();
    expect(screen.getByTestId("approve-needs-nid")).toHaveTextContent(en.partyNid.errors.OWNER_NID_REQUIRED);
    const buyer = screen.getByTestId("review-nid-buyer");
    fireEvent.click(within(buyer).getByRole("button", { name: en.partyNid.save }));
    expect(await within(buyer).findByText(en.partyNid.errors.nidRequired)).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
    fireEvent.change(within(buyer).getByLabelText(en.partyNid.nid, { exact: false }), { target: { value: "১৯৮৫ ৯৯৯০ ০০০০ ০০০৭৭" } });
    fireEvent.change(within(buyer).getByLabelText(en.partyNid.dob, { exact: false }), { target: { value: "1985-05-05" } });
    fireEvent.click(within(buyer).getByRole("button", { name: en.partyNid.save }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/documents/d1/party-nids", { buyer: { nid: "19859990000000077", date_of_birth: "1985-05-05" } }),
    );
    expect(await screen.findByTestId("review-nid-buyer-masked")).toHaveTextContent("•••• 0077");
    await waitFor(() => expect(screen.getByTestId("approve-btn")).toBeEnabled());
  });

  it("explains an NID refusal from the server in its own words", async () => {
    setup({ post: vi.fn().mockRejectedValue(new ApiError(409, "NID_NAME_MISMATCH", "x", { party: "buyer" })) });
    fireEvent.click(await screen.findByTestId("approve-btn"));
    expect(await screen.findByText(en.partyNid.errors.NID_NAME_MISMATCH)).toBeInTheDocument();
  });

  it("reject needs a reason, then posts it", async () => {
    const { post } = setup();
    fireEvent.click(await screen.findByTestId("reject-btn"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByTestId("reject-confirm"));
    expect(within(dialog).getByText(en.review.reject.reasonRequired)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(new RegExp(en.review.reject.reasonLabel)), { target: { value: "Blurry scan" } });
    fireEvent.click(within(dialog).getByTestId("reject-confirm"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/reject", { reason: "Blurry scan" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("reject dialog closes with Escape and does not post", async () => {
    const { post } = setup();
    fireEvent.click(await screen.findByTestId("reject-btn"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("requests reprocessing", async () => {
    const { post } = setup();
    fireEvent.click(await screen.findByTestId("reprocess-btn"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/reprocess"));
    expect(screen.getByText(en.review.actions.reprocessHint)).toBeInTheDocument();
  });

  it("is read-only once approved or rejected", async () => {
    setup({ status: "APPROVED", ext: extraction({}, { processing_status: "APPROVED" }) });
    expect(await screen.findByTestId("decision-banner")).toHaveTextContent(en.review.decision.APPROVED);
    expect(screen.queryByTestId("approve-btn")).toBeNull();
    expect(screen.queryByTestId("edit-mouza")).toBeNull();
  });

  it("renders Bangla action labels", async () => {
    setup({ messages: bn, locale: "bn" });
    expect(await screen.findByTestId("approve-btn")).toHaveTextContent(bn.review.actions.approve);
    expect(screen.getByTestId("reject-btn")).toHaveTextContent(bn.review.actions.reject);
    expect(screen.getByTestId("reprocess-btn")).toHaveTextContent(bn.review.actions.reprocess);
  });
});

describe("keyboard shortcuts (U3.3)", () => {
  it("A approves, and R opens the reject dialog", async () => {
    const { post } = setup();
    await screen.findByTestId("approve-btn");
    fireEvent.keyDown(window, { code: "KeyR", key: "r" });
    expect(await screen.findByTestId("reject-confirm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.review.cancel }));
    await waitFor(() => expect(screen.queryByTestId("reject-confirm")).toBeNull());
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/approve"));
  });

  it("A does nothing while the data is invalid, and keys typed into a field are ignored", async () => {
    const bad = extraction({}, { validation: { valid: false, errors: [{ field: "buyer", code: "REQUIRED" }] } });
    const { post } = setup({ ext: bad });
    fireEvent.click(await screen.findByTestId("edit-mouza"));
    fireEvent.keyDown(screen.getByTestId("input-mouza"), { code: "KeyA", key: "a" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    expect(post).not.toHaveBeenCalled();
  });
});
