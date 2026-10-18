"use client";
import { useLocale, useTranslations } from "next-intl";
import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { RISK_TONE } from "@/components/domain/RiskIndicator";
import { evidenceKey, evidenceValues } from "./evidence";
import type { Evidence } from "./types";

const ICON = { HIGH: AlertOctagon, MEDIUM: AlertTriangle, INFO: Info } as const;
const EDGE = { HIGH: "border-l-critical", MEDIUM: "border-l-review", INFO: "border-l-pending" } as const;

// client-messages: risk.evidence result.units result.unknownDate (evidenceKey, evidenceValues)
export default function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const t = useTranslations();
  const locale = useLocale();
  if (evidence.length === 0) return <p className="text-sm text-ink-muted">{t("risk.noEvidence")}</p>;
  return (
    <ul aria-label={t("risk.evidenceTitle")} className="flex flex-col gap-2">
      {evidence.map((e, i) => {
        const known = evidenceKey(e.code) !== "risk.evidence.UNKNOWN";
        const text = t(evidenceKey(e.code), evidenceValues(e, t as never, locale));
        const sev = e.severity === "INFO" ? "pending" : (RISK_TONE[e.severity] ?? "pending");
        const sk = (["HIGH", "MEDIUM", "INFO"].includes(e.severity) ? e.severity : "INFO") as keyof typeof ICON;
        const Icon = ICON[sk];
        return (
          <li
            key={`${e.code}-${i}`}
            data-code={e.code}
            className={`glass-card flex flex-wrap items-start gap-3 border-l-[3px] px-3 py-3 ${EDGE[sk]}`}
          >
            <Badge tone={sev} icon={<Icon />}>{t(`risk.severity.${["HIGH", "MEDIUM", "INFO"].includes(e.severity) ? e.severity : "INFO"}`)}</Badge>
            <span className="min-w-0 flex-1 basis-48 text-sm text-ink">{known ? text : `${text} (${e.code})`}</span>
          </li>
        );
      })}
    </ul>
  );
}
