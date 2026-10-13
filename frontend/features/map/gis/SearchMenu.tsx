"use client";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Select } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import PlaceSearch from "./PlaceSearch";
import {
  ADMIN_LEVELS,
  placeOptions,
  select,
  type GisFeatureDto,
  type GisSelection,
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
  loading: boolean;
}

/** Map-only Division → District → Upazila menu. Unions, mouzas and survey sheets are on the mouza map page. */
export default function SearchMenu(p: SearchMenuProps) {
  const t = useTranslations("map.gis");
  const { sel } = p;

  return (
    <div className="flex flex-col gap-3" data-testid="gis-menu">
      <PlaceSearch
        onPick={p.onPickHit}
        levels={ADMIN_LEVELS}
        placeholder={t("searchPlaceholder")}
        noneText={t("searchNone")}
      />
      <Select
        label={t("division")}
        placeholder={t("choose")}
        value={sel.divisionId}
        options={placeOptions(p.divisions)}
        disabled={p.loading && p.divisions.length === 0}
        onChange={(e) => p.onChange(select(sel, "divisionId", e.target.value))}
      />
      <Select
        label={t("district")}
        placeholder={t("choose")}
        value={sel.districtId}
        options={placeOptions(p.districts)}
        disabled={!sel.divisionId}
        onChange={(e) => p.onChange(select(sel, "districtId", e.target.value))}
      />
      <Select
        label={t("upazila")}
        placeholder={t("choose")}
        value={sel.upazilaId}
        options={placeOptions(p.upazilas)}
        disabled={!sel.districtId}
        onChange={(e) => p.onChange(select(sel, "upazilaId", e.target.value))}
      />
      <p className="text-xs text-ink-muted">
        {t("mouzaHint")}{" "}
        <Link href="/mouza-map" className="font-medium text-link underline underline-offset-2">
          {t("mouzaLink")}
        </Link>
      </p>
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
