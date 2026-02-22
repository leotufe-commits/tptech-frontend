import React from "react";
import { cn } from "./tp";

type TPTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value"
> & {
  label?: string;
  hint?: string;
  error?: string | null;

  value: string;
  onChange: (v: string) => void;

  maxLen?: number;

  wrapClassName?: string;
};

export default function TPTextarea({
  label,
  hint,
  error,

  value,
  onChange,

  maxLen,

  className,
  wrapClassName,

  disabled,
  ...rest
}: TPTextareaProps) {
  return (
    <div className={cn("w-full space-y-1", wrapClassName)}>
      {label ? (
        <label className="text-sm font-medium text-muted">
          {label}
        </label>
      ) : null}

      <textarea
        {...rest}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          let next = e.target.value ?? "";
          if (typeof maxLen === "number") {
            next = next.slice(0, maxLen);
          }
          onChange(next);
        }}
        className={cn(
          "tp-input resize-none",
          error && "border-red-500/60 focus-visible:ring-red-500/20",
          className
        )}
        spellCheck={false}
      />

      {error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : hint ? (
        <div className="text-xs text-muted">{hint}</div>
      ) : null}
    </div>
  );
}