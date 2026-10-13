"use client";
import { useMemo, useState } from "react";
import { MapPinned, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";
import { Button, Card, EmptyState, ErrorState, LoadingState, Select } from "@/components/ui";
import PlaceSearch from "@/features/map/gis/PlaceSearch";
import {
  EMPTY_SELECTION,
  gisLabel,
  mouzasInUnion,
  placeOptions,
  select,
  selectionFromHit,
  type GisSelection,
} from "@/features/map/gis/types";
import {
  useDistricts,
  useDivisions,
  useGisCapabilities,
  useMouzas,
  useUnions,
  useUpazilas,
} from "@/features/map/gis/useGis";
import MouzaDetail from "./MouzaDetail";
import MouzaList from "./MouzaList";

/** Mouza map (all signed-in roles): pick Division → District → Upazila → Union, list its mouzas, open the scans. */
export default function MouzaMapView() {
  const t = useTranslations("mouza");
  const tg = useTranslations("map.gis");
  const tc = useTranslations("common");
  const caps = useGisCapabilities();
  const divisions = useDivisions();
  const [sel, setSel] = useState<GisSelection>(EMPTY_SELECTION);
  const districts = useDistricts(sel.divisionId);
  const upazilas = useUpazilas(sel.districtId);
  const unions = useUnions(sel.upazilaId);
  const mouzas = useMouzas(sel.upazilaId);

  const coverage = caps.data?.mouza_enabled_division_name ?? "";
  const unionById = useMemo(() => new Map((unions.data?.unions ?? []).map((u) => [u.id, gisLabel(u)])), [unions.data]);
  const unionName = (id: string | null | undefined) => (id ? unionById.get(id) : undefined);
  const unionOptions = (unions.data?.unions ?? []).map((u) => ({
    value: u.id,
    label: `${gisLabel(u)} · ${t("mouzaCount", { count: u.mouza_count })}`,
  }));

  const nameOf = (list: { properties: { id: string; name: string; bn_name: string } }[] | undefined, id: string) => {
    const f = list?.find((x) => x.properties.id === id);
    return f ? gisLabel(f.properties) : "";
  };
  const upazilaName = nameOf(upazilas.data?.features, sel.upazilaId);
  const place = [upazilaName, nameOf(districts.data?.features, sel.districtId)].filter(Boolean).join(", ");
  const all = mouzas.data?.mouzas ?? [];
  const list = mouzasInUnion(all, sel.unionId);
  const open = all.find((m) => m.id === sel.mouzaId) ?? null;

  let body: React.ReactNode;
  if (!sel.upazilaId) {
    body = <EmptyState title={t("pickUpazila")} description={coverage ? t("coverage", { divisions: coverage }) : undefined} />;
  } else if (mouzas.isPending) {
    body = <LoadingState />;
  } else if (mouzas.isError) {
    body = <ErrorState message={t("loadError")} onRetry={() => void mouzas.refetch()} />;
  } else if (!mouzas.data.enabled) {
    body = <EmptyState title={t("outOfScope")} description={coverage ? t("coverage", { divisions: coverage }) : undefined} />;
  } else if (all.length === 0) {
    body = <EmptyState title={t("none")} />;
  } else {
    body = (
      <>
        {unions.data && unionOptions.length === 0 && <p className="text-sm text-ink-muted">{t("noUnion")}</p>}
        <MouzaList
          key={sel.upazilaId}
          mouzas={list}
          unionName={unionName}
          onOpen={(id) => setSel((s) => ({ ...s, mouzaId: id }))}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("title")} purpose={t("purpose")} meta={[tc("demoLabel")]} />

      {(divisions.isError || caps.isError) && (
        <ErrorState
          message={tg("loadError")}
          onRetry={() => {
            void divisions.refetch();
            void caps.refetch();
          }}
        />
      )}

      <Card title={t("findTitle")} icon={<MapPinned />} accent="primary">
        <div className="flex flex-col gap-3" data-testid="mouza-finder">
          <PlaceSearch
            onPick={(h) => setSel(selectionFromHit(h))}
            placeholder={t("searchPlaceholder")}
            noneText={t("searchNone")}
            scopeNote={coverage ? t("searchScopeNote", { divisions: coverage }) : undefined}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label={tg("division")}
              placeholder={tg("choose")}
              value={sel.divisionId}
              options={placeOptions(divisions.data?.features ?? [])}
              disabled={divisions.isPending}
              onChange={(e) => setSel(select(sel, "divisionId", e.target.value))}
            />
            <Select
              label={tg("district")}
              placeholder={tg("choose")}
              value={sel.districtId}
              options={placeOptions(districts.data?.features ?? [])}
              disabled={!sel.divisionId}
              onChange={(e) => setSel(select(sel, "districtId", e.target.value))}
            />
            <Select
              label={tg("upazila")}
              placeholder={tg("choose")}
              value={sel.upazilaId}
              options={placeOptions(upazilas.data?.features ?? [])}
              disabled={!sel.districtId}
              onChange={(e) => setSel(select(sel, "upazilaId", e.target.value))}
            />
            <Select
              label={t("union")}
              placeholder={t("allUnions")}
              value={sel.unionId}
              options={unionOptions}
              disabled={!sel.upazilaId || unionOptions.length === 0}
              onChange={(e) => setSel(select(sel, "unionId", e.target.value))}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<RotateCcw />}
            className="self-end"
            disabled={!sel.divisionId}
            onClick={() => setSel(EMPTY_SELECTION)}
          >
            {t("reset")}
          </Button>
        </div>
      </Card>

      <section aria-label={t("listTitle")} className="flex flex-col gap-3">
        {sel.upazilaId && (
          <h2 className="text-lg font-semibold text-ink">
            {t("listIn", { place: sel.unionId ? `${unionName(sel.unionId) ?? ""}, ${place}` : place })}
          </h2>
        )}
        {body}
      </section>

      <div className="flex flex-col gap-1 text-xs text-ink-muted">
        <p>{t("scanNote")}</p>
        <p>{t("sourceNote")}</p>
      </div>

      <MouzaDetail
        mouza={open}
        union={unionName(open?.union_id)}
        place={place}
        sourceUrl={caps.data?.mouza_source_url}
        onClose={() => setSel((s) => ({ ...s, mouzaId: "" }))}
      />
    </div>
  );
}
