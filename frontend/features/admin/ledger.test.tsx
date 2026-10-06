import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import LedgerCard from "./LedgerCard";

const ME = { id: "me", name: "Ada Admin", email: "ada@x.co", role: "ADMIN", preferred_language: "en" };

function wrap(get: any, messages: any = en, locale = "en") {
  const client = { refresh: vi.fn().mockResolvedValue({ user: ME }), get, post: vi.fn(), patch: vi.fn() } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <LedgerCard />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("ledger integrity card", () => {
  it("does not call the API until Verify is pressed, then shows INTACT", async () => {
    const get = vi.fn().mockResolvedValue({ status: "INTACT", entries: 42, broken_seq: null, reason: null, entity_type: null, entity_id: null });
    wrap(get);
    expect(get).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Verify ledger" }));
    expect(await screen.findByText("Ledger intact")).toBeInTheDocument();
    expect(screen.getByText("42 entries verified")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/admin/ledger/verify");
  });

  it("shows the first broken seq and the reason", async () => {
    const get = vi.fn().mockResolvedValue({ status: "BROKEN", entries: 42, broken_seq: 7, reason: "RECORD_MODIFIED", entity_type: "transaction", entity_id: "t1" });
    wrap(get);
    fireEvent.click(await screen.findByRole("button", { name: "Verify ledger" }));
    expect(await screen.findByText("Broken at entry #7")).toBeInTheDocument();
    expect(screen.getByText(en.admin.ledger.reasons.RECORD_MODIFIED)).toBeInTheDocument();
  });

  it("shows a permission error on 403 and has Bangla text", async () => {
    const get = vi.fn().mockRejectedValue(new ApiError(403, "FORBIDDEN", "no"));
    wrap(get, bn, "bn");
    fireEvent.click(await screen.findByRole("button", { name: bn.admin.ledger.verify }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
