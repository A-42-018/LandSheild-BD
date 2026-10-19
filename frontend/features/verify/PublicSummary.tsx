"use client";
import { useLocale, useTranslations } from "next-intl";
import { EyeOff, Gavel, LogIn, MapPinned, Route, Scale, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import RiskIndicator from "@/components/domain/RiskIndicator";
import StatusBadge from "@/components/domain/StatusBadge";
import { Link } from "@/i18n/navigation";
import { districtName, upazilaName } from "@/lib/geo";
import { localDigits } from "@/lib/intl-locale";
import { formatArea } from "@/features/result/format";
import { SheetWarning, useSurveyLabel, useUnitLabel } from "@/features/result/LandInfoCard";

/** GET /public/lands/search (U2.1): owners arrive already masked ("R*** U***"); nothing here can unmask them. */
export interface PublicLandSummary {
  land_id: string;
  district: string;
  upazila: string;
  mouza: string;
  khatian_no: string;
  dag_no: string;
  area: number;
  area_unit: string;
  status: string;
  risk_level: string;
  owner_count: number;
  owners_masked: string[];
  open_case: boolean;
  counts: { active_encumbrances: number; pending_mutations: number };
  survey_type?: string | null;
  jl_no?: string | null;
  map_sheet_no?: string | null;
  warnings?: string[];
}

/** U2.2: what a visitor sees without signing in: risk, place, owner count with masked names, case yes/no.
 *  Full owners, history and the PDF report stay behind sign-in; the button brings them straight back to this parcel. */
export default function PublicSummary({ data }: { data: PublicLandSummary }) {
  const t = useTranslations("verify.summary");
  const tr = useTranslations("result");
  const locale = useLocale();
  const unit = useUnitLabel();
  const survey = useSurveyLabel();
  const n = (v: number) => localDigits(v, locale);
  const place = [districtName(data.district, locale), upazilaName(data.district, data.upazila, locale), data.mouza].join(" · ");
  const full = `/verify/result?land_id=${encodeURIComponent(data.land_id)}`;
  const rows: [string, React.ReactNode, LucideIcon][] = [
    ...(data.survey_type ? ([[tr("survey"), survey(data.survey_type), MapPinned]] as [string, React.ReactNode, LucideIcon][]) : []),
    ...(data.jl_no ? ([[tr("jlNo"), localDigits(data.jl_no, locale), MapPinned]] as [string, React.ReactNode, LucideIcon][]) : []),
    ...(data.map_sheet_no ? ([[tr("sheetNo"), localDigits(data.map_sheet_no, locale), MapPinned]] as [string, React.ReactNode, LucideIcon][]) : []),
    [tr("khatian"), localDigits(data.khatian_no, locale), MapPinned],
    [tr("dag"), localDigits(data.dag_no, locale), MapPinned],
    [tr("area"), formatArea(data.area, data.area_unit, locale, unit(data.area_unit)), Scale],
    [tr("status"), <StatusBadge key="s" code={data.status} />, Route],
    [t("openCase"), data.open_case ? t("yes") : t("no"), Gavel],
    [t("encumbrances"), n(data.counts.active_encumbrances), Gavel],
    [t("pendingMutations"), n(data.counts.pending_mutations), Route],
  ];
  return (
    <Card title={t("title")} variant="record" data-testid="public-summary" aria-live="polite">
      <SheetWarning warnings={data.warnings} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xl font-bold text-ink">
            <span className="sr-only">{tr("landId")}: </span>
            {data.land_id}
          </p>
          <p className="text-sm text-ink-muted">{place}</p>
        </div>
        <RiskIndicator level={data.risk_level} size="lg" />
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line/70 bg-surface/60 p-3 sm:col-span-2">
          <dt className="flex items-center gap-2 text-sm text-ink-muted">
            <Users aria-hidden="true" className="h-4 w-4" />
            {t("owners", { count: data.owner_count, n: n(data.owner_count) })}
          </dt>
          <dd className="mt-1 font-medium text-ink">
            {data.owners_masked.length ? (
              <ul data-testid="masked-owners">
                {data.owners_masked.map((name, i) => (
                  <li key={`${name}-${i}`}>{name}</li>
                ))}
              </ul>
            ) : (
              tr("noOwners")
            )}
          </dd>
        </div>
        {rows.map(([k, v, Icon]) => (
          <div key={k} className="rounded-xl border border-line/70 bg-surface/60 p-3">
            <dt className="flex items-center gap-2 text-sm text-ink-muted">
              <Icon aria-hidden="true" className="h-4 w-4" />
              {k}
            </dt>
            <dd className="mt-1 font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 flex items-start gap-2 text-sm text-ink-muted">
        <EyeOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        {t("maskNote")}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href={`/login?next=${encodeURIComponent(full)}`}
          data-testid="summary-login"
          className="inline-flex min-h-touch items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-fg shadow-[0_6px_16px_-6px_rgb(var(--primary)/0.55)] hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <LogIn aria-hidden="true" className="h-4 w-4" />
          {t("loginForFull")}
        </Link>
        <Link href="/signup" className="inline-flex min-h-touch items-center text-sm font-medium text-link underline">
          {t("noAccount")}
        </Link>
      </div>
    </Card>
  );
}
