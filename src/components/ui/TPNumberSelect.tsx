// src/components/ui/TPNumberSelect.tsx
// Número + selector integrado en un solo campo visual:
//   [ 10,00      ARS ]   o   [ 10,00      % ]
//
// La etiqueta del selector aparece inline dentro del input (sin separador
// ni chevron visibles en reposo). Al hacer click o scroll se cambia la opción.
// El picker es una fila compacta de chips que emerge junto al selector.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronUp, Star } from "lucide-react";
import { cn } from "./tp";

export type NSOption = { value: string; label: string; disabled?: boolean };

type Props = {
  // Número
  numberValue: number | null;
  onNumberChange: (v: number | null) => void;
  numberMin?: number;
  numberDecimals?: number;
  numberPlaceholder?: string;

  // Selector
  selectorValue: string;
  onSelectorChange: (v: string) => void;
  selectorOptions: NSOption[];

  // Favorito en selector (opcional)
  favoriteValue?: string | null;
  onSetFavorite?: (v: string) => void;

  /** Muestra flechas de incremento/decremento dentro del input (estilo TPNumberInput) */
  showArrows?: boolean;
  /** Paso de incremento/decremento cuando showArrows=true (default: 1) */
  step?: number;

  disabled?: boolean;
  className?: string;
};

// ─── helpers numéricos ────────────────────────────────────────────────────────

function isIntermediate(s: string) {
  if (s.trim() === "") return true;
  if (s === "-") return true;
  if (s.endsWith(",") || s.endsWith(".")) return true;
  return false;
}

function parseNum(raw: string): number {
  const s = raw.trim().replace(",", ".");
  if (!/^-?\d*\.?\d*$/.test(s)) return NaN;
  return Number(s);
}

function fmt(n: number | null | undefined, decimals?: number): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toFixed(decimals ?? 2);
}

// ─── componente ──────────────────────────────────────────────────────────────

export default function TPNumberSelect({
  numberValue,
  onNumberChange,
  numberMin,
  numberDecimals,
  numberPlaceholder = "0,00",
  selectorValue,
  onSelectorChange,
  selectorOptions,
  favoriteValue,
  onSetFavorite,
  showArrows = false,
  step = 1,
  disabled = false,
  className,
}: Props) {
  const stepSafe = typeof step === "number" && step > 0 ? step : 1;

  // ── número ──────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState(() => fmt(numberValue, numberDecimals));
  const [isEditing, setIsEditing] = useState(false);
  const lastEmittedRef = useRef<number | null>(numberValue ?? null);

  function inc(dir: 1 | -1) {
    if (disabled) return;
    const base = numberValue ?? numberMin ?? 0;
    let next = base + dir * stepSafe;
    if (numberMin != null && Number.isFinite(numberMin) && next < numberMin) next = numberMin;
    lastEmittedRef.current = next;
    onNumberChange(next);
    setDraft(fmt(next, numberDecimals));
  }

  useEffect(() => {
    const isExternal = numberValue !== lastEmittedRef.current;
    if (isExternal) {
      lastEmittedRef.current = numberValue ?? null;
      if (isEditing) setIsEditing(false);
      setDraft(fmt(numberValue, numberDecimals));
    } else if (!isEditing) {
      setDraft(fmt(numberValue, numberDecimals));
    }
  }, [numberValue, numberDecimals, isEditing]);

  function apply(n: number) {
    if (!Number.isFinite(n)) return;
    let v = n;
    if (numberMin != null && Number.isFinite(numberMin) && v < numberMin) v = numberMin;
    lastEmittedRef.current = v;
    onNumberChange(v);
  }

  // ── selector ─────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});

  const wrapRef  = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // refs estables para el wheel listener (evita re-registrar en cada render)
  const selectorValueRef   = useRef(selectorValue);
  selectorValueRef.current = selectorValue;
  const selectorOptionsRef   = useRef(selectorOptions);
  selectorOptionsRef.current = selectorOptions;
  const onSelectorChangeRef   = useRef(onSelectorChange);
  onSelectorChangeRef.current = onSelectorChange;

  const selLabel = selectorOptions.find(o => o.value === selectorValue)?.label ?? selectorValue;

  // ── posición del picker ──────────────────────────────────────────────────
  function calcDropStyle(): React.CSSProperties {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    const base: React.CSSProperties = {
      position: "fixed",
      right: window.innerWidth - rect.right,
      zIndex: 9999,
    };
    if (spaceBelow >= 80 || spaceBelow >= spaceAbove) {
      return { ...base, top: rect.bottom + 6 };
    }
    return { ...base, bottom: window.innerHeight - rect.top + 6 };
  }

  useEffect(() => {
    if (!open) { setActiveIndex(-1); return; }
    setDropStyle(calcDropStyle());
    const idx = selectorOptions.findIndex(o => o.value === selectorValue);
    setActiveIndex(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function update() { setDropStyle(calcDropStyle()); }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── cerrar al click fuera ────────────────────────────────────────────────
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const portal = document.getElementById("tp-numsel-portal");
      if (!wrapRef.current?.contains(t) && !portal?.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []);

  // ── scroll sobre la etiqueta de moneda → cicla opciones ──────────────────
  useEffect(() => {
    const btn = btnRef.current;
    if (!btn) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const opts = selectorOptionsRef.current.filter(o => !o.disabled);
      const curIdx = opts.findIndex(o => o.value === selectorValueRef.current);
      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIdx = Math.max(0, Math.min(opts.length - 1, curIdx + dir));
      if (nextIdx !== curIdx) onSelectorChangeRef.current(opts[nextIdx].value);
    }
    btn.addEventListener("wheel", onWheel, { passive: false });
    return () => btn.removeEventListener("wheel", onWheel);
  }, []); // solo al montar — refs actualizan los valores sin re-registrar

  function pick(v: string) {
    onSelectorChange(v);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onBtnKeyDown(e: React.KeyboardEvent) {
    const opts = selectorOptions.filter(o => !o.disabled);
    const curIdx = opts.findIndex(o => o.value === selectorValue);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      if (!open) {
        const next = opts[Math.min(curIdx + 1, opts.length - 1)];
        if (next && next.value !== selectorValue) pick(next.value);
        return;
      }
      setActiveIndex(i => Math.min(i + 1, selectorOptions.length - 1));
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (!open) {
        const next = opts[Math.max(curIdx - 1, 0)];
        if (next && next.value !== selectorValue) pick(next.value);
        return;
      }
      setActiveIndex(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (activeIndex >= 0 && activeIndex < selectorOptions.length) pick(selectorOptions[activeIndex].value);
      return;
    }
    if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapRef}
      className={cn("w-full", disabled && "opacity-[0.65] pointer-events-none", className)}
    >
      <div className="tp-input flex items-center h-[42px] overflow-hidden group/wrap">

        {/* ── Input numérico ── */}
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          placeholder={numberPlaceholder}
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent text-center text-sm text-[var(--text)] outline-none pl-3 pr-2 h-full"
          onFocus={() => {
            setIsEditing(true);
            if (draft === "" && numberValue != null && Number.isFinite(numberValue)) {
              setDraft(fmt(numberValue, numberDecimals));
            }
          }}
          onBlur={() => {
            setIsEditing(false);
            const raw = draft.trim();
            if (!raw || raw === "-") {
              lastEmittedRef.current = null;
              onNumberChange(null);
              setDraft("");
              return;
            }
            const n = parseNum(raw);
            if (Number.isFinite(n)) {
              apply(n);
              setDraft(fmt(n, numberDecimals));
            } else {
              setDraft(fmt(numberValue, numberDecimals));
            }
          }}
          onChange={e => {
            const raw = e.target.value;
            setDraft(raw);
            if (raw.trim() === "") { lastEmittedRef.current = null; onNumberChange(null); return; }
            if (isIntermediate(raw)) return;
            const n = parseNum(raw);
            if (Number.isFinite(n)) apply(n);
          }}
          onKeyDown={e => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
        />

        {/* ── Selector inline — sin separador visual en reposo ── */}
        {selectorOptions.length > 0 && (
          <button
            ref={btnRef}
            type="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={onBtnKeyDown}
            onClick={() => !disabled && setOpen(v => !v)}
            title="Cambiar (también con scroll)"
            className={cn(
              "flex items-center gap-0.5 h-full shrink-0 select-none transition-colors",
              "text-xs font-bold tracking-wide",
              showArrows ? "pl-1.5 pr-1.5" : "pl-1.5 pr-3",
              open
                ? "text-primary"
                : "text-muted hover:text-primary"
            )}
          >
            <span>{selLabel}</span>
            <ChevronDown
              size={12}
              className={cn("transition-transform shrink-0 text-muted", open && "rotate-180")}
            />
          </button>
        )}

        {/* ── Flechas de incremento/decremento ── */}
        {showArrows && (
          <div className="flex flex-col shrink-0">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => inc(1)}
              disabled={disabled}
              className="h-5 w-8 grid place-items-center text-muted hover:text-text disabled:opacity-50"
              aria-label="Incrementar"
              title="Incrementar"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => inc(-1)}
              disabled={disabled}
              className="mt-0.5 h-5 w-8 grid place-items-center text-muted hover:text-text disabled:opacity-50"
              aria-label="Disminuir"
              title="Disminuir"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Picker de chips ── */}
      {open && !disabled && createPortal(
        <div
          id="tp-numsel-portal"
          style={dropStyle}
          className="rounded-2xl border border-border bg-card shadow-soft p-1.5 flex flex-wrap gap-1"
          onMouseDown={e => e.preventDefault()}
        >
          {selectorOptions.map((opt, idx) => {
            const isSelected = opt.value === selectorValue;
            const isActive   = idx === activeIndex;
            const isFav      = favoriteValue !== undefined ? opt.value === favoriteValue : false;
            return (
              <button
                key={opt.value}
                type="button"
                tabIndex={-1}
                disabled={!!opt.disabled}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => !opt.disabled && pick(opt.value)}
                className={cn(
                  "relative inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold transition select-none",
                  opt.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  isSelected
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : cn(
                        "border border-transparent text-muted",
                        !opt.disabled && "hover:bg-surface2/60 hover:text-text",
                        !opt.disabled && isActive && "bg-surface2/60 text-text"
                      )
                )}
              >
                {isSelected && <Check size={10} className="shrink-0" />}
                <span>{opt.label}</span>
                {onSetFavorite && (
                  <span
                    role="button"
                    title={isFav ? "Predeterminado" : "Usar como predeterminado"}
                    onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={e => { e.stopPropagation(); onSetFavorite(opt.value); }}
                    className={cn(
                      "transition-colors",
                      isFav ? "text-yellow-400" : "text-muted/30 hover:text-yellow-400"
                    )}
                  >
                    <Star size={9} className={isFav ? "fill-yellow-400" : ""} />
                  </span>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
