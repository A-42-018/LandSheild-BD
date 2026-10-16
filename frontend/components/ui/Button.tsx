import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "gold";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Decorative icon before the label (pass a lucide icon element, it is hidden from screen readers). */
  icon?: ReactNode;
  /** Decorative icon after the label. */
  iconRight?: ReactNode;
  /** Full width below 640 px (phones), natural width above. */
  fullWidthOnMobile?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg shadow-[0_6px_16px_-6px_rgb(var(--primary)/0.55)] hover:bg-primary-hover active:bg-primary-hover",
  gold: "btn-gold font-semibold",
  secondary:
    "border border-primary bg-surface text-primary hover:bg-primary-soft active:bg-primary-soft",
  danger: "bg-critical text-critical-fg hover:bg-critical/90 active:bg-critical/80",
  ghost: "text-primary hover:bg-primary-soft active:bg-primary-soft",
};
const sizes: Record<ButtonSize, string> = {
  // Every size is at least 48 px tall (min-h-touch); sizes differ in padding and text only.
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-5 py-2.5 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon, iconRight, fullWidthOnMobile, disabled, className, type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      className={cn(
        "inline-flex min-h-touch items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,box-shadow,transform] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        fullWidthOnMobile && "w-full sm:w-auto",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      ) : icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">{iconRight}</span>
      )}
    </button>
  );
});

export default Button;
