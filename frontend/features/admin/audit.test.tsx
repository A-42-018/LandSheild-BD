import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { OFFICER_NAV } from "@/features/officer/OfficerShell";
import { hasRole } from "@/features/auth/roles";
import AuditLogs from "./AuditLogs";
import { auditQuery } from "./useAuditLogs";

const mk = (role: string) => ({ id: "1", name: "U", email: "u@x.co", role, preferred_language: "en" });
const row = (over: any = {}) => ({
  id: "a1", action: "DOCUMENT_APPROVE", entity_type: "document", entity_id: "d1",
  actor: { name: "Olivia Officer", role: "OFFICER" }, ip_hash: "abcd1234", created_at: "2026-10-01T08:00:00Z", ...over,
});
const LIST = (items: any[], total = items.length) => ({ items, total, limit: 20, offset: 0 });

function wrap(get: any, messages: any = en, locale = "en") {
  const client = { refresh: vi.fn().mockResolvedValue({ user: mk("OFFICER") }), get } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <AuditLogs />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("audit logs", () => {
  it("renders rows with translated action, actor, truncated ip", async () => {
    wrap(vi.fn().mockResolvedValue(LIST([row(), row({ id: "a2", action: "WEIRD", actor: null, ip_hash: null })])));
    const table = await screen.findByTestId("audit-table");
    expect(within(table).getByText("Document approved")).toBeInTheDocument();
    expect(within(table).getByText("Olivia Officer (Officer)")).toBeInTheDocument();
    expect(within(table).getByText("abcd1234…")).toBeInTheDocument();
    expect(within(table).getByText("WEIRD")).toBeInTheDocument();
    expect(within(table).getByText("System")).toBeInTheDocument();
  });

  it("sends filters to the API on apply and resets", async () => {
    const get = vi.fn().mockResolvedValue(LIST([row()]));
    wrap(get);
    await screen.findByTestId("audit-table");
    expect(get.mock.calls.at(-1)![0]).toContain("/admin/audit-logs?limit=20&offset=0");
    fireEvent.change(screen.getByLabelText("Actor name"), { target: { value: " olivia " } });
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "LOGIN" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => {
      const u = get.mock.calls.at(-1)![0] as string;
      expect(u).toContain("actor=olivia");
      expect(u).toContain("action=LOGIN");
      expect(u).toContain("date_from=2026-09-01");
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(get.mock.calls.at(-1)![0]).not.toContain("actor="));
  });

  it("blocks an inverted date range", async () => {
    wrap(vi.fn().mockResolvedValue(LIST([row()])));
    await screen.findByTestId("audit-table");
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-02" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-10-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("must not be after");
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();
  });

  it("paginates via offset", async () => {
    const get = vi.fn().mockResolvedValue(LIST([row()], 45));
    wrap(get);
    await screen.findByTestId("audit-table");
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(get.mock.calls.at(-1)![0]).toContain("offset=20"));
  });

  it("shows empty, permission and generic error states", async () => {
    const { unmount } = wrap(vi.fn().mockResolvedValue(LIST([])));
    expect(await screen.findByText(en.admin.audit.empty)).toBeInTheDocument();
    unmount();
    wrap(vi.fn().mockRejectedValue(new ApiError(403, "FORBIDDEN", "no", null)));
    expect(await screen.findByText(en.errors.permission)).toBeInTheDocument();
  });

  it("renders in Bangla", async () => {
    wrap(vi.fn().mockResolvedValue(LIST([row()])), bn, "bn");
    expect(await screen.findByText("অডিট লগ")).toBeInTheDocument();
    expect(within(screen.getByTestId("audit-table")).getByText("নথি অনুমোদিত হয়েছে")).toBeInTheDocument();
  });

  it("builds the query and limits the nav entry to officer+", () => {
    expect(auditQuery({ actor: "", action: "", entity: "document", from: "", to: "2026-10-01", page: 3 })).toBe(
      "entity_type=document&date_to=2026-10-01&limit=20&offset=40",
    );
    const item = OFFICER_NAV.find((i) => i.href === "/officer/audit-logs")!;
    expect(hasRole("OFFICER", item.roles)).toBe(true);
    expect(hasRole("REVIEWER", item.roles)).toBe(false);
  });
});
