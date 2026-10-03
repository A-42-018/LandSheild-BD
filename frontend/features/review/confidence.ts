import type { BadgeTone } from "@/components/ui";

/** R4 bands: ≥ 0.90 green · 0.85–0.90 amber · < 0.85 red. The red cut-off is the API threshold. */
export const GREEN_MIN = 0.9;

export type Band = "high" | "medium" | "low";

export function bandFor(confidence: number, threshold = 0.85): Band {
  if (confidence >= GREEN_MIN) return "high";
  if (confidence >= threshold) return "medium";
  return "low";
}

export const BAND_TONE: Record<Band, BadgeTone> = { high: "verified", medium: "review", low: "critical" };

export const percent = (c: number): number => Math.round(c * 100);
