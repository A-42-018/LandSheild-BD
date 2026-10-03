import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardAccent = "none" | "primary" | "verified" | "review" | "critical";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  footer?: ReactNode;
  /** Decorative icon shown before the title (lucide element). */
  icon?: ReactNode;
  /** Coloured strip on the top edge. */
  accent?: CardAccent;
  as?: "section" | "div" | "article";
}

const accents: Record<CardAccent, string> = {
  none: "",
  primary: "border-t-4 border-t-primary",
  verified: "border-t-4 border-t-verified",
  review: "border-t-4 border-t-review",
  critical: "border-t-4 border-t-critical",
};

export default function Card({
  title, footer, icon, accent = "none", as: Tag = "section", className, children, ...rest
}: CardProps) {
  return (
    <Tag
      data-accent={accent === "none" ? undefined : accent}
      className={cn("rounded-xl border border-line bg-surface shadow-card", accents[accent], className)}
      {...rest}
    >
      {title && (
        <div className="flex items-center gap-2 rounded-t-xl border-b border-line bg-primary-soft/60 px-4 py-3 text-base font-semibold text-ink">
          {icon && (
            <span aria-hidden="true" className="inline-flex shrink-0 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
          )}
          <span>{title}</span>
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="rounded-b-xl border-t border-line bg-surface-muted/60 px-4 py-3 text-sm text-ink-muted">{footer}</div>}
    </Tag>
  );
}
