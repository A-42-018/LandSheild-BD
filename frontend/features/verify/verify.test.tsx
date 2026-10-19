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

/** A visitor: refresh finds no session, so the form falls back to the public endpoint. */
function visitor(request: ApiClient["request"]): ApiClient {
  return { refresh: vi.fn().mockResolvedValue(null), get: vi.fn(), request } as unknown as ApiClient;
}

const SUMMARY = {
  land_id: "LP-10240", district: "Gazipur", upazila: "Sreepur", mouza: "Barmi", khatian_no: "1250", dag_no: "790",
  area: 10, area_unit: "decimal", status: "ACTIVE", risk_level: "HIGH", owner_count: 2,
  owners_masked: ["R*** U***", "K*** M***"], open_case: true, counts: { active_encumbrances: 1, pending_mutations: 0 },
};

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

const survey = (m: any = en) => screen.getByLabelText(new RegExp(`^${m.verify.survey}`));

function fill(m: any = en) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${m.verify.district}`)), { target: { value: "Gazipur" } });
  fireEvent.change(screen.getByLabelText(new RegExp(m.verify.upazila)), { target: { value: "Sreepur" } });
  fireEvent.change(screen.getByLabelText(new RegExp(m.verify.mouza)), { target: { value: "Barmi" } });
  fireEvent.change(survey(m), { target: { value: "RS" } });
  fireEvent.change(screen.getByLabelText(new RegExp(m.verify.khatian)), { target: { value: "১২৪৫" } });
  fireEvent.change(screen.getByLabelText(new RegExp(m.verify.dag)), { target: { value: "785" } });
}

beforeEach(() => push.mockClear());

describe("schema", () => {
  it("normalizes Bangla digits: ১২৪৫ → 1245", () => {
    expect(normalizeDigits("১২৪৫")).toBe("1245");
    const r = verifySchema.parse({ district: "Gazipur", upazila: "Sreepur", mouza: " Barmi ", survey: "RS", khatian: "১২৪৫", dag: "৭৮৫" });
    expect(r).toMatchObject({ khatian: "1245", dag: "785", mouza: "Barmi", survey: "RS" });
  });
  it("rejects non-numeric khatian and empty fields", () => {
    expect(verifySchema.safeParse({ district: "", upazila: "", mouza: "", survey: "RS", khatian: "abc", dag: "" }).success).toBe(false);
  });
  const base = { district: "Gazipur", upazila: "Sreepur", mouza: "Barmi", khatian: "1", dag: "2" };
  it("requires a survey, with no default", () => {
    const r = verifySchema.safeParse({ ...base, survey: "" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe("surveyRequired");
    expect(verifySchema.safeParse({ ...base, survey: "XX" }).success).toBe(false);
    expect(verifySchema.safeParse({ ...base }).success).toBe(false);
  });
  it("takes JL and sheet as optional text, converting Bangla digits", () => {
    expect(verifySchema.parse({ ...base, survey: "CS", jl_no: "", sheet_no: "" })).toMatchObject({ jl_no: "", sheet_no: "" });
    expect(verifySchema.parse({ ...base, survey: "CS", jl_no: " ০১২ ", sheet_no: "৩ক" })).toMatchObject({ jl_no: "012", sheet_no: "3ক" });
    expect(verifySchema.safeParse({ ...base, survey: "CS", jl_no: "12a" }).success).toBe(false);
    expect(verifySchema.safeParse({ ...base, survey: "CS", sheet_no: "x".repeat(21) }).success).toBe(false);
  });
});

describe("geo", () => {
  it("lists upazilas per district", () => {
    expect(upazilasOf("Gazipur").map((u) => u.value)).toContain("Sreepur");
    expect(upazilasOf("nope")).toEqual([]);
  });

  it("keeps each upazila under its own district (same as the map data)", () => {
    const of = (d: string) => upazilasOf(d).map((u) => u.value);
    expect(of("Meherpur")).toEqual(expect.arrayContaining(["Gangni", "Meherpur Sadar"]));
    expect(of("Chuadanga")).not.toContain("Gangni");
    expect(of("Noakhali")).toEqual(expect.arrayContaining(["Hatiya", "Kabirhat", "Senbagh", "Subarnachar"]));
    expect(of("Sylhet")).not.toContain("Kabirhat");
    expect(of("Natore")).toContain("Singra");
    expect(of("Sirajgonj")).not.toContain("Singra");
    expect(of("Lalmonirhat")).toContain("Lalmonirhat Sadar");
    expect(of("Kurigram")).not.toContain("Lalmonirhat Sadar");
  });
});

describe("PublicSummary survey fields", () => {
  it("shows Survey, JL and sheet, and an amber notice on SHEET_MISMATCH", async () => {
    const request = vi.fn().mockResolvedValue({ ...SUMMARY, survey_type: "RS", jl_no: "12", map_sheet_no: "7", warnings: ["SHEET_MISMATCH"] });
    wrap(visitor(request as any));
    fill();
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    const sum = await screen.findByTestId("public-summary");
    expect(sum).toHaveTextContent(en.result.survey);
    expect(sum).toHaveTextContent("JL no.");
    expect(sum).toHaveTextContent(en.result.sheetMismatch);
  });
});

describe("VerifyForm", () => {
  it("shows required errors and does not call the API", async () => {
    const get = vi.fn();
    wrap(client(get as any));
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    expect((await screen.findAllByText(en.verify.errors.required)).length).toBeGreaterThan(0);
    expect(get).not.toHaveBeenCalled();
    // U5.4: focus goes to the first wrong field on screen (district), not the first registered one (mouza)
    expect(screen.getByRole("combobox", { name: en.verify.district })).toHaveFocus();
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
    expect(url).toContain("survey=RS");
    expect(url).not.toContain("jl_no"); // optional: left out when empty
    expect(url).not.toContain("sheet_no");
  });

  it("does not search without a survey and shows surveyRequired", async () => {
    const get = vi.fn();
    wrap(client(get as any));
    fill();
    fireEvent.change(survey(), { target: { value: "" } });
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    expect(await screen.findByText(en.verify.errors.surveyRequired)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining("/lands/search"));
  });

  it("sends the sheet number from 'More details' (Bangla digits converted)", async () => {
    const get = vi.fn().mockResolvedValue({ land_id: "LP-10100" });
    wrap(client(get as any));
    fill();
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.sheetNo)), { target: { value: "৭" } });
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const url = get.mock.calls.map((c) => c[0] as string).find((u) => u.startsWith("/lands/search")) as string;
    expect(url).toContain("sheet_no=7");
  });

  it("LAND_AMBIGUOUS shows the chooser; picking one signed in opens that land_id", async () => {
    const cands = [
      { land_id: "LP-10001", survey_type: "CS", jl_no: "12", mouza: "Barmi" },
      { land_id: "LP-12001", survey_type: "RS", jl_no: "12", mouza: "Barmi" },
    ];
    const get = vi.fn().mockRejectedValue(new ApiError(409, "LAND_AMBIGUOUS", "x", { candidates: cands }));
    wrap(client(get as any));
    fill();
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    const chooser = await screen.findByTestId("ambiguous-chooser");
    expect(chooser).toHaveTextContent(en.verify.chooser.landIntro);
    const opts = within(chooser).getAllByTestId("chooser-option");
    expect(opts).toHaveLength(2);
    expect(opts[0]).toHaveTextContent(`${en.archive.surveys.CS} · JL 12 · Barmi`);
    expect(chooser).not.toHaveTextContent("R***");
    fireEvent.click(opts[1]);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify/result?land_id=LP-12001"));
  });

  it("LAND_AMBIGUOUS as a visitor: picking re-runs the public search with that survey and JL", async () => {
    const cands = [
      { land_id: "LP-10001", survey_type: "CS", jl_no: "12", mouza: "Barmi" },
      { land_id: "LP-12001", survey_type: "RS", jl_no: "12", mouza: "Barmi" },
    ];
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, "LAND_AMBIGUOUS", "x", { candidates: cands }))
      .mockResolvedValueOnce({ ...SUMMARY, survey_type: "CS", jl_no: "12" });
    wrap(visitor(request as any));
    fill();
    fireEvent.change(survey(), { target: { value: "" } });
    fireEvent.change(survey(), { target: { value: "RS" } });
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    const chooser = await screen.findByTestId("ambiguous-chooser");
    fireEvent.click(within(chooser).getAllByTestId("chooser-option")[0]);
    expect(await screen.findByTestId("public-summary")).toBeInTheDocument();
    const url = request.mock.calls[1][0] as string;
    expect(url).toContain("survey=CS");
    expect(url).toContain("jl_no=12");
    expect(screen.queryByTestId("ambiguous-chooser")).toBeNull();
  });

  it("MOUZA_AMBIGUOUS lists the JL options in the chooser", async () => {
    const options = [
      { jl_no: "4", mouza: "Ashulia" },
      { jl_no: "9", mouza: "Ashulia" },
    ];
    const get = vi.fn().mockRejectedValue(new ApiError(409, "MOUZA_AMBIGUOUS", "x", { options }));
    wrap(client(get as any));
    fill();
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    const chooser = await screen.findByTestId("ambiguous-chooser");
    expect(chooser).toHaveTextContent(en.verify.chooser.mouzaIntro);
    expect(within(chooser).getAllByTestId("chooser-option")[1]).toHaveTextContent("JL 9");
  });

  it("shows jlMismatch when the API says JL_MISMATCH", async () => {
    const get = vi.fn().mockRejectedValue(new ApiError(422, "JL_MISMATCH", "x"));
    wrap(client(get as any));
    fill();
    fireEvent.change(screen.getByLabelText(new RegExp(en.verify.jlNo)), { target: { value: "99" } });
    fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.verify.errors.jlMismatch);
  });

  it("fills itself from the hero's query and searches once (U1.3)", async () => {
    window.history.pushState({}, "", "/verify?district=Gazipur&upazila=Sreepur&mouza=Barmi&survey=RS&jl_no=12&sheet_no=7&khatian=1245&dag=785");
    const get = vi.fn().mockResolvedValue({ land_id: "LP-10100" });
    try {
      wrap(client(get as any));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/verify/result?land_id=LP-10100"));
      expect(screen.getByLabelText(new RegExp(en.verify.upazila))).toHaveValue("Sreepur");
      expect(screen.getByLabelText(new RegExp(en.verify.mouza))).toHaveValue("Barmi");
      expect(survey()).toHaveValue("RS");
      expect(screen.getByLabelText(new RegExp(en.verify.jlNo))).toHaveValue("12");
      expect(screen.getByLabelText(new RegExp(en.verify.sheetNo))).toHaveValue("7");
      const searches = get.mock.calls.map((c) => c[0] as string).filter((u) => u.startsWith("/lands/search"));
      expect(searches).toHaveLength(1);
      expect(searches[0]).toContain("survey=RS");
      expect(searches[0]).toContain("jl_no=12");
      expect(searches[0]).toContain("sheet_no=7");
    } finally {
      window.history.pushState({}, "", "/");
    }
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

  it("picking a mouza fills its JL read-only, with an edit link", async () => {
    const get = vi.fn(async (url: string) => {
      if (url.startsWith("/gis/search"))
        return { hits: [{ level: "upazila", id: "77", name: "Sreepur", bn_name: "", path: "Dhaka / Gazipur" }] };
      if (url.startsWith("/gis/mouzas"))
        return { enabled: true, mouzas: [{ id: "a", name: "Barmi", bn_name: "", jl_no: "012" }, { id: "c", name: "Mawna", bn_name: "", jl_no: "005" }] };
      return { land_id: "LP-1" };
    });
    wrap(client(get as any));
    fill();
    const input = screen.getByLabelText(new RegExp(en.verify.mouza)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.focus(input);
    fireEvent.mouseDown(within(await screen.findByRole("listbox")).getAllByRole("option")[0]);
    const jl = screen.getByLabelText(new RegExp(en.verify.jlNo)) as HTMLInputElement;
    expect(jl.value).toBe("012");
    expect(jl).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: en.verify.jlEdit }));
    expect(jl).not.toHaveAttribute("readonly");
    fireEvent.change(jl, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: en.verify.submit }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const url = get.mock.calls.map((c) => c[0] as string).find((u) => u.startsWith("/lands/search")) as string;
    expect(url).toContain("jl_no=5");
  });

  it("a mouza name shared by 2+ JLs forces the JL choice", async () => {
    const get = vi.fn(async (url: string) => {
      if (url.startsWith("/gis/search"))
        return { hits: [{ level: "upazila", id: "77", name: "Sreepur", bn_name: "", path: "Dhaka / Gazipur" }] };
      if (url.startsWith("/gis/mouzas"))
        return { enabled: true, mouzas: [{ id: "a", name: "Barmi", bn_name: "", jl_no: "012" }, { id: "b", name: "Barmi", bn_name: "", jl_no: "034" }] };
      return { land_id: "LP-1" };
    });
    wrap(client(get as any));
    fill(); // types "Barmi" by hand: no pick, still a clash
    // the plain JL input is swapped for a select once the mouza list has loaded
    await waitFor(() => expect(screen.getByLabelText(new RegExp(en.verify.jlNo)).tagName).toBe("SELECT"));
    const jl = screen.getByLabelText(new RegExp(en.verify.jlNo)) as HTMLSelectElement;
    expect(within(jl).getAllByRole("option").map((o) => o.textContent)).toEqual([en.verify.jlChoose, "JL 012", "JL 034"]);
    fireEvent.click(screen.getByRole("button", { name: en.verify.submit }));
    expect(await screen.findByText(en.verify.errors.jlNeeded)).toBeInTheDocument();
    expect(get.mock.calls.some((c) => String(c[0]).startsWith("/lands/search"))).toBe(false);
    fireEvent.change(jl, { target: { value: "034" } });
    fireEvent.click(screen.getByRole("button", { name: en.verify.submit }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const url = get.mock.calls.map((c) => c[0] as string).find((u) => u.startsWith("/lands/search")) as string;
    expect(url).toContain("jl_no=34");
  });

  it("mouza combobox works from the keyboard: arrows move, Enter picks, Escape closes", async () => {
    const get = vi.fn(async (url: string) => {
      if (url.startsWith("/gis/search"))
        return { hits: [{ level: "upazila", id: "77", name: "Sreepur", bn_name: "", path: "Dhaka / Gazipur" }] };
      if (url.startsWith("/gis/mouzas"))
        return { enabled: true, mouzas: [{ id: "a", name: "Barmi", bn_name: "", jl_no: "012" }, { id: "c", name: "Mawna", bn_name: "", jl_no: "005" }] };
      throw new ApiError(404, "LAND_NOT_FOUND", "x");
    });
    wrap(client(get as any));
    fill();
    const input = screen.getByLabelText(new RegExp(en.verify.mouza)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    await screen.findByRole("listbox");
    fireEvent.keyDown(input, { key: "Enter" }); // nothing highlighted: not swallowed
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("Barmi");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
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

  describe("visitor (U2.2)", () => {
    it("searches the public endpoint without a token and shows the masked summary", async () => {
      const request = vi.fn().mockResolvedValue(SUMMARY);
      const c = visitor(request as any);
      wrap(c);
      fill();
      fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
      const card = await screen.findByTestId("public-summary");
      const [url, opts] = request.mock.calls[0];
      expect(url).toContain("/public/lands/search?");
      expect(url).toContain("khatian=1245");
      expect(url).toContain("survey=RS");
      expect(opts).toEqual({ anonymous: true });
      expect((c.get as any).mock.calls.filter((a: any[]) => String(a[0]).startsWith("/lands/"))).toEqual([]);
      expect(push).not.toHaveBeenCalled();
      expect(within(card).getByText("LP-10240")).toBeInTheDocument();
      expect(within(screen.getByTestId("masked-owners")).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["R*** U***", "K*** M***"]);
      expect(within(card).getByText(en.risk.level.HIGH)).toBeInTheDocument();
      expect(card).toHaveTextContent(en.verify.summary.maskNote);
    });

    it("the sign-in button returns to the full result of that parcel", async () => {
      wrap(visitor(vi.fn().mockResolvedValue(SUMMARY) as any));
      fill();
      fireEvent.click(await screen.findByRole("button", { name: en.verify.submit }));
      const link = await screen.findByTestId("summary-login");
      expect(link).toHaveAttribute("href", `/login?next=${encodeURIComponent("/verify/result?land_id=LP-10240")}`);
      expect(link).toHaveTextContent(en.verify.summary.loginForFull);
    });

    it("answers the hero's query on its own once the visitor state is known", async () => {
      window.history.pushState({}, "", "/verify?district=Gazipur&upazila=Sreepur&mouza=Barmi&survey=RS&khatian=1250&dag=790");
      const request = vi.fn().mockResolvedValue(SUMMARY);
      try {
        wrap(visitor(request as any));
        expect(await screen.findByTestId("public-summary")).toBeInTheDocument();
        expect(request).toHaveBeenCalledTimes(1);
      } finally {
        window.history.pushState({}, "", "/");
      }
    });

    it("shows not found and rate-limit messages in Bangla", async () => {
      const request = vi.fn().mockRejectedValueOnce(new ApiError(404, "LAND_NOT_FOUND", "x")).mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "x"));
      wrap(visitor(request as any), bn, "bn");
      fill(bn);
      fireEvent.click(await screen.findByRole("button", { name: bn.verify.submit }));
      expect(await screen.findByRole("alert")).toHaveTextContent(bn.verify.errors.notFound);
      fireEvent.click(screen.getByRole("button", { name: bn.verify.submit }));
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(bn.verify.errors.rateLimited));
      expect(screen.queryByTestId("public-summary")).toBeNull();
    });
  });
});
