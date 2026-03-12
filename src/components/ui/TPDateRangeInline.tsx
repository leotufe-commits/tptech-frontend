import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calendar, X, Menu, Check } from "lucide-react";
import { cn } from "./tp";

export type TPDateRangeValue = {
  from: Date | null;
  to: Date | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** yyyy-MM-dd (input type="date") */
function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateInputValue(v: string) {
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeRange(from: Date | null, to: Date | null): TPDateRangeValue {
  if (!from && !to) return { from: null, to: null };
  if (from && to && to.getTime() < from.getTime()) return { from: to, to: from };
  return { from, to };
}

type PresetKey = "today" | "7d" | "30d" | "thisMonth" | "lastMonth" | "clear";

export default function TPDateRangeInline({
  value,
  onChange,

  disabled,
  className,

  showPresets = true,
  presets = [1, 7, 30],

  defaultPresetDays = 30,

  mode = "auto",
  debounceMs = 250,

  fromLabel = "Desde",
  toLabel = "Hasta",

  min,
  max,
}: {
  value: TPDateRangeValue;
  onChange: (v: TPDateRangeValue) => void;

  disabled?: boolean;
  className?: string;

  showPresets?: boolean;
  presets?: number[];

  /** si no hay value (from/to null) aplica este preset al montar */
  defaultPresetDays?: number;

  mode?: "auto" | "manual";
  debounceMs?: number;

  fromLabel?: string;
  toLabel?: string;

  min?: Date;
  max?: Date;
}) {
  // ✅ evita flicker: inicializa desde value en el PRIMER render
  const [fromInput, setFromInput] = useState(() => (value.from ? toDateInputValue(value.from) : ""));
  const [toInput, setToInput] = useState(() => (value.to ? toDateInputValue(value.to) : ""));

  const timerRef = useRef<any>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  // ✅ para aplicar preset por defecto SOLO una vez (y sin parpadeo)
  const didInitRef = useRef(false);

  // sync inputs cuando cambia value desde afuera
  useEffect(() => {
    const f = value.from ? toDateInputValue(value.from) : "";
    const t = value.to ? toDateInputValue(value.to) : "";
    // evita renders innecesarios
    setFromInput((prev) => (prev === f ? prev : f));
    setToInput((prev) => (prev === t ? prev : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.from?.getTime(), value.to?.getTime()]);

  const minStr = useMemo(() => (min ? toDateInputValue(min) : undefined), [min]);
  const maxStr = useMemo(() => (max ? toDateInputValue(max) : undefined), [max]);

  function emit(nextFromStr: string, nextToStr: string) {
    const from = parseDateInputValue(nextFromStr);
    const to = parseDateInputValue(nextToStr);
    onChange(normalizeRange(from, to));
  }

  function scheduleEmit(nextFromStr: string, nextToStr: string) {
    if (mode === "manual") return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      emit(nextFromStr, nextToStr);
    }, debounceMs);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  // ✅ Presets inclusivos (Hoy = mismo día en ambos)
  function setPresetDays(days: number) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // hoy 00:00

    const back = Math.max(0, days - 1); // 7d => hoy + 6 atrás
    const from = new Date(today.getTime() - back * 24 * 60 * 60 * 1000);
    const to = today;

    const f = toDateInputValue(from);
    const t = toDateInputValue(to);

    setFromInput(f);
    setToInput(t);
    onChange(normalizeRange(from, to));
  }

  function setThisMonth() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const f = toDateInputValue(from);
    const t = toDateInputValue(to);
    setFromInput(f);
    setToInput(t);
    onChange(normalizeRange(from, to));
  }

  function setLastMonth() {
    const now = new Date();
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = new Date(firstThisMonth.getFullYear(), firstThisMonth.getMonth() - 1, 1);
    const to = new Date(firstThisMonth.getFullYear(), firstThisMonth.getMonth(), 0);
    const f = toDateInputValue(from);
    const t = toDateInputValue(to);
    setFromInput(f);
    setToInput(t);
    onChange(normalizeRange(from, to));
  }

  function clearAll() {
    setFromInput("");
    setToInput("");
    onChange({ from: null, to: null });
  }

  function clearFromOnly() {
    setFromInput("");
    if (mode === "manual") {
      onChange(normalizeRange(null, parseDateInputValue(toInput)));
      return;
    }
    emit("", toInput);
  }

  const hasValue = !!value.from || !!value.to;

  const activePreset = useMemo((): PresetKey | null => {
    if (!value.from && !value.to) return "clear";
    if (!value.from || !value.to) return null;

    const from = new Date(value.from.getFullYear(), value.from.getMonth(), value.from.getDate());
    const to = new Date(value.to.getFullYear(), value.to.getMonth(), value.to.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (to.getTime() !== today.getTime()) return null;

    const diffDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return "today";
    if (diffDays === 6) return "7d";
    if (diffDays === 29) return "30d";

    const thisMonthFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    if (from.getTime() === thisMonthFrom.getTime()) return "thisMonth";

    return null;
  }, [value.from?.getTime(), value.to?.getTime()]);

  // ✅ aplica preset default ANTES del paint (evita parpadeo)
  useLayoutEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    if (!showPresets) return;
    if (disabled) return;
    if (!defaultPresetDays) return;

    if (!value.from && !value.to) {
      const allowed = Array.isArray(presets) ? presets : [1, 7, 30];
      const days =
        allowed.includes(defaultPresetDays)
          ? defaultPresetDays
          : allowed.slice().sort((a, b) => b - a)[0] ?? defaultPresetDays;

      setPresetDays(days);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // close menu: click afuera + ESC
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!menuOpen) return;
      const el = menuWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setMenuOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (!menuOpen) return;
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  const menuItems = useMemo(() => {
    const base: Array<{ k: PresetKey; label: string; hidden?: boolean } | { sep: true }> = [
      { k: "today", label: "Hoy", hidden: !presets.includes(1) },
      { k: "7d", label: "Últimos 7 días", hidden: !presets.includes(7) },
      { k: "30d", label: "Últimos 30 días", hidden: !presets.includes(30) },
      { sep: true },
      { k: "thisMonth", label: "Este mes" },
      { k: "lastMonth", label: "Mes pasado" },
      { sep: true },
      { k: "clear", label: "Limpiar filtro" },
    ];
    return base.filter((x: any) => !x.hidden);
  }, [presets]);

  function runPreset(k: PresetKey) {
    if (k === "today") setPresetDays(1);
    else if (k === "7d") setPresetDays(7);
    else if (k === "30d") setPresetDays(30);
    else if (k === "thisMonth") setThisMonth();
    else if (k === "lastMonth") setLastMonth();
    else if (k === "clear") clearAll();
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* desde */}
      <div className="relative flex-1 min-w-[170px]">
        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text opacity-50" />
        <input
          type="date"
          value={fromInput}
          onChange={(e) => {
            const v = e.target.value;
            setFromInput(v);
            scheduleEmit(v, toInput);
          }}
          onBlur={() => {
            if (mode === "manual") return;
            emit(fromInput, toInput);
          }}
          min={minStr}
          max={maxStr}
          disabled={disabled}
          className={cn(
            "tp-date-input w-full h-10 rounded-xl border border-border bg-bg text-text pl-9 pr-9 text-sm",
            "focus:outline-none focus:ring-4 focus:ring-primary/20",
            "disabled:opacity-60 disabled:pointer-events-none"
          )}
          aria-label={fromLabel}
          title={fromLabel}
        />

        {fromInput ? (
          <button
            type="button"
            onClick={clearFromOnly}
            disabled={disabled}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-lg",
              "text-muted hover:text-text hover:bg-surface2 transition",
              "disabled:opacity-60 disabled:pointer-events-none"
            )}
            title="Limpiar desde"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {/* hasta */}
      <div className="relative flex-1 min-w-[170px]">
        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text opacity-50" />
        <input
          type="date"
          value={toInput}
          onChange={(e) => {
            const v = e.target.value;
            setToInput(v);
            scheduleEmit(fromInput, v);
          }}
          onBlur={() => {
            if (mode === "manual") return;
            emit(fromInput, toInput);
          }}
          min={minStr}
          max={maxStr}
          disabled={disabled}
          className={cn(
            "tp-date-input w-full h-10 rounded-xl border border-border bg-bg text-text pl-9 pr-9 text-sm",
            "focus:outline-none focus:ring-4 focus:ring-primary/20",
            "disabled:opacity-60 disabled:pointer-events-none"
          )}
          aria-label={toLabel}
          title={toLabel}
        />

        {hasValue ? (
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-lg",
              "text-muted hover:text-text hover:bg-surface2 transition",
              "disabled:opacity-60 disabled:pointer-events-none"
            )}
            title="Limpiar filtro"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {/* ✅ SWAP: primero hamburguesa */}
      {showPresets ? (
        <div ref={menuWrapRef} className="relative shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "h-10 w-10 grid place-items-center rounded-xl border border-border bg-bg",
              "text-muted hover:text-text hover:bg-surface2 transition",
              "focus:outline-none focus:ring-4 focus:ring-primary/20",
              "disabled:opacity-60 disabled:pointer-events-none"
            )}
            title="Presets de fecha"
            aria-label="Presets de fecha"
            aria-expanded={menuOpen}
          >
            <Menu size={18} />
          </button>

          {menuOpen ? (
            <div
              className={cn(
                "absolute right-0 mt-2 min-w-[220px] z-50",
                "rounded-2xl border border-border bg-card text-text shadow-lg overflow-hidden"
              )}
              role="menu"
            >
              {menuItems.map((it, idx) => {
                if ("sep" in it) {
                  return <div key={`sep-${idx}`} className="h-px bg-border my-1" />;
                }
                const active = activePreset === it.k;
                return (
                  <button
                    key={it.k}
                    type="button"
                    role="menuitem"
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm",
                      "flex items-center justify-between gap-2",
                      "hover:bg-surface2 transition",
                      active && "font-semibold"
                    )}
                    onClick={() => {
                      setMenuOpen(false);
                      runPreset(it.k);
                    }}
                  >
                    <span>{it.label}</span>
                    {active ? <Check size={16} className="text-[rgb(var(--primary-rgb)/1)]" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ✅ SWAP: ahora la X queda última */}
      {hasValue ? (
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled}
          className={cn(
            "h-10 w-10 grid place-items-center rounded-xl border border-border bg-bg",
            "text-muted hover:text-text hover:bg-surface2 transition",
            "focus:outline-none focus:ring-4 focus:ring-primary/20",
            "disabled:opacity-60 disabled:pointer-events-none"
          )}
          title="Limpiar filtro"
          aria-label="Limpiar filtro"
        >
          <X size={18} />
        </button>
      ) : null}
    </div>
  );
}