import React from "react";
import { cn } from "./tp";

type TPInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange" | "value"> & {
  label?: string;
  hint?: string;
  error?: string | null;

  value: string;
  onChange: (v: string) => void;

  onlyDigits?: boolean;
  maxLen?: number;

  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;

  wrapClassName?: string;
};

export default function TPInput({
  label,
  hint,
  error,

  value,
  onChange,

  onlyDigits,
  maxLen,

  leftIcon,
  rightIcon,

  className,
  wrapClassName,

  disabled,
  ...rest
}: TPInputProps) {
  const hasLeft = Boolean(leftIcon);
  const hasRight = Boolean(rightIcon);

  return (
    <div className={cn("w-full space-y-1", wrapClassName)}>
      {label ? <label className="text-xs font-medium text-muted leading-4">{label}</label> : null}

      <div className="relative">
        {hasLeft ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{leftIcon}</div>
        ) : null}

        <input
          {...rest}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            let next = e.target.value ?? "";
            if (onlyDigits) next = next.replace(/\D/g, "");
            if (typeof maxLen === "number") next = next.slice(0, maxLen);
            onChange(next);
          }}
          className={cn(
            "tp-input",
            "h-[42px] leading-5",
            hasLeft ? "pl-10" : "pl-3",
            hasRight ? "pr-10" : "pr-3",
            error && "border-red-500/60 focus-visible:ring-red-500/20",
            className
          )}
          spellCheck={false}
        />

        {hasRight ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">{rightIcon}</div>
        ) : null}
      </div>

      {error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : hint ? (
        <div className="text-xs text-muted">{hint}</div>
      ) : null}
    </div>
  );
}