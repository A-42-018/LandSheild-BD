import type { HTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { AlertOctagon, AlertTriangle, CheckCircle2, HelpCircle, type LucideIcon } from "lucide-react";
import type { BadgeTone } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";

// U0.3 — the one way to show a parcel's risk level: colour + icon + word, always together (roadmap §5).
// Never colour alone, never a bare score. The icon shapes differ too (circle / triangle / octagon), so the
// level survives greyscale printing and colour-blindness.
export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_TONE: Record<string, BadgeTone> = {
  LOW: "verified",
  MEDIUM: "review",
  HIGH: "critical",
};

export const RISK_ICON: Record<RiskLevel, LucideIcon> = {
  LOW: CheckCircle2,
  MEDIUM: AlertTriangle,
  HIGH: AlertOctagon,
};

const PILL: Record<BadgeTone, string> = {
  verified: "border-verified/40 bg-verified-soft text-verified",
  review: "border-review/40 bg-review-soft text-review",
  critical: "border-critical/40 bg-critical-soft text-critical",
  pending: "border-pending/40 bg-pending-soft text-pending",
};
const TILE: Record<BadgeTone, string> = {
  verified: "bg-verified-soft text-verified ring-verified/30",
  review: "bg-review-soft text-review ring-review/30",
  critical: "bg-critical-soft text-critical ring-critical/30",
  pending: "bg-pending-soft text-pending ring-pending/30",
};
const WORD: Record<BadgeTone, string> = {
  verified: "text-verified",
  review: "text-review",
  critical: "text-critical",
  pending: "text-pending",
};

export type RiskIndicatorSize = "sm" | "md" | "lg";

export interface RiskIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  /** Backend level code (LOW / MEDIUM / HIGH). Anything else shows a neutral "not known". */
  level: string | null | undefined;
  /** sm = table cell / list row, md = default chip, lg = headline block on the risk card. */
  size?: RiskIndicatorSize;
  /** Show the "Risk:" prefix. When false it stays for screen readers only (use under a "Risk" column header). */
  showLabel?: boolean;
}

export function riskLevelOf(level: string | null | undefined): RiskLevel | null {
  return level && (RISK_LEVELS as readonly string[]).includes(level) ? (level as RiskLevel) : null;
}

export default function RiskIndicator({ level, size = "md", showLabel = true, className, ...rest }: RiskIndicatorProps) {
  const t = useTranslations("risk");
  const known = riskLevelOf(level);
  const tone: BadgeTone = known ? RISK_TONE[known] : "pending";
  const Icon = known ? RISK_ICON[known] : HelpCircle;
  const word = t(`level.${known ?? "UNKNOWN"}`);
  const label = `${t("label")}: `;

  if (size === "lg") {
    return (
      <span data-risk={known ?? "UNKNOWN"} data-tone={tone} data-size="lg" className={cn("inline-flex items-center gap-3", className)} {...rest}>
        <span aria-hidden="true" className={cn("inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1", TILE[tone])}>
          <Icon className="h-7 w-7" />
        </span>
        <span className="flex flex-col">
          <span className={cn("text-sm font-medium text-ink-muted", !showLabel && "sr-only")}>{label}</span>
          <span className={cn("font-display text-2xl font-bold leading-tight", WORD[tone])}>{word}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      data-risk={known ?? "UNKNOWN"}
      data-tone={tone}
      data-size={size}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        PILL[tone],
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden="true" className={cn("shrink-0", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <span className={showLabel ? "font-medium" : "sr-only"}>{label}</span>
      <span>{word}</span>
    </span>
  );
}
