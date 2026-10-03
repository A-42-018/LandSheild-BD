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

export default function LandInfoCard({ land }: { land: LandInfo }) {
  const t = useTranslations("result");
  const locale = useLocale();
  const unit = useUnitLabel();
  const rows: [string, React.ReactNode, LucideIcon][] = [
    [t("landId"), land.land_id, Hash],
    [t("district"), land.district, MapPin],
    [t("upazila"), land.upazila, MapPin],
    [t("mouza"), land.mouza, MapIcon],
    [t("khatian"), land.khatian_no, Compass],
    [t("dag"), land.dag_no, Compass],
    [t("area"), formatArea(land.area, land.area_unit, locale, unit(land.area_unit)), Ruler],
    [t("status"), <StatusBadge key="s" code={land.status} />, ShieldCheck],
  ];
  return (
    <Card title={t("landInfo")} icon={<Landmark />} accent="primary">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v, Icon]) => (
          <div key={k} className="rounded-lg bg-surface-muted/60 px-3 py-2">
            <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Icon aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              {k}
            </dt>
            <dd className="font-medium text-ink">{v}</dd>
          </div>
        ))}
        <div className="rounded-lg bg-surface-muted/60 px-3 py-2 sm:col-span-2">
          <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Users aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
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
