"use client";
import { useLocale, useTranslations } from "next-intl";
import { Compass, Hash, Landmark, MapPin, Map as MapIcon, Ruler, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { formatArea } from "./format";
import type { LandInfo } from "./types";

export function useUnitLabel() {
  const t = useTranslations("result.units");
  return (u: string) => (t.has(u) ? t(u) : u);
}

/** Record card (roadmap 4.5 item 4): 3 px primary top rule, label muted / value ink, land ID in mono, optional chip top-right. */
export default function LandInfoCard({ land, chip }: { land: LandInfo; chip?: React.ReactNode }) {
  const t = useTranslations("result");
  const locale = useLocale();
  const unit = useUnitLabel();
  const rows: [string, React.ReactNode, LucideIcon][] = [
    [t("landId"), <span key="id" className="font-mono">{land.land_id}</span>, Hash],
    [t("district"), land.district, MapPin],
    [t("upazila"), land.upazila, MapPin],
    [t("mouza"), land.mouza, MapIcon],
    [t("khatian"), land.khatian_no, Compass],
    [t("dag"), land.dag_no, Compass],
    [t("area"), formatArea(land.area, land.area_unit, locale, unit(land.area_unit)), Ruler],
    [t("status"), <StatusBadge key="s" code={land.status} />, ShieldCheck],
  ];
  return (
    <Card title={t("landInfo")} icon={<Landmark />} variant="record">
      {chip && <div className="mb-3 flex justify-end" data-testid="record-chip">{chip}</div>}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v, Icon]) => (
          <div key={k} className="border-b border-line pb-2">
            <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {k}
            </dt>
            <dd className="font-medium text-ink">{v}</dd>
          </div>
        ))}
        <div className="sm:col-span-2">
          <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Users aria-hidden="true" className="h-3.5 w-3.5" />
            {t("currentOwners")}
          </dt>
          <dd className="font-medium text-ink">
            {land.current_owners.length === 0 ? (
              t("noOwners")
            ) : (
              <ul>
                {land.current_owners.map((o, i) => (
                  <li key={`${o.name}-${i}`}>
                    {o.name}
                    {o.father_name && (
                      <span className="font-normal text-ink-muted"> · {t("fatherName")}: {o.father_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
