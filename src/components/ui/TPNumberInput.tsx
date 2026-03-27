import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "./tp";

type Props = {
  label?: string;
  hint?: React.ReactNode;
  error?: string | null;

  value: number | null;
  onChange: (v: number | null) => void;

  step?: number;
  min?: number;
  max?: number;

  decimals?: number;
  placeholder?: string;

  disabled?: boolean;
  readOnly?: boolean;

  leftIcon?: React.ReactNode;
  rightAddon?: React.ReactNode;

  className?: string;
  wrapClassName?: string;

  disableWheel?: boolean;
  emptyBaseValue?: number;

  /** ✅ compat: pasar ref desde afuera */
  inputRef?: React.Ref<HTMLInputElement>;

  /** ✅ compat: seleccionar todo al enfocar */
  selectAllOnFocus?: boolean;

  /** ✅ compat: alias */
  autoSelect?: boolean;

  /** ✅ compat: permitir ocultar flechas */
  showArrows?: boolean;

  /** ✅ compat: onKeyDown externo */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;

  /** Símbolo que se muestra a la derecha dentro del campo, ej: "%" */
  suffix?: React.ReactNode;
};

function isIntermediate(raw: string) {
  const s = String(raw ?? "");
  if (s.trim() === "") return true;
  if (s === "-") return true;
  if (s.endsWith(",") || s.endsWith(".")) return true;
  return false;
}

function parseSmartNumber(raw: string) {
  const s = String(raw ?? "").trim();
  if (!s) return NaN;

  const normalized = s.replace(/\s+/g, "").replace(",", ".");
  if (!/^-?\d*\.?\d*$/.test(normalized)) return NaN;

  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function formatFixed(n: number, decimals?: number) {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(typeof decimals === "number" ? decimals : 2);
}

function pow10(decimals?: number) {
  if (typeof decimals !== "number") return null;
  const d = Math.max(0, Math.min(12, Math.floor(decimals)));
  return 10 ** d;
}

function toScaled(n: number, p: number) {
  return Math.round((n + Number.EPSILON) * p);
}

function fromScaled(s: number, p: number) {
  return s / p;
}

function clampScaled(s: number, minS?: number, maxS?: number) {
  if (!Number.isFinite(s)) return s;
  if (typeof minS === "number" && s < minS) s = minS;
  if (typeof maxS === "number" && s > maxS) s = maxS;
  return s;
}

function setRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  try {
    (ref as any).current = value;
  } catch {
    // noop
  }
}

export default function TPNumberInput({
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
  rightAddon,
  className,
  wrapClassName,
  disableWheel = true,
  emptyBaseValue,

  inputRef,
  selectAllOnFocus,
  autoSelect,
  showArrows = true,
  onKeyDown,
  suffix,
}: Props) {
  const innerRef = useRef<HTMLInputElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  // Rastrea el último valor que nosotros emitimos via onChange.
  // Si llega un value distinto, es un cambio externo del padre → sincronizar siempre,
  // sin importar si isEditing es true.
  const lastEmittedRef = useRef<number | null>(value ?? null);

  const stepSafe = useMemo(() => {
    const s = Number(step);
    return Number.isFinite(s) && s > 0 ? s : 1;
  }, [step]);

  const p = useMemo(() => pow10(decimals), [decimals]);

  useEffect(() => {
    const isExternalChange = value !== lastEmittedRef.current;

    if (isExternalChange) {
      // El padre cambió value independientemente (variante, catálogo, moneda).
      // Sincronizar draft incondicionalmente y salir del modo edición.
      lastEmittedRef.current = value ?? null;
      if (isEditing) setIsEditing(false);
      setDraft(
        typeof value === "number" && Number.isFinite(value)
          ? formatFixed(value, decimals)
          : ""
      );
    } else if (!isEditing) {
      // El cambio viene de nosotros mismos (eco del onChange), solo sincronizar
      // si no estamos editando activamente.
      setDraft(
        typeof value === "number" && Number.isFinite(value)
          ? formatFixed(value, decimals)
          : ""
      );
    }
  }, [value, decimals, isEditing]);

  function apply(next: number) {
    if (!Number.isFinite(next)) return;

    if (p) {
      let s = toScaled(next, p);

      const minS =
        typeof min === "number" && Number.isFinite(min) ? toScaled(min, p) : undefined;
      const maxS =
        typeof max === "number" && Number.isFinite(max) ? toScaled(max, p) : undefined;

      s = clampScaled(s, minS, maxS);
      const result = fromScaled(s, p);
      lastEmittedRef.current = result;
      onChange(result);
      return;
    }

    let v = next;
    if (typeof min === "number" && Number.isFinite(min) && v < min) v = min;
    if (typeof max === "number" && Number.isFinite(max) && v > max) v = max;
    lastEmittedRef.current = v;
    onChange(v);
  }

  function getBaseNumberForSpinner() {
    if (!isIntermediate(draft)) {
      const n = parseSmartNumber(draft);
      if (Number.isFinite(n)) return n;
    }

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof emptyBaseValue === "number" && Number.isFinite(emptyBaseValue)) {
      return emptyBaseValue;
    }
    if (typeof min === "number" && Number.isFinite(min)) return min;
    return 0;
  }

  function inc(dir: 1 | -1) {
    if (disabled || readOnly) return;

    const base = getBaseNumberForSpinner();
    let nextNum = base;

    if (p) {
      const baseS = toScaled(base, p);
      const stepS = Math.max(1, toScaled(stepSafe, p));
      const nextS = baseS + dir * stepS;

      const minS =
        typeof min === "number" && Number.isFinite(min) ? toScaled(min, p) : undefined;
      const maxS =
        typeof max === "number" && Number.isFinite(max) ? toScaled(max, p) : undefined;

      const clampedS = clampScaled(nextS, minS, maxS);
      nextNum = fromScaled(clampedS, p);
    } else {
      nextNum = base + dir * stepSafe;
      if (typeof min === "number" && Number.isFinite(min) && nextNum < min) nextNum = min;
      if (typeof max === "number" && Number.isFinite(max) && nextNum > max) nextNum = max;
    }

    apply(nextNum);

    setIsEditing(true);
    setDraft(formatFixed(nextNum, decimals));

    innerRef.current?.focus();
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
  const hasRight = Boolean(rightAddon);
  const hasSuffix = Boolean(suffix);
  const wantSelectAll = Boolean(selectAllOnFocus || autoSelect);

  return (
    <div className={cn("w-full space-y-1", wrapClassName)}>
      {label ? <label className="text-sm font-medium text-muted">{label}</label> : null}

      <div className="relative">
        {hasLeft ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-14 flex items-center justify-start font-semibold text-muted pointer-events-none">
            {leftIcon}
          </div>
        ) : null}

        <input
          ref={(el) => {
            innerRef.current = el;
            setRef(inputRef, el as any);
          }}
          type="text"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          inputMode="decimal"
          className={cn(
            "tp-input",
            "tp-number-no-spin",
            "text-center",
            showArrows
              ? hasSuffix ? "pr-16" : "pr-12"
              : hasSuffix ? "pr-8" : "pr-4",
            hasLeft && "pl-16",
            error && "border-red-500/60 focus-visible:ring-red-500/20",
            className
          )}
          onFocus={(e) => {
            setIsEditing(true);

            if (draft === "" && typeof value === "number" && Number.isFinite(value)) {
              setDraft(formatFixed(value, decimals));
            }

            if (wantSelectAll) {
              window.setTimeout(() => {
                try {
                  (e.target as HTMLInputElement)?.select?.();
                } catch {}
              }, 0);
            }
          }}
          onBlur={() => {
            setIsEditing(false);

            const raw = String(draft ?? "");
            if (raw.trim() === "" || raw === "-") {
              lastEmittedRef.current = null;
              onChange(null);
              setDraft("");
              return;
            }

            const n = parseSmartNumber(raw);
            if (Number.isFinite(n)) {
              apply(n);
              setDraft(formatFixed(n, decimals));
            } else {
              if (typeof value === "number" && Number.isFinite(value)) {
                setDraft(formatFixed(value, decimals));
              } else {
                setDraft("");
              }
            }
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented) return;
            if (disabled || readOnly) return;

            if (e.key === "ArrowUp") {
              e.preventDefault();
              inc(1);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              inc(-1);
            }
            if (e.key === "Enter") {
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);

            if (raw.trim() === "") {
              onChange(null);
              return;
            }

            if (isIntermediate(raw)) return;

            const n = parseSmartNumber(raw);
            if (!Number.isFinite(n)) return;

            apply(n);
          }}
        />

        {hasRight ? (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 left-1/2 ml-7 text-sm font-medium text-muted pointer-events-none select-none"
            )}
          >
            {rightAddon}
          </div>
        ) : null}

        {hasSuffix && (
          <div className={cn(
            "absolute top-1/2 -translate-y-1/2 text-sm font-semibold text-muted pointer-events-none select-none",
            showArrows ? "right-11" : "right-3"
          )}>
            {suffix}
          </div>
        )}

        {showArrows ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
            <button
              type="button"
              onClick={() => inc(1)}
              disabled={disabled || readOnly}
              className="h-5 w-8 grid place-items-center text-muted hover:text-text disabled:opacity-50"
              aria-label="Incrementar"
              title="Incrementar"
            >
              <ChevronUp className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => inc(-1)}
              disabled={disabled || readOnly}
              className="mt-0.5 h-5 w-8 grid place-items-center text-muted hover:text-text disabled:opacity-50"
              aria-label="Disminuir"
              title="Disminuir"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
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