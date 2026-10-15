import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "verified" | "review" | "critical" | "pending";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Decorative icon before the text (lucide element); the text always carries the meaning. */
  icon?: ReactNode;
  /** Small leading dot when there is no icon, so status is never colour-only. */
  dot?: boolean;
}

const tones: Record<BadgeTone, string> = {
  verified: "border-verified/30 bg-verified-soft text-verified",
  review: "border-review/30 bg-review-soft text-review",
  critical: "border-critical/30 bg-critical-soft text-critical",
  pending: "border-pending/30 bg-pending-soft text-pending",
};

export default function Badge({ tone = "pending", icon, dot, className, children, ...rest }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {!icon && dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon && <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      {children}
    </span>
  );
}
