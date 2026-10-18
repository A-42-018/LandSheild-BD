"use client";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import type { ExtractionOut } from "./types";

/** demo + mock results both come from the saved fixtures, so both read "Demo sample". */
const SOURCE_KEY: Record<string, string> = {
  demo: "demo",
  mock: "demo",
  "pdf-text": "pdfText",
  tesseract: "tesseract",
};
const EXTRACTOR_KEY: Record<string, string> = { rules: "rules", claude: "claude", fused: "fused" };

export default function EngineBadge({ data }: { data: ExtractionOut }) {
  const t = useTranslations("review.engine");
  const source = data.ocr_source ? SOURCE_KEY[data.ocr_source] : undefined;
  const extractor = data.extractor ? EXTRACTOR_KEY[data.extractor] : undefined;
  if (!source && !extractor) return null;
  const warnings = (data.warnings ?? []).filter((w) => t.has(`warnings.${w.split(":")[0]}`));
  return (
    <div data-testid="engine-badge" className="flex flex-col gap-1 text-xs text-ink-muted">
      <div className="flex flex-wrap items-center gap-2">
        {source && (
          <Badge tone={source === "demo" ? "pending" : "verified"} data-testid="badge-source" data-source={data.ocr_source}>
            {t("source")}: {t(`sources.${source}`)}
          </Badge>
        )}
        {extractor && (
          <Badge tone={extractor === "claude" ? "review" : "pending"} data-testid="badge-extractor" data-extractor={data.extractor}>
            {t("extractor")}: {t(`extractors.${extractor}`)}
            {extractor === "claude" && data.model ? ` (${data.model})` : ""}
          </Badge>
        )}
      </div>
      <p data-testid="engine-note">{t("note")}</p>
      {warnings.map((w) => (
        <p key={w} role="status" data-testid={`warning-${w.split(":")[0]}`} className="text-review">
          {t(`warnings.${w.split(":")[0]}`)}
        </p>
      ))}
    </div>
  );
}
