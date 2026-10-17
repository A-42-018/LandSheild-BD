import type { BadgeTone } from "@/components/ui/Badge";

export const DAY_MS = 86_400_000;
/** Waiting time bands for the reviewer queue (roadmap §4.3): up to 2 days, 3–7 days, more than 7 days. */
export type AgeBand = "fresh" | "aging" | "late";

export function ageDays(createdAt: string, now: number = Date.now()): number {
  const t = Date.parse(createdAt);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / DAY_MS));
}

export function ageBand(days: number): AgeBand {
  return days <= 2 ? "fresh" : days <= 7 ? "aging" : "late";
}

export const AGE_TONE: Record<AgeBand, BadgeTone> = { fresh: "verified", aging: "review", late: "critical" };
