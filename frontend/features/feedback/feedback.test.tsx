import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { districtName, upazilaName } from "@/lib/geo";
import { localDigits } from "@/lib/intl-locale";
import { AuthProvider } from "@/features/auth/AuthContext";
import TrackView from "@/features/track/TrackView";
import FeedbackAdmin from "./FeedbackAdmin";
import FeedbackForm from "./FeedbackForm";
import PageHelpful from "./PageHelpful";

let path = "/faq";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => path,
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

function wrap(ui: React.ReactNode, api: Partial<ApiClient>, locale: "en" | "bn" = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = { refresh: vi.fn().mockResolvedValue(null), ...api } as unknown as ApiClient;
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("Bangla display helpers", () => {
  it("shows Bangla digits and place names only under bn", () => {
    expect(localDigits("610/2", "bn")).toBe("৬১০/২");
    expect(localDigits("610", "en")).toBe("610");
    expect(localDigits(null, "bn")).toBe("");
    expect(districtName("Dhaka", "bn")).toBe("ঢাকা");
    expect(districtName("Dhaka", "en")).toBe("Dhaka");
    expect(upazilaName("Dhaka", "Savar", "bn")).not.toBe("Savar");
    expect(districtName("Nowhere", "bn")).toBe("Nowhere");
  });
});

describe("FeedbackForm", () => {
  it("validates, posts anonymously and shows the reference number", async () => {
    const request = vi.fn().mockResolvedValue({ reference_no: "FB-2026-00042", status: "RECEIVED", created_at: "2026-10-14T00:00:00Z" });
    wrap(<FeedbackForm />, { request } as any);
    fireEvent.click(screen.getByRole("button", { name: en.feedback.submit }));
    expect(screen.getByText(en.feedback.errors.subject)).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(new RegExp(en.feedback.subject)), { target: { value: "Wrong upazila" } });
    fireEvent.change(screen.getByLabelText(new RegExp(en.feedback.message)), { target: { value: "The upazila shown is wrong." } });
    fireEvent.click(screen.getByRole("button", { name: en.feedback.submit }));
    expect(await screen.findByTestId("feedback-ref")).toHaveTextContent("FB-2026-00042");
    expect(request).toHaveBeenCalledWith("/public/feedback", expect.objectContaining({ method: "POST", anonymous: true }));
    expect(request.mock.calls[0][1].body).toMatchObject({ kind: "GRIEVANCE", contact_email: null });
  });

  it("U5.4: a failed submit focuses the first wrong field, the message box included (Bangla)", () => {
    wrap(<FeedbackForm />, { request: vi.fn() } as any, "bn");
    const send = screen.getByRole("button", { name: bn.feedback.submit });
    fireEvent.change(screen.getByLabelText(new RegExp(bn.feedback.subject)), { target: { value: "বিষয় লিখলাম" } });
    fireEvent.change(screen.getByLabelText(bn.feedback.email), { target: { value: "not-an-email" } });
    fireEvent.click(send);
    expect(screen.getByLabelText(new RegExp(bn.feedback.message))).toHaveFocus();
    fireEvent.change(screen.getByLabelText(new RegExp(bn.feedback.message)), { target: { value: "এটি একটি দীর্ঘ বার্তা।" } });
    send.focus();
    fireEvent.click(send);
    expect(screen.getByLabelText(bn.feedback.email)).toHaveFocus();
  });

  it("maps a 429 to the rate-limit message", async () => {
    const request = vi.fn().mockRejectedValue(new ApiError(429, "RATE_LIMITED", "x"));
    wrap(<FeedbackForm />, { request } as any, "bn");
    fireEvent.change(screen.getByLabelText(new RegExp(bn.feedback.subject)), { target: { value: "বিষয় লিখলাম" } });
    fireEvent.change(screen.getByLabelText(new RegExp(bn.feedback.message)), { target: { value: "এটি একটি দীর্ঘ বার্তা।" } });
    fireEvent.click(screen.getByRole("button", { name: bn.feedback.submit }));
    expect(await screen.findByText(bn.feedback.errors.rateLimited)).toBeInTheDocument();
  });
});

describe("PageHelpful", () => {
  it("posts the rating for a rated page and says thanks; hidden elsewhere", async () => {
    path = "/faq";
    const request = vi.fn().mockResolvedValue(null);
    const { unmount } = wrap(<PageHelpful />, { request } as any);
    fireEvent.click(screen.getByRole("button", { name: en.feedback.helpful.yes }));
    await waitFor(() => expect(screen.getByText(new RegExp(en.feedback.helpful.thanks))).toBeInTheDocument());
    expect(request).toHaveBeenCalledWith("/public/page-rating", expect.objectContaining({ anonymous: true, body: { page: "/faq", helpful: true } }));
    unmount();
    path = "/officer";
    wrap(<PageHelpful />, { request } as any);
    expect(screen.queryByTestId("page-helpful")).toBeNull();
  });
});

describe("TrackView with a feedback reference", () => {
  it("looks up FB- numbers on the feedback endpoint and shows status and reply", async () => {
    const request = vi.fn().mockResolvedValue({ reference_no: "FB-2026-00042", kind: "GRIEVANCE", status: "RESOLVED", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z", response: "Corrected." });
    wrap(<TrackView />, { request } as any);
    fireEvent.change(screen.getByLabelText(new RegExp(en.track.number)), { target: { value: " fb-2026-00042 " } });
    fireEvent.click(screen.getByRole("button", { name: en.track.submit }));
    expect(await screen.findByTestId("feedback-status")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-state")).toHaveTextContent(en.feedback.status.RESOLVED);
    expect(screen.getByText("Corrected.")).toBeInTheDocument();
    expect(request.mock.calls[0][0]).toBe("/public/feedback/FB-2026-00042");
  });
  it("U5.4: a malformed number moves focus back to the number box", () => {
    const request = vi.fn();
    wrap(<TrackView />, { request } as any);
    fireEvent.change(screen.getByLabelText(new RegExp(en.track.number)), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: en.track.submit }));
    expect(screen.getByLabelText(new RegExp(en.track.number))).toHaveFocus();
    expect(request).not.toHaveBeenCalled();
  });
});

describe("FeedbackAdmin", () => {
  const item = { id: "i1", reference_no: "FB-2026-00001", kind: "FEEDBACK", subject: "Nice", message: "Works well for me.", contact_email: null, related_ref: null, status: "RECEIVED", response: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };
  it("lists items and saves a status + reply", async () => {
    const get = vi.fn().mockResolvedValue({ items: [item], total: 1, open: 1, helpful: 3, not_helpful: 1, limit: 50, offset: 0 });
    const patch = vi.fn().mockResolvedValue({ ...item, status: "RESOLVED" });
    wrap(<FeedbackAdmin />, { get, patch } as any);
    expect(await screen.findByText("FB-2026-00001")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-summary")).toHaveTextContent("1 open");
    fireEvent.click(screen.getByRole("button", { name: en.feedback.admin.handle }));
    fireEvent.change(screen.getByLabelText(en.feedback.admin.reply), { target: { value: "Thanks" } });
    fireEvent.click(screen.getByRole("button", { name: en.feedback.admin.save }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/feedback/i1", { status: "IN_REVIEW", response: "Thanks" }));
  });
});
