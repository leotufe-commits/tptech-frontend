import React, { useEffect, useMemo, useRef } from "react";
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

  /** Si value es null y el user incrementa, base inicial */
  emptyBaseValue?: number;

  /** ✅ NUEVO: ref externo (para focus/select desde modales) */
  inputRef?: React.Ref<HTMLInputElement>;

  /** ✅ NUEVO: selecciona todo al enfocar */
  autoSelect?: boolean;

  /** ✅ NUEVO: permitir capturar Enter (y otras teclas) */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;

  /** ✅ NUEVO: onBlur externo */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;

  /** ✅ NUEVO: mostrar/ocultar flechas (custom). Default: false */
  showArrows?: boolean;
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

function setRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else (ref as any).current = value;
}

export function TPNumberInput({
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

  inputRef,
  autoSelect = true,
  onKeyDown,
  onBlur,

  showArrows = false,
}: Props) {
  const innerRef = useRef<HTMLInputElement | null>(null);

  const stepSafe = useMemo(() => {
    const s = Number(step);
    return Number.isFinite(s) && s > 0 ? s : 1;
  }, [step]);

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

    requestAnimationFrame(() => {
      innerRef.current?.focus();
      if (autoSelect) innerRef.current?.select();
    });
  }

  useEffect(() => {
    if (!disableWheel) return;
    const el = innerRef.current;
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
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted select-none">
            {leftIcon}
          </div>
        ) : null}

        <input
          ref={(el) => {
            innerRef.current = el;
            setRef(inputRef, el as any);
          }}
          // ✅ CLAVE: evitamos spinners nativos usando text
          type="text"
          inputMode="decimal"
          pattern="^-?\\d*[.,]?\\d*$"
          value={typeof value === "number" && Number.isFinite(value) ? String(value) : ""}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(
            "tp-input",
            "tp-number-no-spin",
            // si no hay flechas, no reservamos espacio
            showArrows ? "pr-12" : "pr-3",
            hasLeft && "pl-10",
            error && "border-red-500/60 focus-visible:ring-red-500/20",
            className
          )}
          onFocus={(e) => {
            if (autoSelect) requestAnimationFrame(() => e.currentTarget.select());
          }}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          onChange={(e) => {
            const raw = e.target.value;

            if (String(raw ?? "").trim() === "") {
              onChange(null);
              return;
            }

            const n = parseSmartNumber(raw);
            if (!Number.isFinite(n)) return;

            apply(n);
          }}
        />

        {/* ✅ Flechas custom: opcionales (por defecto apagadas) */}
        {showArrows ? (
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
              ▲
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
              ▼
            </button>
          </div>
        ) : null}
      </div>

      {error ? <div className="text-xs text-red-400">{error}</div> : hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export default TPNumberInput;