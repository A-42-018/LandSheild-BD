"use client";
import { AlertTriangle, CheckCircle2, HelpCircle, XCircle, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { CheckStatus, PrePurchaseDto } from "./types";

const ICON: Record<CheckStatus, LucideIcon> = {
  PASS: CheckCircle2,
  WARN: AlertTriangle,
  FAIL: XCircle,
  UNKNOWN: HelpCircle,
};
const TONE: Record<CheckStatus, string> = {
  PASS: "text-verified",
  WARN: "text-review",
  FAIL: "text-critical",
  UNKNOWN: "text-ink-muted",
};

export default function CheckResult({ data }: { data: PrePurchaseDto }) {
  const t = useTranslations("check");
  const clear = data.verdict === "NO_INDICATORS";
  return (
    <Card
      title={`${t("resultTitle")} · ${data.land_id}`}
      accent={clear ? "verified" : "critical"}
      data-testid="check-result"
    >
      <p role="status" className="mb-4 font-semibold text-ink" data-testid="check-verdict">
        {t(clear ? "verdict.clear" : "verdict.flagged")}
      </p>
      <ul className="flex flex-col divide-y divide-line">
        {data.rows.map((r) => {
          const Icon = ICON[r.status];
          const key = `rows.${r.code}.${r.status}`;
          const values = Object.fromEntries(Object.entries(r.detail ?? {}).map(([k, v]) => [k, String(v)]));
          return (
            <li key={r.code} data-testid={`check-row-${r.code}`} data-status={r.status} className="flex items-start gap-3 py-3">
              <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${TONE[r.status]}`} />
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {t(`rows.${r.code}.title`)}
                  <span className={`ms-2 text-xs font-semibold ${TONE[r.status]}`}>{t(`status.${r.status}`)}</span>
                </p>
                <p className="text-sm text-ink-muted">{t.has(key) ? t(key, values) : t(`fallback.${r.status}`)}</p>
                {r.code === "DOCUMENT_AUTHENTIC" && (
                  <Link href="/verify-document" className="text-sm font-medium text-primary underline" data-testid="check-doc-link">
                    {t("docLink")}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-ink-muted">{t("disclaimer")}</p>
    </Card>
  );
}
