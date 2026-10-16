"use client";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui";
import RiskIndicator from "@/components/domain/RiskIndicator";
import StatusBadge from "@/components/domain/StatusBadge";
import { Link } from "@/i18n/navigation";
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
  detailsHref,
}: {
  features: MapFeatureDto[];
  selectedId: string | null;
  onSelect: (landId: string) => void;
  /** Where "View details" goes; default is the signed-in result page. */
  detailsHref?: (p: MapFeatureDto["properties"]) => string;
}) {
  const t = useTranslations("map");
  const tu = useTranslations("result.units");
  return (
    <section aria-labelledby="map-list-title" className="flex flex-col gap-2">
      <h2 id="map-list-title" className="text-lg font-semibold text-ink">
        {t("listTitle")}
      </h2>
      <ul className="flex flex-col gap-2">
        {features.map((f) => {
          const p = f.properties;
          const au = p.area_unit ?? "";
          const unit = tu.has(au) ? tu(au) : au;
          const href = detailsHref?.(p) ?? `/verify/result?land_id=${encodeURIComponent(p.land_id)}`;
          return (
            <li
              key={p.land_id}
              data-testid={`parcel-${p.land_id}`}
              aria-current={selectedId === p.land_id ? "true" : undefined}
              data-risk={p.risk_level}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-l-4 border-line bg-surface p-3 shadow-card transition-shadow hover:shadow-raised ${LEFT[p.risk_level ?? ""] ?? "border-l-pending"} ${selectedId === p.land_id ? "ring-2 ring-primary/50" : ""}`}
            >
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <MapPin aria-hidden="true" className="h-4 w-4 text-primary" />
                {p.land_id}
              </span>
              <span className="text-sm text-ink-muted">
                {t("popup.dag")} {p.dag_no} · {t("popup.khatian")} {p.khatian_no}
                {p.area !== undefined && ` · ${p.area} ${unit}`}
              </span>
              {p.status && <StatusBadge code={p.status} />}
              {p.risk_level && <RiskIndicator level={p.risk_level} />}
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
                  href={href}
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
