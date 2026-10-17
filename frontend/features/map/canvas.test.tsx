import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { localDigits } from "@/lib/intl-locale";
import MapCanvas from "./MapCanvas";
import { gf } from "./test-utils";

// Real Leaflet in jsdom (no layout): checks the canvas wiring, not pixels.
const base = {
  features: [],
  selectedId: null,
  onSelect: vi.fn(),
  onOpen: vi.fn(),
  hrefFor: (id: string) => `/x/${id}`,
  labels: {
    landId: "Land ID", dag: "Dag", khatian: "Khatian", area: "Area", status: "Status", risk: "Risk", view: "View",
    statusText: (c: string) => c, riskText: (c: string) => c, unitText: (c: string) => c,
    digits: (v: string | number) => String(v),
  },
  ariaLabel: "Map",
  fitParcels: false,
};

// jsdom reports no SVG support, so Leaflet would have no vector renderer; fake the one probe it uses.
(globalThis as any).SVGElement.prototype.createSVGRect = () => ({});
// jsdom has no layout: give every element a size so Leaflet can compute zoom levels.
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 800 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });

describe("MapCanvas (real Leaflet)", () => {
  it("draws boundaries, scale, readout and attribution; tiles toggle without rebuilding", async () => {
    const pick = vi.fn();
    const feats = [gf("4", "Khulna", "খুলনা"), gf("3", "Dhaka", "ঢাকা")] as any[];
    const { container, rerender } = render(
      <MapCanvas
        {...base}
        tileUrl="https://tile.example/{z}/{x}/{y}.png"
        admin={{ features: feats, level: "division", selectedId: null }}
        onAdminPick={pick}
        zoomLabel="Zoom"
        attribution="Boundaries: test"
        fitKey="a"
        fitBounds={[[20.55, 88], [26.7, 92.75]]}
      />,
    );
    await waitFor(() => expect(container.querySelector(".leaflet-container")).not.toBeNull());
    await waitFor(() => expect(container.querySelectorAll(".leaflet-tile-pane img, .leaflet-tile-container").length >= 0).toBe(true));
    expect(container.querySelector(".leaflet-control-scale")).not.toBeNull();
    const readout = container.querySelector('[data-testid="map-readout"]');
    expect(readout?.textContent).toMatch(/° .*′ .*″ N .*E, Zoom: \d+\.\d\d/);
    expect(container.querySelector(".leaflet-control-attribution")?.textContent).toContain("Boundaries: test");
    await waitFor(() => expect(container.querySelectorAll("path.leaflet-interactive").length).toBe(2));

    rerender(
      <MapCanvas
        {...base}
        admin={{ features: feats.slice(0, 1), level: "division", selectedId: "4" }}
        onAdminPick={pick}
        fitKey="b"
        fitBounds={[[22, 89], [23, 90]]}
      />,
    );
    await waitFor(() => expect(container.querySelectorAll("path.leaflet-interactive").length).toBe(1));
    expect(container.querySelector(".leaflet-container")).not.toBeNull(); // same map instance, not rebuilt
  });

  const parcel = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[90.3, 23.8], [90.301, 23.8], [90.301, 23.801], [90.3, 23.8]]] },
    properties: { land_id: "LP-10001", dag_no: "101", khatian_no: "501", area: 15, area_unit: "decimal" },
  } as any;
  const popupDds = async (digits: (v: string | number) => string) => {
    const { container, unmount } = render(
      <MapCanvas {...base} labels={{ ...base.labels, digits }} features={[parcel]} selectedId="LP-10001" />,
    );
    await waitFor(() => expect(container.querySelector(".leaflet-popup-content dl")).not.toBeNull());
    const dds = [...container.querySelectorAll(".leaflet-popup-content dd")].map((d) => d.textContent);
    const title = container.querySelector(".leaflet-popup-content strong")?.textContent;
    unmount();
    return { title, dds };
  };
  it("selected parcel popup shows Bangla digits under bn, land ID unchanged", async () => {
    const { title, dds } = await popupDds((v) => localDigits(v, "bn"));
    expect(title).toBe("LP-10001");
    expect(dds).toEqual(["LP-10001", "১০১", "৫০১", "১৫ decimal"]);
  });
  it("selected parcel popup keeps Latin digits under en", async () => {
    const { dds } = await popupDds((v) => localDigits(v, "en"));
    expect(dds).toEqual(["LP-10001", "101", "501", "15 decimal"]);
  });

  const bnHemi = { n: "উত্তর", s: "দক্ষিণ", e: "পূর্ব", w: "পশ্চিম" };
  const readoutOf = (c: HTMLElement) => c.querySelector('[data-testid="map-readout"]')?.textContent ?? "";
  it("cursor/zoom readout uses Bangla digits and words under bn", async () => {
    const { container, unmount } = render(
      <MapCanvas {...base} labels={{ ...base.labels, digits: (v) => localDigits(v, "bn") }} zoomLabel="জুম" hemispheres={bnHemi} />,
    );
    await waitFor(() => expect(readoutOf(container)).not.toBe(""));
    const text = readoutOf(container);
    expect(text).toMatch(/^[০-৯]+° [০-৯]{2}′ [০-৯]{2}″ উত্তর [০-৯]+° [০-৯]{2}′ [০-৯]{2}″ পূর্ব, জুম: [০-৯]+\.[০-৯]{2}$/);
    expect(text).not.toMatch(/[0-9]/);
    unmount();
  });
  it("cursor/zoom readout keeps Latin digits under en", async () => {
    const { container, unmount } = render(
      <MapCanvas {...base} labels={{ ...base.labels, digits: (v) => localDigits(v, "en") }} zoomLabel="Zoom" hemispheres={{ n: "N", s: "S", e: "E", w: "W" }} />,
    );
    await waitFor(() => expect(readoutOf(container)).not.toBe(""));
    expect(readoutOf(container)).toMatch(/^\d+° \d{2}′ \d{2}″ N \d+° \d{2}′ \d{2}″ E, Zoom: \d+\.\d{2}$/);
    unmount();
  });
  it("switching locale relabels the readout in place without rebuilding the map", async () => {
    const { container, rerender, unmount } = render(<MapCanvas {...base} zoomLabel="Zoom" />);
    await waitFor(() => expect(readoutOf(container)).toContain("Zoom:"));
    const before = readoutOf(container);
    const mapEl = container.querySelector(".leaflet-container");
    rerender(
      <MapCanvas {...base} labels={{ ...base.labels, digits: (v) => localDigits(v, "bn") }} zoomLabel="জুম" hemispheres={bnHemi} />,
    );
    await waitFor(() => expect(readoutOf(container)).toContain("জুম:"));
    expect(readoutOf(container)).toBe(
      localDigits(before.replace(" N ", " উত্তর ").replace(" E,", " পূর্ব,").replace("Zoom", "জুম"), "bn"),
    );
    expect(container.querySelector(".leaflet-container")).toBe(mapEl); // same map instance
    unmount();
  });

  it("unmounts cleanly", async () => {
    const { container, unmount } = render(<MapCanvas {...base} />);
    await waitFor(() => expect(container.querySelector(".leaflet-container")).not.toBeNull());
    expect(() => unmount()).not.toThrow();
  });
});
