import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import PublicRecordView from "./PublicRecordView";
import { recordPath } from "./publicUrl";
import type { PublicRecordDto } from "./types";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/v/r/rec-1",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const DTO: PublicRecordDto = {
  state: "VALID",
  deed_no: "4782/খ",
  version: 2,
  approved_at: "2026-10-18T07:00:00Z",
  superseded: false,
};

function wrap(c: Partial<ApiClient>, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = { refresh: vi.fn().mockResolvedValue(null), ...c } as unknown as ApiClient;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <PublicRecordView recordId="rec-1" />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("recordPath", () => {
  it("is /{locale}/v/r/{id}, encoded", () => {
    expect(recordPath("bn", "abc")).toBe("/bn/v/r/abc");
    expect(recordPath("en", "a/b")).toBe("/en/v/r/a%2Fb");
  });
});

describe("PublicRecordView", () => {
  it("calls the API anonymously and shows valid, deed no, version and date only", async () => {
    const request = vi.fn().mockResolvedValue(DTO);
    wrap({ request } as any);
    const state = await screen.findByTestId("record-state");
    expect(request).toHaveBeenCalledWith("/public/records/rec-1", { anonymous: true });
    expect(state.getAttribute("data-state")).toBe("VALID");
    expect(state.textContent).toContain(en.publicRecord.state.VALID);
    expect(screen.getByTestId("record-deed-no").textContent).toBe("4782/খ");
    expect(screen.getByTestId("record-version").textContent).toBe("2");
    expect(screen.getByTestId("record-approved-at").textContent).toContain("2026");
    expect(screen.getByTestId("record-privacy").textContent).toContain(en.publicRecord.privacyNote);
    expect(screen.queryByTestId("record-superseded")).toBeNull();
    expect(document.body.textContent).not.toMatch(/sha-?256|signature|officer/i);
  });
  it("shows INVALID with icon + text, not colour alone", async () => {
    wrap({ request: vi.fn().mockResolvedValue({ ...DTO, state: "INVALID" }) } as any);
    const state = await screen.findByTestId("record-state");
    expect(state.getAttribute("data-state")).toBe("INVALID");
    expect(state.textContent).toContain(en.publicRecord.state.INVALID);
    expect(state.querySelector("svg")).toBeTruthy();
  });
  it("notes when a newer approved version exists", async () => {
    wrap({ request: vi.fn().mockResolvedValue({ ...DTO, version: 1, superseded: true }) } as any);
    expect((await screen.findByTestId("record-superseded")).textContent).toContain(en.publicRecord.superseded);
  });
  it("shows a dash when the deed no or date is missing", async () => {
    wrap({ request: vi.fn().mockResolvedValue({ ...DTO, deed_no: null, approved_at: null }) } as any);
    await screen.findByTestId("record-state");
    expect(screen.getByTestId("record-deed-no").textContent).toBe(en.publicRecord.none);
    expect(screen.getByTestId("record-approved-at").textContent).toBe(en.publicRecord.none);
  });
  it("404 → not found state, no details", async () => {
    wrap({ request: vi.fn().mockRejectedValue(new ApiError(404, "RECORD_NOT_FOUND", "x")) } as any);
    await waitFor(() => expect(screen.getByTestId("record-not-found")).toBeTruthy());
    expect(screen.getByText(en.publicRecord.notFound)).toBeTruthy();
    expect(screen.queryByTestId("record-details")).toBeNull();
  });
  it("429 → rate-limit message", async () => {
    wrap({ request: vi.fn().mockRejectedValue(new ApiError(429, "RATE_LIMITED", "x")) } as any);
    await waitFor(() => expect(screen.getByText(en.errors.tooMany)).toBeTruthy());
  });
  it("error → retry refetches", async () => {
    const request = vi.fn().mockRejectedValueOnce(new ApiError(500, "X", "x")).mockResolvedValue(DTO);
    wrap({ request } as any);
    await waitFor(() => expect(screen.getByText(en.publicRecord.loadError)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await screen.findByTestId("record-state");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("renders BN labels", async () => {
    wrap({ request: vi.fn().mockResolvedValue(DTO) } as any, bn, "bn");
    expect((await screen.findByTestId("record-state")).textContent).toContain(bn.publicRecord.state.VALID);
    expect(screen.getByText(bn.publicRecord.title)).toBeTruthy();
  });
});
