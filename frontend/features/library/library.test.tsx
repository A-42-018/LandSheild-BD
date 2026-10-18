import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { hasRole } from "@/features/auth/roles";
import { OFFICER_NAV } from "@/features/officer/OfficerShell";
import LibraryView from "./LibraryView";
import RecentUploads from "./RecentUploads";
import { DEFAULT_PARAMS } from "./types";
import { libraryQuery, paramsFromUrl, paramsToUrl } from "./useLibrary";

let search = "";
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/officer/documents",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const user = { id: "1", name: "U", email: "u@x.co", role: "OFFICER", preferred_language: "en" };
const row = (over: any = {}) => ({
  id: "d1", land_id: "LP-10240", document_type: "DEED", processing_status: "REVIEW_REQUIRED", file_type: "pdf",
  created_at: "2026-10-01T08:00:00Z", office: null, deed_no: "4782/খ", mouza: "ভবানীপুর", deed_date: "1944-02-27",
  deed_profile: "historical", historical: true, uploaded_by_me: true, digitised: false, approved_version: null,
  versions: 1, needs_my_action: false, ...over,
});
const LIST = (items: any[], total = items.length) => ({ items, total, limit: 20, offset: 0 });

function wrap(ui: React.ReactNode, get: any, messages: any = en, locale = "en") {
  const client = { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } }); // the hooks retry a 500 twice
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
const api = (over: (p: string) => any = () => LIST([row()])) =>
  vi.fn((p: string) => {
    if (p.startsWith("/offices")) return Promise.resolve([]);
    return Promise.resolve(over(p));
  });
const docCalls = (get: any) => get.mock.calls.map((c: any[]) => c[0] as string).filter((p: string) => p.startsWith("/documents?"));

beforeEach(() => {
  search = "";
  replace.mockClear();
});

describe("library url state", () => {
  it("builds the API query", () => {
    expect(libraryQuery({ ...DEFAULT_PARAMS, tab: "action", status: "APPROVED", profile: "historical", q: " ভবানীপুর ", page: 3 })).toBe(
      "tab=action&status=APPROVED&q=%E0%A6%AD%E0%A6%AC%E0%A6%BE%E0%A6%A8%E0%A7%80%E0%A6%AA%E0%A7%81%E0%A6%B0&profile=historical&sort=created_at&order=desc&limit=20&offset=40",
    );
  });
  it("round-trips through the URL and drops defaults", () => {
    expect(paramsToUrl(DEFAULT_PARAMS)).toBe("");
    const p = { ...DEFAULT_PARAMS, tab: "office" as const, type: "DEED", sort: "deed_date" as const, order: "asc" as const, page: 2 };
    expect(paramsFromUrl(new URLSearchParams(paramsToUrl(p)))).toEqual(p);
  });
  it("ignores unknown values", () => {
    const p = paramsFromUrl(new URLSearchParams("tab=x&sort=y&profile=z&page=-4&order=up"));
    expect(p).toEqual(DEFAULT_PARAMS);
  });
});

describe("library page", () => {
  it("lists my uploads with the historical tag, status and digitised column", async () => {
    const get = api(() => LIST([row(), row({ id: "d2", deed_no: null, land_id: null, historical: false, file_type: "png", digitised: true, approved_version: 2, processing_status: "APPROVED" })]));
    wrap(<LibraryView />, get);
    const link = await screen.findByRole("link", { name: /Open document 4782/ });
    expect(link).toHaveAttribute("href", "/officer/documents/d1");
    const tr = link.closest("tr") as HTMLElement;
    expect(within(tr).getByText("Historical")).toBeInTheDocument();
    expect(within(tr).getByText("Not yet")).toBeInTheDocument();
    expect(screen.getByText("Digital v2")).toBeInTheDocument();
    expect(docCalls(get)[0]).toContain("tab=mine");
  });

  it("gives every row a Download menu for its own document", async () => {
    wrap(<LibraryView />, api(() => LIST([row(), row({ id: "d2", digitised: true, approved_version: 2, versions: 2, processing_status: "APPROVED" }), row({ id: "d3", versions: 0 })])));
    await screen.findByTestId("library-table");
    expect(screen.getAllByTestId("download-trigger")).toHaveLength(3);
    fireEvent.click(within(screen.getByTestId("download-menu-d3")).getByTestId("download-trigger"));
    expect(screen.getByTestId("download-pdf")).toBeDisabled();
    expect(screen.getByTestId("download-original")).toBeEnabled();
    fireEvent.click(within(screen.getByTestId("download-menu-d2")).getByTestId("download-trigger"));
    expect(screen.queryByTestId("download-draft-note")).toBeNull();
  });

  it("shows three tabs and switches the tab through the URL", async () => {
    wrap(<LibraryView />, api());
    await screen.findByTestId("library-table");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["My uploads", "My office", "Needs my action"]);
    fireEvent.click(screen.getByRole("tab", { name: "Needs my action" }));
    expect(replace).toHaveBeenCalledWith("/officer/documents?tab=action");
  });

  it("reads the tab and filters from the URL and sends them to the API", async () => {
    search = "tab=office&status=APPROVED&profile=historical&type=DEED&date_from=2026-10-01&date_to=2026-10-31&q=%E0%A6%AD&sort=deed_date&order=asc&page=2";
    const get = api(() => LIST([row()], 45));
    wrap(<LibraryView />, get);
    await screen.findByTestId("library-table");
    const url = docCalls(get)[0];
    for (const part of ["tab=office", "status=APPROVED", "profile=historical", "type=DEED", "date_from=2026-10-01", "date_to=2026-10-31", "sort=deed_date", "order=asc", "offset=20"])
      expect(url).toContain(part);
    expect(screen.getByRole("tab", { name: "My office", selected: true })).toBeInTheDocument();
  });

  it("each filter and the search write the URL and reset to page 1", async () => {
    search = "page=3";
    wrap(<LibraryView />, api(() => LIST([row()], 100)));
    await screen.findByTestId("library-table");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "APPROVED" } });
    expect(replace).toHaveBeenLastCalledWith("/officer/documents?status=APPROVED");
    fireEvent.change(screen.getByLabelText("Document type"), { target: { value: "KHATIAN" } });
    expect(replace).toHaveBeenLastCalledWith("/officer/documents?type=KHATIAN");
    fireEvent.change(screen.getByLabelText("Kind of deed"), { target: { value: "modern" } });
    expect(replace).toHaveBeenLastCalledWith("/officer/documents?profile=modern");
    fireEvent.change(screen.getByLabelText("Uploaded from"), { target: { value: "2026-10-01" } });
    expect(replace).toHaveBeenLastCalledWith("/officer/documents?date_from=2026-10-01");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "রামকান্ত" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(replace.mock.calls.at(-1)![0]).toContain("q=");
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "deed_date" } });
    expect(replace).toHaveBeenLastCalledWith("/officer/documents?sort=deed_date");
  });

  it("pages and clears filters", async () => {
    search = "status=APPROVED&page=2";
    wrap(<LibraryView />, api(() => LIST([row()], 45)));
    await screen.findByTestId("library-table");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(replace).toHaveBeenLastCalledWith("/officer/documents");
  });

  it("shows a message per tab when empty", async () => {
    search = "tab=action";
    wrap(<LibraryView />, api(() => LIST([])));
    expect(await screen.findByText(en.library.empty.action)).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    const get = vi.fn((p: string) => (p.startsWith("/documents?") ? Promise.reject(new ApiError(500, "SERVER", "boom")) : Promise.resolve([])));
    wrap(<LibraryView />, get);
    expect(await screen.findByRole("button", { name: /try again|retry/i })).toBeInTheDocument();
  });

  it("renders in Bangla", async () => {
    wrap(<LibraryView />, api(), bn, "bn");
    expect(await screen.findByRole("heading", { level: 1, name: bn.library.title })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: bn.library.tabs.mine })).toBeInTheDocument();
  });
});

describe("recent uploads card and menu item", () => {
  it("asks for my last five and links to the library", async () => {
    const get = api(() => LIST([row(), row({ id: "d2", deed_no: "9/A" })]));
    wrap(<RecentUploads />, get);
    expect(await screen.findByTestId("recent-uploads")).toBeInTheDocument();
    expect(docCalls(get)[0]).toContain("tab=mine");
    expect(docCalls(get)[0]).toContain("limit=5");
    expect(screen.getByRole("link", { name: en.library.recent.all })).toHaveAttribute("href", "/officer/documents");
  });
  it("is empty without uploads", async () => {
    wrap(<RecentUploads />, api(() => LIST([])));
    expect(await screen.findByText(en.library.recent.empty)).toBeInTheDocument();
  });
  it("adds My documents to the officer menu for reviewers and up, not citizens", () => {
    const item = OFFICER_NAV.find((i) => i.href === "/officer/documents")!;
    expect(item.labelKey).toBe("officer.nav.documents");
    for (const r of ["REVIEWER", "OFFICER", "ADMIN"] as const) expect(hasRole(r, item.roles)).toBe(true);
    expect(hasRole("CITIZEN", item.roles)).toBe(false);
  });
});
