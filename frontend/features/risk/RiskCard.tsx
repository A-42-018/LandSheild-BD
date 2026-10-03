"use client";
import { useLocale, useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import Card from "@/components/ui/Card";
import RiskBadge from "@/components/domain/RiskBadge";
import { formatDate } from "@/features/result/format";
import EvidenceList from "./EvidenceList";
import type { RiskAssessment } from "./types";

const BAR: Record<string, string> = { LOW: "bg-verified", MEDIUM: "bg-review", HIGH: "bg-critical" };
const TEXT: Record<string, string> = { LOW: "text-verified", MEDIUM: "text-review", HIGH: "text-critical" };
const ACCENT = { LOW: "verified", MEDIUM: "review", HIGH: "critical" } as const;

export default function RiskCard({ risk }: { risk: RiskAssessment }) {
  const t = useTranslations();
  const locale = useLocale();
  const score = Math.max(0, Math.min(100, risk.overall_score));
  const mlScore = typeof risk.ml_score === "number" ? Math.max(0, Math.min(1, risk.ml_score)) : null;
  const mlEvidence = risk.evidence.find((e) => e.code === "ML_ANOMALY");
  const mlPoints = typeof mlEvidence?.params?.points === "number" ? (mlEvidence.params.points as number) : 0;
  return (
    <Card
      title={t("result.riskTitle")}
      icon={<ShieldAlert />}
      accent={ACCENT[risk.risk_level as keyof typeof ACCENT] ?? "primary"}
      data-testid="risk-section"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-muted">{t("risk.score")}</span>
          <span data-testid="risk-score" className={`text-4xl font-bold ${TEXT[risk.risk_level] ?? "text-ink"}`}>
            {score}
            <span className="text-sm font-normal text-ink-muted"> / 100</span>
          </span>
          <RiskBadge level={risk.risk_level} />
        </div>
        <div
          role="meter"
          aria-label={t("risk.score")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          className="relative h-3 w-full overflow-hidden rounded-full bg-surface-muted ring-1 ring-line"
        >
          <div className={`h-full ${BAR[risk.risk_level] ?? "bg-pending"}`} style={{ width: `${score}%` }} />
          <span aria-hidden="true" className="absolute inset-y-0 left-[30%] w-px bg-ink/40" />
          <span aria-hidden="true" className="absolute inset-y-0 left-[60%] w-px bg-ink/40" />
        </div>
        {mlScore !== null && (
          <div data-testid="risk-ml" className="rounded-lg border border-primary/20 bg-primary-soft px-3 py-2 text-sm text-ink">
            <p>{t("risk.ml.line", { percent: Math.round(mlScore * 100) })}</p>
            <p>{t("risk.ml.points", { points: mlPoints })}</p>
          </div>
        )}
        <EvidenceList evidence={risk.evidence} />
        <p className="text-xs text-ink-muted">{t("risk.assessedOn", { date: formatDate(risk.assessed_at, locale, "") })}</p>
      </div>
    </Card>
  );
}
