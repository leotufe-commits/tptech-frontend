// src/components/ui/TPSelect.tsx
import React from "react";
import { cn } from "./tp";

type SelectOption = {
  value: string;
  label: string;
};

type TPSelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "value"
> & {
  value: string;
  onChange: (v: string) => void;
  options?: SelectOption[];
  label?: string;
  hint?: string;
  error?: string | null;
  wrapClassName?: string;
};

export default function TPSelect({
  value,
  onChange,
  options,
  children,
  label,
  hint,
  error,
  className,
  wrapClassName,
  disabled,
  ...rest
}: TPSelectProps) {
  return (
    <div className={cn("w-full", wrapClassName)}>
      {label ? <div className="mb-2 text-sm text-muted">{label}</div> : null}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "tp-select w-full h-[42px]",
          error && "border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20",
          disabled && "opacity-70",
          className
        )}
        {...rest}
      >
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : children}
      </select>

      {error ? (
        <div className="mt-1 text-xs text-red-400">{error}</div>
      ) : hint ? (
        <div className="mt-1 text-xs text-muted">{hint}</div>
      ) : null}
    </div>
  );
}
