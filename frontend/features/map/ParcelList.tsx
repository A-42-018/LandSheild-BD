"use client";
import { useLocale, useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui";
import RiskBadge from "@/components/domain/RiskBadge";
import StatusBadge from "@/components/domain/StatusBadge";
import { Link } from "@/i18n/navigation";
import { formatArea } from "@/features/result/format";
import { localDigits } from "@/lib/intl-locale";
import type { MapFeatureDto } from "./types";

const LEFT: Record<string, string> = {
  LOW: "border-l-verified",
  MEDIUM: "border-l-review",
  HIGH: "border-l-critical",
};

/** Text/keyboard alternative to the canvas: every parcel is reachable without the pointer. */
export default function ParcelList({
  features,
  selectedId,
  onSelect,
}: {
  features: MapFeatureDto[];
  selectedId: string | null;
  onSelect: (landId: string) => void;
}) {
  const t = useTranslations("map");
  const tu = useTranslations("result.units");
  const locale = useLocale();
  return (
    <section aria-labelledby="map-list-title" className="flex flex-col gap-2">
      <h2 id="map-list-title" className="text-lg font-semibold text-ink">
        {t("listTitle")}
      </h2>
      <ul className="flex flex-col gap-2">
        {features.map((f) => {
          const p = f.properties;
          const unit = tu.has(p.area_unit) ? tu(p.area_unit) : p.area_unit;
          return (
            <li
              key={p.land_id}
              data-testid={`parcel-${p.land_id}`}
              aria-current={selectedId === p.land_id ? "true" : undefined}
              data-risk={p.risk_level}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-l-4 border-line bg-surface p-3 shadow-card transition-shadow hover:shadow-raised ${LEFT[p.risk_level] ?? "border-l-pending"} ${selectedId === p.land_id ? "ring-2 ring-primary/50" : ""}`}
            >
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <MapPin aria-hidden="true" className="h-4 w-4 text-primary" />
                {p.land_id}
              </span>
              <span className="text-sm text-ink-muted">
                {t("popup.dag")} {localDigits(p.dag_no, locale)} · {t("popup.khatian")} {localDigits(p.khatian_no, locale)} ·{" "}
                {formatArea(p.area, p.area_unit, locale, unit)}
              </span>
              <StatusBadge code={p.status} />
              <RiskBadge level={p.risk_level} />
              <span className="ms-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={t("showOnMapFor", { landId: p.land_id })}
                  onClick={() => onSelect(p.land_id)}
                >
                  {t("showOnMap")}
                </Button>
                <Link
                  href={`/verify/result?land_id=${encodeURIComponent(p.land_id)}`}
                  aria-label={t("viewDetailsFor", { landId: p.land_id })}
                  className="inline-flex items-center rounded-md px-2 text-sm font-medium text-primary underline"
                >
                  {t("popup.view")}
                </Link>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
