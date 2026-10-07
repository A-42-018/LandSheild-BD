import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import type { ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import ReviewView from "./ReviewView";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const FIELDS = ["owner_name", "father_name", "khatian_no", "dag_no", "mouza", "district", "upazila", "land_area", "area_unit", "deed_no", "deed_date", "seller", "buyer"];
const user = (role: string) => ({ id: "u", name: "U", email: "u@x.co", role, preferred_language: "en" });
const doc = (over: any = {}) => ({
  id: "d1", land_id: "LP-10001", document_type: "DEED", processing_status: "REVIEW_REQUIRED",
  file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z", ...over,
});
const extraction = (over: any = {}) => ({
  document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "rules", threshold: 0.85,
  fields: FIELDS.map((f) => ({ field: f, value: "v", confidence: 0.95, source_bbox: null, edited_by_human: false, low_confidence: false })),
  edited_by_human: false, has_low_confidence: false, low_confidence_fields: [],
  validation: { valid: true, errors: [] }, ...over,
});

function mount(role: string, d: any, e: any = extraction()) {
  const post = vi.fn().mockResolvedValue({});
  const get = vi.fn((path: string) => Promise.resolve(path.endsWith("/extraction") ? e : d));
  const api = {
    refresh: vi.fn().mockResolvedValue({ user: user(role) }), get, post,
    blob: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" })),
  } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={api}><ReviewView id="d1" /></AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { post };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("review page role wiring", () => {
  it("UPLOADED: an officer can start processing from the review page", async () => {
    const { post } = mount("OFFICER", doc({ processing_status: "UPLOADED" }));
    fireEvent.click(await screen.findByTestId("start-processing-review"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/process"));
  });

  it("UPLOADED: a reviewer sees a waiting note and no start button (process is officer-only)", async () => {
    mount("REVIEWER", doc({ processing_status: "UPLOADED" }));
    expect(await screen.findByTestId("not-started-state")).toHaveTextContent(en.review.waitingForOfficer);
    expect(screen.queryByTestId("start-processing-review")).toBeNull();
  });

  it("FAILED: shows the failure reason and lets a reviewer retry", async () => {
    const { post } = mount("REVIEWER", doc({ processing_status: "FAILED", failure_code: "OCR_UNAVAILABLE" }));
    expect(await screen.findByTestId("failed-state")).toHaveTextContent(en.review.failed.OCR_UNAVAILABLE);
    fireEvent.click(screen.getByTestId("retry-processing"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/reprocess"));
  });

  it("uploader sees approve disabled with the four-eyes note", async () => {
    mount("OFFICER", doc(), extraction({ self_approval_blocked: true }));
    expect(await screen.findByTestId("approve-btn")).toBeDisabled();
    expect(screen.getByTestId("approve-own-upload")).toHaveTextContent(en.review.actions.selfApproval);
  });

  it("another reviewer can approve", async () => {
    mount("REVIEWER", doc(), extraction({ self_approval_blocked: false }));
    expect(await screen.findByTestId("approve-btn")).toBeEnabled();
    expect(screen.queryByTestId("approve-own-upload")).toBeNull();
  });
});
