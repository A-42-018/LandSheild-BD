"use client";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { EyeOff, Layers, ListTree, Maximize2, Minimize2, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, LoadingState, Select } from "@/components/ui";
import RiskIndicator from "@/components/domain/RiskIndicator";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { localDigits } from "@/lib/intl-locale";
import ParcelList from "./ParcelList";
import SearchMenu from "./gis/SearchMenu";
import {
  BD_BOUNDS,
  bboxToBounds,
  EMPTY_SELECTION,
  gisLabel,
  LEVEL_STYLE,
  resolveTileUrl,
  select,
  selectionFromHit,
  viewLevel,
  type GisFeatureDto,
  type GisLevel,
  type GisSelection,
  type SearchHitDto,
} from "./gis/types";
import { useDistricts, useDivisions, useUpazilas } from "./gis/useGis";
import type { PopupLabels } from "./popup";
import { filterFeatures, RISK_COLOR, RISK_FILTERS, type MapFeatureDto, type RiskFilter } from "./types";
import { useParcelMap } from "./useMap";

// Leaflet only loads when the map is on screen (and only in the browser).
const MapCanvas = lazy(() => import("./MapCanvas"));

const GLASS = "border border-line/80 bg-surface/90 shadow-glass backdrop-blur-md"; // floating glass overlay panel (UI v2)
const GLASS_FIELDS =
  "[&_label]:text-xs [&_input:not([type=checkbox])]:py-1.5 [&_select]:py-1.5 [&_button]:py-1.5 [&_button]:text-sm";


const TILE_URL = resolveTileUrl(process.env.NEXT_PUBLIC_MAP_TILE_URL);
const ATTRIBUTION =
  'Boundaries: geoBoundaries (CC BY 4.0) via <a href="https://github.com/ifahimreza/bangladesh-geojson">ifahimreza/bangladesh-geojson</a>, simplified';

export default function MapView() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { status } = useAuth();
  const publicView = status !== "authenticated"; // U2.3: visitors see outlines and numbers, no risk colours
  const q = useParcelMap();
  const divisions = useDivisions();
  const [sel, setSel] = useState<GisSelection>(EMPTY_SELECTION);
  const districts = useDistricts(sel.divisionId);
  const upazilas = useUpazilas(sel.districtId);

  const [filter, setFilter] = useState<RiskFilter>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(true);
  const [showTiles, setShowTiles] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showParcels, setShowParcels] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);

  // Phones: start with the search menu and the legend closed so the map is visible first.
  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches) {
      setMenuOpen(false);
      setLegendOpen(false);
    }
  }, []);

  // Esc leaves fullscreen; the page behind does not scroll
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  const features = useMemo(
    () => filterFeatures(q.data?.features ?? [], filter),
    [q.data, filter],
  );

  const level = viewLevel(sel);
  const levelFeatures: GisFeatureDto[] =
    (level === "division"
      ? divisions.data?.features
      : level === "district"
        ? districts.data?.features
        : upazilas.data?.features) ?? [];

  // deepest chosen place decides where the map zooms
  const deepest =
    (sel.upazilaId && upazilas.data?.features.find((f) => f.properties.id === sel.upazilaId)) ||
    (sel.districtId && districts.data?.features.find((f) => f.properties.id === sel.districtId)) ||
    (sel.divisionId && divisions.data?.features.find((f) => f.properties.id === sel.divisionId)) ||
    null;
  const fitBounds = deepest ? bboxToBounds(deepest.properties.bbox) : BD_BOUNDS;
  const fitKey = `${sel.divisionId}|${sel.districtId}|${sel.upazilaId}|${deepest ? "ready" : "wait"}`;

  const pickLevel = (lvl: GisLevel, id: string) =>
    setSel((s) =>
      select(s, lvl === "division" ? "divisionId" : lvl === "district" ? "districtId" : "upazilaId", id),
    );
  const pickHit = (h: SearchHitDto) => setSel(selectionFromHit(h));

  const code = (ns: string, c: string) => (t.has(`${ns}.${c}`) ? t(`${ns}.${c}`) : c);
  const labels: PopupLabels = {
    landId: t("map.popup.landId"),
    dag: t("map.popup.dag"),
    khatian: t("map.popup.khatian"),
    area: t("map.popup.area"),
    status: t("map.popup.status"),
    risk: t("map.popup.risk"),
    view: t("map.popup.view"),
    statusText: (c) => code("status", c),
    riskText: (c) => code("risk.level", c),
    unitText: (c) => code("result.units", c),
    digits: (v) => localDigits(v, locale),
  };
  // Signed in: the full result. Visitor: the public search, pre-filled from the parcel's place and numbers.
  const detailsOf = (p: MapFeatureDto["properties"]) =>
    publicView
      ? `/verify?${new URLSearchParams({ district: p.district ?? "", upazila: p.upazila ?? "", mouza: p.mouza ?? "", khatian: p.khatian_no, dag: p.dag_no })}`
      : `/verify/result?land_id=${encodeURIComponent(p.land_id)}`;
  const detailsPath = (id: string) => {
    const f = q.data?.features.find((x) => x.properties.land_id === id);
    return f ? detailsOf(f.properties) : `/verify/result?land_id=${encodeURIComponent(id)}`;
  };

  const options = RISK_FILTERS.map((f) => ({
    value: f,
    label: f === "ALL" ? t("map.filterAll") : t(`risk.level.${f}`),
  }));

  let parcels: React.ReactNode;
  if (!showParcels) {
    parcels = null;
  } else if (q.isPending) {
    parcels = <LoadingState />;
  } else if (q.isError) {
    parcels = (
      <ErrorState error={q.error} message={t("map.loadError")} onRetry={() => void q.refetch()} />
    );
  } else if (q.data.features.length === 0) {
    parcels = <EmptyState title={t("map.noParcels")} />;
  } else {
    parcels = (
      <>
        <div className="flex flex-wrap items-end gap-4">
          {!publicView && (
            <div className="w-full sm:w-56">
              <Select
                label={t("map.filterLabel")}
                options={options}
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as RiskFilter);
                  setSelected(null);
                }}
              />
            </div>
          )}
          <p role="status" className="text-sm text-ink-muted">
            {t("map.count", { count: features.length })}
          </p>
        </div>
        {features.length === 0 ? (
          <EmptyState title={t("map.noMatch")} />
        ) : (
          <ParcelList features={features} selectedId={selected} onSelect={setSelected} detailsHref={detailsOf} />
        )}
      </>
    );
  }

  const gisFailed = divisions.isError;

  return (
    <div
      className={
        fullscreen
          ? "flex flex-col gap-3 px-4"
          : "flex w-full min-w-0 flex-col gap-2" // inside the page column: a 100vw breakout overflowed under classic scrollbars and pushed the map controls off screen
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold text-ink">{t("map.title")}</h1>
        <p
          role="note"
          className="glass-card px-3 py-1 text-sm font-medium text-ink"
        >
          {t("common.demoLabel")}
        </p>
      </div>
      <p className="text-sm text-ink-muted">{t(publicView ? "map.introPublic" : "map.intro")}</p>

      {gisFailed && (
        <div>
          <ErrorState error={divisions.error} message={t("map.gis.loadError")} onRetry={() => void divisions.refetch()} />
        </div>
      )}

      <div
        data-fullscreen={fullscreen || undefined}
        className={
          fullscreen
            ? "fixed inset-0 z-[2000] isolate bg-surface"
            : "relative isolate overflow-hidden rounded-card border border-line shadow-card"
        }
      >
        <Suspense fallback={<LoadingState />}>
          <MapCanvas
            key={fullscreen ? "fullscreen" : "inline"}
            className={
              fullscreen
                ? "h-[100dvh] w-full bg-surface-muted"
                : "h-[calc(100svh-8rem)] min-h-[560px] w-full bg-surface-muted"
            }
            features={showParcels ? features : []}
            selectedId={selected}
            onSelect={setSelected}
            onOpen={(id) => router.push(detailsPath(id))}
            hrefFor={detailsPath}
            labels={labels}
            ariaLabel={t("map.canvasLabel")}
            tileUrl={TILE_URL && showTiles ? TILE_URL : undefined}
            admin={
              showBoundaries
                ? {
                    features: levelFeatures,
                    level,
                    selectedId: level === "upazila" ? sel.upazilaId || null : null,
                  }
                : undefined
            }
            labelOf={(f) => gisLabel(f.properties)}
            onAdminPick={pickLevel}
            fitBounds={fitBounds}
            fitKey={fitKey}
            fitParcels={false}
            zoomLabel={t("map.gis.zoom")}
            hemispheres={{ n: t("map.gis.north"), s: t("map.gis.south"), e: t("map.gis.east"), w: t("map.gis.west") }}
            attribution={ATTRIBUTION}
          />
        </Suspense>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={`absolute right-3 top-3 z-[1000] !text-ink hover:!bg-surface-muted ${GLASS}`}
          aria-pressed={fullscreen}
          icon={fullscreen ? <Minimize2 /> : <Maximize2 />}
          onClick={() => setFullscreen((v) => !v)}
        >
          {fullscreen ? t("map.gis.exitFullscreen") : t("map.gis.fullscreen")}
        </Button>

        <aside
          aria-label={t("map.gis.menuTitle")}
          className="absolute left-2 right-2 top-14 z-[1000] flex max-h-[calc(100%-4.5rem)] flex-col gap-2 sm:left-14 sm:right-auto sm:top-3 sm:max-h-[calc(100%-1.5rem)] sm:w-64"
        >
          <Button
            type="button"
            variant="secondary"
            className={`self-start !text-ink hover:!bg-surface-muted ${GLASS}`}
            icon={<Layers />}
            aria-expanded={menuOpen}
            aria-controls="gis-menu-panel"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? t("map.gis.hideMenu") : t("map.gis.showMenu")}
          </Button>
          {menuOpen && (
            <div
              id="gis-menu-panel"
              className={`flex flex-col overflow-hidden rounded-card text-ink ${GLASS}`}
            >
              <div className="flex items-center gap-2 border-b-2 border-gold bg-brand-deep px-3 py-2 text-primary-fg">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
                <h2 className="text-sm font-semibold text-white/100">{t("map.gis.menuTitle")}</h2>
              </div>
              <div className={`flex flex-col gap-3 overflow-y-auto p-3 text-sm ${GLASS_FIELDS}`}>
              <SearchMenu
                sel={sel}
                onChange={setSel}
                onPickHit={pickHit}
                onReset={() => setSel(EMPTY_SELECTION)}
                divisions={divisions.data?.features ?? []}
                districts={districts.data?.features ?? []}
                upazilas={upazilas.data?.features ?? []}
                loading={divisions.isPending}
              />
              <fieldset className="flex flex-col gap-2 border-t border-line pt-3 text-sm text-ink">
                <legend className="px-1 font-medium">{t("map.gis.layers")}</legend>
                {TILE_URL && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showTiles}
                      onChange={(e) => setShowTiles(e.target.checked)}
                    />
                    {t("map.gis.layerBasemap")}
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showBoundaries}
                    onChange={(e) => setShowBoundaries(e.target.checked)}
                  />
                  {t("map.gis.layerBoundaries")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showParcels}
                    onChange={(e) => setShowParcels(e.target.checked)}
                  />
                  {t(publicView ? "map.gis.layerParcelsPublic" : "map.gis.layerParcels")}
                </label>
              </fieldset>
              </div>
            </div>
          )}
        </aside>
        {!legendOpen && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={`absolute bottom-9 right-2 z-[1000] !text-ink hover:!bg-surface-muted ${GLASS}`}
            icon={<ListTree />}
            aria-expanded={false}
            aria-controls="map-legend"
            onClick={() => setLegendOpen(true)}
          >
            {t("map.showLegend")}
          </Button>
        )}
        {legendOpen && (
          <section
            id="map-legend"
            aria-label={t("map.legendTitle")}
            className={`absolute bottom-9 right-2 z-[1000] flex max-w-[15rem] flex-col gap-1 rounded-card p-2.5 text-xs text-ink ${GLASS}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t("map.legendTitle")}</span>
              <button
                type="button"
                aria-expanded={true}
                aria-controls="map-legend"
                onClick={() => setLegendOpen(false)}
                className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-link hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
                {t("map.hideLegend")}
              </button>
            </div>
            {showBoundaries &&
              (["division", "district", "upazila"] as const).map((lvl) => (
                <span key={lvl} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block w-5 shrink-0 border-t"
                    style={{
                      borderTopWidth: LEVEL_STYLE[lvl].weight + 1,
                      borderColor: LEVEL_STYLE[lvl].color,
                    }}
                  />
                  {t(`map.gis.level.${lvl}`)}
                  {lvl === level && ` — ${t("map.gis.shownNow")}`}
                </span>
              ))}
            {showParcels &&
              !publicView &&
              (["LOW", "MEDIUM", "HIGH"] as const).map((lvl) => (
                <span key={lvl} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 shrink-0 rounded-sm border border-line"
                    style={{ backgroundColor: RISK_COLOR[lvl] }}
                  />
                  <RiskIndicator level={lvl} size="sm" showLabel={false} />
                </span>
              ))}
            {showParcels && <span className="text-ink-muted">{t(publicView ? "map.legendNotePublic" : "map.legendNote")}</span>}
          </section>
        )}
      </div>

      <p className="text-xs text-ink-muted">{t("map.mapHint")}</p>
      <p className="text-xs text-ink-muted">{t("map.gis.boundaryNote")}</p>

      {showParcels && (
        <div className="flex flex-col gap-3 pb-4">
          {parcels}
        </div>
      )}
    </div>
  );
}
