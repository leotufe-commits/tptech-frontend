// tptech-frontend/src/components/ui/TPInput.tsx
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
    let next = String(v ?? "");
    if (onlyDigits) next = next.replace(/\D+/g, "");
    if (typeof maxLen === "number" && maxLen > 0) next = next.slice(0, maxLen);
    onChange(next);
  }

  return (
    <div className={cn("space-y-1", wrapClassName)}>
      {label ? <div className="text-xs font-medium text-muted">{label}</div> : null}

      <div className="relative">
        {hasLeft ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            {leftIcon}
          </div>
        ) : null}

        {/* 🔥 IMPORTANTE: input SIEMPRE self-closing (NO children) */}
        <input
          {...rest}
          ref={inputRef as any}
          disabled={disabled}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            TP_INPUT,
            hasLeft && "pl-9",
            hasRight && "pr-10",
            error && "border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20",
            className
          )}
        />

        {hasRight ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            {/* rightIcon puede ser un button (como tu Eye/EyeOff) */}
            {rightIcon}
          </div>
        ) : null}
      </div>

      {error ? <div className="text-[11px] text-red-300">{error}</div> : null}
      {!error && hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}