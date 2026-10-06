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

const user = { id: "1", name: "U", email: "u@x.co", role: "REVIEWER", preferred_language: "en" };
const hit = (over: any = {}) => ({
  document_id: "d1", document_type: "KHATIAN", land_id: "LP-10100", survey_type: "RS", district: "Gazipur",
  upazila: "Sreepur", mouza: "Barmi", khatian_no: "1245", snippet: "মৌজা [বারমী] মালিক", ...over,
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
    expect(archiveQuery({ q: " বারমী ", survey: "RS", district: "", page: 2 })).toBe(
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

  it("is in the officer nav for reviewers and up", () => {
    const item = OFFICER_NAV.find((i) => i.href === "/officer/archive")!;
    expect(hasRole("REVIEWER", item.roles)).toBe(true);
    expect(hasRole("CITIZEN", item.roles)).toBe(false);
  });
});
