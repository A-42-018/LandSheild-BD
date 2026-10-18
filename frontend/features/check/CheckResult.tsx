"use client";
import { AlertTriangle, CheckCircle2, HelpCircle, Printer, ShieldAlert, ShieldCheck, XCircle, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Button, Card, type BadgeTone } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { localDigits } from "@/lib/intl-locale";
import type { CheckStatus, PrePurchaseDto } from "./types";

const ICON: Record<CheckStatus, LucideIcon> = {
  PASS: CheckCircle2,
  WARN: AlertTriangle,
  FAIL: XCircle,
  UNKNOWN: HelpCircle,
};
const TILE: Record<CheckStatus, string> = {
  PASS: "bg-verified-soft text-verified",
  WARN: "bg-review-soft text-review",
  FAIL: "bg-critical-soft text-critical",
  UNKNOWN: "bg-pending-soft text-pending",
};
const TONE: Record<CheckStatus, BadgeTone> = {
  PASS: "verified",
  WARN: "review",
  FAIL: "critical",
  UNKNOWN: "pending",
};
/** Indicators first, then the clear items, then what could not be checked. */
const ORDER: CheckStatus[] = ["FAIL", "WARN", "PASS", "UNKNOWN"];

export default function CheckResult({ data }: { data: PrePurchaseDto }) {
  const t = useTranslations("check");
  const locale = useLocale();
  const clear = data.verdict === "NO_INDICATORS";
  const rows = [...data.rows].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const counts = ORDER.map((s) => [s, data.rows.filter((r) => r.status === s).length] as const).filter(([, n]) => n > 0);
  const Verdict = clear ? ShieldCheck : ShieldAlert;
  return (
    <Card
      title={`${t("resultTitle")} · ${data.land_id}`}
      accent={clear ? "verified" : "critical"}
      data-testid="check-result"
    >
      <div className={`mb-4 flex flex-col gap-3 rounded-2xl border p-4 ${clear ? "border-verified/30 bg-verified-soft/60" : "border-critical/30 bg-critical-soft/60"}`}>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface ${clear ? "text-verified" : "text-critical"}`}>
            <Verdict className="h-7 w-7" />
          </span>
          <p role="status" className="font-display text-lg font-bold leading-snug text-ink" data-testid="check-verdict">
            {t(clear ? "verdict.clear" : "verdict.flagged")}
          </p>
        </div>
        <ul aria-label={t("summary")} className="flex flex-wrap gap-2">
          {counts.map(([s, n]) => {
            const Icon = ICON[s];
            return (
              <li key={s}>
                <Badge tone={TONE[s]} icon={<Icon aria-hidden="true" className="h-3.5 w-3.5" />} className="bg-surface/80">
                  {localDigits(n, locale)} {t(`status.${s}`)}
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="flex flex-col divide-y divide-line/70 overflow-hidden rounded-xl border border-line/70 bg-surface/70">
        {rows.map((r) => {
          const Icon = ICON[r.status];
          const key = `rows.${r.code}.${r.status}`;
          const values = Object.fromEntries(Object.entries(r.detail ?? {}).map(([k, v]) => [k, String(v)]));
          return (
            <li key={r.code} data-testid={`check-row-${r.code}`} data-status={r.status} className="flex items-start gap-3 p-3 sm:p-4">
              <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TILE[r.status]}`}><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="font-medium text-ink">{t(`rows.${r.code}.title`)}</p>
                  <Badge tone={TONE[r.status]} dot className="shrink-0">{t(`status.${r.status}`)}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{t.has(key) ? t(key, values) : t(`fallback.${r.status}`)}</p>
                {r.code === "DOCUMENT_AUTHENTIC" && (
                  <Link href="/verify-document" className="mt-1 inline-block text-sm font-medium text-primary underline" data-testid="check-doc-link">
                    {t("docLink")}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-muted">{t("disclaimer")}</p>
        <Button variant="secondary" size="sm" icon={<Printer />} onClick={() => window.print()} className="shrink-0 print:hidden">
          {t("print")}
        </Button>
      </div>
    </Card>
  );
}
