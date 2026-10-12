import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import MutationDetail from "./MutationDetail";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/officer/mutations/m1",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const HOLDER = {
  name_en: "Ashulia Union Land Office", name_bn: "আশুলিয়া ইউনিয়ন ভূমি অফিস",
  division_en: "Dhaka", division_bn: "ঢাকা", district_en: "Dhaka", district_bn: "ঢাকা", upazila_en: "Savar", upazila_bn: "সাভার",
};
const detail = (over: any = {}) => ({
  id: "m1", mutation_no: "MUT-2026-0001", land_id: "LP-10001", status: "UNDER_REVIEW", fast_track: true,
  applicant: "Rahim Uddin", area: 5, area_unit: "decimal", applied_at: "2026-10-01T08:00:00Z",
  status_changed_at: "2026-10-02T08:00:00Z", decided_at: null, source: "WORKFLOW",
  previous_khatian_no: "101", new_khatian_no: "202", ac_land_office: null, checklist: null, deed_no: null, transaction_id: null,
  allowed_transitions: [], holder_office: HOLDER, can_recommend: true, can_appeal: false, ...over,
});

function wrap(get: any, post: any = vi.fn(), messages: any = en, locale = "en") {
  const user = { id: "1", name: "U", email: "u@x.co", role: "OFFICER", preferred_language: "en" };
  const c = { refresh: vi.fn().mockResolvedValue({ user }), get, post } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}><MutationDetail id="m1" /></AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("mutation recommendation and appeal", () => {
  it("shows the holding office in both languages and offers no decision to a union officer", async () => {
    wrap(vi.fn().mockResolvedValue(detail()));
    expect(await screen.findByTestId("holder-office")).toHaveTextContent("Ashulia Union Land Office / আশুলিয়া ইউনিয়ন ভূমি অফিস");
    expect(screen.queryByTestId("act-APPROVED")).toBeNull();
    expect(screen.getByTestId("act-recommend")).toBeInTheDocument();
  });

  it("sends a field recommendation with a note", async () => {
    const post = vi.fn().mockResolvedValue(detail({ recommendation: "APPROVE", recommendation_note: "Boundaries verified", recommended_by_name: "U" }));
    wrap(vi.fn().mockResolvedValue(detail()), post);
    fireEvent.click(await screen.findByTestId("act-recommend"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByTestId("note-confirm"));
    expect(post).not.toHaveBeenCalled(); // a note is required
    fireEvent.change(within(dialog).getByLabelText(/Field-verification note/), { target: { value: "Boundaries verified" } });
    fireEvent.click(within(dialog).getByLabelText("Recommends rejection"));
    fireEvent.click(within(dialog).getByTestId("note-confirm"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/mutations/m1/recommend", { decision: "REJECT", note: "Boundaries verified" }));
    expect(await screen.findByTestId("recommendation")).toHaveTextContent("Recommends approval");
  });

  it("files an appeal for a rejected case", async () => {
    const post = vi.fn().mockResolvedValue(detail({ status: "APPEALED", appeal_reason: "Papers attached", can_appeal: false }));
    wrap(vi.fn().mockResolvedValue(detail({ status: "REJECTED", can_recommend: false, can_appeal: true })), post);
    fireEvent.click(await screen.findByTestId("act-appeal"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Grounds for the appeal/), { target: { value: "Papers attached" } });
    fireEvent.click(within(dialog).getByTestId("note-confirm"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/mutations/m1/appeal", { reason: "Papers attached" }));
    expect(await screen.findByTestId("appeal-reason")).toHaveTextContent("Papers attached");
    expect(screen.getAllByText("Appealed").length).toBeGreaterThan(0);
  });

  it("explains a forbidden decision and renders in Bangla", async () => {
    const post = vi.fn().mockRejectedValue(new ApiError(403, "DECISION_FORBIDDEN", "x"));
    wrap(vi.fn().mockResolvedValue(detail({ allowed_transitions: ["APPROVED"] })), post);
    fireEvent.click(await screen.findByTestId("act-APPROVED"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your office cannot take this decision");
  });

  it("renders the opinions in Bangla", async () => {
    wrap(vi.fn().mockResolvedValue(detail({ recommendation: "REJECT", recommendation_note: "n", recommended_by_name: "U" })), vi.fn(), bn, "bn");
    expect(await screen.findByTestId("recommendation")).toHaveTextContent("বাতিলের সুপারিশ");
  });
});
