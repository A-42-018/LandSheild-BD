import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import type { ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import CheckForm from "./CheckForm";
import CheckResult from "./CheckResult";
import { checkSchema } from "./schema";
import type { PrePurchaseDto } from "./types";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/check",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const user = { id: "1", name: "C", email: "c@x.co", role: "CITIZEN", preferred_language: "en" };

const row = (code: string, status: string, detail = {}) => ({ code, status, detail });
const CLEAN: PrePurchaseDto = {
  land_id: "LP-10001",
  verdict: "NO_INDICATORS",
  rows: [
    row("SELLER_MATCHES_OWNER", "PASS"),
    row("MUTATION_UP_TO_DATE", "PASS", { pending: 0, unmutated: 0 }),
    row("NO_PENDING_CASE", "PASS", { count: 0 }),
    row("NOT_KHAS_OR_ACQUIRED", "PASS", { khas: 0, acquisition: 0 }),
    row("NO_OPEN_RISK_INDICATORS", "PASS", { high: 0, other: 0 }),
    row("DOCUMENT_AUTHENTIC", "UNKNOWN"),
  ],
} as PrePurchaseDto;
const KHAS: PrePurchaseDto = {
  ...CLEAN,
  land_id: "LP-10900",
  verdict: "INDICATORS_FOUND",
  rows: CLEAN.rows.map((r) => (r.code === "NOT_KHAS_OR_ACQUIRED" ? row(r.code, "FAIL", { khas: 1, acquisition: 0 }) : r)),
} as PrePurchaseDto;

const wrap = (ui: React.ReactNode, messages: any = en, locale = "en", client?: ApiClient) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client ?? ({ refresh: vi.fn().mockResolvedValue({ user }), get: vi.fn() } as unknown as ApiClient)}>
          {ui}
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
};

describe("CheckResult", () => {
  it("clean parcel: no FAIL rows and the clear verdict", () => {
    wrap(<CheckResult data={CLEAN} />);
    expect(screen.getByTestId("check-verdict")).toHaveTextContent(en.check.verdict.clear);
    for (const r of CLEAN.rows.filter((r) => r.code !== "DOCUMENT_AUTHENTIC"))
      expect(screen.getByTestId(`check-row-${r.code}`)).toHaveAttribute("data-status", "PASS");
    expect(screen.getByTestId("check-row-DOCUMENT_AUTHENTIC")).toHaveAttribute("data-status", "UNKNOWN");
  });
  it("khas parcel: FAIL row with text status and the flagged verdict", () => {
    wrap(<CheckResult data={KHAS} />);
    const r = screen.getByTestId("check-row-NOT_KHAS_OR_ACQUIRED");
    expect(r).toHaveAttribute("data-status", "FAIL");
    expect(r).toHaveTextContent(en.check.status.FAIL);
    expect(screen.getByTestId("check-verdict")).toHaveTextContent(en.check.verdict.flagged);
  });
  it("renders in Bangla", () => {
    wrap(<CheckResult data={KHAS} />, bn, "bn");
    expect(screen.getByTestId("check-verdict")).toHaveTextContent(bn.check.verdict.flagged);
  });
});

describe("schema + form", () => {
  it("seller is optional and trimmed", () => {
    const base = { district: "Dhaka", upazila: "Savar", mouza: "Ashulia", khatian: "501", dag: "101" };
    expect(checkSchema.safeParse(base).success).toBe(true);
    expect(checkSchema.parse({ ...base, seller: "  Jamal  " }).seller).toBe("Jamal");
    expect(checkSchema.safeParse({ ...base, seller: "x".repeat(101) }).success).toBe(false);
  });
  it("searches the land, then calls the check endpoint with the seller", async () => {
    const get = vi.fn().mockResolvedValueOnce({ land_id: "LP-10900" }).mockResolvedValueOnce(KHAS);
    wrap(<CheckForm />, en, "en", { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient);
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en.verify.district}`)), { target: { value: "Gazipur" } });
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.upazila)), { target: { value: "Sreepur" } });
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.mouza)), { target: { value: "Barmi" } });
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.khatian)), { target: { value: "1245" } });
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.dag)), { target: { value: "785" } });
    fireEvent.change(screen.getByLabelText(/Seller name/), { target: { value: "Rahim" } });
    fireEvent.click(screen.getByRole("button", { name: en.check.submit }));
    await waitFor(() => expect(screen.getByTestId("check-result")).toBeInTheDocument());
    expect(get.mock.calls[1][0]).toBe("/lands/LP-10900/pre-purchase-check?seller=Rahim");
  });
  it("shows a not-found error", async () => {
    const { ApiError } = await import("@/lib/api");
    const get = vi.fn().mockRejectedValue(new ApiError(404, "LAND_NOT_FOUND", "x"));
    wrap(<CheckForm />, en, "en", { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient);
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en.verify.district}`)), { target: { value: "Gazipur" } });
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.upazila)), { target: { value: "Sreepur" } });
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.mouza)), { target: { value: "Barmi" } });
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.khatian)), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.dag)), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: en.check.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.check.errors.notFound);
  });
});
