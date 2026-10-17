import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "./cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Control rendered inside the right edge of the field (e.g. a show-password toggle). */
  endAdornment?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, required, endAdornment, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
        {required && <span aria-hidden="true" className="text-critical"> *</span>}
      </label>
      <div className="relative">
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-touch rounded-xl border bg-surface px-3 py-2 text-ink transition-[border-color,box-shadow] placeholder:text-ink-muted",
          "hover:border-primary/50 focus:outline-none focus:ring-[3px]",
          "disabled:cursor-not-allowed disabled:bg-surface-muted",
          error
            ? "border-critical focus:border-critical focus:ring-critical/25"
            : "border-line focus:border-primary focus:ring-primary/25",
          endAdornment ? "pr-11" : "",
          "w-full",
          className,
        )}
        {...rest}
      />
      {endAdornment && <div className="absolute inset-y-0 right-1 flex items-center">{endAdornment}</div>}
      </div>
      {hint && <p id={hintId} className="text-xs text-ink-muted">{hint}</p>}
      {error && (
        // the alert names its field (U5.4): several fields can fail at once, and five bare "এই তথ্যটি আবশ্যক।"
        // in a row do not say which is which. aria-describedby points at the message only.
        <p role="alert" className="flex items-center gap-1 text-xs text-critical">
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="sr-only">{label}: </span>
          <span id={errorId}>{error}</span>
        </p>
      )}
    </div>
  );
});

export default Input;
