import React from "react";
import { cn, TP_SELECT } from "./tp";

type TPSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  label?: string;
  hint?: string;
  error?: string | null;

  value: string;
  onChange: (v: string) => void;

  wrapClassName?: string;
};

export function TPSelect({
  label,
  hint,
  error,
  value,
  onChange,
  className,
  wrapClassName,
  disabled,
  children,
  ...rest
}: TPSelectProps) {
  return (
    <div className={cn("w-full space-y-1", wrapClassName)}>
      {label ? (
        <label className="text-xs font-medium text-muted leading-4">{label}</label>
      ) : null}

      <div className="relative">
        <select
          {...rest}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            TP_SELECT,
            "h-[42px] leading-5 appearance-none pr-10",
            error && "border-red-500/60 focus-visible:ring-red-500/20",
            className
          )}
        >
          {children}
        </select>

        {/* caret visual sutil (opcional). Si no lo querés, lo saco. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : hint ? (
        <div className="text-xs text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

export default TPSelect;