"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { buildPopup, type PopupLabels } from "./popup";
import { riskColor, type MapFeatureDto } from "./types";
import { formatCoords, formatZoom } from "./gis/coords";
import { BD_BOUNDS, LEVEL_STYLE, type GisFeatureDto, type GisLevel } from "./gis/types";

type LeafletNS = typeof Leaflet;

export interface MapCanvasProps {
  features: MapFeatureDto[];
  selectedId: string | null;
  onSelect: (landId: string) => void;
  onOpen: (landId: string) => void;
  hrefFor: (landId: string) => string;
  labels: PopupLabels;
  ariaLabel: string;
  /** Street basemap tiles; undefined = blank background (works offline). */
  tileUrl?: string;
  /** National boundary layer (P66): features of ONE level + the selected id. */
  admin?: { features: GisFeatureDto[]; level: GisLevel; selectedId: string | null };
  labelOf?: (f: GisFeatureDto) => string;
  onAdminPick?: (level: GisLevel, id: string) => void;
  /** [[south, west], [north, east]] to fit whenever `fitKey` changes. */
  fitBounds?: [[number, number], [number, number]] | null;
  fitKey?: string;
  /** Legacy parcel view fits to the parcels; the national map does not. Default true. */
  fitParcels?: boolean;
  zoomLabel?: string;
  attribution?: string;
  /** Overrides the default box size classes (the national page fills the viewport). */
  className?: string;
}

/** Leaflet is imported inside an effect only, so nothing touches `window` during SSR. */
export default function MapCanvas(props: MapCanvasProps) {
  const { features, selectedId, onSelect, onOpen, hrefFor, labels, ariaLabel, tileUrl } = props;
  const { admin, labelOf, onAdminPick, fitBounds, fitKey, zoomLabel, attribution } = props;
  const fitParcels = props.fitParcels !== false;
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const groupRef = useRef<Leaflet.FeatureGroup | null>(null);
  const adminRef = useRef<Leaflet.FeatureGroup | null>(null);
  const tilesRef = useRef<Leaflet.TileLayer | null>(null);
  const readoutRef = useRef<HTMLDivElement | null>(null);
  const layers = useRef(new Map<string, Leaflet.GeoJSON>());
  const libRef = useRef<LeafletNS | null>(null);
  const [ready, setReady] = useState(false);

  // keep the latest callbacks without re-creating the map
  const cb = useRef({ onSelect, onOpen, hrefFor, labels, onAdminPick, labelOf, zoomLabel });
  cb.current = { onSelect, onOpen, hrefFor, labels, onAdminPick, labelOf, zoomLabel };

  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | undefined;
    void (async () => {
      const mod = await import("leaflet");
      if (cancelled || !host.current) return;
      const L = ((mod as unknown as { default?: LeafletNS }).default ?? mod) as LeafletNS;
      map = L.map(host.current, { minZoom: 5, maxZoom: 19, attributionControl: true, zoomSnap: 0.25 });
      if (attribution) map.attributionControl.addAttribution(attribution);
      L.control.scale({ imperial: false }).addTo(map);
      adminRef.current = L.featureGroup().addTo(map);
      groupRef.current = L.featureGroup().addTo(map);
      // cursor position + zoom readout, as on the reference portal (text only, no markup)
      const Readout = L.Control.extend({
        onAdd() {
          const el = L.DomUtil.create("div", "leaflet-bar");
          el.style.cssText = "background:#fff;padding:2px 8px;font-size:12px;pointer-events:none";
          el.setAttribute("data-testid", "map-readout");
          readoutRef.current = el as HTMLDivElement;
          return el;
        },
      });
      new Readout({ position: "bottomleft" }).addTo(map);
      const paint = (ll?: Leaflet.LatLng) => {
        const c = ll ?? map!.getCenter();
        if (readoutRef.current) {
          readoutRef.current.textContent = `${formatCoords(c.lat, c.lng)}, ${cb.current.zoomLabel ?? "Zoom"}: ${formatZoom(map!.getZoom())}`;
        }
      };
      map.on("mousemove", (e: Leaflet.LeafletMouseEvent) => paint(e.latlng));
      map.on("move zoom", () => paint());
      map.fitBounds(BD_BOUNDS);
      paint();
      libRef.current = L;
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      layers.current.clear();
      groupRef.current = null;
      adminRef.current = null;
      tilesRef.current = null;
      readoutRef.current = null;
      mapRef.current = null;
      libRef.current = null;
      map?.remove();
      setReady(false);
    };
  }, [attribution]);

  // street basemap on/off without rebuilding the map
  useEffect(() => {
    const L = libRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    tilesRef.current?.remove();
    tilesRef.current = null;
    if (tileUrl) {
      tilesRef.current = L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      tilesRef.current.bringToBack();
    }
  }, [ready, tileUrl]);

  // administrative boundaries (one level at a time, never the whole country's mouzas)
  useEffect(() => {
    const L = libRef.current;
    const group = adminRef.current;
    if (!ready || !L || !group) return;
    group.clearLayers();
    if (admin) {
      const base = LEVEL_STYLE[admin.level];
      for (const f of admin.features) {
        const chosen = f.properties.id === admin.selectedId;
        const dim = admin.selectedId !== null && !chosen;
        const layer = L.geoJSON(f as unknown as GeoJSON.Feature, {
          style: {
            color: base.color,
            weight: chosen ? base.weight + 1.5 : base.weight,
            fillColor: base.color,
            fillOpacity: chosen ? 0.25 : dim ? 0.02 : 0.08,
          },
        });
        const text = cb.current.labelOf?.(f) ?? f.properties.name;
        const tip = document.createElement("span");
        tip.textContent = text; // DOM text node: names are never parsed as HTML
        layer.bindTooltip(tip, { sticky: true });
        layer.on("click", () => cb.current.onAdminPick?.(admin.level, f.properties.id));
        layer.addTo(group);
      }
    }
    groupRef.current?.bringToFront();
  }, [ready, admin]);

  // fit to the requested box whenever the key changes (selection / reset)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !fitBounds) return;
    map.fitBounds(fitBounds, { padding: [16, 16], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  // draw / redraw parcels when data or the filter changes
  useEffect(() => {
    const L = libRef.current;
    const map = mapRef.current;
    const group = groupRef.current;
    if (!ready || !L || !map || !group) return;
    group.clearLayers();
    layers.current.clear();
    for (const f of features) {
      const p = f.properties;
      const color = riskColor(p.risk_level);
      const layer = L.geoJSON(f as unknown as GeoJSON.Feature, {
        style: { color, weight: 2, fillColor: color, fillOpacity: 0.3 },
      });
      layer.bindPopup(() => {
        const c = cb.current;
        return buildPopup(p, c.labels, c.hrefFor(p.land_id), c.onOpen);
      });
      layer.on("click", () => cb.current.onSelect(p.land_id));
      layer.addTo(group);
      layers.current.set(p.land_id, layer);
    }
    const bounds = group.getBounds();
    if (fitParcels && bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
  }, [ready, features, fitParcels]);

  // keep tiles correct when the box is resized (window, menu layout)
  useEffect(() => {
    const el = host.current;
    const map = mapRef.current;
    if (!ready || !el || !map || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  // external selection (list button) -> highlight, zoom and open the popup
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    layers.current.forEach((layer, id) => {
      layer.setStyle({ weight: id === selectedId ? 4 : 2 });
    });
    const sel = selectedId ? layers.current.get(selectedId) : undefined;
    if (sel) {
      map.fitBounds(sel.getBounds(), { padding: [48, 48], maxZoom: 18 });
      sel.openPopup();
    }
  }, [ready, selectedId, features]);

  return (
    <div
      ref={host}
      role="region"
      aria-label={ariaLabel}
      data-testid="map-canvas"
      className={
        props.className ??
        "h-[420px] w-full rounded-lg border border-line bg-surface-muted md:h-[620px]"
      }
    />
  );
}
