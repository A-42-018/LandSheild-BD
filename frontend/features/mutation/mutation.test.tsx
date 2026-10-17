import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import type { ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import MutationQueue from "./MutationQueue";
import MutationDetail from "./MutationDetail";
import { daysSince } from "./types";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/officer/mutations",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const mk = (role: string) => ({ id: "1", name: "U", email: "u@x.co", role, preferred_language: "en" });
const item = (over: any = {}) => ({
  id: "m1", mutation_no: "MUT-2026-0001", land_id: "LP-10001", status: "UNDER_REVIEW", fast_track: true,
  applicant: "Rahim Uddin", area: 5, area_unit: "decimal", applied_at: "2026-10-01T08:00:00Z",
  status_changed_at: "2026-10-02T08:00:00Z", decided_at: null, source: "WORKFLOW", ...over,
});
const detail = (over: any = {}) => ({
  ...item(), previous_khatian_no: "101", new_khatian_no: "202", ac_land_office: "AC Land Demo",
  checklist: {
    SELLER_IS_RECORDED_OWNER: "PASS", NO_OPEN_HIGH_ALERT: "FAIL", NO_ACTIVE_CASE: "NOT_CHECKED",
    NOT_KHAS_OR_ACQUIRED: "NOT_CHECKED", AREA_WITHIN_SELLER_HOLDING: "PASS", DOCUMENT_HUMAN_APPROVED: "PASS",
  },
  deed_no: "D-77", transaction_id: "t1", allowed_transitions: ["APPROVED", "HEARING", "REJECTED"], ...over,
});

function wrap(ui: React.ReactNode, get: any, post: any = vi.fn(), role = "OFFICER", messages: any = en, locale = "en") {
  const c = { refresh: vi.fn().mockResolvedValue({ user: mk(role) }), get, post } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("MutationQueue", () => {
  it("renders rows with fast-track badge and filters by status tab", async () => {
    const get = vi.fn().mockResolvedValue({ total: 1, items: [item()] });
    wrap(<MutationQueue />, get);
    expect(await screen.findByText("MUT-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Fast-track")).toBeInTheDocument();
    expect(screen.getByText("Rahim Uddin")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(expect.stringContaining("/mutations?limit=20&offset=0"));
    fireEvent.click(screen.getByRole("tab", { name: "Hearing" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("status=HEARING")));
  });

  it("shows the empty state", async () => {
    wrap(<MutationQueue />, vi.fn().mockResolvedValue({ total: 0, items: [] }));
    expect(await screen.findByText(en.mutation.empty)).toBeInTheDocument();
  });

  it("renders in Bangla", async () => {
    wrap(<MutationQueue />, vi.fn().mockResolvedValue({ total: 1, items: [item()] }), vi.fn(), "OFFICER", bn, "bn");
    expect(await screen.findByText("দ্রুত নিষ্পত্তি")).toBeInTheDocument();
    expect(screen.getByText("৫ শতাংশ")).toBeInTheDocument();
  });
});

describe("MutationDetail", () => {
  it("renders checklist, deed and timeline", async () => {
    wrap(<MutationDetail id="m1" />, vi.fn().mockResolvedValue(detail()));
    expect(await screen.findByTestId("mutation-checklist")).toBeInTheDocument();
    expect(screen.getAllByText("Pass")).toHaveLength(3);
    expect(screen.getByText("Fail")).toBeInTheDocument();
    expect(screen.getAllByText("Not checked")).toHaveLength(2);
    expect(screen.getByText("D-77")).toBeInTheDocument();
    expect(screen.getByTestId("mutation-timeline").children).toHaveLength(2);
  });

  it("shows the area with a Bangla unit label in Bangla", async () => {
    wrap(<MutationDetail id="m1" />, vi.fn().mockResolvedValue(detail()), vi.fn(), "OFFICER", bn, "bn");
    expect(await screen.findByText("৫ শতাংশ")).toBeInTheDocument();
  });

  it("approve calls the transition endpoint without a reason", async () => {
    const post = vi.fn().mockResolvedValue(detail({ status: "APPROVED", allowed_transitions: [] }));
    wrap(<MutationDetail id="m1" />, vi.fn().mockResolvedValue(detail()), post);
    fireEvent.click(await screen.findByTestId("act-APPROVED"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/mutations/m1/transition", { to: "APPROVED", reason: undefined }));
  });

  it("reject needs a reason, then posts it", async () => {
    const post = vi.fn().mockResolvedValue(detail({ status: "REJECTED", allowed_transitions: [] }));
    wrap(<MutationDetail id="m1" />, vi.fn().mockResolvedValue(detail()), post);
    fireEvent.click(await screen.findByTestId("act-REJECTED"));
    fireEvent.click(screen.getByTestId("reason-confirm"));
    expect(await screen.findByText("A reason is required.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Owner mismatch " } });
    fireEvent.click(screen.getByTestId("reason-confirm"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/mutations/m1/transition", { to: "REJECTED", reason: "Owner mismatch" }));
  });

  it("send to hearing opens the reason modal", async () => {
    wrap(<MutationDetail id="m1" />, vi.fn().mockResolvedValue(detail()));
    fireEvent.click(await screen.findByTestId("act-HEARING"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("hides actions for reviewers and for decided mutations", async () => {
    const { unmount } = wrap(<MutationDetail id="m1" />, vi.fn().mockResolvedValue(detail()), vi.fn(), "REVIEWER");
    await screen.findByTestId("mutation-checklist");
    expect(screen.queryByTestId("act-APPROVED")).toBeNull();
    unmount();
    wrap(<MutationDetail id="m1" />, vi.fn().mockResolvedValue(detail({ status: "APPROVED", allowed_transitions: [] })));
    await screen.findByTestId("mutation-checklist");
    expect(screen.queryByTestId("act-APPROVED")).toBeNull();
  });
});

describe("daysSince", () => {
  it("counts whole days and never goes negative", () => {
    const now = Date.parse("2026-10-06T00:00:00Z");
    expect(daysSince("2026-10-01T00:00:00Z", now)).toBe(5);
    expect(daysSince("2026-10-09T00:00:00Z", now)).toBe(0);
  });
});
