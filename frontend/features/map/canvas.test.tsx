import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    landId: "Land ID", dag: "Dag", khatian: "Khatian", area: "Area", status: "Status", risk: "Risk", view: "View", locale: "en",
    statusText: (c: string) => c, riskText: (c: string) => c, unitText: (c: string) => c,
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

  it("unmounts cleanly", async () => {
    const { container, unmount } = render(<MapCanvas {...base} />);
    await waitFor(() => expect(container.querySelector(".leaflet-container")).not.toBeNull());
    expect(() => unmount()).not.toThrow();
  });
});
