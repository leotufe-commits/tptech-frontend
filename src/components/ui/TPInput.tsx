// src/components/ui/TPInput.tsx
import React from "react";
import { cn, TP_INPUT } from "./tp";

type TPInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "onChange" | "value"
> & {
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

  inputRef?: React.Ref<HTMLInputElement>;
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
  inputRef,
  ...rest
}: TPInputProps) {
  const hasLeft = Boolean(leftIcon);
  const hasRight = Boolean(rightIcon);

  function handleChange(v: string) {
    let next = v;
    if (onlyDigits) next = next.replace(/\D+/g, "");
    if (typeof maxLen === "number" && maxLen > 0) next = next.slice(0, maxLen);
    onChange(next);
  }

  const labelText = String(label || "");
  const showRealLabel = Boolean(labelText.trim());

  return (
    <div className={cn("w-full", wrapClassName)}>
      {/* ✅ EXACTAMENTE igual que TPComboCreatable */}
      <label
        className={cn("tp-field-label", !showRealLabel && "tp-field-label--empty")}
        aria-hidden={!showRealLabel}
      >
        {showRealLabel ? labelText : "\u00A0"}
      </label>

      <div className="relative">
        {hasLeft ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            {leftIcon}
          </span>
        ) : null}

        <input
          ref={inputRef as any}
          disabled={disabled}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            TP_INPUT,
            hasLeft && "pl-10",
            hasRight && "pr-10",
            error && "border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20",
            className
          )}
          {...rest}
        />

        {hasRight ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            {rightIcon}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-1 text-xs text-red-400">{error}</div>
      ) : hint ? (
        <div className="mt-1 text-xs text-muted">{hint}</div>
      ) : null}
    </div>
  );
}