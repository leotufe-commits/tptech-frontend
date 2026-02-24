// src/components/ui/TPInput.tsx
import React from "react";
import { cn } from "./tp";

/**
 * TPInput
 * ✅ Alineado visualmente con TPComboCreatable (mismo look & height)
 * - Usa la misma clase base "tp-input" que usan los combos
 * - Mantiene soporte de icons, error, hint, etc.
 */
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

  /** ✅ permite focus desde afuera (ej: modales) */
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

  return (
    <div className={cn("w-full", wrapClassName)}>
      {label ? <div className="mb-2 text-sm text-muted">{label}</div> : null}

      <div className="relative">
        {hasLeft ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            {leftIcon}
          </span>
        ) : null}

        <input
          ref={inputRef as any}
          disabled={disabled}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            // ✅ MISMA base que los combos (TPComboCreatable)
            "tp-input w-full",
            // ✅ aseguro misma altura (por si algún tp-input viejo no la tiene)
            "h-[42px]",
            hasLeft && "pl-10",
            hasRight && "pr-10",
            error && "border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20",
            disabled && "opacity-70",
            className
          )}
          {...rest}
        />

        {hasRight ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
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