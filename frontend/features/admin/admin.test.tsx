import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ADMIN_ONLY, hasRole } from "@/features/auth/roles";
import { OFFICER_NAV } from "@/features/officer/OfficerShell";
import AdminView from "./AdminView";
import { adminQuery } from "./useAdmin";

const ME = { id: "me", name: "Ada Admin", email: "ada@x.co", role: "ADMIN", preferred_language: "en" };
const user = (o: any = {}) => ({
  id: "u1", name: "Rita Reviewer", email: "rita@x.co", role: "REVIEWER", preferred_language: "en",
  is_active: true, created_at: "2026-10-01T08:00:00Z", ...o,
});
const page = (items: any[], total = items.length) => ({ items, total, limit: 20, offset: 0 });
const land = (o: any = {}) => ({
  land_id: "LP-10100", district: "Dhaka", upazila: "Savar", mouza: "Ashulia", khatian_no: "610", dag_no: "210",
  area: 20, area_unit: "decimal", status: "ACTIVE", updated_at: "2026-10-01T08:00:00Z", ...o,
});
const doc = (o: any = {}) => ({
  id: "d1", land_id: "LP-10100", document_type: "DEED", processing_status: "APPROVED", ocr_confidence: 0.91,
  uploaded_by: "Olivia Officer", created_at: "2026-10-01T08:00:00Z", ...o,
});

function wrap(overrides: Partial<Record<"get" | "post" | "patch", any>> = {}, messages: any = en, locale = "en") {
  const get = overrides.get ?? vi.fn(async (url: string) =>
    url.startsWith("/admin/users") ? page([user(), user({ id: "me", name: "Ada Admin", email: "ada@x.co", role: "ADMIN" })])
    : url.startsWith("/admin/land-records") ? page([land()]) : page([doc()]));
  const client = {
    refresh: vi.fn().mockResolvedValue({ user: ME }), get,
    post: overrides.post ?? vi.fn(), patch: overrides.patch ?? vi.fn(),
  } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <AdminView />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { get, client: client as any };
}

describe("admin users", () => {
  it("lists users with translated roles and marks the current admin", async () => {
    wrap();
    const table = await screen.findByTestId("users-table");
    expect(within(table).getByText("Rita Reviewer")).toBeInTheDocument();
    expect(within(table).getByText("Reviewer")).toBeInTheDocument();
    expect(within(table).getByText("(you)")).toBeInTheDocument();
    expect(within(table).getAllByText("Active")).toHaveLength(2);
  });

  it("cannot deactivate yourself but can deactivate others", async () => {
    const patch = vi.fn().mockResolvedValue(user({ is_active: false }));
    wrap({ patch });
    await screen.findByTestId("users-table");
    expect(screen.getByRole("button", { name: "Deactivate Ada Admin" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate Rita Reviewer" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/admin/users/u1", { is_active: false }));
  });

  it("edit modal sends only changed fields and locks own role", async () => {
    const patch = vi.fn().mockResolvedValue(user({ role: "OFFICER" }));
    wrap({ patch });
    await screen.findByTestId("users-table");
    fireEvent.click(screen.getByRole("button", { name: "Edit Ada Admin" }));
    let dlg = within(screen.getByRole("dialog"));
    expect(dlg.getByLabelText("Role")).toBeDisabled();
    expect(dlg.getByLabelText("Account is active")).toBeDisabled();
    fireEvent.click(dlg.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Rita Reviewer" }));
    dlg = within(screen.getByRole("dialog"));
    fireEvent.change(dlg.getByLabelText("Role"), { target: { value: "OFFICER" } });
    fireEvent.click(dlg.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/admin/users/u1", { role: "OFFICER" }));
  });

  it("creates a user and shows the server error for a duplicate email", async () => {
    const post = vi.fn().mockRejectedValueOnce(new ApiError(409, "EMAIL_TAKEN", "x")).mockResolvedValueOnce(user());
    wrap({ post });
    await screen.findByTestId("users-table");
    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    const create = screen.getByRole("button", { name: "Create user" });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: " Nina " } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "nina@x.co" } });
    fireEvent.change(screen.getByLabelText(/Initial password/), { target: { value: "short" } });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Initial password/), { target: { value: "long-enough-1" } });
    fireEvent.click(create);
    expect(await screen.findByText("This email is already registered.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]).toEqual(["/admin/users", {
      name: "Nina", email: "nina@x.co", password: "long-enough-1", role: "CITIZEN", preferred_language: "en",
    }]);
  });

  it("sends search, role filter and sort to the API", async () => {
    const { get } = wrap();
    await screen.findByTestId("users-table");
    expect(get.mock.calls.at(-1)![0]).toBe("/admin/users?sort=created_at&order=desc&limit=20&offset=0");
    fireEvent.change(screen.getAllByLabelText("Search")[0], { target: { value: " rita " } });
    fireEvent.change(screen.getAllByLabelText("Role")[0], { target: { value: "REVIEWER" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply filters" })[0]);
    await waitFor(() => {
      const u = get.mock.calls.at(-1)![0] as string;
      expect(u).toContain("q=rita");
      expect(u).toContain("role=REVIEWER");
    });
    fireEvent.click(within(screen.getByTestId("users-table")).getByRole("button", { name: "Email" }));
    await waitFor(() => expect(get.mock.calls.at(-1)![0]).toContain("sort=email&order=asc"));
  });

  it("shows a permission error state", async () => {
    wrap({ get: vi.fn().mockRejectedValue(new ApiError(403, "FORBIDDEN", "no")) });
    expect(await screen.findByText(en.admin.console.errors.permission)).toBeInTheDocument();
  });
});

describe("admin records + documents", () => {
  it("land records tab renders rows and queries the API", async () => {
    const { get } = wrap();
    await screen.findByTestId("users-table");
    fireEvent.click(screen.getByRole("tab", { name: "Land records" }));
    const table = await screen.findByTestId("records-table");
    expect(within(table).getByText("LP-10100")).toBeInTheDocument();
    expect(within(table).getByText("Active")).toBeInTheDocument();
    expect(within(table).queryByText(/father|nid/i)).toBeNull();
    expect(get.mock.calls.some((c: any[]) => c[0] === "/admin/land-records?sort=land_id&order=asc&limit=20&offset=0")).toBe(true);
  });

  it("documents tab maps type/status, never shows a path, handles unassigned", async () => {
    wrap({ get: vi.fn(async (u: string) => (u.startsWith("/admin/documents") ? page([doc(), doc({ id: "d2", land_id: null, ocr_confidence: null, processing_status: "WEIRD" })]) : page([user()]))) });
    await screen.findByTestId("users-table");
    fireEvent.click(screen.getByRole("tab", { name: "Documents" }));
    const table = await screen.findByTestId("documents-table");
    expect(within(table).getAllByText("Deed")).toHaveLength(2);
    expect(within(table).getByText("91%")).toBeInTheDocument();
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();
    expect(within(table).getByText("WEIRD")).toBeInTheDocument();
  });
});

describe("admin misc", () => {
  it("builds query strings", () => {
    const p = { q: " a ", filter: "ADMIN", active: "false", sort: "name", order: "asc" as const, page: 3 };
    expect(adminQuery("users", p)).toBe("q=a&role=ADMIN&is_active=false&sort=name&order=asc&limit=20&offset=40");
    expect(adminQuery("documents", { ...p, filter: "FAILED" })).toBe("q=a&status=FAILED&sort=name&order=asc&limit=20&offset=40");
  });

  it("nav entry is admin only", () => {
    const item = OFFICER_NAV.find((i) => i.href === "/officer/admin")!;
    expect(item.roles).toEqual(ADMIN_ONLY);
    expect(hasRole("OFFICER", item.roles)).toBe(false);
    expect(hasRole("ADMIN", item.roles)).toBe(true);
  });

  it("renders in Bangla", async () => {
    wrap(undefined, bn, "bn");
    expect(await screen.findByText(bn.admin.console.users.title, { selector: "h2, h3, div, span" })).toBeInTheDocument();
    expect(await screen.findByTestId("users-table")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ভূমি রেকর্ড" })).toBeInTheDocument();
  });
});
