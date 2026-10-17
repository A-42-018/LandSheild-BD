import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const doc = (status = "REVIEW_REQUIRED") => ({
  id: "d1", land_id: "LP-10001", document_type: "DEED", processing_status: status,
  file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z", party_nids: { buyer: "0077" },
});

function extraction(top: Partial<ExtractionOut> = {}): ExtractionOut {
  return {
    document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "mock", threshold: 0.85,
    fields: [{ field: "mouza", value: "Ashulia", confidence: 0.95, source_bbox: null, edited_by_human: false, low_confidence: false }],
    edited_by_human: false, has_low_confidence: false, low_confidence_fields: [],
    validation: { valid: true, errors: [] }, ...top,
  };
}

function setup(ext: ExtractionOut, opts: { post?: any; messages?: any; locale?: string } = {}) {
  const get = vi.fn((path: string) => Promise.resolve(path.endsWith("/extraction") ? ext : doc(ext.processing_status)));
  const post = opts.post ?? vi.fn().mockResolvedValue(doc("PROCESSING"));
  const blob = vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" }));
  const client = { refresh: vi.fn().mockResolvedValue({ user: reviewer }), get, patch: vi.fn(), post, blob } as unknown as ApiClient;
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
  return { get, post };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("deed profile switch (modern <-> historical)", () => {
  it("shows a detected historical deed and re-reads it as modern", async () => {
    const { post } = setup(extraction({ deed_profile: "historical", ocr_profile: "historical", profile_overridden: false }));
    expect(await screen.findByTestId("badge-profile")).toHaveTextContent("Deed type: Historical deed");
    expect(screen.getByTestId("profile-origin")).toHaveTextContent(en.review.profile.detected);
    const btn = screen.getByTestId("profile-switch");
    expect(btn).toHaveTextContent(en.review.profile.toModern);
    expect(btn).toHaveAccessibleDescription(en.review.profile.hint);
    fireEvent.click(btn);
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/reprocess", { profile: "modern" }));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("shows a reviewer's choice and switches a modern deed to historical", async () => {
    const { post } = setup(extraction({ deed_profile: "modern", profile_overridden: true }));
    expect(await screen.findByTestId("badge-profile")).toHaveTextContent("Deed type: Modern deed");
    expect(screen.getByTestId("profile-origin")).toHaveTextContent(en.review.profile.overridden);
    fireEvent.click(screen.getByTestId("profile-switch"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/reprocess", { profile: "historical" }));
  });

  it("plain reprocessing still sends no profile", async () => {
    const { post } = setup(extraction({ deed_profile: "historical" }));
    fireEvent.click(await screen.findByTestId("reprocess-btn"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/reprocess"));
  });

  it("says when the switch could not be requested", async () => {
    const post = vi.fn().mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "x"));
    setup(extraction({ deed_profile: "historical" }), { post });
    fireEvent.click(await screen.findByTestId("profile-switch"));
    expect(await screen.findByText(en.review.actions.reprocessFailed)).toBeInTheDocument();
  });

  it("shows nothing for khatian / porcha and results from before detection", async () => {
    setup(extraction({ deed_profile: null }));
    await screen.findByTestId("extraction-panel");
    expect(screen.queryByTestId("deed-profile")).toBeNull();
  });

  it("keeps the profile but offers no switch after a decision", async () => {
    setup(extraction({ processing_status: "APPROVED", deed_profile: "historical" }));
    expect(await screen.findByTestId("badge-profile")).toHaveTextContent("Historical deed");
    expect(screen.queryByTestId("profile-switch")).toBeNull();
  });

  it("is translated to Bangla", async () => {
    setup(extraction({ deed_profile: "historical" }), { messages: bn, locale: "bn" });
    expect(await screen.findByTestId("badge-profile")).toHaveTextContent("দলিলের ধরন: পুরাতন দলিল");
    expect(screen.getByTestId("profile-switch")).toHaveTextContent(bn.review.profile.toModern);
  });
});
