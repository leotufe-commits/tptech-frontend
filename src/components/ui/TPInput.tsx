// src/components/ui/TPInput.tsx
import React from "react";
import { cn } from "./tp";

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

  /**
   * ✅ NUEVO:
   * Si el label lo maneja un wrapper externo (TPField),
   * evitamos reservar espacio de label adentro.
   */
  noLabelSpace?: boolean;
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

  noLabelSpace = false,
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

  // ✅ Base idéntica a la que estás viendo en TPComboCreatable (DevTools)
  const BASE_INPUT =
    "mt-1 w-full h-[42px] rounded-xl border border-border bg-white px-3 text-sm " +
    "text-[color:var(--ui-input-text)] placeholder:text-[color:var(--ui-placeholder)] " +
    "placeholder:opacity-100 outline-none " +
    "focus:border-primary/40 focus:ring-4 focus:ring-primary/20 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className={cn(noLabelSpace ? "w-full" : "tp-field w-full", wrapClassName)}>
      {!noLabelSpace ? (
        <label
          className={cn("tp-field-label", !showRealLabel && "tp-field-label--empty")}
          aria-hidden={!showRealLabel}
        >
          {showRealLabel ? labelText : "\u00A0"}
        </label>
      ) : null}

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
            BASE_INPUT,
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

      {!noLabelSpace ? (
        error ? (
          <div className="mt-1 text-xs text-red-400">{error}</div>
        ) : hint ? (
          <div className="mt-1 text-xs text-muted">{hint}</div>
        ) : null
      ) : null}
    </div>
  );
}