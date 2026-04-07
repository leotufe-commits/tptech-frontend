// src/components/ui/ArticleSearchSelect.tsx
// Selector de artículo con búsqueda asíncrona — visual idéntico a TPComboCreatable.
// Línea secundaria: SKU · Stock · Precio
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, X } from "lucide-react";
import { cn, TP_INPUT } from "./tp";
import { articlesApi, fmtMoney, fmtQty } from "../../services/articles";
import type { ArticleRow } from "../../services/articles";

// ---------------------------------------------------------------------------
// Helper: línea secundaria de info
// ---------------------------------------------------------------------------
export function articleInfoLine(row: ArticleRow): string {
  const parts: string[] = [];
  if (row.sku) parts.push(`SKU: ${row.sku}`);
  if (row.stockMode === "BY_ARTICLE" && row.stockData != null)
    parts.push(`Stock: ${fmtQty(row.stockData.total)}`);
  if (row.resolvedSalePrice) parts.push(fmtMoney(row.resolvedSalePrice));
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function ArticleSearchSelect({
  selected,
  onSelect,
  onClear,
  placeholder = "Buscar por nombre, código o SKU…",
  articleType,
}: {
  selected: ArticleRow | null;
  onSelect: (row: ArticleRow) => void;
  onClear: () => void;
  placeholder?: string;
  /** Filtra los resultados por tipo de artículo (ej: "PRODUCT", "SERVICE") */
  articleType?: string;
}) {
  const wrapRef     = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [query,       setQuery]       = useState("");
  const [options,     setOptions]     = useState<ArticleRow[]>([]);
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropStyle,   setDropStyle]   = useState<React.CSSProperties>({});

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Posición del dropdown (igual que TPComboCreatable) ──────────────────
  function calcDropStyle(): React.CSSProperties {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const maxH = 280;
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    if (spaceBelow >= maxH || spaceBelow >= spaceAbove)
      return { top: rect.bottom + 4, left: rect.left, width: rect.width };
    return { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width };
  }

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

  // ── Cierra al hacer click fuera ─────────────────────────────────────────
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !dropdownRef.current?.contains(t))
        setOpen(false);
    }
    // capture:true para disparar antes del stopPropagation del Modal
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []);

  // ── Resetea el índice activo al cambiar opciones ────────────────────────
  useEffect(() => {
    setActiveIndex(options.length > 0 ? 0 : -1);
  }, [options]);

  // ── Búsqueda con debounce ───────────────────────────────────────────────
  function search(val: string) {
    setQuery(val);
    setDropStyle(calcDropStyle());
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await articlesApi.list({ q: val, take: 10, ...(articleType ? { articleType } : {}) });
        setOptions(res.rows);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function openDropdown() {
    if (selected) {
      onClear();
      setQuery("");
      setDropStyle(calcDropStyle());
      setOpen(true);
      inputRef.current?.focus();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await articlesApi.list({ q: "", take: 10, ...(articleType ? { articleType } : {}) });
          setOptions(res.rows);
        } finally {
          setLoading(false);
        }
      }, 150);
      return;
    }
    setDropStyle(calcDropStyle());
    if (options.length > 0) { setOpen(true); return; }
    search(query);
  }

  function pick(row: ArticleRow) {
    onSelect(row);
    setQuery("");
    setOptions([]);
    setOpen(false);
  }

  function clear() {
    onClear();
    setQuery("");
    setOptions([]);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // ── Teclado ─────────────────────────────────────────────────────────────
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, options.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0 && activeIndex < options.length) {
      e.preventDefault();
      pick(options[activeIndex]);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const canClear   = Boolean(selected);
  const rightPad   = canClear ? "pr-16" : "pr-10";
  const inputValue = selected ? selected.name : query;

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          readOnly={Boolean(selected)}
          placeholder={placeholder}
          onChange={e => { if (!selected) search(e.target.value); }}
          onFocus={() => { if (!selected) openDropdown(); }}
          onClick={() => { if (selected) openDropdown(); }}
          onKeyDown={onKeyDown}
          className={cn(TP_INPUT, "w-full", rightPad, selected && "cursor-default")}
        />

        {/* X para limpiar */}
        {canClear && (
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            onClick={clear}
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        )}

        {/* Chevron / Spinner */}
        {loading
          ? <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
              <Loader2 size={15} className="animate-spin" />
            </div>
          : <button
              type="button"
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
              onClick={openDropdown}
            >
              <ChevronDown size={16} />
            </button>
        }

        {/* Dropdown con opciones */}
        {open && options.length > 0 && createPortal(
          <div
            ref={dropdownRef}
            data-tp-portal
            style={{ ...dropStyle, position: "fixed", zIndex: 9999 }}
            className="rounded-2xl border border-border bg-card shadow-soft"
            onMouseDown={e => e.preventDefault()}
          >
            <div className="max-h-64 overflow-auto p-2">
              {options.map((row, idx) => {
                const info = articleInfoLine(row);
                return (
                  <button
                    key={row.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => pick(row)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-primary/10",
                      idx === activeIndex && "bg-primary/10"
                    )}
                  >
                    <div className="font-medium text-text leading-snug truncate">{row.name}</div>
                    {info && (
                      <div className="text-[11px] text-muted mt-0.5 truncate">{info}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}

        {/* Sin resultados */}
        {open && !loading && query.trim() && options.length === 0 && createPortal(
          <div
            data-tp-portal
            style={{ ...dropStyle, position: "fixed", zIndex: 9999 }}
            className="rounded-2xl border border-border bg-card shadow-soft"
          >
            <div className="px-3 py-3 text-sm text-muted">Sin resultados</div>
          </div>,
          document.body
        )}
      </div>

    </div>
  );
}
