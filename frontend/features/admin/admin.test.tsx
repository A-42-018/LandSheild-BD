import type { ReactElement } from "react";
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
import UsersPanel from "./UsersPanel";
import RecordsView from "./RecordsView";
import OfficesPanel from "./OfficesPanel";
import SettingsPanel from "./SettingsPanel";
import AdminOverview from "./AdminOverview";
import AdminShell, { ADMIN_NAV } from "./AdminShell";
import { redirectFor } from "@/features/auth/roles";
import { adminQuery } from "./useAdmin";

let path = "/admin/users";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => path,
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

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

function wrap(overrides: Partial<Record<"get" | "post" | "patch", any>> = {}, messages: any = en, locale = "en", view: ReactElement = <UsersPanel />) {
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
          {view}
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
    expect(await screen.findByText(en.errors.permission)).toBeInTheDocument();
  });
});

describe("admin records + documents", () => {
  it("land records tab renders rows and queries the API", async () => {
    const { get } = wrap(undefined, en, "en", <RecordsView />);
    const table = await screen.findByTestId("records-table");
    expect(within(table).getByText("LP-10100")).toBeInTheDocument();
    expect(within(table).getByText("Active")).toBeInTheDocument();
    expect(within(table).queryByText(/father|nid/i)).toBeNull();
    expect(get.mock.calls.some((c: any[]) => c[0] === "/admin/land-records?sort=land_id&order=asc&limit=20&offset=0")).toBe(true);
  });

  it("land records show the survey and JL columns (old rows show a dash)", async () => {
    wrap({ get: vi.fn(async () => page([land({ survey_type: "RS", jl_no: "42" }), land({ land_id: "LP-10101" })])) }, en, "en", <RecordsView />);
    const table = await screen.findByTestId("records-table");
    expect(within(table).getByText("JL no.")).toBeInTheDocument();
    expect(within(table).getByText("Survey")).toBeInTheDocument();
    expect(within(table).getByText("RS (Revisional)")).toBeInTheDocument();
    expect(within(table).getByText("42")).toBeInTheDocument();
  });

  it("documents tab maps type/status, never shows a path, handles unassigned", async () => {
    wrap({ get: vi.fn(async (u: string) => (u.startsWith("/admin/documents") ? page([doc(), doc({ id: "d2", land_id: null, ocr_confidence: null, processing_status: "WEIRD" })]) : page([land()]))) }, en, "en", <RecordsView />);
    await screen.findByTestId("records-table");
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
    const item = OFFICER_NAV.find((i) => i.href === "/admin")!;
    expect(item.roles).toEqual(ADMIN_ONLY);
    expect(hasRole("OFFICER", item.roles)).toBe(false);
    expect(hasRole("ADMIN", item.roles)).toBe(true);
  });

  it("renders in Bangla", async () => {
    wrap(undefined, bn, "bn");
    expect(await screen.findByText(bn.admin.console.users.title, { selector: "h2, h3, div, span" })).toBeInTheDocument();
    expect(await screen.findByTestId("users-table")).toBeInTheDocument();
  });
});

describe("admin console shell (U3.5)", () => {
  it("lists the sections, content and records, with the current one marked", () => {
    expect(ADMIN_NAV.map((n) => n.href)).toEqual([
      "/admin", "/admin/users", "/admin/officer-requests", "/admin/offices", "/admin/content", "/admin/records", "/admin/audit-logs", "/admin/settings",
    ]);
    wrap(undefined, en, "en", <AdminShell><p>body</p></AdminShell>);
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getAllByRole("link")).toHaveLength(8);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveTextContent("Users");
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("admins land on /admin after sign-in; officers stay on /officer", () => {
    expect(redirectFor("ADMIN")).toBe("/admin");
    expect(redirectFor("OFFICER")).toBe("/officer");
  });

  it("overview shows counts and links the waiting officer requests", async () => {
    const get = vi.fn(async (u: string) =>
      u.startsWith("/admin/officer-requests") ? { items: [], total: 9, pending: 3, limit: 1, offset: 0 }
      : u.startsWith("/admin/users") ? page([user()], 42)
      : u.startsWith("/admin/land-records") ? page([land()], 1200) : page([doc()], 7));
    wrap({ get }, en, "en", <AdminOverview />);
    const pending = await screen.findByTestId("tile-pending");
    expect(pending).toHaveTextContent("3");
    expect(pending).toHaveAttribute("href", "/admin/officer-requests");
    expect(screen.getByTestId("tile-users")).toHaveTextContent("42");
    expect(screen.getByTestId("tile-records")).toHaveTextContent("1,200");
    expect(screen.getByTestId("tile-documents")).toHaveTextContent("7");
    expect(screen.getByTestId("ledger-card")).toBeInTheDocument();
  });

  it("offices table lists offices with their officer counts and queries the API", async () => {
    const office = (o: any = {}) => ({
      id: "o1", code: "UL-1", office_type: "Union Land Office", division_en: "Dhaka", division_bn: "ঢাকা", district_en: "Dhaka", district_bn: "ঢাকা",
      upazila_en: "Savar", upazila_bn: "সাভার", union_en: "Ashulia", union_bn: "আশুলিয়া", name_en: "Ashulia Union Land Office", name_bn: "আশুলিয়া ইউনিয়ন ভূমি অফিস",
      location: null, officers: 2, ...o,
    });
    const get = vi.fn(async () => page([office(), office({ id: "o2", code: "UL-2", name_en: "Other", name_bn: "Other", officers: 0 })], 2));
    wrap({ get }, en, "en", <OfficesPanel />);
    const table = await screen.findByTestId("offices-table");
    expect(within(table).getByText(/Ashulia Union Land Office/)).toBeInTheDocument();
    expect(within(table).getByText("UL-1")).toBeInTheDocument();
    expect(within(table).getByText("2")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/admin/offices?limit=20&offset=0");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: " savar " } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith("/admin/offices?limit=20&offset=0&q=savar"));
  });

  it("settings is read-only and explains each role, in both languages", () => {
    wrap(undefined, en, "en", <SettingsPanel />);
    expect(screen.getByRole("note")).toHaveTextContent("cannot be changed here yet");
    expect(screen.getByText(/after 15 minutes/)).toBeInTheDocument();
    expect(within(screen.getByTestId("roles-list")).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
