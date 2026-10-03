"use client";
import { useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Select } from "@/components/ui";
import { useGisSearch } from "./useGis";
import {
  gisLabel,
  select,
  type GisCapabilitiesDto,
  type GisFeatureDto,
  type GisSelection,
  type MouzaListDto,
  type SearchHitDto,
} from "./types";

export interface SearchMenuProps {
  sel: GisSelection;
  onChange: (next: GisSelection) => void;
  onPickHit: (hit: SearchHitDto) => void;
  onReset: () => void;
  divisions: GisFeatureDto[];
  districts: GisFeatureDto[];
  upazilas: GisFeatureDto[];
  mouzas?: MouzaListDto;
  caps?: GisCapabilitiesDto;
  loading: boolean;
}

const opts = (fs: GisFeatureDto[]) =>
  fs
    .map((f) => ({ value: f.properties.id, label: gisLabel(f.properties) }))
    .sort((a, b) => a.label.localeCompare(b.label));

/** Cascading Division → District → Upazila → Mouza → Sheet → Plot menu (reference: map.land.gov.bd). */
export default function SearchMenu(p: SearchMenuProps) {
  const t = useTranslations("map.gis");
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const search = useGisSearch(submitted);
  const { sel } = p;

  const mouzaOptions = (p.mouzas?.mouzas ?? []).map((m) => ({
    value: m.id,
    label: `${m.code}-${m.name}${m.bn_name ? ` (${m.bn_name})` : ""}`,
  }));
  const mouzaDisabled = !sel.upazilaId || !p.mouzas?.enabled || mouzaOptions.length === 0;
  let mouzaHint: string | undefined;
  if (sel.upazilaId && p.mouzas) {
    if (!p.mouzas.enabled) {
      mouzaHint = t("mouzaOutOfScope", { division: p.caps?.mouza_enabled_division_name ?? "—" });
    } else if (mouzaOptions.length === 0) {
      mouzaHint = t("mouzaNone");
    }
  }
  const sheets = p.mouzas?.mouzas.find((m) => m.id === sel.mouzaId)?.sheets ?? [];
  const sheetOptions = sheets
    .map((s) => s.sheet_no)
    .filter((n): n is string => Boolean(n))
    .map((n) => ({ value: n, label: n }));

  return (
    <div className="flex flex-col gap-3" data-testid="gis-menu">
      <form
        className="flex flex-col gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(term.trim());
        }}
      >
        <label htmlFor="gis-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="flex items-stretch gap-1.5">
          <input
            id="gis-search"
            type="search"
            value={term}
            placeholder={t("searchPlaceholder")}
            onChange={(e) => setTerm(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-line px-2.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <button
            type="submit"
            aria-label={t("searchButton")}
            title={t("searchButton")}
            disabled={term.trim().length < 2}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-fg hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </form>
      {submitted.length >= 2 && (
        <div aria-live="polite" className="text-sm">
          {search.isPending ? (
            <p className="text-ink-muted">{t("searching")}</p>
          ) : search.isError ? (
            <p className="text-critical">{t("searchError")}</p>
          ) : search.data.hits.length === 0 ? (
            <p className="text-ink-muted">{t("searchNone")}</p>
          ) : (
            <ul className="flex max-h-48 flex-col overflow-auto rounded-md border border-line">
              {search.data.hits.map((h) => (
                <li key={`${h.level}-${h.id}`} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-surface-muted"
                    onClick={() => p.onPickHit(h)}
                  >
                    <span className="font-medium">{gisLabel(h)}</span>{" "}
                    <span className="text-xs text-ink-muted">
                      {t(`level.${h.level}`)}
                      {h.path ? ` · ${h.path}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {search.data && search.data.hits.length > 0 && search.data.out_of_scope_hint && (
            <p className="mt-1 text-xs text-ink-muted">{t("searchScopeNote")}</p>
          )}
        </div>
      )}

      <Select
        label={t("division")}
        placeholder={t("choose")}
        value={sel.divisionId}
        options={opts(p.divisions)}
        disabled={p.loading && p.divisions.length === 0}
        onChange={(e) => p.onChange(select(sel, "divisionId", e.target.value))}
      />
      <Select
        label={t("district")}
        placeholder={t("choose")}
        value={sel.districtId}
        options={opts(p.districts)}
        disabled={!sel.divisionId}
        onChange={(e) => p.onChange(select(sel, "districtId", e.target.value))}
      />
      <Select
        label={t("upazila")}
        placeholder={t("choose")}
        value={sel.upazilaId}
        options={opts(p.upazilas)}
        disabled={!sel.districtId}
        onChange={(e) => p.onChange(select(sel, "upazilaId", e.target.value))}
      />
      <details className="group rounded-md border border-line/70 px-2.5 py-1.5">
        <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t("advanced")}
        </summary>
        <div className="mt-2 flex flex-col gap-3">
      <Select
        label={t("mouza")}
        placeholder={t("choose")}
        value={sel.mouzaId}
        options={mouzaOptions}
        disabled={mouzaDisabled}
        hint={mouzaHint}
        onChange={(e) => p.onChange(select(sel, "mouzaId", e.target.value))}
      />
      <Select
        label={t("sheet")}
        placeholder={t("choose")}
        options={sheetOptions}
        disabled={sheetOptions.length === 0}
      />
      <Select label={t("plot")} placeholder={t("choose")} options={[]} disabled />
      <p className="text-xs text-ink-muted">{t("sheetPlotNote")}</p>
        </div>
      </details>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={<RotateCcw />}
        className="self-end text-primary"
        onClick={p.onReset}
      >
        {t("reset")}
      </Button>
    </div>
  );
}
