import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import OfficerSignup from "./OfficerSignup";
import OfficerRequestsPanel from "@/features/admin/OfficerRequestsPanel";
import { bi } from "./types";

const OFFICE = {
  id: "o1", code: "LO-00001", office_type: "Union Land Office",
  division_en: "Dhaka", division_bn: "ঢাকা", district_en: "Dhaka", district_bn: "ঢাকা",
  upazila_en: "Savar", upazila_bn: "সাভার", union_en: "Ashulia", union_bn: "আশুলিয়া",
  name_en: "Ashulia Union Land Office (Tahsil Office)", name_bn: "আশুলিয়া ইউনিয়ন ভূমি অফিস (তহসিল অফিস)", location: "Ashulia Union",
};
const ADMIN = { id: "a", name: "Ada", email: "ada@x.co", role: "ADMIN", preferred_language: "en" };

function mount(ui: any, client: Partial<ApiClient>, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={{ refresh: vi.fn().mockResolvedValue({ user: ADMIN }), ...client } as unknown as ApiClient}>
          {ui}
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const get = vi.fn(async (url: string) => {
  if (url.startsWith("/offices/divisions")) return [{ en: "Dhaka", bn: "ঢাকা" }];
  if (url.startsWith("/offices/districts")) return [{ en: "Dhaka", bn: "ঢাকা" }];
  if (url.startsWith("/offices/upazilas")) return [{ en: "Savar", bn: "সাভার" }];
  return { items: [OFFICE], total: 1 };
});

describe("bi()", () => {
  it("shows English and Bangla together", () => {
    expect(bi("Savar", "সাভার")).toBe("Savar / সাভার");
    expect(bi("Dhaka", "Dhaka")).toBe("Dhaka");
    expect(bi("X", null)).toBe("X");
  });
});

describe("officer signup", () => {
  it("cascades division > zila > upozila > office, both languages in every list", async () => {
    mount(<OfficerSignup />, { get } as any);
    const division = await screen.findByLabelText(/Division/);
    expect(await within(division).findByText("Dhaka / ঢাকা")).toBeInTheDocument();
    expect(screen.getByLabelText(/Zila/)).toBeDisabled();
    fireEvent.change(division, { target: { value: "Dhaka" } });
    const district = screen.getByLabelText(/Zila/);
    await waitFor(() => expect(district).toBeEnabled());
    fireEvent.change(district, { target: { value: "Dhaka" } });
    fireEvent.change(await screen.findByLabelText(/Upozila/), { target: { value: "Savar" } });
    const office = await screen.findByLabelText(/Land office/);
    await within(office).findByText(`${OFFICE.name_en} / ${OFFICE.name_bn}`);
    fireEvent.change(office, { target: { value: "o1" } });
    expect(screen.getByTestId("office-path")).toHaveTextContent("Dhaka / ঢাকা › Dhaka / ঢাকা › Savar / সাভার");
  });

  it("blocks submit until the form is valid, then sends the request and shows the pending notice", async () => {
    const post = vi.fn().mockResolvedValue({ id: "r1", status: "PENDING" });
    mount(<OfficerSignup />, { get, post } as any);
    fireEvent.click(await screen.findByRole("button", { name: "Send request" }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText(/Division/), { target: { value: "Dhaka" } });
    await waitFor(() => expect(screen.getByLabelText(/Zila/)).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/Zila/), { target: { value: "Dhaka" } });
    fireEvent.change(await screen.findByLabelText(/Upozila/), { target: { value: "Savar" } });
    const office = await screen.findByLabelText(/Land office/);
    await within(office).findByText(/Ashulia/);
    fireEvent.change(office, { target: { value: "o1" } });
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "Rina Akter" } });
    fireEvent.change(screen.getByLabelText(/Official email/), { target: { value: "rina@office.gov.bd" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "long-enough-1" } });
    fireEvent.change(screen.getByLabelText(/Designation/), { target: { value: "Tahsildar" } });
    fireEvent.change(screen.getByLabelText(/employee ID/), { target: { value: "EMP-1" } });
    fireEvent.change(screen.getByLabelText(/Mobile/), { target: { value: "+৮৮০১৭১১০০০০০০" } }); // Bangla digits are sent as ASCII
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/offices/officer-requests", expect.objectContaining({ office_id: "o1", email: "rina@office.gov.bd", phone: "+8801711000000" })));
    expect(await screen.findByTestId("signup-done")).toHaveTextContent("Your account stays inactive");
  });

  it("explains a taken email", async () => {
    const post = vi.fn().mockRejectedValue(new ApiError(409, "EMAIL_TAKEN", "x"));
    mount(<OfficerSignup />, { get, post } as any);
    fireEvent.change(await screen.findByLabelText(/Division/), { target: { value: "Dhaka" } });
    await waitFor(() => expect(screen.getByLabelText(/Zila/)).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/Zila/), { target: { value: "Dhaka" } });
    fireEvent.change(await screen.findByLabelText(/Upozila/), { target: { value: "Savar" } });
    const office = await screen.findByLabelText(/Land office/);
    await within(office).findByText(/Ashulia/);
    fireEvent.change(office, { target: { value: "o1" } });
    for (const [re, v] of [[/Full name/, "R"], [/Official email/, "r@o.co"], [/^Password/, "long-enough-1"], [/Designation/, "Tahsildar"], [/employee ID/, "E1"], [/Mobile/, "+8801711000000"]] as const)
      fireEvent.change(screen.getByLabelText(re), { target: { value: v } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already registered");
  });

  it("renders in Bangla", async () => {
    mount(<OfficerSignup />, { get } as any, bn, "bn");
    expect(await screen.findByRole("heading", { name: "কর্মকর্তা অ্যাকাউন্টের জন্য আবেদন" })).toBeInTheDocument();
  });
});

describe("admin officer requests", () => {
  const req = (o: any = {}) => ({
    id: "r1", status: "PENDING", created_at: "2026-10-01T08:00:00Z", user_id: "u9", name: "Rina Akter",
    email: "rina@office.gov.bd", designation: "Tahsildar", phone: "+8801711000000", employee_id: "EMP-1",
    proof_note: null, office: OFFICE, reviewed_at: null, rejection_reason: null, ...o,
  });

  it("approves a pending request", async () => {
    const post = vi.fn().mockResolvedValue(req({ status: "APPROVED" }));
    mount(<OfficerRequestsPanel />, { get: vi.fn(async () => ({ items: [req()], total: 1, pending: 1, limit: 20, offset: 0 })), post } as any);
    const table = await screen.findByTestId("officer-requests-table");
    expect(within(table).getByText(`${OFFICE.name_en} / ${OFFICE.name_bn}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve Rina Akter" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/admin/officer-requests/r1/approve"));
  });

  it("rejects only with a reason", async () => {
    const post = vi.fn().mockResolvedValue(req({ status: "REJECTED" }));
    mount(<OfficerRequestsPanel />, { get: vi.fn(async () => ({ items: [req()], total: 1, pending: 1, limit: 20, offset: 0 })), post } as any);
    fireEvent.click(await screen.findByRole("button", { name: "Reject Rina Akter" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Reason for rejection"), { target: { value: "Posting order not valid" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/admin/officer-requests/r1/reject", { reason: "Posting order not valid" }));
  });
});

describe("area sorting", () => {
  it("adds division / zila / upozila to the queue query, only when chosen", async () => {
    const { queueQuery } = await import("@/features/officer/useOfficerData");
    const base = { filter: "" as const, q: "", sort: "created_at" as const, order: "desc" as const, page: 1 };
    expect(queueQuery(base)).not.toContain("division");
    const s = queueQuery({ ...base, division: "Dhaka", district: "Dhaka", upazila: "Savar" });
    expect(s).toContain("division=Dhaka");
    expect(s).toContain("district=Dhaka");
    expect(s).toContain("upazila=Savar");
  });
});
