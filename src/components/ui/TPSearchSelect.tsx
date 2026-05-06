// src/components/ui/TPSearchSelect.tsx
// ============================================================================
// TPSearchSelect — buscador + select genérico, reutilizable.
//
// Pensado como primitivo para construir buscadores tipados de entidades
// (clientes, proveedores, vendedores, almacenes, etc.). Soporta:
//   · Búsqueda en línea con highlight + navegación con teclado
//   · Renderers personalizados de fila (renderOption) y meta del seleccionado
//     (renderSelectedMeta)
//   · Footer de dropdown (renderDropdownFooter) — útil para acciones
//     "Crear nuevo" o atajos
//   · Estado loading (visual) listo para fetch async en el futuro
//
// Comportamiento de foco / dropdown (consistente con guidelines TPTech):
//   · El dropdown NO se abre solo por foco
//   · Se abre con: typing, ArrowDown, click explícito en input
//   · Enter selecciona el item highlighted (no abre el dropdown si está cerrado)
//   · Escape cierra solo el dropdown (no propaga al modal contenedor)
//
// Diseñado para anidarse adentro de modales (ver Modal.tsx) sin romper el
// trap de Tab/Enter/Escape global.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X as XIcon, Loader2, ChevronDown } from "lucide-react";

import { cn } from "./tp";

export type TPSearchSelectProps<T> = {
  value: T | null;
  onChange: (value: T | null) => void;
  options: T[];

  /** Devuelve el label legible de una opción (usado en el input cuando hay selección y como fallback de fila). */
  getOptionLabel: (option: T) => string;
  /** Devuelve un id único de la opción (usado como `key` y para detectar selección). */
  getOptionValue: (option: T) => string;
  /**
   * Devuelve el texto sobre el que se filtra al tipear. Si se omite, se
   * filtra solo por `getOptionLabel`. Útil para agregar email/teléfono/etc.
   */
  getOptionSearchableText?: (option: T) => string;

  /** Render personalizado de fila del dropdown. Si se omite, se muestra el label. */
  renderOption?: (option: T, ctx: { highlighted: boolean }) => React.ReactNode;
  /** Bloque opcional bajo el input cuando hay selección y el dropdown está cerrado (ej. badges, saldo, link "Ver ficha"). */
  renderSelectedMeta?: (option: T) => React.ReactNode;
  /** Footer del dropdown (ej. acciones "+ Crear nuevo"). Recibe el query actual por si querés precargar. */
  renderDropdownFooter?: (query: string) => React.ReactNode;
  /** Texto cuando la lista filtrada está vacía. */
  renderEmpty?: (query: string) => React.ReactNode;

  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Visual; reservado para futuro fetch async. */
  loading?: boolean;
};

export function TPSearchSelect<T>({
  value,
  onChange,
  options,
  getOptionLabel,
  getOptionValue,
  getOptionSearchableText,
  renderOption,
  renderSelectedMeta,
  renderDropdownFooter,
  renderEmpty,
  placeholder,
  disabled = false,
  className,
  loading = false,
}: TPSearchSelectProps<T>) {
  const [query, setQuery]     = useState("");
  const [isOpen, setIsOpen]   = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef     = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Click/touch fuera cierra el dropdown.
  // IMPORTANTE: capturamos `pointerdown` en fase de captura — algunos
  // ancestros (ej. Modal) hacen stopPropagation en mousedown y un listener
  // en bubbling no se enteraría.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  // Cierre cuando el foco pasa a un elemento fuera del combo (Tab, click en
  // otro input).
  useEffect(() => {
    if (!isOpen) return;
    function onFocusIn(e: FocusEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, [isOpen]);

  // Cierre con Escape en captura — antes de que el Modal lo procese.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    const getText = getOptionSearchableText ?? getOptionLabel;
    return options.filter((o) => getText(o).toLowerCase().includes(term));
  }, [options, query, getOptionSearchableText, getOptionLabel]);

  useEffect(() => { setHighlight(0); }, [query, isOpen]);

  function commitSelection(item: T) {
    onChange(item);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function clearSelection() {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      // Solo ArrowDown abre el dropdown desde cerrado.
      if (e.key === "ArrowDown") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      const picked = filtered[highlight];
      if (picked) {
        e.preventDefault();
        e.stopPropagation();
        commitSelection(picked);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className={cn(
        // Foco coherente con `.tp-input` (ver index.css): borde primario + halo
        // sutil de 1px. Sin outline, sin doble ring, sin invadir el dark mode.
        "flex items-center gap-2 rounded-xl border border-border bg-card px-3",
        "transition-[box-shadow,border-color] duration-150",
        "focus-within:border-[color-mix(in_oklab,var(--primary)_60%,var(--border))]",
        "focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_35%,transparent)]",
      )}>
        <Search size={14} className="text-muted shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : (value ? getOptionLabel(value) : "")}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onClick={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text outline-none placeholder:text-muted disabled:opacity-60 focus:shadow-none focus-visible:shadow-none focus-visible:border-transparent"
          aria-autocomplete="list"
          aria-expanded={isOpen}
        />
        {loading && <Loader2 size={12} className="animate-spin text-muted shrink-0" />}
        {value && !disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-surface2 hover:text-text"
            title="Quitar selección"
            aria-label="Quitar selección"
          >
            <XIcon size={12} />
          </button>
        )}
        {!disabled && (
          <button
            type="button"
            onMouseDown={(e) => {
              // Si el menú está cerrado y el input no tiene foco, el click va a
              // disparar foco + apertura. Si está abierto, queremos cerrar.
              // Usamos onMouseDown para preceder al blur del input.
              e.preventDefault();
              setIsOpen((o) => !o);
              inputRef.current?.focus();
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted hover:text-text"
            title={isOpen ? "Cerrar" : "Abrir"}
            aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
          >
            <ChevronDown
              size={14}
              className={cn("transition-transform duration-150", isOpen && "rotate-180")}
            />
          </button>
        )}
      </div>

      {value && !isOpen && renderSelectedMeta ? (
        <div className="mt-1">{renderSelectedMeta(value)}</div>
      ) : null}

      {isOpen && !disabled ? (
        <div
          ref={panelRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded-md border border-border shadow-2xl ring-1 ring-black/10"
          style={{ backgroundColor: "var(--card)", backdropFilter: "none" }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted">
              {renderEmpty ? renderEmpty(query) : (
                <>Sin resultados{query ? ` para «${query}»` : ""}.</>
              )}
            </div>
          ) : (
            <ul role="listbox">
              {filtered.map((opt, idx) => {
                const highlighted = idx === highlight;
                return (
                  <li
                    key={getOptionValue(opt)}
                    role="option"
                    aria-selected={highlighted}
                    onMouseDown={(ev) => { ev.preventDefault(); commitSelection(opt); }}
                    onMouseEnter={() => setHighlight(idx)}
                    className={cn(
                      "cursor-pointer",
                      highlighted ? "bg-primary/10 text-text" : "text-text/80 hover:bg-surface2/60"
                    )}
                  >
                    {renderOption ? renderOption(opt, { highlighted }) : (
                      <div className="px-3 py-2 text-sm">{getOptionLabel(opt)}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {renderDropdownFooter ? (
            <div className="border-t border-border">{renderDropdownFooter(query)}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default TPSearchSelect;
