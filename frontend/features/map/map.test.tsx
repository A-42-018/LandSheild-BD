import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { navItemsFor } from "@/features/auth/roles";
import MapView from "./MapView";
import { route } from "./test-utils";
import { buildPopup, type PopupLabels } from "./popup";
import { filterFeatures, riskColor, type MapCollectionDto, type MapFeatureDto } from "./types";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/map",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

// Leaflet needs a real layout engine; the canvas is stubbed and only its props are checked.
vi.mock("./MapCanvas", () => ({
  default: (p: any) => (
    <div
      data-testid="map-canvas"
      data-selected={p.selectedId ?? ""}
      data-admin-level={p.admin?.level ?? ""}
      data-admin-count={p.admin?.features.length ?? -1}
      data-admin-selected={p.admin?.selectedId ?? ""}
      data-fit-key={p.fitKey ?? ""}
      data-tiles={p.tileUrl ?? ""}
      aria-label={p.ariaLabel}
    >
      {p.features.map((f: any) => (
        <span key={f.properties.land_id} data-testid="canvas-feature">{f.properties.land_id}</span>
      ))}
    </div>
  ),
}));

const user = { id: "1", name: "C", email: "c@x.co", role: "CITIZEN", preferred_language: "en" };

const feat = (id: string, risk: string, extra: Partial<MapFeatureDto["properties"]> = {}): MapFeatureDto => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[[90.3, 23.8], [90.301, 23.8], [90.301, 23.801], [90.3, 23.8]]] },
  properties: { land_id: id, dag_no: "210", khatian_no: "610", area: 20, area_unit: "decimal", status: "ACTIVE", risk_level: risk, ...extra },
});
const DATA: MapCollectionDto = {
  type: "FeatureCollection",
  features: [feat("LP-10100", "LOW"), feat("LP-10240", "HIGH", { status: "REVIEW_REQUIRED" }), feat("LP-10500", "MEDIUM")],
};

function client(get: (p: string) => Promise<any>): ApiClient {
  return { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient;
}
function wrap(c: ApiClient, messages: any = en, locale = "en") {
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
const ok = (d: MapCollectionDto) => route(d);

describe("filterFeatures / riskColor", () => {
  it("filters by risk level and keeps all for ALL", () => {
    expect(filterFeatures(DATA.features, "ALL")).toHaveLength(3);
    expect(filterFeatures(DATA.features, "HIGH").map((f) => f.properties.land_id)).toEqual(["LP-10240"]);
    expect(filterFeatures(DATA.features, "LOW")).toHaveLength(1);
  });
  it("uses token colours and a neutral fallback", () => {
    expect(riskColor("HIGH")).toBe("#B42318");
    expect(riskColor("LOW")).toBe("#1B7F4B");
    expect(riskColor("???")).toBe("#5B6B80");
  });
});

describe("buildPopup", () => {
  const labels: PopupLabels = {
    landId: "Land ID", dag: "Dag", khatian: "Khatian", area: "Area", status: "Status", risk: "Risk", view: "View details", locale: "en",
    statusText: (c) => c, riskText: (c) => c, unitText: (c) => c,
  };
  it("shows the six public fields and a details link, text only", () => {
    const open = vi.fn();
    const el = buildPopup(DATA.features[0].properties, labels, "/en/verify/result?land_id=LP-10100", open);
    const text = el.textContent ?? "";
    for (const s of ["LP-10100", "210", "610", "20 decimal", "ACTIVE", "LOW", "Dag", "Khatian", "Risk"]) expect(text).toContain(s);
    const a = el.querySelector("a")!;
    expect(a.textContent).toBe("View details");
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    a.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith("LP-10100");
  });
  it("shows dag, khatian and area in Bangla digits under bn, land ID stays Latin", () => {
    const bnLabels: PopupLabels = { ...labels, locale: "bn", unitText: (c) => (c === "decimal" ? "শতাংশ" : c) };
    const el = buildPopup(feat("LP-10240", "HIGH", { dag_no: "101", khatian_no: "501/2", area: 15 }).properties, bnLabels, "/x", vi.fn());
    const text = el.textContent ?? "";
    expect(text).toContain("১০১");
    expect(text).toContain("৫০১/২");
    expect(text).toContain("১৫ শতাংশ");
    expect(text.replaceAll("LP-10240", "")).not.toMatch(/[0-9]/);
    expect(text).toContain("LP-10240");
  });
  it("never turns stored values into markup", () => {
    const evil = feat("<img src=x onerror=alert(1)>", "LOW", { dag_no: "<b>1</b>" }).properties;
    const el = buildPopup(evil, labels, "/x", vi.fn());
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector("b")).toBeNull();
    expect(el.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("MapView", () => {
  it("loading → canvas, demo note, legend text, parcel list with badges", async () => {
    wrap(client(ok(DATA)));
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    expect(await screen.findByTestId("map-canvas")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(en.common.demoLabel);
    expect(screen.getAllByTestId("canvas-feature")).toHaveLength(3);
    const legend = screen.getByRole("region", { name: en.map.legendTitle });
    for (const l of ["Low", "Medium", "High"]) expect(legend).toHaveTextContent(l);
    const row = screen.getByTestId("parcel-LP-10240");
    expect(within(row).getByText("High")).toBeInTheDocument();
    expect(within(row).getByText("Review Required")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "View details for LP-10240" })).toHaveAttribute(
      "href",
      "/verify/result?land_id=LP-10240",
    );
  });

  it("risk filter narrows canvas and list; no-match shows an empty state", async () => {
    wrap(client(ok({ ...DATA, features: [DATA.features[0], DATA.features[1]] })));
    await screen.findByTestId("map-canvas");
    fireEvent.change(screen.getByLabelText(en.map.filterLabel), { target: { value: "HIGH" } });
    expect(screen.getAllByTestId("canvas-feature").map((e) => e.textContent)).toEqual(["LP-10240"]);
    expect(screen.queryByTestId("parcel-LP-10100")).toBeNull();
    expect(screen.getByText("1 parcel shown")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(en.map.filterLabel), { target: { value: "MEDIUM" } });
    expect(screen.getByText(en.map.noMatch)).toBeInTheDocument();
    expect(screen.queryAllByTestId("canvas-feature")).toHaveLength(0);
    expect(screen.getByTestId("map-canvas")).toBeInTheDocument(); // the national map stays
  });

  it("Show on map selects the parcel for the canvas", async () => {
    wrap(client(ok(DATA)));
    await screen.findByTestId("map-canvas");
    fireEvent.click(screen.getByRole("button", { name: "Show LP-10500 on map" }));
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-selected", "LP-10500");
    expect(screen.getByTestId("parcel-LP-10500")).toHaveAttribute("aria-current", "true");
  });

  it("empty dataset", async () => {
    wrap(client(ok({ type: "FeatureCollection", features: [] })));
    expect(await screen.findByText(en.common.empty)).toBeInTheDocument();
    expect(screen.queryAllByTestId("canvas-feature")).toHaveLength(0);
  });

  it("error with retry, and permission message on 403", async () => {
    let fail = true;
    const get = vi.fn((p: string) =>
      p === "/lands/map" && fail ? Promise.reject(new ApiError(500, "X", "x")) : route(DATA)(p),
    );
    wrap(client(get));
    expect(await screen.findByText(en.map.loadError)).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByTestId("parcel-LP-10240")).toBeInTheDocument();
  });
  it("403 shows the permission text", async () => {
    const get = vi.fn((p: string) =>
      p === "/lands/map" ? Promise.reject(new ApiError(403, "FORBIDDEN", "x")) : route(DATA)(p),
    );
    wrap(client(get));
    expect(await screen.findByText(en.errors.permission)).toBeInTheDocument();
  });

  it("renders Bangla labels", async () => {
    wrap(client(ok(DATA)), bn, "bn");
    expect(await screen.findByRole("heading", { level: 1, name: bn.map.title })).toBeInTheDocument();
    expect(screen.getByLabelText(bn.map.filterLabel)).toBeInTheDocument();
    expect(screen.getByTestId("parcel-LP-10240")).toHaveTextContent(bn.risk.level.HIGH);
    await waitFor(() => expect(screen.getByTestId("map-canvas")).toHaveAttribute("aria-label", bn.map.canvasLabel));
  });

  it("lists dag, khatian and area in Bangla digits (no Latin digits besides the land ID)", async () => {
    const data: MapCollectionDto = { type: "FeatureCollection", features: [feat("LP-10240", "HIGH", { dag_no: "101", khatian_no: "501", area: 15 })] };
    wrap(client(ok(data)), bn, "bn");
    const row = await screen.findByTestId("parcel-LP-10240");
    expect(row).toHaveTextContent("দাগ নং ১০১ · খতিয়ান নং ৫০১ · ১৫ শতাংশ");
    expect((row.textContent ?? "").replaceAll("LP-10240", "")).not.toMatch(/[0-9]/);
  });

  it("is in the nav for every signed-in role, not for anonymous", () => {
    const has = (r: any) => navItemsFor(r).some((i) => i.href === "/map");
    expect(has(null)).toBe(false);
    for (const r of ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"]) expect(has(r)).toBe(true);
  });

  it("parcel list carries no owner names", async () => {
    wrap(client(ok(DATA)));
    await screen.findByTestId("map-canvas");
    expect(document.body.textContent).not.toMatch(/Rahim|Karim|Hasan/);
  });
});

describe("MapView (UD7)", () => {
  it("fullscreen button toggles fullscreen and Esc leaves it; legend stays on the map", async () => {
    wrap(client(ok(DATA)));
    const canvas = await screen.findByTestId("map-canvas");
    const container = canvas.parentElement!;
    expect(container).not.toHaveAttribute("data-fullscreen");
    const btn = screen.getByRole("button", { name: en.map.gis.fullscreen });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(container).toHaveAttribute("data-fullscreen", "true");
    expect(screen.getByRole("button", { name: en.map.gis.exitFullscreen })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(container).not.toHaveAttribute("data-fullscreen"));
    expect(container).toContainElement(screen.getByRole("region", { name: en.map.legendTitle }));
  });
  it("legend can be hidden and shown again", async () => {
    wrap(client(ok(DATA)));
    await screen.findByTestId("map-canvas");
    fireEvent.click(screen.getByRole("button", { name: en.map.hideLegend }));
    expect(screen.queryByRole("region", { name: en.map.legendTitle })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.map.showLegend }));
    expect(screen.getByRole("region", { name: en.map.legendTitle })).toHaveTextContent("High");
  });
  it("parcel rows carry the risk level for styling", async () => {
    wrap(client(ok(DATA)));
    expect(await screen.findByTestId("parcel-LP-10240")).toHaveAttribute("data-risk", "HIGH");
  });
});
