import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "./tp";

type Props = {
  label?: string;
  hint?: string;
  error?: string | null;

  /** Controlled value (number or null for empty) */
  value: number | null;
  onChange: (v: number | null) => void;

  /** behavior */
  step?: number; // ej 1, 0.01, 0.001
  min?: number;
  max?: number;

  /** formatting/typing */
  decimals?: number;
  placeholder?: string;

  disabled?: boolean;
  readOnly?: boolean;

  /** optional adornments */
  leftIcon?: React.ReactNode;

  /** layout */
  className?: string;
  wrapClassName?: string;

  /** optional: evitar cambiar con rueda del mouse */
  disableWheel?: boolean;

  /**
   * Si value es null (vacío) y el usuario usa las flechas,
   * usamos este valor como base inicial (en vez de 0).
   */
  emptyBaseValue?: number;
};

function clamp(n: number, min?: number, max?: number) {
  if (!Number.isFinite(n)) return typeof min === "number" ? min : 0;
  if (typeof min === "number" && n < min) n = min;
  if (typeof max === "number" && n > max) n = max;
  return n;
}

function roundTo(n: number, decimals?: number) {
  if (!Number.isFinite(n)) return n;
  if (typeof decimals !== "number") return n;
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

/** Convierte "0,750" -> 0.75 */
function parseSmartNumber(raw: string) {
  const s = String(raw ?? "").trim();
  if (!s) return NaN;

  const normalized = s.replace(/\s+/g, "").replace(",", ".");
  if (!/^-?\d*\.?\d*$/.test(normalized)) return NaN;

  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Formatea para mostrar SIEMPRE decimales fijos (ej 0,820) */
function formatFixed(n: number, decimals?: number) {
  if (!Number.isFinite(n)) return "";
  if (typeof decimals !== "number") return String(n).replace(".", ",");
  return n.toFixed(decimals).replace(".", ",");
}

function TPNumberInput({
  label,
  hint,
  error,

  value,
  onChange,

  step = 1,
  min,
  max,

  decimals,
  placeholder,

  disabled,
  readOnly,

  leftIcon,

  className,
  wrapClassName,

  disableWheel = true,

  emptyBaseValue,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // estado para manejar display (con ceros) vs edición libre
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  const stepSafe = useMemo(() => {
    const s = Number(step);
    return Number.isFinite(s) && s > 0 ? s : 1;
  }, [step]);

  // sincroniza draft cuando NO estamos editando y cambia el value
  useEffect(() => {
    if (isEditing) return;
    if (typeof value === "number" && Number.isFinite(value)) {
      setDraft(formatFixed(value, decimals));
    } else {
      setDraft("");
    }
  }, [value, decimals, isEditing]);

  function apply(next: number) {
    const v = roundTo(clamp(next, min, max), decimals);
    onChange(v);
  }

  function inc(dir: 1 | -1) {
    if (disabled || readOnly) return;

    const base =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : typeof emptyBaseValue === "number" && Number.isFinite(emptyBaseValue)
        ? emptyBaseValue
        : typeof min === "number"
        ? min
        : 0;

    apply(base + dir * stepSafe);
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!disableWheel) return;
    const el = inputRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (document.activeElement === el) e.preventDefault();
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as any);
  }, [disableWheel]);

  const hasLeft = Boolean(leftIcon);

  return (
    <div className={cn("w-full space-y-1", wrapClassName)}>
      {label ? <label className="text-sm font-medium text-muted">{label}</label> : null}

      <div className="relative">
        {hasLeft ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{leftIcon}</div>
        ) : null}

        <input
          ref={inputRef}
          type="text"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          inputMode="decimal"
          className={cn(
            "tp-input",
            "tp-number-no-spin",
            "pr-12",
            hasLeft && "pl-10",
            error && "border-red-500/60 focus-visible:ring-red-500/20",
            className
          )}
          onFocus={() => {
            setIsEditing(true);
            if (typeof value === "number" && Number.isFinite(value)) {
              setDraft(String(value).replace(".", ","));
            }
          }}
          onBlur={() => {
            setIsEditing(false);
            if (typeof value === "number" && Number.isFinite(value)) {
              setDraft(formatFixed(value, decimals));
            } else {
              setDraft("");
            }
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);

            if (String(raw ?? "").trim() === "") {
              onChange(null);
              return;
            }

            const n = parseSmartNumber(raw);
            if (!Number.isFinite(n)) return;

            apply(n);
          }}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
          <button
            type="button"
            onClick={() => inc(1)}
            disabled={disabled || readOnly}
            className={cn(
              "h-5 w-8 grid place-items-center rounded-md",
              "text-muted hover:text-text hover:bg-surface2",
              "disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted"
            )}
            aria-label="Incrementar"
            title="Incrementar"
          >
            <ChevronUp className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => inc(-1)}
            disabled={disabled || readOnly}
            className={cn(
              "mt-0.5 h-5 w-8 grid place-items-center rounded-md",
              "text-muted hover:text-text hover:bg-surface2",
              "disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted"
            )}
            aria-label="Disminuir"
            title="Disminuir"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : hint ? (
        <div className="text-xs text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

export default TPNumberInput;