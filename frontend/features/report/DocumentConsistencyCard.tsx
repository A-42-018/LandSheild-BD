"use client";
import { useTranslations } from "next-intl";
import { FileCheck2 } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import EvidenceList from "@/features/risk/EvidenceList";
import type { DocumentConsistency } from "./types";

export default function DocumentConsistencyCard({ data }: { data: DocumentConsistency }) {
  const t = useTranslations("report");
  const ts = useTranslations("status");
  const known = t.has(`docStatus.${data.status}`);
  const entries = Object.entries(data.by_status);
  return (
    <Card title={t("docConsistency")} icon={<FileCheck2 />} data-testid="doc-consistency">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={data.status === "NO_ISSUES" ? "verified" : "review"}>
            {known ? t(`docStatus.${data.status}`) : data.status}
          </Badge>
          <span className="text-sm text-ink-muted">
            {t("totalDocuments")}: {data.total_documents}
          </span>
        </div>
        {entries.length > 0 && (
          <ul aria-label={t("documentsByStatus")} className="flex flex-wrap gap-2 text-sm text-ink-muted">
            {entries.map(([code, n]) => (
              <li key={code}>
                {ts.has(code) ? ts(code) : code}: {n}
              </li>
            ))}
          </ul>
        )}
        {data.indicators.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("noIndicators")}</p>
        ) : (
          <EvidenceList evidence={data.indicators} />
        )}
      </div>
    </Card>
  );
}
