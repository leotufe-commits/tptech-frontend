// src/components/ui/ArticleSearchSelect.tsx
// Selector de artículo con búsqueda asíncrona — visual idéntico a TPComboCreatable.
// Línea secundaria: Código · SKU · Stock · Precio
//
// Modo variant-aware (cuando se pasa `onSelectVariant`):
//   - Artículos padre con variantes se muestran como AGRUPADOR (header no clickeable)
//   - Las variantes se listan debajo y son clickeables
//   - Productos simples / servicios sin variantes se muestran como items normales
//   - Servicios reciben un badge "Servicio"
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Package, X } from "lucide-react";
import { cn, TP_INPUT } from "./tp";
import { articlesApi, fmtMoney, fmtQty } from "../../services/articles";
import type { ArticleRow, ArticleVariant } from "../../services/articles";

// ---------------------------------------------------------------------------
// Helper: línea secundaria de info
// ---------------------------------------------------------------------------
export function articleInfoLine(row: ArticleRow): string {
  const parts: string[] = [];
  if (row.code) parts.push(row.code);
  if (row.sku) parts.push(`SKU: ${row.sku}`);
  if (row.stockMode === "BY_ARTICLE" && row.stockData != null)
    parts.push(`Stock: ${fmtQty(row.stockData.total)}`);
  if (row.resolvedSalePrice) parts.push(fmtMoney(row.resolvedSalePrice));
  return parts.join(" · ");
}

function activeVariants(row: ArticleRow): ArticleVariant[] {
  return (row.variants ?? []).filter(v => v.isActive !== false);
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function ArticleSearchSelect({
  selected,
  selectedVariantId,
  onSelect,
  onSelectVariant,
  onClear,
  placeholder = "Buscar por nombre, código o SKU…",
  articleType,
  currentGroupId,
}: {
  selected: ArticleRow | null;
  /** Id de la variante seleccionada (modo variant-aware) — usado para el display del input */
  selectedVariantId?: string | null;
  onSelect: (row: ArticleRow) => void;
  /** Callback para selección de variante. Si se define, el componente entra en modo variant-aware:
   *  los padres con variantes pasan a ser agrupadores no-clickeables y las variantes se listan
   *  individualmente. Productos/servicios sin variantes siguen llamando a `onSelect`. */
  onSelectVariant?: (row: ArticleRow, variantId: string) => void;
  onClear: () => void;
  placeholder?: string;
  /** Filtra los resultados por tipo de artículo (ej: "PRODUCT", "SERVICE") */
  articleType?: string;
  /** ID del grupo actual. Si se provee, artículos de otros grupos aparecen deshabilitados. */
  currentGroupId?: string;
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

  function isRowDisabled(row: ArticleRow): { disabled: boolean; reason: string | null } {
    if (!currentGroupId || !row.groupId) return { disabled: false, reason: null };
    if (row.groupId === currentGroupId) return { disabled: true, reason: "Ya está en este grupo" };
    return { disabled: true, reason: `Pertenece a: ${row.group?.name ?? "otro grupo"}` };
  }

  function pick(row: ArticleRow) {
    if (isRowDisabled(row).disabled) return;
    onSelect(row);
    setQuery("");
    setOptions([]);
    setOpen(false);
  }

  function pickVariant(row: ArticleRow, variant: ArticleVariant) {
    if (isRowDisabled(row).disabled) return;
    if (!onSelectVariant) {
      // Fallback al comportamiento legacy si no se pasó onSelectVariant
      onSelect(row);
    } else {
      onSelectVariant(row, variant.id);
    }
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

  // ── Items navegables (en modo variant-aware: cada variante es un item) ─
  type SelectableItem =
    | { kind: "row"; row: ArticleRow }
    | { kind: "variant"; row: ArticleRow; variant: ArticleVariant };

  const variantAware = !!onSelectVariant;
  const selectableItems: SelectableItem[] = variantAware
    ? options.flatMap<SelectableItem>(row => {
        const vars = activeVariants(row);
        if (vars.length > 0) return vars.map(v => ({ kind: "variant", row, variant: v }));
        return [{ kind: "row", row }];
      })
    : options.map<SelectableItem>(row => ({ kind: "row", row }));

  function pickItem(item: SelectableItem) {
    if (item.kind === "variant") pickVariant(item.row, item.variant);
    else pick(item.row);
  }

  // ── Teclado ─────────────────────────────────────────────────────────────
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, selectableItems.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0 && activeIndex < selectableItems.length) {
      e.preventDefault();
      pickItem(selectableItems[activeIndex]);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const canClear   = Boolean(selected);
  const rightPad   = canClear ? "pr-16" : "pr-10";
  // Display text: si hay variante seleccionada, mostrar "Padre · Variante"
  const selectedVariantName = selected && selectedVariantId
    ? activeVariants(selected).find(v => v.id === selectedVariantId)?.name ?? null
    : null;
  const inputValue = selected
    ? (selectedVariantName ? `${selected.name} · ${selectedVariantName}` : selected.name)
    : query;

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
            <div className="max-h-64 overflow-auto p-2 space-y-0.5">
              {options.map(row => {
                const vars = activeVariants(row);
                const isGrouper = variantAware && vars.length > 0;
                const { disabled, reason } = isRowDisabled(row);
                const isService = row.articleType === "SERVICE";
                const info = articleInfoLine(row);

                if (isGrouper) {
                  // Padre con variantes → encabezado agrupador (no clickeable) + variantes hijas
                  return (
                    <div key={row.id} className="pt-1 first:pt-0">
                      {/* ── Header agrupador (no clickeable) ── */}
                      <div className="flex items-center gap-2 px-2 py-1">
                        <div className="shrink-0 w-7 h-7 rounded-md overflow-hidden border border-border bg-surface2 flex items-center justify-center">
                          {row.mainImageUrl
                            ? <img src={row.mainImageUrl} alt="" className="w-full h-full object-cover" />
                            : <Package size={12} className="text-muted opacity-50" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold uppercase tracking-wide text-muted/70 truncate">
                            {row.name}
                          </div>
                          {reason && (
                            <div className="text-[11px] text-amber-600 truncate">{reason}</div>
                          )}
                        </div>
                      </div>
                      {/* ── Variantes (clickeables) ── */}
                      {vars.map(v => {
                        const idx = selectableItems.findIndex(it => it.kind === "variant" && it.variant.id === v.id);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            tabIndex={-1}
                            onClick={() => pickVariant(row, v)}
                            onMouseEnter={() => { if (!disabled) setActiveIndex(idx); }}
                            disabled={disabled}
                            className={cn(
                              "w-full rounded-lg pl-9 pr-2 py-1.5 text-left transition-colors flex items-center gap-2",
                              disabled
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-primary/10 cursor-pointer",
                              !disabled && idx === activeIndex && "bg-primary/10"
                            )}
                          >
                            {/* Miniatura de variante (si hay) */}
                            {v.imageUrl && (
                              <div className="shrink-0 w-6 h-6 rounded border border-border bg-surface2 overflow-hidden">
                                <img src={v.imageUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-text leading-snug truncate">
                                {v.name || v.code}
                              </div>
                              <div className="text-xs text-muted mt-0.5 truncate">
                                {row.name}
                                {v.sku && <span className="ml-1 font-mono text-muted/70">· {v.sku}</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                // Item normal — producto simple, servicio o (modo legacy) padre con/sin variantes
                const idx = selectableItems.findIndex(it => it.kind === "row" && it.row.id === row.id);
                return (
                  <button
                    key={row.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => pick(row)}
                    onMouseEnter={() => { if (!disabled) setActiveIndex(idx); }}
                    disabled={disabled}
                    className={cn(
                      "w-full rounded-xl px-2 py-2 text-left text-sm transition-colors",
                      disabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-primary/10 cursor-pointer",
                      !disabled && idx === activeIndex && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Miniatura */}
                      <div className={cn(
                        "shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-border bg-surface2 flex items-center justify-center",
                        disabled && "grayscale"
                      )}>
                        {row.mainImageUrl
                          ? <img src={row.mainImageUrl} alt="" className="w-full h-full object-cover" />
                          : <Package size={14} className="text-muted opacity-50" />
                        }
                      </div>
                      {/* Texto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isService && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-sky-500/15 text-sky-600 dark:text-sky-400">
                              Servicio
                            </span>
                          )}
                          <span className="font-medium text-text leading-snug truncate">{row.name}</span>
                        </div>
                        {reason ? (
                          <div className="text-[11px] text-amber-600 mt-0.5 truncate">{reason}</div>
                        ) : info ? (
                          <div className="text-[11px] text-muted mt-0.5 truncate">{info}</div>
                        ) : null}
                      </div>
                    </div>
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
