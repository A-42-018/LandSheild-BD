import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { upazilasOf } from "@/lib/geo";
import { AuthProvider } from "@/features/auth/AuthContext";
import VerifyForm from "./VerifyForm";
import { normalizeDigits, verifySchema } from "./schema";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/verify",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const user = { id: "1", name: "C", email: "c@x.co", role: "CITIZEN", preferred_language: "en" };

function client(get: ApiClient["get"]): ApiClient {
  return { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient;
}

function wrap(c: ApiClient, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}>
          <VerifyForm />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function fill(m: any = en) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${m.verify.district}`)), { target: { value: "Gazipur" } });
  fireEvent.change(screen.getByLabelText(new RegExp(m.verify.upazila)), { target: { value: "Sreepur" } });
  fireEvent.change(screen.getByLabelText(new RegExp(m.verify.mouza)), { target: { value: "Barmi" } });
  fireEvent.change(screen.getByLabelText(new RegExp(m.verify.khatian)), { target: { value: "১২৪৫" } });
  fireEvent.change(screen.getByLabelText(new RegExp(m.verify.dag)), { target: { value: "785" } });
}

beforeEach(() => push.mockClear());

describe("schema", () => {
  it("normalizes Bangla digits: ১২৪৫ → 1245", () => {
    expect(normalizeDigits("১২৪৫")).toBe("1245");
    const r = verifySchema.parse({ district: "Gazipur", upazila: "Sreepur", mouza: " Barmi ", khatian: "১২৪৫", dag: "৭৮৫" });
    expect(r).toMatchObject({ khatian: "1245", dag: "785", mouza: "Barmi" });
  });
  it("rejects non-numeric khatian and empty fields", () => {
    expect(verifySchema.safeParse({ district: "", upazila: "", mouza: "", khatian: "abc", dag: "" }).success).toBe(false);
  });
});

describe("geo", () => {
  it("lists upazilas per district", () => {
    expect(upazilasOf("Gazipur").map((u) => u.value)).toContain("Sreepur");
    expect(upazilasOf("nope")).toEqual([]);
  });
});

describe("VerifyForm", () => {
  it("shows required errors and does not call the API", async () => {
    const get = vi.fn();
    wrap(client(get as any));
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    expect((await screen.findAllByText(en.verify.errors.required)).length).toBeGreaterThan(0);
    expect(get).not.toHaveBeenCalled();
  });

  it("sends ASCII digits and navigates to the result route", async () => {
    const get = vi.fn().mockResolvedValue({ land_id: "LP-10100" });
    wrap(client(get as any));
    fill();
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify/result?land_id=LP-10100"));
    const url = get.mock.calls.map((c) => c[0] as string).find((u) => u.startsWith("/lands/search")) as string;
    expect(url).toContain("khatian=1245");
    expect(url).toContain("district=Gazipur");
  });

  it("suggests mouza names of the chosen upazila while typing", async () => {
    const get = vi.fn(async (url: string) => {
      if (url.startsWith("/gis/search"))
        return { hits: [{ level: "upazila", id: "77", name: "Sreepur", bn_name: "", path: "Dhaka / Gazipur" }] };
      if (url.startsWith("/gis/mouzas"))
        return {
          enabled: true,
          mouzas: [
            { id: "a", name: "Barmi", bn_name: "বারমী", jl_no: "012" },
            { id: "b", name: "Barmi", bn_name: "বারমী", jl_no: "034" },
            { id: "c", name: "মাওনা", bn_name: "মাওনা", jl_no: "005" },
          ],
        };
      throw new ApiError(404, "LAND_NOT_FOUND", "x");
    });
    wrap(client(get as any));
    fill();
    const input = screen.getByLabelText(new RegExp(en.verify.mouza)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.focus(input);
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain("Barmi");
    expect(options[1].textContent).toContain("মাওনা");
    fireEvent.mouseDown(options[0]);
    expect(input.value).toBe("Barmi");
    fireEvent.change(input, { target: { value: "মাও" } });
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);
  });

  it("shows the empty state on 404", async () => {
    const get = vi.fn().mockRejectedValue(new ApiError(404, "LAND_NOT_FOUND", "x"));
    wrap(client(get as any));
    fill();
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.verify.errors.notFound);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a network error in Bangla", async () => {
    const get = vi.fn().mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "x"));
    wrap(client(get as any), bn, "bn");
    fill(bn);
    fireEvent.click(await screen.findByRole("button", { name: bn.verify.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(bn.verify.errors.network);
  });
});
