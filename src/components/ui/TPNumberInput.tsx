import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X as XIcon } from "lucide-react";
import { cn } from "./tp";
import { useNumberFormat } from "../../context/NumberFormatContext";
import {
  formatNumber,
  getNumberFormatConfig,
  parseNumberInput,
  type NumberFormatType,
} from "../../lib/number-format";

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
  /**
   * Opt-in: tipo de dato del motor central de formato. Cuando se pasa, el
   * display/blur usa los decimales y el separador decimal de la región
   * configurada por el tenant. Sin esto, el input mantiene el comportamiento
   * histórico (punto, decimales del prop). El parseo SIEMPRE acepta coma o
   * punto, con o sin `formatType`.
   */
  formatType?: NumberFormatType;
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

  /**
   * Si está, renderiza una X dentro del input (a la derecha del valor,
   * antes de suffix/arrows) para limpiar. Tabbeable=false. preventDefault
   * en mouseDown para no robar foco al input adyacente. El caller decide
   * cuándo pasarla (típicamente solo cuando hay override activo).
   */
  onClear?: () => void;

  /**
   * Modo compacto: flechas más chicas y padding reducido para que el valor
   * se vea sin solapar el spinner cuando el input es estrecho (ej. líneas
   * de comprobante con columnas de 90–150px).
   */
  compact?: boolean;
};

function isIntermediate(raw: string) {
  const s = String(raw ?? "");
  if (s.trim() === "") return true;
  if (s === "-") return true;
  if (s.endsWith(",") || s.endsWith(".")) return true;
  return false;
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
  formatType,
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
  onClear,
  compact = false,
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

  // Config del tenant. Sin provider devuelve el default (AR) — seguro en tests.
  const { config } = useNumberFormat();

  // Decimales efectivos: prop explícito gana; si no y hay formatType, el del
  // preset; si no, undefined (comportamiento histórico = libre).
  const effectiveDecimals = useMemo<number | undefined>(() => {
    if (typeof decimals === "number") return decimals;
    if (formatType) return getNumberFormatConfig(formatType, config).decimals;
    return undefined;
  }, [decimals, formatType, config]);

  // Display en reposo / blur. Con formatType: número completo de la región
  // (miles + decimal del tenant), SIN prefijo/sufijo (los pone la UI por
  // fuera). El draft mientras se tipea queda crudo (onChange no reformatea),
  // así que agrupar acá no genera problemas de caret. Sin formatType:
  // comportamiento histórico (punto, decimales del prop).
  function formatDraft(n: number): string {
    if (!Number.isFinite(n)) return "";
    if (formatType) {
      return formatNumber(n, formatType, config, { bare: true, blank: "" });
    }
    return formatFixed(n, effectiveDecimals);
  }

  // Parseo SIEMPRE tolerante (coma o punto, con/sin miles). Devuelve NaN si
  // no es un número (compat con la lógica previa basada en Number.isFinite).
  function parseDraft(raw: string): number {
    const v = parseNumberInput(raw, config);
    return v === null ? NaN : v;
  }

  const p = useMemo(() => pow10(effectiveDecimals), [effectiveDecimals]);

  useEffect(() => {
    const isExternalChange = value !== lastEmittedRef.current;

    if (isExternalChange) {
      // "Null-bounce": nosotros emitimos null (usuario borró el campo) pero el padre
      // no actualizó su state y nos devuelve el valor anterior. Si estamos editando,
      // no interrumpimos al usuario — él sigue escribiendo.
      const isNullBounce = lastEmittedRef.current === null && isEditing && value !== null;
      lastEmittedRef.current = value ?? null;
      if (isNullBounce) return;

      // El padre cambió value independientemente (variante, catálogo, reset externo).
      // Sincronizar draft y salir del modo edición.
      if (isEditing) setIsEditing(false);
      setDraft(
        typeof value === "number" && Number.isFinite(value)
          ? formatDraft(value)
          : ""
      );
    } else if (!isEditing) {
      // El cambio viene de nosotros mismos (eco del onChange), solo sincronizar
      // si no estamos editando activamente.
      setDraft(
        typeof value === "number" && Number.isFinite(value)
          ? formatDraft(value)
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
      const n = parseDraft(draft);
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
    setDraft(formatDraft(nextNum));

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
  const hasClear = Boolean(onClear);
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
            hasLeft && "pl-16",
            error && "border-red-500/60 focus-visible:ring-red-500/20",
            className
          )}
          style={{
            // inline style wins CSS specificity over input.tp-input { padding: 0 1rem }
            paddingRight: (() => {
              const base = showArrows
                ? hasSuffix ? (compact ? 3   : 4)
                            : (compact ? 2.25 : 3)
                : hasSuffix ? (compact ? 1.5 : 2)
                            : (compact ? 0.5 : 1);
              const extra = hasClear ? (compact ? 1.25 : 1.5) : 0;
              return `${base + extra}rem`;
            })(),
            paddingLeft: hasLeft ? undefined : (compact ? "0.5rem" : "1rem"),
          }}
          onFocus={(e) => {
            setIsEditing(true);

            if (draft === "" && typeof value === "number" && Number.isFinite(value)) {
              setDraft(formatDraft(value));
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

            const n = parseDraft(raw);
            if (Number.isFinite(n)) {
              apply(n);
              setDraft(formatDraft(n));
            } else {
              if (typeof value === "number" && Number.isFinite(value)) {
                setDraft(formatDraft(value));
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
              lastEmittedRef.current = null;
              onChange(null);
              return;
            }

            if (isIntermediate(raw)) return;

            const n = parseDraft(raw);
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
            showArrows
              ? (compact ? "right-7" : "right-11")
              : (compact ? "right-2" : "right-3")
          )}>
            {suffix}
          </div>
        )}

        {hasClear && (
          <button
            type="button"
            // X interna para limpiar override. Tabbeable=false: TAB salta
            // directo al próximo input editable. preventDefault en mouseDown
            // para no robar foco. El caller decide cuándo pasar onClear.
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              // Snap visual instantáneo: actualizamos el `draft` local a "0"
              // ya formateado ANTES de invocar el callback externo. Esto
              // evita el flicker "20.00 → 20 → 0" que aparecía cuando el
              // padre actualiza `value` después del round-trip al backend
              // (preview) y el effect de sincronización pisaba el draft con
              // un format intermedio. También sincroniza `lastEmittedRef`
              // para que el próximo cambio de `value=0` se vea como eco
              // interno y NO dispare un nuevo setDraft.
              lastEmittedRef.current = 0;
              setDraft(formatDraft(0));
              setIsEditing(false);
              onClear?.();
            }}
            disabled={disabled || readOnly}
            className="absolute top-1/2 -translate-y-1/2 grid place-items-center text-muted/60 hover:text-text disabled:opacity-50"
            style={{
              right:
                showArrows && hasSuffix ? (compact ? "3rem"    : "4rem"   ) :
                showArrows              ? (compact ? "2.5rem"  : "3rem"   ) :
                hasSuffix               ? (compact ? "1.5rem"  : "2rem"   ) :
                                          (compact ? "0.25rem" : "0.5rem" ),
            }}
            aria-label="Limpiar valor"
            title="Limpiar"
          >
            <XIcon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </button>
        )}

        {showArrows ? (
          <div className={cn(
            "absolute top-1/2 -translate-y-1/2 flex flex-col",
            compact ? "right-1" : "right-2"
          )}>
            <button
              type="button"
              // Spinners FUERA del flujo de Tab. El input principal sigue
              // siendo tabbable; las flechas de teclado ↑/↓ dentro del input
              // ya incrementan/decrementan (comportamiento nativo de
              // input[type=number]). Esto evita que TAB se "enganche" en los
              // botones de spinner cuando el operador navega rápido entre
              // Cantidad → Precio → Bonificación → Impuestos.
              tabIndex={-1}
              // Evita que el click robe foco del input editable adyacente —
              // el operador puede seguir clickeando los arrows con mouse.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => inc(1)}
              disabled={disabled || readOnly}
              className={cn(
                "grid place-items-center text-muted hover:text-text disabled:opacity-50",
                compact ? "h-3.5 w-5" : "h-5 w-8"
              )}
              aria-label="Incrementar"
              title="Incrementar"
            >
              <ChevronUp className={compact ? "h-3 w-3" : "h-4 w-4"} />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => inc(-1)}
              disabled={disabled || readOnly}
              className={cn(
                "grid place-items-center text-muted hover:text-text disabled:opacity-50",
                compact ? "mt-0 h-3.5 w-5" : "mt-0.5 h-5 w-8"
              )}
              aria-label="Disminuir"
              title="Disminuir"
            >
              <ChevronDown className={compact ? "h-3 w-3" : "h-4 w-4"} />
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