"use client";
import {
  AlertTriangle, Check, CheckCircle2, ClipboardCheck, HandHeart, HelpCircle, Home, Printer, Radar, Scale, ScrollText,
  SearchCheck, ShieldAlert, ShieldCheck, Trees, Users, XCircle, type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { Link } from "@/i18n/navigation";
import { contours } from "@/features/landing/Backdrop";
import { localDigits } from "@/lib/intl-locale";
import type { CheckStatus, PrePurchaseDto } from "./types";

const STATUS_ICON: Record<CheckStatus, LucideIcon> = {
  PASS: Check,
  WARN: AlertTriangle,
  FAIL: XCircle,
  UNKNOWN: HelpCircle,
};
/** A picture for what each row is about (the status is shown separately, on the corner badge and the pill). */
const TOPIC_ICON: Record<string, LucideIcon> = {
  SELLER_MATCHES_OWNER: Users,
  MUTATION_UP_TO_DATE: Home,
  NO_PENDING_CASE: Scale,
  NOT_KHAS_OR_ACQUIRED: Trees,
  NO_OPEN_RISK_INDICATORS: Radar,
  DOCUMENT_AUTHENTIC: ScrollText,
};
/** Row surface: green for clear, amber / red for indicators, quiet grey for what could not be checked. */
const ROW: Record<CheckStatus, string> = {
  PASS: "border-verified/25 bg-verified-soft/55 before:bg-verified",
  WARN: "border-review/30 bg-review-soft/60 before:bg-review",
  FAIL: "border-critical/30 bg-critical-soft/60 before:bg-critical",
  UNKNOWN: "border-line/90 bg-surface-muted/70 before:bg-ink-muted/40",
};
const TOPIC_TILE: Record<CheckStatus, string> = {
  PASS: "border-verified/25 bg-surface text-verified",
  WARN: "border-review/30 bg-surface text-review",
  FAIL: "border-critical/30 bg-surface text-critical",
  UNKNOWN: "border-line bg-surface text-ink-muted",
};
const CORNER: Record<CheckStatus, string> = {
  PASS: "bg-verified",
  WARN: "bg-review",
  FAIL: "bg-critical",
  UNKNOWN: "bg-ink-muted",
};
/** Clear = the site's gold seal; the rest use the status colours. */
const PILL: Record<CheckStatus, string> = {
  PASS: "border-gold/70 bg-gradient-to-b from-gold-soft to-gold text-brand-deep shadow-[0_2px_8px_-3px_rgb(var(--gold)/0.9)]",
  WARN: "border-review/40 bg-review-soft text-review",
  FAIL: "border-critical/40 bg-critical-soft text-critical",
  UNKNOWN: "border-line bg-surface text-ink-muted",
};
const TILE: Record<CheckStatus, { icon: LucideIcon; box: string; chip: string }> = {
  PASS: {
    icon: HandHeart,
    box: "border-gold/60 bg-gradient-to-br from-brand-deep-2 to-brand-deep text-white/95",
    chip: "border-white/20 bg-white/10 text-gold-soft",
  },
  WARN: { icon: AlertTriangle, box: "border-review/40 bg-review-soft text-ink", chip: "border-review/30 bg-surface text-review" },
  FAIL: { icon: ShieldAlert, box: "border-critical/40 bg-critical-soft text-ink", chip: "border-critical/30 bg-surface text-critical" },
  UNKNOWN: { icon: SearchCheck, box: "border-line bg-gradient-to-br from-surface to-surface-muted text-ink", chip: "border-line bg-surface text-ink-muted" },
};
/** Indicators first, then the clear items, then what could not be checked. */
const ORDER: CheckStatus[] = ["FAIL", "WARN", "PASS", "UNKNOWN"];

const BANNER_RINGS = contours([{ cx: 520, cy: 40, rings: 6, step: 22, seed: 1.4 }]);

export default function CheckResult({ data }: { data: PrePurchaseDto }) {
  const t = useTranslations("check");
  const locale = useLocale();
  const clear = data.verdict === "NO_INDICATORS";
  const rows = [...data.rows].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const counts = ORDER.map((s) => [s, data.rows.filter((r) => r.status === s).length] as const).filter(([, n]) => n > 0);
  const Verdict = clear ? ShieldCheck : ShieldAlert;

  return (
    <section className="glass-card overflow-hidden" data-testid="check-result" data-accent={clear ? "verified" : "critical"}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
        <h2 className="flex items-center gap-3 text-base font-semibold text-ink">
          <span aria-hidden="true" className="icon-tile !h-9 !w-9 [&>svg]:h-5 [&>svg]:w-5"><ClipboardCheck /></span>
          {t("resultTitle")}
        </h2>
        <span className="rounded-full border border-gold/60 bg-gold-soft/30 px-3 py-1 font-mono text-sm font-semibold text-ink">{data.land_id}</span>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {/* verdict: the deep-green brand band with a gold rim (red when indicators were found) */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border-2 p-4 shadow-[0_14px_30px_-18px_rgb(var(--shadow)/0.8)] sm:p-5",
            clear
              ? "border-gold/70 bg-gradient-to-br from-brand-deep-2 to-brand-deep"
              : "border-critical/60 bg-gradient-to-br from-critical to-[rgb(110_18_24)]",
          )}
        >
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-gold" viewBox="0 0 600 140" preserveAspectRatio="xMidYMid slice" fill="none">
            <path d={BANNER_RINGS} stroke="currentColor" strokeOpacity="0.12" />
          </svg>
          <span aria-hidden="true" className="pointer-events-none absolute inset-1.5 rounded-xl border border-gold/25" />
          <div className="relative flex items-center gap-4">
            <span
              aria-hidden="true"
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold/70 bg-gradient-to-b from-gold-soft to-gold text-brand-deep shadow-[0_8px_18px_-8px_rgb(0_0_0/0.6)] sm:h-16 sm:w-16"
            >
              <Verdict className="h-8 w-8 sm:h-9 sm:w-9" />
            </span>
            <p role="status" className="font-display text-lg font-bold leading-snug text-white/95 sm:text-xl" data-testid="check-verdict">
              {t(clear ? "verdict.clear" : "verdict.flagged")}
            </p>
          </div>
        </div>

        {/* one tile per status that occurs: big number, what it means */}
        <ul aria-label={t("summary")} className={cn("grid gap-3", counts.length > 1 && "grid-cols-2", counts.length > 2 && "md:grid-cols-4")}>
          {counts.map(([s, n]) => {
            const tile = TILE[s];
            const Icon = tile.icon;
            return (
              <li key={s} data-testid={`check-tile-${s}`} className={cn("flex items-center gap-3 rounded-2xl border p-3 shadow-[0_6px_18px_-12px_rgb(var(--shadow)/0.5)]", tile.box)}>
                <span aria-hidden="true" className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", tile.chip)}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-lg font-bold leading-tight">
                    {localDigits(n, locale)} {t(`tiles.${s}`)}
                  </span>
                  <span className="block text-xs opacity-80">({t(`status.${s}`)})</span>
                </span>
              </li>
            );
          })}
        </ul>

        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const Topic = TOPIC_ICON[r.code] ?? CheckCircle2;
            const StatusIcon = STATUS_ICON[r.status];
            const key = `rows.${r.code}.${r.status}`;
            const values = Object.fromEntries(Object.entries(r.detail ?? {}).map(([k, v]) => [k, String(v)]));
            return (
              <li
                key={r.code}
                data-testid={`check-row-${r.code}`}
                data-status={r.status}
                className={cn(
                  "relative flex items-start gap-3 overflow-hidden rounded-xl border p-3 pl-4 shadow-[0_4px_14px_-10px_rgb(var(--shadow)/0.5)] sm:p-4 sm:pl-5",
                  "before:absolute before:inset-y-0 before:left-0 before:w-1",
                  ROW[r.status],
                )}
              >
                <span aria-hidden="true" className={cn("relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", TOPIC_TILE[r.status])}>
                  <Topic className="h-6 w-6" strokeWidth={1.6} />
                  <span className={cn("absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-surface ring-2 ring-surface", CORNER[r.status])}>
                    <StatusIcon className="h-3 w-3" strokeWidth={3} />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <p className="font-semibold text-ink">{t(`rows.${r.code}.title`)}</p>
                    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-3 py-0.5 text-xs font-bold", PILL[r.status])}>
                      {t(`status.${r.status}`)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">{t.has(key) ? t(key, values) : t(`fallback.${r.status}`)}</p>
                  {r.code === "DOCUMENT_AUTHENTIC" && (
                    <Link href="/verify-document" className="mt-1.5 inline-block text-sm font-semibold text-primary underline" data-testid="check-doc-link">
                      {t("docLink")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-3 border-t border-line/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">{t("disclaimer")}</p>
          <Button variant="secondary" size="sm" icon={<Printer />} onClick={() => window.print()} className="shrink-0 print:hidden">
            {t("print")}
          </Button>
        </div>
      </div>
    </section>
  );
}
