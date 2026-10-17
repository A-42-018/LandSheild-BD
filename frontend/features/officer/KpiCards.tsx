"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertOctagon, BadgeCheck, Bell, CalendarClock, CheckCheck, Database, FileClock, Gavel, Hourglass, Link2, Link2Off, type LucideIcon,
} from "lucide-react";
import { ErrorState, LoadingState } from "@/components/ui";
import { useOfficerStats } from "./useOfficerData";
import type { OfficerStats } from "./types";
import { intlLocale } from "@/lib/intl-locale";

type NumKey = "total_records" | "pending_review" | "high_risk" | "verified" | "open_alerts" | "pending_mutations" | "active_encumbrances" | "settled_this_month" | "hearings_upcoming";

/** Glass tiles (UI v2): icon chip carries the status colour; the grid fills by rem width, so it also holds when the browser font size is raised. */
const KPIS: { key: NumKey; chip: string; Icon: LucideIcon }[] = [
  { key: "total_records", chip: "bg-primary-soft text-primary", Icon: Database },
  { key: "pending_review", chip: "bg-review-soft text-review", Icon: Hourglass },
  { key: "high_risk", chip: "bg-critical-soft text-critical", Icon: AlertOctagon },
  { key: "verified", chip: "bg-verified-soft text-verified", Icon: BadgeCheck },
  { key: "open_alerts", chip: "bg-review-soft text-review", Icon: Bell },
  { key: "pending_mutations", chip: "bg-primary-soft text-primary", Icon: FileClock },
  { key: "active_encumbrances", chip: "bg-critical-soft text-critical", Icon: Gavel },
  { key: "settled_this_month", chip: "bg-verified-soft text-verified", Icon: CheckCheck },
  { key: "hearings_upcoming", chip: "bg-review-soft text-review", Icon: CalendarClock },
];
const TILE = "glass-card flex h-full min-w-0 flex-col items-start gap-3 p-4";

function Chip({ cls, Icon }: { cls: string; Icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cls}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export default function KpiCards() {
  const t = useTranslations("officer.kpi");
  const locale = useLocale();
  const q = useOfficerStats();

  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) {
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  }
  const fmt = new Intl.NumberFormat(intlLocale(locale));
  const s: OfficerStats = q.data;
  const intact = s.ledger_status === "INTACT";
  return (
    <ul aria-label={t("title")} className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10.5rem),1fr))] gap-3">
      {KPIS.map(({ key, chip, Icon }) => (
        <li key={key}>
          <div className={TILE} data-testid={`kpi-${key}`}>
            <Chip cls={chip} Icon={Icon} />
            <div className="min-w-0 [overflow-wrap:normal]">
              <p className="text-sm text-ink-muted">{t(key)}</p>
              <p className="font-display text-3xl font-bold leading-tight text-ink">{fmt.format(s[key] ?? 0)}</p>
            </div>
          </div>
        </li>
      ))}
      <li>
        <div className={TILE} data-testid="kpi-ledger" data-state={s.ledger_status}>
          <Chip cls={intact ? "bg-verified-soft text-verified" : "bg-critical-soft text-critical"} Icon={intact ? Link2 : Link2Off} />
          <div className="min-w-0 [overflow-wrap:normal]">
            <p className="text-sm text-ink-muted">{t("ledger")}</p>
            <p className={`font-display text-2xl font-bold ${intact ? "text-verified" : "text-critical"}`}>
              {intact ? t("ledgerIntact") : t("ledgerBroken")}
            </p>
            <p className="text-xs text-ink-muted">{t("ledgerEntries", { count: s.ledger_entries })}</p>
          </div>
        </div>
      </li>
    </ul>
  );
}
