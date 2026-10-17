import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import PublicVerifyView from "./PublicVerifyView";
import QrCard from "./QrCard";
import { publicPath, publicUrl } from "./publicUrl";
import type { PublicVerifyDto } from "./types";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/v/LP-10240",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));
vi.mock("qrcode.react", () => ({
  QRCodeSVG: (p: any) => <svg data-value={p.value} role="img" aria-label={p["aria-label"]} data-testid={p["data-testid"]} />,
}));

const DTO: PublicVerifyDto = {
  land_id: "LP-10240",
  district: "Dhaka",
  upazila: "Savar",
  mouza: "Ashulia",
  status: "ACTIVE",
  risk_level: "HIGH",
  counts: { ownership_records: 3, transactions: 2, flagged_transactions: 2, open_alerts: 1 },
  last_verified_at: "2026-09-30T10:15:00+00:00",
};

function wrap(ui: React.ReactNode, c: Partial<ApiClient>, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = { refresh: vi.fn().mockResolvedValue(null), ...c } as unknown as ApiClient;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("publicUrl", () => {
  it("encodes only /{locale}/v/{landId}", () => {
    expect(publicPath("bn", "LP-10240")).toBe("/bn/v/LP-10240");
    expect(publicUrl("en", "LP-10240", "https://demo.example/")).toBe("https://demo.example/en/v/LP-10240");
  });
});

describe("QrCard", () => {
  it("renders an accessible QR whose value is the public URL only", () => {
    wrap(<QrCard landId="LP-10240" />, {});
    const svg = screen.getByTestId("qr-code");
    expect(svg.getAttribute("aria-label")).toContain("LP-10240");
    const value = svg.getAttribute("data-value") ?? "";
    expect(value).toMatch(/\/en\/v\/LP-10240$/);
    expect(value).not.toMatch(/\?|#|token|name/i);
    expect(screen.getByTestId("qr-url").getAttribute("href")).toBe(value);
    expect(screen.getByText(en.qr.caption)).toBeTruthy();
  });
  it("renders BN text", () => {
    wrap(<QrCard landId="LP-10240" />, {}, bn, "bn");
    expect(screen.getByText(bn.qr.caption)).toBeTruthy();
    expect(screen.getByTestId("qr-code").getAttribute("data-value")).toMatch(/\/bn\/v\/LP-10240$/);
  });
});

describe("PublicVerifyView", () => {
  it("loads anonymously and shows the PublicSafe summary with no names", async () => {
    const request = vi.fn().mockResolvedValue(DTO);
    wrap(<PublicVerifyView landId="LP-10240" />, { request } as any);
    await waitFor(() => expect(screen.getByTestId("public-summary")).toBeTruthy());
    expect(request).toHaveBeenCalledWith("/public/verify/LP-10240", { anonymous: true });
    expect(screen.getByText("Savar")).toBeTruthy();
    expect(screen.getByTestId("public-risk").textContent).toContain("High");
    const counts = screen.getByTestId("public-counts");
    expect(counts.textContent).toContain("Ownership records");
    expect(screen.getByTestId("public-last-verified").textContent).toContain("2026");
    expect(screen.getByText(en.common.demoLabel)).toBeTruthy();
    expect(screen.getByTestId("public-privacy").textContent).toContain(en.publicVerify.privacyNote);
    expect(document.body.textContent).not.toMatch(/father|rahim|karim|hasan/i);
  });
  it("shows 'not verified yet' when never verified", async () => {
    wrap(<PublicVerifyView landId="LP-10001" />, { request: vi.fn().mockResolvedValue({ ...DTO, last_verified_at: null, risk_level: "LOW" }) } as any);
    await waitFor(() => expect(screen.getByTestId("public-last-verified").textContent).toBe(en.publicVerify.neverVerified));
  });
  it("404 → not found state", async () => {
    wrap(<PublicVerifyView landId="LP-99999" />, { request: vi.fn().mockRejectedValue(new ApiError(404, "LAND_NOT_FOUND", "x")) } as any);
    await waitFor(() => expect(screen.getByText(en.publicVerify.notFound)).toBeTruthy());
  });
  it("429 → rate-limit message", async () => {
    wrap(<PublicVerifyView landId="LP-10240" />, { request: vi.fn().mockRejectedValue(new ApiError(429, "RATE_LIMITED", "x")) } as any);
    await waitFor(() => expect(screen.getByText(en.errors.tooMany)).toBeTruthy());
  });
  it("error → retry refetches", async () => {
    const request = vi.fn().mockRejectedValueOnce(new ApiError(500, "X", "x")).mockResolvedValue(DTO);
    wrap(<PublicVerifyView landId="LP-10240" />, { request } as any);
    await waitFor(() => expect(screen.getByText(en.publicVerify.loadError)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await waitFor(() => expect(screen.getByTestId("public-summary")).toBeTruthy());
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("renders BN labels", async () => {
    wrap(<PublicVerifyView landId="LP-10240" />, { request: vi.fn().mockResolvedValue(DTO) } as any, bn, "bn");
    await waitFor(() => expect(screen.getByText(bn.publicVerify.title)).toBeTruthy());
    expect(screen.getByTestId("public-counts").textContent).toContain(bn.publicVerify.ownershipRecords);
  });
});

describe("signed QR (F4a)", () => {
  it("adds only deed id + hash prefix once the seal loads", async () => {
    const request = vi.fn().mockResolvedValue({ deed_id: "deed-1", hash12: "0123456789ab" });
    wrap(<QrCard landId="LP-10240" />, { request } as any);
    await waitFor(() =>
      expect(screen.getByTestId("qr-code").getAttribute("data-value")).toMatch(/\/en\/v\/LP-10240\?d=deed-1&h=0123456789ab$/),
    );
    expect(request).toHaveBeenCalledWith("/public/seal/LP-10240", { anonymous: true });
  });
  it("shows the signature chip for ?d=&h= and nothing without them", async () => {
    window.history.pushState({}, "", "/en/v/LP-10240?d=deed-1&h=0123456789ab");
    const request = vi.fn((path: string) =>
      Promise.resolve(path.startsWith("/public/signature") ? { state: "VALID" } : DTO),
    );
    wrap(<PublicVerifyView landId="LP-10240" />, { request } as any);
    const chip = await screen.findByTestId("signature-chip");
    expect(chip.getAttribute("data-state")).toBe("VALID");
    expect(chip.textContent).toContain(en.publicVerify.sig.VALID);
    window.history.pushState({}, "", "/en/v/LP-10240");
  });
});

