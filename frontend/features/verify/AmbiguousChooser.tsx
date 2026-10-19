"use client";
import { useTranslations } from "next-intl";
import { Layers } from "lucide-react";
import { Card } from "@/components/ui";

/** One row of `details.candidates` (LAND_AMBIGUOUS) or `details.options` (MOUZA_AMBIGUOUS); never has owner data. */
export interface AmbiguityCandidate {
  land_id?: string;
  survey_type?: string | null;
  jl_no?: string | null;
  mouza?: string | null;
}
export type AmbiguityKind = "land" | "mouza";

/** Pull the candidate list out of an ApiError's `details`; empty when the shape is unexpected. */
export function candidatesOf(kind: AmbiguityKind, details: unknown): AmbiguityCandidate[] {
  const d = (details ?? {}) as { candidates?: AmbiguityCandidate[]; options?: AmbiguityCandidate[] };
  const list = kind === "land" ? d.candidates : d.options;
  return Array.isArray(list) ? list : [];
}

/** D7: several records match: the user says which one is on their document; nothing is picked silently. */
export default function AmbiguousChooser({
  kind,
  candidates,
  onPick,
}: {
  kind: AmbiguityKind;
  candidates: AmbiguityCandidate[];
  onPick: (c: AmbiguityCandidate) => void;
}) {
  const t = useTranslations("verify.chooser");
  const ta = useTranslations("archive");
  const label = (c: AmbiguityCandidate) =>
    [
      c.survey_type ? (ta.has(`surveys.${c.survey_type}`) ? ta(`surveys.${c.survey_type}`) : c.survey_type) : t("noSurvey"),
      c.jl_no ? `JL ${c.jl_no}` : t("noJl"),
      c.mouza,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <Card title={t("title")} icon={<Layers />} data-testid="ambiguous-chooser" role="alert">
      <p className="mb-3 text-ink-muted">{kind === "land" ? t("landIntro") : t("mouzaIntro")}</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {candidates.map((c, i) => (
          <li key={`${c.land_id ?? c.jl_no}-${i}`}>
            <button
              type="button"
              onClick={() => onPick(c)}
              data-testid="chooser-option"
              className="min-h-touch w-full rounded-xl border border-line/70 bg-surface/60 px-4 py-2.5 text-start font-medium text-ink hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {label(c)}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
