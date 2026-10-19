import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
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
const VALUES: Record<string, string> = { owner_name: "A", khatian_no: "501", dag_no: "210", mouza: "Ashulia", district: "Dhaka", upazila: "Savar" };

const doc = (type = "KHATIAN") => ({
  id: "d1", land_id: "LP-10001", document_type: type, processing_status: "REVIEW_REQUIRED",
  file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z",
});

function extraction(top: Partial<ExtractionOut> = {}): ExtractionOut {
  const fields = Object.entries(VALUES).map(([field, value]) => ({
    field, value, confidence: 0.95, source_bbox: null, edited_by_human: false, low_confidence: false,
  }));
  return {
    document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "mock", threshold: 0.85,
    fields, edited_by_human: false, has_low_confidence: false, low_confidence_fields: [],
    validation: { valid: true, errors: [] }, survey_type: "RS", jl_no: "42", ...top,
  };
}

function setup(opts: { type?: string; ext?: ExtractionOut; patch?: any; resolve?: any } = {}) {
  const ext = opts.ext ?? extraction();
  const get = vi.fn((path: string) => {
    if (path.startsWith("/gis/mouzas/resolve")) return opts.resolve ? opts.resolve(path) : Promise.resolve({ id: "m1", jl_no: "42" });
    return Promise.resolve(path.endsWith("/extraction") ? ext : doc(opts.type));
  });
  const patch = opts.patch ?? vi.fn().mockResolvedValue(ext);
  const blob = vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" }));
  const client = { refresh: vi.fn().mockResolvedValue({ user: reviewer }), get, patch, blob } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <ReviewView id="d1" />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { get, patch };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("survey and JL on a khatian review (SJ7)", () => {
  it("shows the extracted survey and JL with a green tick when the JL fits the mouza", async () => {
    const { get } = setup();
    await screen.findByTestId("survey-jl-panel");
    expect(screen.getByTestId("input-survey_type")).toHaveValue("RS");
    expect(screen.getByTestId("input-jl_no")).toHaveValue("42");
    await screen.findByTestId("jl-ok");
    expect(get.mock.calls.some((c: any[]) => c[0].startsWith("/gis/mouzas/resolve?") && c[0].includes("jl_no=42") && c[0].includes("mouza=Ashulia"))).toBe(true);
  });

  it("warns when the JL does not belong to the mouza", async () => {
    setup({ resolve: () => Promise.reject(new ApiError(422, "JL_MISMATCH", "no", null)) });
    await screen.findByTestId("jl-mismatch");
    expect(screen.queryByTestId("jl-ok")).toBeNull();
  });

  it("sends the corrected survey and JL to the extraction endpoint", async () => {
    const { patch } = setup();
    await screen.findByTestId("survey-jl-panel");
    expect(screen.getByTestId("save-survey_jl")).toBeDisabled(); // nothing changed yet
    fireEvent.change(screen.getByTestId("input-survey_type"), { target: { value: "CS" } });
    fireEvent.change(screen.getByTestId("input-jl_no"), { target: { value: "0043" } });
    fireEvent.click(screen.getByTestId("save-survey_jl"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/documents/d1/extraction", { survey_type: "CS", jl_no: "43" }));
  });

  it("shows a refused survey; clearing a wrong survey sends an empty one", async () => {
    const patch = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(422, "EXTRACTION_INVALID", "bad", [{ field: "survey_type", code: "INVALID" }]))
      .mockResolvedValue(extraction());
    setup({ patch });
    await screen.findByTestId("survey-jl-panel");
    fireEvent.change(screen.getByTestId("input-survey_type"), { target: { value: "SA" } });
    fireEvent.click(screen.getByTestId("save-survey_jl"));
    expect(await screen.findByTestId("error-survey_jl")).toHaveTextContent(en.review.errors.INVALID);
    fireEvent.change(screen.getByTestId("input-survey_type"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("save-survey_jl"));
    await waitFor(() => expect(patch).toHaveBeenLastCalledWith("/documents/d1/extraction", { survey_type: "" }));
  });

  it("does not count a zero-padded or Bangla JL as a change", async () => {
    const { patch } = setup({ ext: extraction({ jl_no: "042" }) });
    await screen.findByTestId("survey-jl-panel");
    expect(screen.getByTestId("save-survey_jl")).toBeDisabled();
    fireEvent.change(screen.getByTestId("input-jl_no"), { target: { value: "৪২" } });
    expect(screen.getByTestId("save-survey_jl")).toBeDisabled();
    fireEvent.change(screen.getByTestId("input-jl_no"), { target: { value: "৪৩" } });
    fireEvent.click(screen.getByTestId("save-survey_jl"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/documents/d1/extraction", { jl_no: "43" }));
  });

  it("is not shown for a deed", async () => {
    setup({ type: "DEED", ext: extraction({ survey_type: null, jl_no: null }) });
    await screen.findByTestId("extraction-panel");
    expect(screen.queryByTestId("survey-jl-panel")).toBeNull();
  });
});
