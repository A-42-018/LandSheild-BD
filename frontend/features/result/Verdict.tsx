"use client";
import { useTranslations } from "next-intl";
import { Flag, Gavel, ListChecks, Route } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Card, ErrorState, LoadingState } from "@/components/ui";
import RiskIndicator, { RISK_TONE, riskLevelOf } from "@/components/domain/RiskIndicator";
import type { RiskAssessment } from "@/features/risk/types";
import { hasOpenCase, nextSteps } from "./nextSteps";

const ACCENT = { verified: "verified", review: "review", critical: "critical", pending: "primary" } as const;

/** U2.4: the answer first. Big risk badge → three plain lines → "what to do now" (1–3 steps). Details live in the sections below. */
export default function Verdict({ risk }: { risk: Pick<UseQueryResult<RiskAssessment>, "data" | "isPending" | "isError" | "refetch"> }) {
  const t = useTranslations("result.verdict");
  const tr = useTranslations("risk");
  if (risk.isPending) return <LoadingState />;
  if (risk.isError || !risk.data) {
    return (
      <Card title={t("title")} icon={<ListChecks />} data-testid="verdict">
        <div className="flex flex-col gap-4">
          <ErrorState message={tr("loadError")} onRetry={() => void risk.refetch()} />
          <Steps ids={nextSteps(null, [])} />
        </div>
      </Card>
    );
  }
  const data = risk.data;
  const level = riskLevelOf(data.risk_level);
  const key = level ?? "UNKNOWN";
  const codes = data.evidence.map((e) => e.code);
  const accent = ACCENT[level ? RISK_TONE[level] : "pending"];
  const lines: [string, React.ReactNode, typeof Flag][] = [
    ["level", t(`level.${key}`), ListChecks],
    ["signs", t("signs", { count: data.evidence.length }), Flag],
    ["cases", t(hasOpenCase(codes) ? "casesSome" : "casesNone"), Gavel],
  ];
  return (
    <Card title={t("title")} icon={<Route />} accent={accent} data-testid="verdict">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <RiskIndicator level={data.risk_level} size="lg" data-testid="verdict-badge" />
          <p className="font-display text-xl font-bold text-ink sm:text-2xl">{t(`headline.${key}`)}</p>
        </div>
        <ul aria-label={t("summaryLabel")} className="flex flex-col gap-2" data-testid="verdict-summary">
          {lines.map(([id, text, Icon]) => (
            <li key={id} className="flex items-start gap-3 text-ink">
              <Icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <Steps ids={nextSteps(data.risk_level, codes)} />
      </div>
    </Card>
  );
}

function Steps({ ids }: { ids: string[] }) {
  const t = useTranslations("result.verdict");
  return (
    <div data-testid="next-steps" className="rounded-xl border border-primary/20 bg-primary-soft p-4">
      <h2 className="mb-2 text-base font-bold text-ink">{t("stepsTitle")}</h2>
      <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-ink marker:font-semibold marker:text-primary">
        {ids.map((id) => (
          <li key={id}>{t(`steps.${id}`)}</li>
        ))}
      </ol>
    </div>
  );
}
