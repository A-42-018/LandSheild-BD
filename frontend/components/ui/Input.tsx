import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "./cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, required, ...rest },
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
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-11 rounded-md border bg-surface px-3 py-2 text-ink shadow-card transition-colors placeholder:text-ink-muted",
          "hover:border-primary/50 focus:outline-none focus:ring-2",
          "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:shadow-none",
          error
            ? "border-critical focus:border-critical focus:ring-critical/30"
            : "border-line focus:border-primary focus:ring-primary/30",
          className,
        )}
        {...rest}
      />
      {hint && <p id={hintId} className="text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-critical">
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});

export default Input;
