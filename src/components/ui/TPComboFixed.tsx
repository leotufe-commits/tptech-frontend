// src/components/ui/TPComboFixed.tsx
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { ChevronDown, Check, Search, Star } from "lucide-react";
import { cn, TP_INPUT } from "./tp";

type Option = { value: string; label: string; disabled?: boolean; isHeader?: boolean; isFavorite?: boolean };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  tabIndex?: number;
  className?: string;
  /** Permite escribir para filtrar opciones */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Si se provee, muestra una estrella en cada opción para marcarla como predeterminada */
  onSetFavorite?: (value: string) => void;
  /** Valor actualmente marcado como predeterminado (alternativa a isFavorite en cada opción) */
  favoriteValue?: string | null;
};

export default function TPComboFixed({
  value,
  onChange,
  options,
  placeholder = "Seleccionar…",
  disabled = false,
  tabIndex,
  className,
  searchable = false,
  searchPlaceholder = "Buscar…",
  onSetFavorite,
  favoriteValue,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [searchText, setSearchText] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  /* Opciones filtradas (solo cuando searchable) */
  const filteredOptions = searchable && searchText.trim()
    ? options.filter((o) =>
        !o.isHeader && o.label.toLowerCase().includes(searchText.trim().toLowerCase())
      )
    : options;

  /* Calcular posición del dropdown */
  function calcDropdownStyle(): React.CSSProperties {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const dropdownMaxH = 288; // max-h-64 (256) + padding
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    if (spaceBelow >= dropdownMaxH || spaceBelow >= spaceAbove) {
      return {
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      };
    }
    return {
      position: "fixed",
      bottom: window.innerHeight - rect.top + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    };
  }

  /* Cerrar al hacer click fuera */
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      const dropdown = document.getElementById("tp-combo-fixed-portal");
      if (
        !wrapRef.current?.contains(target) &&
        !dropdown?.contains(target)
      ) {
        setOpen(false);
        setSearchText("");
      }
    }
    // capture:true para disparar antes del stopPropagation del Modal
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []);

  /* Cerrar al hacer scroll o resize */
  useEffect(() => {
    if (!open) return;
    function onScroll() {
      setDropdownStyle(calcDropdownStyle());
    }
    function onResize() {
      setDropdownStyle(calcDropdownStyle());
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Encuentra el próximo índice seleccionable (no-header) en una dirección */
  function nextSelectable(arr: Option[], from: number, dir: 1 | -1): number {
    let idx = from;
    while (idx >= 0 && idx < arr.length) {
      if (!arr[idx].isHeader) return idx;
      idx += dir;
    }
    // Si no hay hacia adelante, buscar hacia el otro lado
    idx = from - dir;
    while (idx >= 0 && idx < arr.length) {
      if (!arr[idx].isHeader) return idx;
      idx -= dir;
    }
    return -1;
  }

  /* Al abrir/cerrar: resetear activeIndex */
  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      setSearchText("");
      return;
    }
    setDropdownStyle(calcDropdownStyle());
    const idx = filteredOptions.findIndex((o) => o.value === value && !o.isHeader);
    setActiveIndex(idx >= 0 ? idx : nextSelectable(filteredOptions, 0, 1));

    /* En modo searchable enfocar el input de búsqueda */
    if (searchable) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Al filtrar, resetear activeIndex al primer resultado */
  useEffect(() => {
    if (!open) return;
    const idx = filteredOptions.findIndex((o) => o.value === value && !o.isHeader);
    setActiveIndex(idx >= 0 ? idx : nextSelectable(filteredOptions, 0, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setSearchText("");
    setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setOpen((v) => !v);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const candidate = prev < 0 ? 0 : Math.min(prev + 1, filteredOptions.length - 1);
        const next = nextSelectable(filteredOptions, candidate, 1);
        if (next >= 0) itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next >= 0 ? next : prev;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const candidate = prev <= 0 ? 0 : prev - 1;
        const next = nextSelectable(filteredOptions, candidate, -1);
        if (next >= 0) itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next >= 0 ? next : prev;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = activeIndex >= 0 ? filteredOptions[activeIndex] : undefined;
      if (opt && !opt.isHeader) pick(opt.value);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  function onNonSearchKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIndex((prev) => {
        const candidate = prev < 0 ? 0 : Math.min(prev + 1, options.length - 1);
        const next = nextSelectable(options, candidate, 1);
        if (next >= 0) itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next >= 0 ? next : prev;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIndex((prev) => {
        const candidate = prev <= 0 ? 0 : prev - 1;
        const next = nextSelectable(options, candidate, -1);
        if (next >= 0) itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next >= 0 ? next : prev;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const opt = activeIndex >= 0 ? options[activeIndex] : undefined;
      if (opt && !opt.isHeader) pick(opt.value);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const dropdown = open && !disabled && ReactDOM.createPortal(
    <div
      id="tp-combo-fixed-portal"
      data-tp-portal
      style={dropdownStyle}
      className="rounded-2xl border border-border bg-card shadow-soft"
      role="listbox"
    >
      {/* Campo de búsqueda (solo si searchable) */}
      {searchable && (
        <div className="p-2 pb-1">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              ref={searchRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              className={cn(
                TP_INPUT,
                "w-full !pl-8 py-1.5 text-sm h-8"
              )}
            />
          </div>
        </div>
      )}

      <div className="max-h-64 overflow-auto p-2 pt-1">
        {filteredOptions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted text-center">
            Sin resultados
          </p>
        ) : (
          filteredOptions.map((opt, idx) => {
            if (opt.isHeader) {
              return (
                <div
                  key={opt.value}
                  className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted select-none"
                >
                  {opt.label}
                </div>
              );
            }
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;
            const isOptDisabled = !!opt.disabled;
            return (
              <button
                key={opt.value}
                ref={(el) => { itemRefs.current[idx] = el; }}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={isOptDisabled}
                onMouseEnter={() => !isOptDisabled && setActiveIndex(idx)}
                onClick={() => !isOptDisabled && pick(opt.value)}
                tabIndex={-1}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm flex items-center gap-2 transition",
                  isOptDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-primary/10 cursor-pointer",
                  !isOptDisabled && isActive && "bg-primary/10",
                  isSelected && "font-semibold"
                )}
              >
                <span className="flex-1">{opt.label}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="w-[14px] flex items-center justify-center">
                    {isSelected && <Check size={14} className="text-primary" />}
                  </span>
                  {onSetFavorite && (() => {
                    const isFav = favoriteValue !== undefined
                      ? opt.value === favoriteValue
                      : !!opt.isFavorite;
                    return (
                      <span
                        role="button"
                        title={isFav ? "Predeterminado para nuevas entidades" : "Usar como predeterminado para nuevas entidades"}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        onClick={(e) => { e.stopPropagation(); onSetFavorite(opt.value); }}
                        className={cn(
                          "shrink-0 transition-colors",
                          isFav ? "text-yellow-400" : "text-muted/30 hover:text-yellow-400"
                        )}
                      >
                        <Star size={13} className={isFav ? "fill-yellow-400" : ""} />
                      </span>
                    );
                  })()}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={wrapRef} className={cn("relative w-full", disabled && "opacity-[0.65] pointer-events-none", className)}>
      {/* Trigger */}
      <input
        ref={triggerRef}
        readOnly
        tabIndex={disabled ? -1 : tabIndex}
        disabled={disabled}
        value={selectedLabel}
        placeholder={placeholder}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={searchable ? onTriggerKeyDown : onNonSearchKeyDown}
        className={cn(TP_INPUT, "w-full cursor-pointer pr-9", disabled && "!opacity-100")}
        aria-haspopup="listbox"
        aria-expanded={open}
      />

      <ChevronDown
        size={16}
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-transform",
          open && "rotate-180"
        )}
      />

      {dropdown}
    </div>
  );
}
