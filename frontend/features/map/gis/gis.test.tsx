import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import MapView from "../MapView";
import { formatCoords, formatZoom } from "./coords";
import {
  BD_BOUNDS,
  bboxToBounds,
  DEFAULT_TILE_URL,
  EMPTY_SELECTION,
  gisLabel,
  mouzasInUnion,
  resolveTileUrl,
  select,
  sheetRef,
  viewLevel,
} from "./types";
import { route } from "../test-utils";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/map",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));
vi.mock("../MapCanvas", () => ({
  default: (p: any) => (
    <div
      data-testid="map-canvas"
      data-admin-level={p.admin?.level ?? ""}
      data-admin-count={p.admin?.features.length ?? -1}
      data-fit-key={p.fitKey}
      data-fit-parcels={String(p.fitParcels)}
      data-tiles={p.tileUrl ?? ""}
    />
  ),
}));

const user = { id: "1", name: "C", email: "c@x.co", role: "CITIZEN", preferred_language: "en" };
const EMPTY = { type: "FeatureCollection", features: [] } as any;

function wrap(get: ApiClient["get"], messages: any = en, locale = "en") {
  const c = { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}>
          <MapView />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
const canvas = () => screen.getByTestId("map-canvas");

describe("gis helpers", () => {
  it("formats coordinates like the reference portal", () => {
    expect(formatCoords(24.128, 91.334)).toBe("24° 07′ 41″ N 91° 20′ 02″ E");
    expect(formatCoords(-1.5, -2.25)).toBe("1° 30′ 00″ S 2° 15′ 00″ W");
    expect(formatCoords(23.99999, 90)).toMatch(/^24° 00′ 00″ N/);
    expect(formatZoom(6.9444)).toBe("6.94");
  });
  it("labels, bounds and level logic", () => {
    expect(gisLabel({ name: "Khulna", bn_name: "খুলনা" })).toBe("Khulna (খুলনা)");
    expect(gisLabel({ name: "Adabor", bn_name: "" })).toBe("Adabor");
    expect(bboxToBounds([89, 22, 90, 23])).toEqual([[22, 89], [23, 90]]);
    expect(BD_BOUNDS[0][0]).toBeLessThan(21);
    expect(viewLevel(EMPTY_SELECTION)).toBe("division");
    expect(viewLevel({ ...EMPTY_SELECTION, divisionId: "4" })).toBe("district");
    expect(viewLevel({ ...EMPTY_SELECTION, divisionId: "4", districtId: "55" })).toBe("upazila");
  });
  it("selecting a level clears everything below it", () => {
    const full = { divisionId: "4", districtId: "55", upazilaId: "273", unionId: "u1", mouzaId: "m" };
    expect(select(full, "districtId", "9")).toEqual({ divisionId: "4", districtId: "9", upazilaId: "", unionId: "", mouzaId: "" });
    expect(select(full, "divisionId", "3")).toEqual({ divisionId: "3", districtId: "", upazilaId: "", unionId: "", mouzaId: "" });
    expect(select(full, "upazilaId", "1")).toMatchObject({ unionId: "", mouzaId: "" });
    expect(select(full, "unionId", "u2")).toEqual({ ...full, unionId: "u2", mouzaId: "" });
  });
  it("narrows mouzas by union and prints sheet references", () => {
    const ms = [
      { id: "a", code: "a", name: "A", bn_name: "", jl_no: "001", union_id: "u1", sheets: [] },
      { id: "b", code: "b", name: "B", bn_name: "", jl_no: "002", union_id: "u2", sheets: [] },
    ];
    expect(mouzasInUnion(ms, "").map((m) => m.id)).toEqual(["a", "b"]);
    expect(mouzasInUnion(ms, "u2").map((m) => m.id)).toEqual(["b"]);
    expect(sheetRef({ sheet_no: "001", survey: "RS" })).toBe("RS 001");
    expect(sheetRef({ sheet_no: "002" })).toBe("002");
  });
  it("tile url: OSM by default, 'off' disables, custom wins", () => {
    expect(resolveTileUrl(undefined)).toBe(DEFAULT_TILE_URL);
    expect(resolveTileUrl("off")).toBeUndefined();
    expect(resolveTileUrl("")).toBeUndefined();
    expect(resolveTileUrl("https://t.example/{z}/{x}/{y}.png")).toBe("https://t.example/{z}/{x}/{y}.png");
  });
});

describe("national map", () => {
  it("starts on Bangladesh: divisions only, no parcel zoom, street tiles on", async () => {
    wrap(route(EMPTY));
    await waitFor(() => expect(canvas()).toHaveAttribute("data-admin-count", "2"));
    expect(canvas()).toHaveAttribute("data-admin-level", "division");
    expect(canvas()).toHaveAttribute("data-fit-parcels", "false");
    expect(canvas()).toHaveAttribute("data-tiles", DEFAULT_TILE_URL);
  });

  it("drills Division → District → Upazila and lists names as 'English (বাংলা)'", async () => {
    const get = route(EMPTY);
    wrap(get);
    const div = await screen.findByLabelText(en.map.gis.division);
    await waitFor(() => expect(within(div).getAllByRole("option")).toHaveLength(3));
    expect(screen.getByRole("option", { name: "Khulna (খুলনা)" })).toBeInTheDocument();
    expect(screen.getByLabelText(en.map.gis.district)).toBeDisabled();

    fireEvent.change(div, { target: { value: "4" } });
    expect(get).toHaveBeenCalledWith("/gis/districts?division_id=4");
    await waitFor(() => expect(canvas()).toHaveAttribute("data-admin-level", "district"));
    fireEvent.change(await screen.findByLabelText(en.map.gis.district), { target: { value: "55" } });
    await waitFor(() => expect(canvas()).toHaveAttribute("data-admin-level", "upazila"));
    expect(get).toHaveBeenCalledWith("/gis/upazilas?district_id=55");
    const upa = screen.getByLabelText(en.map.gis.upazila);
    await waitFor(() => expect(within(upa).getAllByRole("option")).toHaveLength(2));
    const before = canvas().getAttribute("data-fit-key");
    fireEvent.change(upa, { target: { value: "273" } });
    await waitFor(() => expect(canvas().getAttribute("data-fit-key")).not.toBe(before));
    expect(get).toHaveBeenCalledWith("/gis/mouzas?upazila_id=273");
  });

  it("changing the division resets the lower levels; reset returns to Bangladesh", async () => {
    wrap(route(EMPTY));
    fireEvent.change(await screen.findByLabelText(en.map.gis.division), { target: { value: "4" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.district), { target: { value: "55" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.division), { target: { value: "3" } });
    expect(screen.getByLabelText(en.map.gis.district)).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: en.map.gis.reset }));
    expect(screen.getByLabelText(en.map.gis.division)).toHaveValue("");
    await waitFor(() => expect(canvas()).toHaveAttribute("data-admin-level", "division"));
  });

  it("mouza/sheet/plot are present but disabled with an honest note when no mouza maps are loaded", async () => {
    wrap(route(EMPTY));
    fireEvent.change(await screen.findByLabelText(en.map.gis.division), { target: { value: "4" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.district), { target: { value: "55" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.upazila), { target: { value: "273" } });
    expect(await screen.findByText(en.map.gis.mouzaNone)).toBeInTheDocument();
    expect(screen.getByLabelText(en.map.gis.union)).toBeDisabled();
    expect(screen.getByLabelText(en.map.gis.mouza)).toBeDisabled();
    expect(screen.getByLabelText(en.map.gis.sheet)).toBeDisabled();
    expect(screen.getByLabelText(en.map.gis.plot)).toBeDisabled();
  });

  it("outside the demo division the mouza select explains the scope", async () => {
    wrap(
      route(EMPTY, {
        "/gis/districts?division_id=3": { type: "FeatureCollection", features: [GIS_D()] },
        "/gis/upazilas?district_id=1": { type: "FeatureCollection", features: [GIS_U()] },
        "/gis/mouzas?upazila_id=9": { enabled: false, upazila_id: "9", mouzas: [] },
      }),
    );
    fireEvent.change(await screen.findByLabelText(en.map.gis.division), { target: { value: "3" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.district), { target: { value: "1" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.upazila), { target: { value: "9" } });
    expect(
      await screen.findByText(en.map.gis.mouzaOutOfScope.replace("{division}", "Khulna")),
    ).toBeInTheDocument();
  });

  const UNION_DATA = {
    "/gis/unions?upazila_id=273": {
      enabled: true,
      upazila_id: "273",
      unions: [
        { id: "40013815", name: "Badhal", bn_name: "বাধাল", mouza_count: 1 },
        { id: "40013828", name: "Dhopakhali", bn_name: "ধোপাখালী", mouza_count: 1 },
      ],
    },
    "/gis/mouzas?upazila_id=273": {
      enabled: true,
      upazila_id: "273",
      mouzas: [
        { id: "m2", code: "c2", name: "Krishnapur", bn_name: "কৃষ্ণপুর", union_id: "40013815", jl_no: "002",
          sheets: [{ sheet_no: "001", survey: "RS", plots: 40 }, { sheet_no: "002", survey: "RS", plots: 12 }] },
        { id: "m4", code: "c4", name: "Dhopakhali", bn_name: "ধোপাখালী", union_id: "40013828", jl_no: "004", sheets: [] },
      ],
    },
  };

  it("lists union-wise mouzas with JL no. and survey sheet references", async () => {
    wrap(route(EMPTY, UNION_DATA));
    fireEvent.change(await screen.findByLabelText(en.map.gis.division), { target: { value: "4" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.district), { target: { value: "55" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.upazila), { target: { value: "273" } });
    const un = screen.getByLabelText(en.map.gis.union);
    await waitFor(() => expect(un).not.toBeDisabled());
    expect(screen.getByRole("option", { name: "Badhal (বাধাল) · 1 mouza" })).toBeInTheDocument();
    const mz = screen.getByLabelText(en.map.gis.mouza);
    await waitFor(() => expect(within(mz).getAllByRole("option")).toHaveLength(3)); // placeholder + whole upazila
    expect(await screen.findByText(en.map.gis.mouzaPickUnion)).toBeInTheDocument();

    fireEvent.change(un, { target: { value: "40013815" } });
    await waitFor(() => expect(within(mz).getAllByRole("option")).toHaveLength(2));
    expect(screen.getByRole("option", { name: "JL 002 · Krishnapur (কৃষ্ণপুর)" })).toBeInTheDocument();

    fireEvent.change(mz, { target: { value: "m2" } });
    const info = await screen.findByTestId("mouza-info");
    expect(info).toHaveTextContent("002");
    expect(info).toHaveTextContent("Badhal (বাধাল)");
    expect(info).toHaveTextContent("RS 001, RS 002");
    const sheet = screen.getByLabelText(en.map.gis.sheet);
    expect(sheet).not.toBeDisabled();
    expect(within(sheet).getByRole("option", { name: "RS 001 · 40 plots" })).toBeInTheDocument();
  });

  it("mouzas the source gives no union for are listed under the upazila with a note", async () => {
    wrap(
      route(EMPTY, {
        "/gis/mouzas?upazila_id=273": {
          enabled: true,
          upazila_id: "273",
          mouzas: [{ id: "d1", code: "020601015", name: "চক তেলিগাতী", bn_name: "চক তেলিগাতী", union_id: null, jl_no: "015",
            source_url: "https://settlement.gov.bd", sheets: [{ sheet_no: "001", survey: "BRS", plots: 0 }] }],
        },
      }),
    );
    fireEvent.change(await screen.findByLabelText(en.map.gis.division), { target: { value: "4" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.district), { target: { value: "55" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.upazila), { target: { value: "273" } });
    expect(screen.getByLabelText(en.map.gis.union)).toBeDisabled();
    expect(await screen.findByText(en.map.gis.mouzaNoUnion)).toBeInTheDocument();
    const mz = screen.getByLabelText(en.map.gis.mouza);
    await waitFor(() => expect(mz).not.toBeDisabled());
    fireEvent.change(mz, { target: { value: "d1" } });
    const info = await screen.findByTestId("mouza-info");
    expect(info).toHaveTextContent(en.map.gis.unionUnknown);
    expect(info).toHaveTextContent("BRS 001");
    expect(within(info).getByRole("link")).toHaveAttribute("href", "https://settlement.gov.bd");
  });

  it("picking a mouza without a union fills in its union", async () => {
    wrap(route(EMPTY, UNION_DATA));
    fireEvent.change(await screen.findByLabelText(en.map.gis.division), { target: { value: "4" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.district), { target: { value: "55" } });
    fireEvent.change(await screen.findByLabelText(en.map.gis.upazila), { target: { value: "273" } });
    const mz = screen.getByLabelText(en.map.gis.mouza);
    await waitFor(() => expect(mz).not.toBeDisabled());
    fireEvent.change(mz, { target: { value: "m4" } });
    await waitFor(() => expect(screen.getByLabelText(en.map.gis.union)).toHaveValue("40013828"));
    expect(screen.getByLabelText(en.map.gis.mouza)).toHaveValue("m4");
  });

  it("a mouza search hit selects its upazila, union and mouza", async () => {
    const hit = { level: "mouza", id: "m2", name: "Krishnapur", bn_name: "কৃষ্ণপুর", path: "Bagerhat / Kachua / Badhal", bbox: null,
      division_id: "4", district_id: "55", upazila_id: "273", union_id: "40013815", jl_no: "002" };
    wrap(route(EMPTY, { ...UNION_DATA, "/gis/search?q=krishna": { hits: [hit], out_of_scope_hint: false } }));
    fireEvent.change(await screen.findByLabelText(en.map.gis.searchLabel), { target: { value: "krishna" } });
    fireEvent.click(screen.getByRole("button", { name: en.map.gis.searchButton }));
    fireEvent.click(await screen.findByRole("button", { name: /Krishnapur \(কৃষ্ণপুর\)/ }));
    await waitFor(() => expect(screen.getByLabelText(en.map.gis.mouza)).toHaveValue("m2"));
    expect(screen.getByLabelText(en.map.gis.upazila)).toHaveValue("273");
    expect(screen.getByLabelText(en.map.gis.union)).toHaveValue("40013815");
    expect(await screen.findByTestId("mouza-info")).toHaveTextContent("RS 001");
  });

  it("search finds a place in English or Bangla and jumps to it", async () => {
    const hit = { level: "upazila", id: "273", name: "Kachua", bn_name: "কচুয়া", path: "Khulna / Bagerhat", bbox: [89, 22, 90, 23], division_id: "4", district_id: "55" };
    const get = route(EMPTY, {
      [`/gis/search?q=${encodeURIComponent("কচুয়া")}`]: { hits: [hit], out_of_scope_hint: true },
    });
    wrap(get);
    fireEvent.change(await screen.findByLabelText(en.map.gis.searchLabel), { target: { value: "কচুয়া" } });
    fireEvent.click(screen.getByRole("button", { name: en.map.gis.searchButton }));
    fireEvent.click(await screen.findByRole("button", { name: /Kachua \(কচুয়া\)/ }));
    await waitFor(() => expect(screen.getByLabelText(en.map.gis.upazila)).toHaveValue("273"));
    expect(screen.getByLabelText(en.map.gis.division)).toHaveValue("4");
    expect(screen.getByLabelText(en.map.gis.district)).toHaveValue("55");
  });

  it("search with no result says mouza search is demo-scope only", async () => {
    wrap(route(EMPTY, { "/gis/search?q=zzzz": { hits: [], out_of_scope_hint: true } }));
    fireEvent.change(await screen.findByLabelText(en.map.gis.searchLabel), { target: { value: "zzzz" } });
    fireEvent.click(screen.getByRole("button", { name: en.map.gis.searchButton }));
    expect(await screen.findByText(en.map.gis.searchNone)).toBeInTheDocument();
  });

  it("layer toggles: boundaries and basemap can be switched off", async () => {
    wrap(route(EMPTY));
    await waitFor(() => expect(canvas()).toHaveAttribute("data-admin-count", "2"));
    fireEvent.click(screen.getByLabelText(en.map.gis.layerBoundaries));
    expect(canvas()).toHaveAttribute("data-admin-count", "-1");
    fireEvent.click(screen.getByLabelText(en.map.gis.layerBasemap));
    expect(canvas()).toHaveAttribute("data-tiles", "");
  });

  it("menu can be hidden and shown; legend names every boundary level in text", async () => {
    wrap(route(EMPTY));
    const toggle = await screen.findByRole("button", { name: en.map.gis.hideMenu });
    fireEvent.click(toggle);
    expect(screen.queryByTestId("gis-menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.map.gis.showMenu }));
    expect(screen.getByTestId("gis-menu")).toBeInTheDocument();
    const legend = screen.getByRole("region", { name: en.map.legendTitle });
    for (const l of ["Division", "District", "Upazila"]) expect(legend).toHaveTextContent(l);
  });

  it("boundary data failure shows a retry without breaking the parcel list", async () => {
    let fail = true;
    const get = vi.fn((p: string) => (p.startsWith("/gis/") && fail ? Promise.reject(new ApiError(500, "X", "x")) : route(EMPTY)(p)));
    wrap(get as any);
    expect(await screen.findByText(en.map.gis.loadError)).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getAllByRole("button", { name: en.common.retry })[0]);
    await waitFor(() => expect(screen.queryByText(en.map.gis.loadError)).toBeNull());
  });

  it("renders in Bangla", async () => {
    wrap(route(EMPTY), bn, "bn");
    expect(await screen.findByLabelText(bn.map.gis.division)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: bn.map.title })).toBeInTheDocument();
    expect(screen.getByText(bn.map.gis.boundaryNote)).toBeInTheDocument();
  });
});

import { within } from "@testing-library/react";
function GIS_D() {
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [[[90, 23], [91, 23], [91, 24], [90, 23]]] }, properties: { id: "1", name: "Dhaka", bn_name: "ঢাকা", division_id: "3", bbox: [90, 23, 91, 24], lat: 23.5, long: 90.5 } };
}
function GIS_U() {
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [[[90, 23], [91, 23], [91, 24], [90, 23]]] }, properties: { id: "9", name: "Savar", bn_name: "সাভার", division_id: "3", district_id: "1", bbox: [90, 23, 91, 24], lat: 23.5, long: 90.5 } };
}
