import { BadgeCheck, FileClock, Info, Percent, Search, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PageHeader from "@/components/PageHeader";
import { ScaleArt } from "@/features/landing/Illustrations";
import { DIVISIONS } from "@/lib/geo";
import { formatDate, intlLocale } from "@/lib/intl-locale";
import { BANDS, DIVISION_ROWS, SAMPLE_UPDATED, TILE_POSITION, bandOf, totals, type BandId, type DivisionId } from "./sample";

const SECTION = "glass-card p-4 sm:p-6";
const KPIS: { key: "verifications" | "applications" | "settled" | "settledShare"; chip: string; Icon: LucideIcon }[] = [
  { key: "verifications", chip: "bg-primary-soft text-primary", Icon: Search },
  { key: "applications", chip: "bg-review-soft text-review", Icon: FileClock },
  { key: "settled", chip: "bg-verified-soft text-verified", Icon: BadgeCheck },
  { key: "settledShare", chip: "bg-primary-soft text-primary", Icon: Percent },
];
/** One hue (brand green), light → dark; text tokens chosen so each step keeps ≥ 4.5 : 1 in light, dark and high-contrast themes. */
const BAND_CLASS: Record<BandId, string> = {
  low: "border border-primary/30 bg-primary-soft text-ink",
  mid: "border border-primary/40 bg-primary/35 text-ink",
  high: "border border-primary bg-primary text-primary-fg",
};
const ROW_START = ["", "row-start-1", "row-start-2", "row-start-3"];
const COL_START = ["", "col-start-1", "col-start-2", "col-start-3"];

/** Public তথ্যচিত্র (U4.3): KPI tiles, a schematic division tile map and the same figures as a table. Sample data only. */
export default function StatisticsPage() {
  const t = useTranslations("statistics");
  const locale = useLocale();
  const n = new Intl.NumberFormat(intlLocale(locale));
  const pct = new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 0 });
  const name = (id: DivisionId) => {
    const d = DIVISIONS.find((x) => x.value === id);
    return d ? (locale === "bn" ? d.bn : d.en) : id;
  };
  const sum = totals();
  const updated = formatDate(SAMPLE_UPDATED, locale, "");
  const value = (k: (typeof KPIS)[number]["key"]) => (k === "settledShare" ? pct.format(sum.settledShare) : n.format(sum[k]));
  const bandLabel = (i: number) => {
    const b = BANDS[i];
    const next = BANDS[i + 1];
    if (i === 0) return t("bands.below", { n: n.format(next.min) });
    if (!next) return t("bands.atLeast", { n: n.format(b.min) });
    return t("bands.between", { from: n.format(b.min), to: n.format(next.min - 1) });
  };

  return (
    <article className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader title={t("title")} purpose={t("purpose")} art={<ScaleArt />} meta={[t("updated", { date: updated }), t("sampleBadge")]} />

      <p role="note" data-testid="sample-notice" className="flex items-start gap-3 rounded-card border border-gold bg-gold-soft p-4 text-brand-deep">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <strong className="font-semibold">{t("sampleTitle")}</strong> {t("sampleBody")}{" "}
          <Link href="/data-sources" className="font-semibold underline underline-offset-2">{t("sourcesLink")}</Link>
        </span>
      </p>

      <section aria-labelledby="stats-kpi" className="flex flex-col gap-3">
        <h2 id="stats-kpi" className="section-title text-xl font-semibold text-ink">{t("kpiTitle")}</h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-3">
          {KPIS.map(({ key, chip, Icon }) => (
            <li key={key} data-testid={`stat-${key}`} className="glass-card flex h-full min-w-0 flex-col items-start gap-3 p-4">
              <span aria-hidden="true" className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chip}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink-muted">{t(`kpi.${key}`)}</p>
                <p className="font-display text-3xl font-bold leading-tight text-ink">{value(key)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stats-division" className={`${SECTION} flex flex-col gap-5`}>
        <div>
          <h2 id="stats-division" className="section-title text-xl font-semibold text-ink">{t("divisionTitle")}</h2>
          <p className="mt-2 text-ink-muted">{t("divisionIntro")}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <figure aria-labelledby="stats-map-caption" className="flex flex-col gap-3" data-testid="division-map">
            <ul className="grid grid-cols-3 grid-rows-3 gap-1.5">
              {DIVISION_ROWS.map((r) => {
                const pos = TILE_POSITION[r.id];
                return (
                  <li
                    key={r.id}
                    data-band={bandOf(r.verifications)}
                    className={`flex min-h-20 min-w-0 flex-col justify-center rounded-lg p-2 text-center ${ROW_START[pos.row]} ${COL_START[pos.col]} ${BAND_CLASS[bandOf(r.verifications)]}`}
                  >
                    <span className="block text-sm font-semibold">{name(r.id)}</span>
                    <span className="block font-display text-lg font-bold">{n.format(r.verifications)}</span>
                  </li>
                );
              })}
            </ul>
            <figcaption id="stats-map-caption" className="text-sm text-ink-muted">{t("mapCaption")}</figcaption>
            <ul aria-label={t("legend")} className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
              {BANDS.map((b, i) => (
                <li key={b.id} className="flex items-center gap-2">
                  <span aria-hidden="true" className={`inline-block h-4 w-6 rounded ${BAND_CLASS[b.id]}`} />
                  {bandLabel(i)}
                </li>
              ))}
            </ul>
          </figure>

          <div role="region" aria-labelledby="stats-table-caption" tabIndex={0} className="overflow-x-auto rounded-card border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            <table className="w-full border-collapse text-left text-sm" data-testid="division-table">
              <caption id="stats-table-caption" className="px-2 py-2 text-left font-semibold text-ink sm:px-3">{t("tableCaption")}</caption>
              <thead className="bg-primary-soft/70 text-ink">
                <tr>
                  <th scope="col" className="px-2 py-2.5 sm:px-3 font-semibold">{t("col.division")}</th>
                  <th scope="col" className="px-2 py-2.5 sm:px-3 text-right font-semibold">{t("kpi.verifications")}</th>
                  <th scope="col" className="px-2 py-2.5 sm:px-3 text-right font-semibold">{t("kpi.applications")}</th>
                  <th scope="col" className="px-2 py-2.5 sm:px-3 text-right font-semibold">{t("col.settled")}</th>
                </tr>
              </thead>
              <tbody>
                {DIVISION_ROWS.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <th scope="row" className="px-2 py-2.5 sm:px-3 font-medium text-ink">{name(r.id)}</th>
                    <td className="px-2 py-2.5 sm:px-3 text-right tabular-nums text-ink">{n.format(r.verifications)}</td>
                    <td className="px-2 py-2.5 sm:px-3 text-right tabular-nums text-ink">{n.format(r.applications)}</td>
                    <td className="px-2 py-2.5 sm:px-3 text-right tabular-nums text-ink">{n.format(r.settled)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold">
                  <th scope="row" className="px-2 py-2.5 sm:px-3 text-ink">{t("col.total")}</th>
                  <td className="px-2 py-2.5 sm:px-3 text-right tabular-nums text-ink">{n.format(sum.verifications)}</td>
                  <td className="px-2 py-2.5 sm:px-3 text-right tabular-nums text-ink">{n.format(sum.applications)}</td>
                  <td className="px-2 py-2.5 sm:px-3 text-right tabular-nums text-ink">{n.format(sum.settled)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </article>
  );
}
