import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant = "default" | "record";
export type CardAccent = "none" | "primary" | "verified" | "review" | "critical";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  footer?: ReactNode;
  /** Decorative icon shown before the title (lucide element). */
  icon?: ReactNode;
  /** Coloured strip on the top edge. */
  accent?: CardAccent;
  /** "record": page-level record card with a 3 px primary top rule. */
  variant?: CardVariant;
  as?: "section" | "div" | "article";
}

const accents: Record<CardAccent, string> = {
  none: "",
  primary: "border-t-[3px] border-t-primary",
  verified: "border-t-[3px] border-t-verified",
  review: "border-t-[3px] border-t-review",
  critical: "border-t-[3px] border-t-critical",
};

export default function Card({
  title, footer, icon, accent = "none", variant = "default", as: Tag = "section", className, children, ...rest
}: CardProps) {
  return (
    <Tag
      data-accent={accent === "none" ? undefined : accent}
      data-variant={variant === "record" ? "record" : undefined}
      className={cn("rounded-lg border border-line bg-surface", variant === "record" && accent === "none" ? accents.primary : accents[accent], className)}
      {...rest}
    >
      {title && (
        <div className="flex items-center gap-2 rounded-t-lg border-b border-line bg-surface-muted px-4 py-3 text-base font-semibold text-ink">
          {icon && (
            <span aria-hidden="true" className="inline-flex shrink-0 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
          )}
          <div>{title}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="rounded-b-lg border-t border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">{footer}</div>}
    </Tag>
  );
}
