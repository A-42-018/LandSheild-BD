import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { bandFor } from "./confidence";
import ReviewView from "./ReviewView";
import type { ExtractionOut } from "./types";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const reviewer = { id: "1", name: "R", email: "r@x.co", role: "REVIEWER", preferred_language: "en" };
const FIELDS = ["owner_name", "father_name", "khatian_no", "dag_no", "mouza", "district", "upazila", "land_area", "area_unit", "deed_no", "deed_date", "seller", "buyer"];

const doc = (over: any = {}) => ({
  id: "d1", land_id: "LP-10001", document_type: "DEED", processing_status: "REVIEW_REQUIRED",
  file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z", ...over,
});

function extraction(over: Partial<Record<string, any>> = {}, top: Partial<ExtractionOut> = {}): ExtractionOut {
  const fields = FIELDS.map((f) => ({
    field: f, value: f === "khatian_no" ? "৫০১" : `v-${f}`, confidence: 0.95,
    source_bbox: null, edited_by_human: false, low_confidence: false, ...(over[f] ?? {}),
  }));
  const low = fields.filter((f) => f.low_confidence).map((f) => f.field);
  return {
    document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "mock", threshold: 0.85,
    fields, edited_by_human: false, has_low_confidence: low.length > 0, low_confidence_fields: low,
    validation: { valid: true, errors: [] }, ...top,
  };
}

function client(get: any, blob: any = vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" }))): ApiClient {
  return { refresh: vi.fn().mockResolvedValue({ user: reviewer }), get, blob } as unknown as ApiClient;
}

function wrap(c: ApiClient, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}>
          <ReviewView id="d1" />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const route = (d: any, e: any) =>
  vi.fn((path: string) => {
    if (path.endsWith("/extraction")) return e instanceof Error ? Promise.reject(e) : Promise.resolve(e);
    return d instanceof Error ? Promise.reject(d) : Promise.resolve(d);
  });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("bandFor", () => {
  it("applies R4 bands", () => {
    expect(bandFor(0.95)).toBe("high");
    expect(bandFor(0.9)).toBe("high");
    expect(bandFor(0.89)).toBe("medium");
    expect(bandFor(0.85)).toBe("medium");
    expect(bandFor(0.84)).toBe("low");
    expect(bandFor(0)).toBe("low");
  });
});

describe("ReviewView", () => {
  it("shows all 13 fields exactly as extracted with confidence bands and a two-column layout", async () => {
    wrap(client(route(doc(), extraction({ dag_no: { confidence: 0.87 }, mouza: { confidence: 0.6, low_confidence: true } }))));
    await screen.findByTestId("extraction-panel");
    for (const f of FIELDS) expect(screen.getByTestId(`field-${f}`)).toBeInTheDocument();
    expect(screen.getByTestId("value-khatian_no")).toHaveTextContent("৫০১"); // Bangla digits untouched
    expect(screen.getByTestId("field-owner_name").querySelector("[data-band]")).toHaveAttribute("data-band", "high");
    expect(screen.getByTestId("field-dag_no").querySelector("[data-band]")).toHaveAttribute("data-band", "medium");
    expect(screen.getByTestId("field-mouza").querySelector("[data-band]")).toHaveAttribute("data-band", "low");
    expect(screen.getByTestId("field-mouza")).toHaveTextContent("60%");
    expect(screen.getByTestId("review-columns").className).toContain("grid-cols-1"); // stacks on mobile
    expect(screen.getByTestId("review-columns").className).toContain("xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]");
    expect(screen.getByTestId("doc-preview")).toBeInTheDocument();
  });

  it("shows the low-confidence banner only when flagged", async () => {
    const { unmount } = wrap(client(route(doc(), extraction({ mouza: { confidence: 0.6, low_confidence: true } }))));
    const banner = await screen.findByTestId("low-confidence-banner");
    expect(banner).toHaveTextContent(en.errors.lowConfidence);
    expect(banner).toHaveTextContent("Mouza");
    unmount();
    wrap(client(route(doc(), extraction())));
    await screen.findByTestId("extraction-panel");
    expect(screen.queryByTestId("low-confidence-banner")).toBeNull();
  });

  it("renders null values as 'Not found' and marks human edits", async () => {
    wrap(client(route(doc(), extraction({ deed_date: { value: null, confidence: 0, low_confidence: true }, seller: { edited_by_human: true } }))));
    await screen.findByTestId("extraction-panel");
    expect(screen.getByTestId("value-deed_date")).toHaveTextContent(en.review.valueNotFound);
    expect(screen.getByTestId("field-seller")).toHaveTextContent(en.review.edited);
  });

  it("shows a processing state and does not request the extraction yet", async () => {
    const get = route(doc({ processing_status: "PROCESSING" }), extraction());
    wrap(client(get));
    expect(await screen.findByTestId("processing-state")).toHaveTextContent(en.review.processing);
    expect(get).not.toHaveBeenCalledWith("/documents/d1/extraction");
  });

  it("shows the generic error for FAILED documents", async () => {
    wrap(client(route(doc({ processing_status: "FAILED" }), extraction())));
    expect(await screen.findByText(en.errors.generic)).toBeInTheDocument();
    expect(screen.queryByTestId("extraction-panel")).toBeNull();
  });

  it("maps 404 and 403 on the document", async () => {
    const { unmount } = wrap(client(route(new ApiError(404, "DOCUMENT_NOT_FOUND", "x"), null)));
    expect(await screen.findByText(en.review.notFound)).toBeInTheDocument();
    unmount();
    wrap(client(route(new ApiError(403, "FORBIDDEN", "x"), null)));
    expect(await screen.findByText(en.errors.permission)).toBeInTheDocument();
  });

  it("offers retry when the extraction request fails", async () => {
    wrap(client(route(doc(), new ApiError(403, "FORBIDDEN", "x"))));
    expect(await screen.findByRole("button", { name: en.common.retry })).toBeInTheDocument();
  });

  it("previews images with zoom controls and fetches the file through the api client", async () => {
    const c = client(route(doc(), extraction()));
    wrap(c);
    const img = await screen.findByAltText(en.review.preview.alt);
    expect(img).toHaveAttribute("src", "blob:mock");
    expect((c as any).blob).toHaveBeenCalledWith("/documents/d1/file");
    expect(screen.getByTestId("zoom-level")).toHaveTextContent("100%");
    fireEvent.click(screen.getByRole("button", { name: en.review.preview.zoomIn }));
    expect(screen.getByTestId("zoom-level")).toHaveTextContent("150%");
    expect(img.style.width).toBe("150%");
    fireEvent.click(screen.getByRole("button", { name: en.review.preview.reset }));
    expect(screen.getByTestId("zoom-level")).toHaveTextContent("100%");
  });

  it("previews PDFs in a frame on page 1", async () => {
    wrap(client(route(doc({ file_type: "pdf" }), extraction())));
    const frame = await screen.findByTitle(en.review.preview.alt);
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toContain("#page=1");
  });

  it("shows a preview error with retry when the file cannot be loaded", async () => {
    const blob = vi.fn().mockRejectedValueOnce(new ApiError(404, "DOCUMENT_FILE_MISSING", "x")).mockResolvedValue(new Blob(["x"]));
    wrap(client(route(doc(), extraction()), blob));
    expect(await screen.findByText(en.review.preview.error)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: en.common.retry })[0]);
    await waitFor(() => expect(screen.getByAltText(en.review.preview.alt)).toBeInTheDocument());
  });

  it("renders Bangla labels and band text", async () => {
    wrap(client(route(doc(), extraction({ mouza: { confidence: 0.6, low_confidence: true } }))), bn, "bn");
    await screen.findByTestId("extraction-panel");
    expect(screen.getByTestId("field-mouza")).toHaveTextContent(bn.review.fields.mouza);
    expect(screen.getByTestId("field-mouza")).toHaveTextContent(bn.review.band.low);
    expect(screen.getByTestId("low-confidence-banner")).toHaveTextContent(bn.errors.lowConfidence);
  });
});
