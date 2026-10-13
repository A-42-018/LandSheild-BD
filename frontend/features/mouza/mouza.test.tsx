import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { Table } from "@/components/ui";
import { navItemsFor } from "@/features/auth/roles";
import type { MouzaDto } from "@/features/map/gis/types";
import { fc, gf, route } from "@/features/map/test-utils";
import MouzaMapView from "./MouzaMapView";
import {
  copyNumbers,
  filterMouzas,
  scanFileName,
  foldText,
  groupBySurvey,
  matchesQuery,
  parseSort,
  sortMouzas,
  sortOption,
  surveysOf,
} from "./types";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/mouza-map",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const user = { id: "1", name: "C", email: "c@x.co", role: "CITIZEN", preferred_language: "en" };
const EMPTY = { type: "FeatureCollection", features: [] } as any;
const SCAN = "https://free.mouzamap.tech/3:/Bagerhat/x.pdf?a=view";

const mz = (id: string, name: string, jl: string, extra: Partial<MouzaDto> = {}): MouzaDto => ({
  id, code: id, name, bn_name: "", union_id: null, jl_no: jl, sheets: [], ...extra,
});

const ALIPUR = mz("m1", "Alipur", "001", {
  bn_name: "আলীপুর",
  union_id: "u1",
  sheets: [{ sheet_no: "001", survey: "RS", plots: 582 }, { sheet_no: "001", survey: "BS", url: `${SCAN}#alipur-bs` }],
});
const KRISHNAPUR = mz("m2", "Krishnapur", "012", {
  bn_name: "কৃষ্ণপুর",
  union_id: "u2",
  sheets: [{ sheet_no: "001", survey: "CS", url: `${SCAN}#krishna-cs` }],
});
const BAROI = mz("m3", "Baroi", "005", {
  union_id: "u2",
  sheets: ["001", "002", "003", "004", "005", "006"].map((n) => ({ sheet_no: n, survey: "RS", url: `${SCAN}#baroi-${n}` })),
});
const MOUZAS = [ALIPUR, BAROI, KRISHNAPUR];

const UNIONS = {
  enabled: true,
  upazila_id: "273",
  unions: [
    { id: "u1", name: "Badhal", bn_name: "বাধাল", mouza_count: 1 },
    { id: "u2", name: "Dhopakhali", bn_name: "ধোপাখালী", mouza_count: 2 },
  ],
};
const DATA = (mouzas: MouzaDto[] = MOUZAS, extra: Record<string, unknown> = {}) => ({
  "/gis/unions?upazila_id=273": UNIONS,
  "/gis/mouzas?upazila_id=273": { enabled: true, upazila_id: "273", mouzas },
  ...extra,
});

function wrap(get: ApiClient["get"], messages: any = en, locale = "en", blob: ApiClient["blob"] = vi.fn()) {
  const c = { refresh: vi.fn().mockResolvedValue({ user }), get, blob } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}>
          <MouzaMapView />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

async function pickKachua(m: typeof en = en) {
  fireEvent.change(await screen.findByLabelText(m.map.gis.division), { target: { value: "4" } });
  fireEvent.change(await screen.findByLabelText(m.map.gis.district), { target: { value: "55" } });
  const upa = await screen.findByLabelText(m.map.gis.upazila);
  await waitFor(() => expect(within(upa).getAllByRole("option")).toHaveLength(2));
  fireEvent.change(upa, { target: { value: "273" } });
}
/** Mouza names in table order (the name button of the second column; the cell also carries the phone-only union line). */
const names = () =>
  within(screen.getByTestId("mouza-table"))
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(within(r).getAllByRole("cell")[1]).getByRole("button").textContent);

describe("mouza helpers", () => {
  it("folds case, Unicode form and Bangla digits", () => {
    expect(foldText("  AliPUR  Bazar ")).toBe("alipur bazar");
    expect(foldText("১২")).toBe("12");
  });
  it("matches English or Bangla names, and JL no. exactly (leading zeros and Bangla digits ignored)", () => {
    expect(matchesQuery(ALIPUR, "ali")).toBe(true);
    expect(matchesQuery(ALIPUR, "আলী")).toBe(true);
    expect(matchesQuery(KRISHNAPUR, "12")).toBe(true);
    expect(matchesQuery(KRISHNAPUR, "০১২")).toBe(true);
    expect(matchesQuery(KRISHNAPUR, "1")).toBe(false);
    expect(matchesQuery(ALIPUR, "")).toBe(true);
  });
  it("filters by survey and by scanned map", () => {
    expect(filterMouzas(MOUZAS, { q: "", survey: "RS", scannedOnly: false }).map((m) => m.id)).toEqual(["m1", "m3"]);
    expect(filterMouzas(MOUZAS, { q: "", survey: "RS", scannedOnly: true }).map((m) => m.id)).toEqual(["m3"]);
    expect(filterMouzas([mz("x", "X", "9")], { q: "", survey: "", scannedOnly: true })).toEqual([]);
  });
  it("sorts by JL no., name and sheet count, both ways; JL no. breaks ties", () => {
    const odd = mz("z", "Zed", "abc");
    const ids = (s: string) => sortMouzas([...MOUZAS, odd], parseSort(s), "en").map((m) => m.id);
    expect(ids("jl-asc")).toEqual(["m1", "m3", "m2", "z"]); // non-numeric JL last
    expect(ids("jl-desc")).toEqual(["z", "m2", "m3", "m1"]);
    expect(ids("name-asc")).toEqual(["m1", "m3", "m2", "z"]);
    expect(ids("name-desc")).toEqual(["z", "m2", "m3", "m1"]);
    expect(ids("sheets-desc")).toEqual(["m3", "m1", "m2", "z"]);
    expect(sortMouzas(MOUZAS, parseSort("sheets-desc"), "en", "CS").map((m) => m.id)[0]).toBe("m2");
    expect(sortOption(parseSort("name-desc"))).toBe("name-desc");
  });
  it("lists surveys in historical order with mouza counts; groups sheets by survey", () => {
    expect(surveysOf(MOUZAS)).toEqual([
      { survey: "CS", mouzas: 1 },
      { survey: "RS", mouzas: 2 },
      { survey: "BS", mouzas: 1 },
    ]);
    const g = groupBySurvey([{ sheet_no: "10", survey: "RS" }, { sheet_no: "2", survey: "RS" }, { sheet_no: "1", survey: "CS" }]);
    expect(g.map((x) => [x.survey, x.sheets.map((s) => s.sheet_no)])).toEqual([["CS", ["1"]], ["RS", ["2", "10"]]]);
  });
});

describe("two scans of one sheet number", () => {
  const twin = mz("t1", "Goneshpura", "026", {
    bn_name: "গনেশপুরা",
    union_id: "u1",
    sheets: [
      { sheet_no: "001", survey: "CS", url: `${SCAN}#cs-1a` },
      { sheet_no: "001", survey: "CS", url: `${SCAN}#cs-1b` },
      { sheet_no: "002", survey: "CS", url: `${SCAN}#cs-2` },
    ],
  });
  it("numbers the copies and puts the number in the file name", () => {
    expect(copyNumbers(twin.sheets)).toEqual([1, 2, 1]);
    expect(copyNumbers([{ sheet_no: "001", survey: "RS" }, { sheet_no: "001", survey: "BS" }])).toEqual([1, 1]);
    expect(scanFileName(twin, twin.sheets[0], 1)).toBe("Goneshpura (গনেশপুরা) JL 026 CS 001.pdf");
    expect(scanFileName(twin, twin.sheets[1], 2)).toBe("Goneshpura (গনেশপুরা) JL 026 CS 001 (2).pdf");
    expect(scanFileName(mz("x", 'A/B:C*"D', "7"), { sheet_no: "1" }, 1)).toBe("ABCD JL 7 1.pdf");
  });
  it("the list and the dialog tell the two scans apart, and each downloads its own file", async () => {
    const blob = vi.fn().mockResolvedValue(new Blob(["%PDF"]));
    wrap(route(EMPTY, DATA([twin])), en, "en", blob);
    await pickKachua();
    const row = within(await screen.findByRole("row", { name: /Goneshpura/ }));
    expect(row.getAllByRole("button", { name: /Download the CS 001/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Download the CS 001 map of Goneshpura (গনেশপুরা) (PDF)",
      "Download the CS 001 (2) map of Goneshpura (গনেশপুরা) (PDF)",
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "Goneshpura (গনেশপুরা)" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("button", { name: /CS 001 \(2\) map/ })).toHaveTextContent("Sheet 001 (2) · Download PDF");
    expect(dialog.getByRole("button", { name: /CS 001 map of/ })).toHaveTextContent("Sheet 001 · Download PDF");
    fireEvent.click(dialog.getByRole("button", { name: /CS 001 \(2\) map/ }));
    await waitFor(() => expect(blob).toHaveBeenCalledWith(`/gis/scan?url=${encodeURIComponent(`${SCAN}#cs-1b`)}`));
  });
});

describe("MouzaMapView", () => {
  it("is in the nav for every signed-in role, not for anonymous", () => {
    const has = (r: any) => navItemsFor(r).some((i) => i.href === "/mouza-map" && i.primary);
    expect(has(null)).toBe(false);
    for (const r of ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"]) expect(has(r)).toBe(true);
  });

  it("asks for an upazila first and says which divisions have mouza lists", async () => {
    wrap(route(EMPTY, DATA()));
    expect(await screen.findByRole("heading", { level: 1, name: en.mouza.title })).toBeInTheDocument();
    expect(screen.getByText(en.mouza.pickUpazila)).toBeInTheDocument();
    expect(await screen.findByText(en.mouza.coverage.replace("{divisions}", "Khulna"))).toBeInTheDocument();
    expect(screen.getByLabelText(en.mouza.union)).toBeDisabled();
  });

  it("lists the upazila's mouzas in JL order with union names and scanned-map links", async () => {
    wrap(route(EMPTY, DATA()));
    await pickKachua();
    expect(await screen.findByTestId("mouza-table")).toBeInTheDocument();
    expect(names()).toEqual(["Alipur (আলীপুর)", "Baroi", "Krishnapur (কৃষ্ণপুর)"]);
    expect(screen.getByRole("status")).toHaveTextContent("3 mouzas of 3 · 8 scanned sheets");
    const row = screen.getByRole("row", { name: /Alipur/ });
    // once in the Union column and once under the name for phones (CSS shows one of them; jsdom has no CSS)
    expect(within(row).getAllByText("Badhal (বাধাল)")).toHaveLength(2);
    expect(within(row).getByText(/RS 001/)).toHaveAttribute("title", en.mouza.officialSheet);
    // a scanned sheet is a download button, not a link to another site
    expect(within(row).queryByRole("link")).toBeNull();
    expect(within(row).getByRole("button", { name: "Download the BS 001 map of Alipur (আলীপুর) (PDF)" })).toBeInTheDocument();
  });

  it("the union dropdown narrows the list", async () => {
    wrap(route(EMPTY, DATA()));
    await pickKachua();
    const un = screen.getByLabelText(en.mouza.union);
    await waitFor(() => expect(un).not.toBeDisabled());
    expect(within(un).getByRole("option", { name: "Dhopakhali (ধোপাখালী) · 2 mouzas" })).toBeInTheDocument();
    fireEvent.change(un, { target: { value: "u2" } });
    await waitFor(() => expect(names()).toEqual(["Baroi", "Krishnapur (কৃষ্ণপুর)"]));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Mouzas in Dhopakhali (ধোপাখালী), Kachua (কচুয়া), Bagerhat (বাগেরহাট)");
  });

  it("sort dropdown and column headers sort the same list", async () => {
    wrap(route(EMPTY, DATA()));
    await pickKachua();
    await screen.findByTestId("mouza-table");
    const sort = screen.getByLabelText(en.mouza.sort);
    fireEvent.change(sort, { target: { value: "name-desc" } });
    expect(names()).toEqual(["Krishnapur (কৃষ্ণপুর)", "Baroi", "Alipur (আলীপুর)"]);
    fireEvent.change(sort, { target: { value: "sheets-desc" } });
    expect(names()[0]).toBe("Baroi");
    fireEvent.click(screen.getByRole("button", { name: en.mouza.cols.jl }));
    expect(sort).toHaveValue("jl-asc");
    fireEvent.click(screen.getByRole("button", { name: en.mouza.cols.jl }));
    expect(sort).toHaveValue("jl-desc");
    expect(names()).toEqual(["Krishnapur (কৃষ্ণপুর)", "Baroi", "Alipur (আলীপুর)"]);
  });

  it("survey filter, name/JL filter and scanned-only toggle", async () => {
    wrap(route(EMPTY, DATA()));
    await pickKachua();
    await screen.findByTestId("mouza-table");
    const survey = screen.getByLabelText(en.mouza.survey);
    expect(within(survey).getAllByRole("option").map((o) => o.textContent)).toEqual([
      en.mouza.allSurveys, "CS · 1 mouza", "RS · 2 mouzas", "BS · 1 mouza",
    ]);
    fireEvent.change(survey, { target: { value: "CS" } });
    expect(names()).toEqual(["Krishnapur (কৃষ্ণপুর)"]);
    fireEvent.change(survey, { target: { value: "RS" } });
    expect(names()).toEqual(["Alipur (আলীপুর)", "Baroi"]);
    // only the chosen survey's sheets are shown
    expect(within(screen.getByRole("row", { name: /Alipur/ })).queryByRole("button", { name: /Download/ })).toBeNull();
    fireEvent.click(screen.getByLabelText(en.mouza.scannedOnly));
    expect(names()).toEqual(["Baroi"]);
    fireEvent.change(survey, { target: { value: "" } });
    fireEvent.click(screen.getByLabelText(en.mouza.scannedOnly));
    fireEvent.change(screen.getByLabelText(en.mouza.filterLabel), { target: { value: "১২" } });
    expect(names()).toEqual(["Krishnapur (কৃষ্ণপুর)"]);
    fireEvent.change(screen.getByLabelText(en.mouza.filterLabel), { target: { value: "zzz" } });
    expect(screen.getByText(en.mouza.noMatch)).toBeInTheDocument();
  });

  it("long sheet lists end with '+N more'; the details dialog lists every sheet with View PDF links", async () => {
    wrap(route(EMPTY, DATA()));
    await pickKachua();
    const row = await screen.findByRole("row", { name: /Baroi/ });
    expect(within(row).getAllByRole("button", { name: /Download/ })).toHaveLength(3);
    fireEvent.click(within(row).getByRole("button", { name: "+3 more" }));
    const dialog = await screen.findByRole("dialog", { name: "Baroi" });
    expect(within(dialog).getAllByRole("button", { name: /Download the .* map of Baroi/ })).toHaveLength(6);
    expect(within(dialog).getByRole("button", { name: /RS 006 map of Baroi/ })).toHaveTextContent("Sheet 006 · Download PDF");
    expect(within(dialog).getByText("Dhopakhali (ধোপাখালী)")).toBeInTheDocument();
    expect(within(dialog).getByText(en.mouza.scanNote)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking a mouza name opens its details; official sheets show without a link", async () => {
    const caps = { mouza_enabled: true, mouza_enabled_division_id: "4", mouza_enabled_division_name: "Khulna", counts: {}, mouza_count: 3, mouza_source_url: "https://map.land.gov.bd" };
    wrap(route(EMPTY, DATA(MOUZAS, { "/gis/capabilities": caps })));
    await pickKachua();
    fireEvent.click(await screen.findByRole("button", { name: "Alipur (আলীপুর)" }));
    const dialog = await screen.findByRole("dialog", { name: "Alipur (আলীপুর)" });
    expect(within(dialog).getByText("RS 001 · 582 plots")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /Download the .* map of Alipur/ })).toHaveLength(1);
    expect(within(dialog).getByRole("link", { name: "map.land.gov.bd" })).toHaveAttribute("href", "https://map.land.gov.bd");
  });

  describe("downloading a scan", () => {
    const saved: { href: string; download: string }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ href: this.href, download: this.download });
    });
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:scan"), revokeObjectURL: vi.fn() });
    beforeEach(() => {
      saved.length = 0;
      click.mockClear();
    });
    const alipurRow = async () => {
      await pickKachua();
      return within(await screen.findByRole("row", { name: /Alipur/ }));
    };
    const BTN = { name: "Download the BS 001 map of Alipur (আলীপুর) (PDF)" };

    it("clicking Download fetches the PDF through our API and saves it, without leaving the page", async () => {
      const blob = vi.fn().mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
      wrap(route(EMPTY, DATA()), en, "en", blob);
      const row = await alipurRow();
      fireEvent.click(row.getByRole("button", BTN));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(blob).toHaveBeenCalledWith(`/gis/scan?url=${encodeURIComponent(`${SCAN}#alipur-bs`)}`);
      expect(saved[0]).toEqual({ href: "blob:scan", download: "Alipur (আলীপুর) JL 001 BS 001.pdf" });
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("is disabled and announced while downloading, and usable again afterwards", async () => {
      let done!: (b: Blob) => void;
      const blob = vi.fn(() => new Promise<Blob>((r) => (done = r)));
      wrap(route(EMPTY, DATA()), en, "en", blob);
      const row = await alipurRow();
      fireEvent.click(row.getByRole("button", BTN));
      const btn = await row.findByRole("button", BTN);
      await waitFor(() => expect(btn).toBeDisabled());
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(row.getByRole("status")).toHaveTextContent(en.mouza.downloading);
      fireEvent.click(btn); // a second click while busy does nothing
      expect(blob).toHaveBeenCalledTimes(1);
      done(new Blob(["%PDF"]));
      await waitFor(() => expect(btn).not.toBeDisabled());
      expect(saved).toHaveLength(1);
    });

    it.each([
      [new ApiError(500, "SCAN_UNAVAILABLE", "x"), en.mouza.downloadFailed],
      [new ApiError(429, "RATE_LIMITED", "x"), en.mouza.downloadLimit],
      [new ApiError(404, "SCAN_NOT_FOUND", "x"), en.mouza.downloadMissing],
      [new TypeError("network"), en.mouza.downloadFailed],
    ])("a failed download says why and can be retried (%#)", async (error, text) => {
      const blob = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(new Blob(["%PDF"]));
      wrap(route(EMPTY, DATA()), en, "en", blob);
      const row = await alipurRow();
      fireEvent.click(row.getByRole("button", BTN));
      expect(await row.findByRole("alert")).toHaveTextContent(text);
      expect(saved).toHaveLength(0);
      fireEvent.click(row.getByRole("button", BTN));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(row.queryByRole("alert")).toBeNull();
    });

    it("works from the details dialog too", async () => {
      const blob = vi.fn().mockResolvedValue(new Blob(["%PDF"]));
      wrap(route(EMPTY, DATA()), en, "en", blob);
      await pickKachua();
      fireEvent.click(await screen.findByRole("button", { name: "Alipur (আলীপুর)" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: /BS 001 map of Alipur/ }));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(blob).toHaveBeenCalledWith(expect.stringContaining("/gis/scan?url="));
    });
  });

  it("fits a phone: the table may shrink, and the union moves under the mouza name", async () => {
    wrap(route(EMPTY, DATA()));
    await pickKachua();
    const table = await within(await screen.findByTestId("mouza-table")).findByRole("table");
    expect(table).not.toHaveClass("min-w-[32rem]");
    const union = screen.getByRole("columnheader", { name: en.mouza.cols.union });
    expect(union).toHaveClass("hidden", "sm:table-cell");
    const row = screen.getByRole("row", { name: /Alipur/ });
    expect(row.querySelector("p.sm\\:hidden")).toHaveTextContent("Badhal (বাধাল)");
  });

  it("other tables keep their 32rem minimum width unless they opt in", () => {
    const cols = [{ key: "a", header: "A" }];
    const { container, rerender } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Table columns={cols} rows={[{ a: "1" }]} rowKey={(r) => r.a} />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector("table")).toHaveClass("min-w-[32rem]");
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <Table compact columns={cols} rows={[{ a: "1" }]} rowKey={(r) => r.a} />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector("table")).not.toHaveClass("min-w-[32rem]");
  });

  it("pages through long lists, 25 at a time", async () => {
    const many = Array.from({ length: 30 }, (_, i) => mz(`p${i}`, `Mouza ${i + 1}`, String(i + 1).padStart(3, "0")));
    wrap(route(EMPTY, DATA(many, { "/gis/unions?upazila_id=273": { ...UNIONS, unions: [] } })));
    await pickKachua();
    await screen.findByTestId("mouza-table");
    expect(names()).toHaveLength(25);
    fireEvent.click(screen.getByRole("button", { name: en.table.next }));
    expect(names()).toEqual(["Mouza 26", "Mouza 27", "Mouza 28", "Mouza 29", "Mouza 30"]);
    expect(screen.getByText(en.mouza.noUnion)).toBeInTheDocument();
  });

  it("a mouza search hit selects its upazila and union and opens the mouza", async () => {
    const hit = { level: "mouza", id: "m2", name: "Krishnapur", bn_name: "কৃষ্ণপুর", path: "Bagerhat / Kachua / Dhopakhali", bbox: null,
      division_id: "4", district_id: "55", upazila_id: "273", union_id: "u2", jl_no: "012" };
    wrap(route(EMPTY, DATA(MOUZAS, { "/gis/search?q=krishna": { hits: [hit], out_of_scope_hint: false } })));
    fireEvent.change(await screen.findByLabelText(en.map.gis.searchLabel), { target: { value: "krishna" } });
    fireEvent.click(screen.getByRole("button", { name: en.map.gis.searchButton }));
    fireEvent.click(await screen.findByRole("button", { name: /Krishnapur \(কৃষ্ণপুর\).*JL 012/ }));
    expect(await screen.findByRole("dialog", { name: "Krishnapur (কৃষ্ণপুর)" })).toBeInTheDocument();
    expect(screen.getByLabelText(en.map.gis.upazila)).toHaveValue("273");
    await waitFor(() => expect(screen.getByLabelText(en.mouza.union)).toHaveValue("u2"));
  });

  it("explains an upazila outside the mouza divisions and an upazila with no list", async () => {
    const { unmount } = wrap(route(EMPTY, { "/gis/mouzas?upazila_id=273": { enabled: false, upazila_id: "273", mouzas: [] } }));
    await pickKachua();
    expect(await screen.findByText(en.mouza.outOfScope)).toBeInTheDocument();
    unmount();
    wrap(route(EMPTY, DATA([])));
    await pickKachua();
    expect(await screen.findByText(en.mouza.none)).toBeInTheDocument();
  });

  it("mouza list failure shows a retry", async () => {
    let fail = true;
    const ok = route(EMPTY, DATA());
    const get = vi.fn((p: string) => (p.startsWith("/gis/mouzas") && fail ? Promise.reject(new ApiError(500, "X", "x")) : ok(p)));
    wrap(get as any);
    await pickKachua();
    expect(await screen.findByText(en.mouza.loadError)).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByTestId("mouza-table")).toBeInTheDocument();
  });

  it("renders in Bangla", async () => {
    wrap(route(EMPTY, { ...DATA(), "/gis/divisions": fc(gf("4", "Khulna", "খুলনা")) }), bn, "bn");
    expect(await screen.findByRole("heading", { level: 1, name: bn.mouza.title })).toBeInTheDocument();
    await pickKachua(bn as typeof en);
    await screen.findByTestId("mouza-table");
    expect(screen.getByLabelText(bn.mouza.sort)).toHaveValue("jl-asc");
    expect(screen.getByRole("columnheader", { name: bn.mouza.cols.sheets })).toBeInTheDocument();
    expect(screen.getByText(bn.mouza.scanNote)).toBeInTheDocument();
  });
});
