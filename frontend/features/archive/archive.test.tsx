import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { OFFICER_NAV } from "@/features/officer/OfficerShell";
import { hasRole } from "@/features/auth/roles";
import ArchiveSearch from "./ArchiveSearch";
import { archiveQuery } from "./useArchive";
import { archiveHitHref, parseYear, yearLabel, yearsReversed } from "./types";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const user = { id: "1", name: "U", email: "u@x.co", role: "REVIEWER", preferred_language: "en" };
const hit = (over: any = {}) => ({
  document_id: "d1", document_type: "KHATIAN", land_id: "LP-10100", survey_type: "RS", district: "Gazipur",
  upazila: "Sreepur", mouza: "Barmi", khatian_no: "1245", snippet: "মৌজা [বারমী] মালিক", year_from: null, year_to: null, historical: false, ...over,
});

function wrap(get: any, messages: any = en, locale = "en") {
  const client = { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <ArchiveSearch />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("archive search", () => {
  it("builds the query string", () => {
    expect(archiveQuery({ q: " বারমী ", survey: "RS", district: "", yearFrom: "", yearTo: "", page: 2 })).toBe(
      "q=%E0%A6%AC%E0%A6%BE%E0%A6%B0%E0%A6%AE%E0%A7%80&survey=RS&limit=10&offset=10",
    );
  });

  it("does not call the API until a search is submitted, then shows highlighted hits", async () => {
    const get = vi.fn().mockResolvedValue({ items: [hit()], total: 1, limit: 10, offset: 0 });
    wrap(get);
    await screen.findByText(en.archive.hint);
    expect(get).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Search text/), { target: { value: "বারমী" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const table = await screen.findByTestId("archive-table");
    expect(get.mock.calls.at(-1)![0]).toContain("/archive/search?q=");
    expect(within(table).getByText("RS (Revisional)")).toBeInTheDocument();
    expect(within(table).getByText("LP-10100")).toBeInTheDocument();
    expect(table.querySelector("mark")?.textContent).toBe("বারমী");
  });

  it("shows the empty text and renders in Bangla", async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
    wrap(get, bn, "bn");
    fireEvent.change(screen.getByLabelText(/অনুসন্ধানের লেখা/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "খুঁজুন" }));
    await waitFor(() => expect(screen.getByText(bn.archive.empty)).toBeInTheDocument());
  });

  it("adds the year range to the query only when both are four-digit years", () => {
    const base = { q: "রামকান্ত", survey: "", district: "", page: 1 };
    expect(archiveQuery({ ...base, yearFrom: "1940", yearTo: "1950" })).toContain("year_from=1940&year_to=1950");
    const bad = archiveQuery({ ...base, yearFrom: "19", yearTo: "abcd" });
    expect(bad).not.toContain("year_from");
    expect(bad).not.toContain("year_to");
    expect(archiveQuery({ ...base, yearFrom: "", yearTo: "1950" })).toContain("year_to=1950");
  });

  it("year helpers", () => {
    expect(parseYear(" 1944 ")).toBe(1944);
    expect(parseYear("১৯৪৪")).toBe(1944); // typed on a Bangla keyboard
    expect(parseYear("944")).toBeNull();
    expect(parseYear("2300")).toBeNull();
    expect(yearsReversed("1950", "1940")).toBe(true);
    expect(yearsReversed("1940", "1950")).toBe(false);
    expect(yearsReversed("", "1940")).toBe(false);
    expect(yearLabel({ year_from: 1944, year_to: 1944 })).toBe("1944");
    expect(yearLabel({ year_from: 1940, year_to: 1950 })).toBe("1940–1950");
    expect(yearLabel({ year_from: null, year_to: null })).toBeNull();
    expect(archiveHitHref({ document_id: "d9" })).toBe("/officer/documents/d9");
  });

  it("shows the deed year, the Historical tag and a link to the document page", async () => {
    const get = vi.fn().mockResolvedValue({
      items: [hit({ document_id: "dh", survey_type: null, land_id: null, mouza: "ভবানীপুর", year_from: 1944, year_to: 1944, historical: true })],
      total: 1, limit: 10, offset: 0,
    });
    wrap(get);
    fireEvent.change(screen.getByLabelText(/Search text/), { target: { value: "রামকান্ত" } });
    fireEvent.change(screen.getByLabelText(/Deed year from/), { target: { value: "1940" } });
    fireEvent.change(screen.getByLabelText(/Deed year to/), { target: { value: "1950" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const table = await screen.findByTestId("archive-table");
    expect(get.mock.calls.at(-1)![0]).toContain("year_from=1940&year_to=1950");
    expect(within(table).getByText("1944")).toBeInTheDocument();
    expect(within(table).getByText("Historical")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: /Open the document for ভবানীপুর/ })).toHaveAttribute("href", "/officer/documents/dh");
  });

  it("blocks the search and explains when the years are wrong", async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
    wrap(get);
    fireEvent.change(screen.getByLabelText(/Search text/), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(/Deed year from/), { target: { value: "1950" } });
    fireEvent.change(screen.getByLabelText(/Deed year to/), { target: { value: "1940" } });
    expect(await screen.findByText(en.archive.yearsReversed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Deed year from/), { target: { value: "19" } });
    expect(await screen.findByText(en.archive.yearInvalid)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("is in the officer nav for reviewers and up", () => {
    const item = OFFICER_NAV.find((i) => i.href === "/officer/archive")!;
    expect(hasRole("REVIEWER", item.roles)).toBe(true);
    expect(hasRole("CITIZEN", item.roles)).toBe(false);
  });
});
