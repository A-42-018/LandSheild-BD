import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "./cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  hint?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, hint, error, id, className, required, ...rest },
  ref,
) {
  const auto = useId();
  const selectId = id ?? auto;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-ink">
        {label}
        {required && <span aria-hidden="true" className="text-critical"> *</span>}
      </label>
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-12 w-full text-ellipsis rounded-xl border bg-surface px-3 py-2 text-ink transition-[border-color,box-shadow] md:min-h-11",
          "hover:border-primary/50 focus:outline-none focus:ring-[3px]",
          "disabled:cursor-not-allowed disabled:bg-surface-muted",
          error
            ? "border-critical focus:border-critical focus:ring-critical/25"
            : "border-line focus:border-primary focus:ring-primary/25",
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
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

export default Select;
