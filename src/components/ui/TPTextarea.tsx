// src/components/ui/TPTextarea.tsx
import React from "react";
import { cn, TP_INPUT } from "./tp";

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

  /** ✅ default = 160 (igual a Adjuntos). Podés overridear por pantalla */
  minH?: number;
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
  minH = 160,
  ...rest
}: TPTextareaProps) {
  const showLabel = Boolean(String(label || "").trim());

  return (
    <div className={cn("w-full", showLabel ? "space-y-1" : "", wrapClassName)}>
      {showLabel ? <div className="text-xs font-medium text-muted">{label}</div> : null}

      <textarea
        {...rest}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          let next = e.target.value ?? "";
          if (typeof maxLen === "number") next = next.slice(0, maxLen);
          onChange(next);
        }}
        className={cn(
          TP_INPUT, // ✅ mismo fondo/borde que TPInput/Combo
          "resize-none",
          "h-auto leading-5 py-3", // ✅ evita heredar height 42 + line-height raro
          `min-h-[${minH}px]`,      // ✅ iguala Adjuntos (160px)
          error && "border-red-500/60 focus:ring-red-500/20",
          disabled && "opacity-70",
          className
        )}
        spellCheck={false}
      />

      {error ? <div className="text-[11px] text-red-300">{error}</div> : null}
      {!error && hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}