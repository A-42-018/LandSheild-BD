import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant = "default" | "record";
export type CardAccent = "none" | "primary" | "verified" | "review" | "critical";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  footer?: ReactNode;
  /** Decorative icon shown before the title (lucide element). */
  icon?: ReactNode;
  /** Coloured 3 px bar on the left edge. */
  accent?: CardAccent;
  /** "record": page-level record card with a 3 px primary left bar. */
  variant?: CardVariant;
  /** "panel": tinted section panel (20 px, green + gold glow) grouping a whole section. Default = glass card. */
  tone?: "glass" | "panel";
  as?: "section" | "div" | "article";
}

const accents: Record<CardAccent, string> = {
  none: "",
  primary: "border-l-[3px] border-l-primary",
  verified: "border-l-[3px] border-l-verified",
  review: "border-l-[3px] border-l-review",
  critical: "border-l-[3px] border-l-critical",
};

export default function Card({
  title, footer, icon, accent = "none", variant = "default", tone = "glass", as: Tag = "section", className, children, ...rest
}: CardProps) {
  return (
    <Tag
      data-accent={accent === "none" ? undefined : accent}
      data-variant={variant === "record" ? "record" : undefined}
      data-tone={tone === "panel" ? "panel" : undefined}
      className={cn(tone === "panel" ? "section-panel" : "glass-card", variant === "record" && accent === "none" ? accents.primary : accents[accent], className)}
      {...rest}
    >
      {title && (
        <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3 text-base font-semibold text-ink">
          {icon && (
            <span aria-hidden="true" className="icon-tile !h-9 !w-9 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
          )}
          <div>{title}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="border-t border-line/70 bg-surface-muted/60 px-4 py-3 text-sm text-ink-muted">{footer}</div>}
    </Tag>
  );
}
