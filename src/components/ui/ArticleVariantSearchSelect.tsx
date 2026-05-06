// src/components/ui/ArticleVariantSearchSelect.tsx
// Selector de artículo/variante en un solo paso — para movimientos de stock.
// Muestra artículos simples y variantes en una lista plana unificada.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Package, X } from "lucide-react";
import { cn, TP_INPUT } from "./tp";
import { articlesApi, variantLabel } from "../../services/articles";
import type { ArticleRow, ArticleVariant } from "../../services/articles";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------
export type VariantSelectResult = {
  articleId: string;
  articleName: string;
  articleCode: string;
  articleRow: ArticleRow;             // row de lista (tiene computedCostBase, resolvedSalePrice)
  variantId: string | null;           // null → artículo simple sin variantes
  variantName: string | null;         // etiqueta visual de la variante seleccionada
  variantSku: string | null;          // SKU real de la variante (null si es artículo simple)
  defaultQuantity: string | null;     // nivel variante primero, nivel artículo como fallback
  variantWeightOverride: string | null; // weightOverride de la variante (null si artículo simple)
};

// ---------------------------------------------------------------------------
// Tipos internos del dropdown — lista plana, sin headers de grupo
// ---------------------------------------------------------------------------
type SelectableItem = {
  kind: "item";
  key: string;
  articleId: string;
  articleName: string;
  articleCode: string;
  articleRow: ArticleRow;
  variantId: string | null;
  variantName: string | null;
  variantSku: string | null;
  defaultQuantity: string | null;
  variantWeightOverride: string | null;
  displayLabel: string;            // nombre principal (incluye artículo para variantes)
  subLabel: string;                // SKU u otros metadatos
  itemType: "ARTICLE" | "VARIANT"; // para badge visual
  imgUrl: string | null;           // imagen para mostrar en el dropdown
};

// ---------------------------------------------------------------------------
// Construir la lista plana unificada
// ---------------------------------------------------------------------------
function buildItems(
  articles: ArticleRow[],
  detailsMap: Map<string, ArticleVariant[]>
): SelectableItem[] {
  const result: SelectableItem[] = [];

  for (const article of articles) {
    const variants = detailsMap.get(article.id) ?? [];

    const articleImg = article.mainImageUrl || null;

    if (variants.length === 0) {
      // Artículo simple — un solo item seleccionable
      result.push({
        kind: "item",
        key: `art-${article.id}`,
        articleId: article.id,
        articleName: article.name,
        articleCode: article.code,
        articleRow: article,
        variantId: null,
        variantName: null,
        variantSku: article.sku || null,
        defaultQuantity: article.defaultQuantity,
        variantWeightOverride: null,
        displayLabel: article.name,
        subLabel: article.sku ? `SKU: ${article.sku}` : "",
        itemType: "ARTICLE",
        imgUrl: articleImg,
      });
    } else {
      // Artículo con variantes — un item por variante, nombre completo "Artículo — Variante"
      for (const v of variants) {
        const label = variantLabel(v);
        const sku   = v.sku || v.code || "";
        const variantMainImg = v.images?.find((img) => img.isMain)?.url || v.imageUrl || null;
        result.push({
          kind: "item",
          key: `var-${article.id}-${v.id}`,
          articleId: article.id,
          articleName: article.name,
          articleCode: article.code,
          articleRow: article,
          variantId: v.id,
          variantName: label,
          variantSku: v.sku || null,
          defaultQuantity: v.defaultQuantity ?? article.defaultQuantity,
          variantWeightOverride: v.weightOverride ?? null,
          displayLabel: `${article.name} — ${label}`,
          subLabel: sku ? `SKU: ${sku}` : "",
          itemType: "VARIANT",
          imgUrl: variantMainImg || articleImg,
        });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function ArticleVariantSearchSelect({
  selected,
  onSelect,
  onClear,
  placeholder = "Buscar artículo o variante…",
  stockMap,
}: {
  /**
   * Estado "seleccionado". Pasar null cuando no hay nada seleccionado.
   * articleName + variantName para construir el texto que se muestra en el input.
   */
  selected: { articleName: string; variantName: string | null } | null;
  onSelect: (result: VariantSelectResult) => void;
  onClear: () => void;
  placeholder?: string;
  /** Stock por clave `${articleId}|${variantId ?? ""}`. Si se pasa, cada opción muestra el stock del almacén. */
  stockMap?: Record<string, number>;
}) {
  const wrapRef     = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [query,       setQuery]       = useState("");
  const [items,       setItems]       = useState<SelectableItem[]>([]);
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropStyle,   setDropStyle]   = useState<React.CSSProperties>({});

  // Generación para ignorar resultados de búsquedas anteriores
  const genRef = useRef(0);
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Posición del dropdown ────────────────────────────────────────────────
  function calcDropStyle(): React.CSSProperties {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const maxH = 320;
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
    window.addEventListener("resize",  update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize",  update);
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
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []);

  // ── Reset índice activo cuando cambian los items ─────────────────────────
  useEffect(() => {
    setActiveIndex(items.length > 0 ? 0 : -1);
  }, [items]);

  // ── Búsqueda: usa variantes del list response (sin N+1 calls) ────────────
  async function doSearch(val: string) {
    genRef.current++;
    const gen = genRef.current;

    setLoading(true);
    setItems([]);

    try {
      const res = await articlesApi.list({ q: val, take: 10 });
      if (gen !== genRef.current) return;

      // Las variantes ya vienen en el response de lista — sin llamadas adicionales
      const detailsMap = new Map<string, ArticleVariant[]>();
      for (const a of res.rows) {
        detailsMap.set(a.id, (a.variants ?? []).filter((v: any) => v.isActive));
      }

      if (gen !== genRef.current) return;
      setItems(buildItems(res.rows, detailsMap));
    } catch {
      if (gen !== genRef.current) return;
      setItems([]);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }

  function search(val: string) {
    setQuery(val);
    setDropStyle(calcDropStyle());
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSearch(val), 300);
  }

  function openDropdown() {
    if (selected) {
      onClear();
      setQuery("");
      setItems([]);
      setDropStyle(calcDropStyle());
      setOpen(true);
      inputRef.current?.focus();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void doSearch(""), 150);
      return;
    }
    setDropStyle(calcDropStyle());
    if (items.length > 0) { setOpen(true); return; }
    void doSearch(query);
    setOpen(true);
  }

  function pick(item: SelectableItem) {
    onSelect({
      articleId:            item.articleId,
      articleName:          item.articleName,
      articleCode:          item.articleCode,
      articleRow:           item.articleRow,
      variantId:            item.variantId,
      variantName:          item.variantName,
      variantSku:           item.variantSku,
      defaultQuantity:      item.defaultQuantity,
      variantWeightOverride: item.variantWeightOverride,
    });
    setQuery("");
    setItems([]);
    setOpen(false);
  }

  function clear() {
    onClear();
    setQuery("");
    setItems([]);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // ── Teclado ─────────────────────────────────────────────────────────────
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0 && activeIndex < items.length) {
      e.preventDefault();
      pick(items[activeIndex]);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const canClear   = Boolean(selected);
  const rightPad   = canClear ? "pr-16" : "pr-10";
  const inputValue = selected
    ? selected.variantName
      ? `${selected.articleName} — ${selected.variantName}`
      : selected.articleName
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

        {/* Dropdown con resultados */}
        {open && (loading || items.length > 0) && createPortal(
          <div
            ref={dropdownRef}
            data-tp-portal
            style={{ ...dropStyle, position: "fixed", zIndex: 9999 }}
            className="rounded-2xl border border-border bg-card shadow-soft"
            onMouseDown={e => e.preventDefault()}
          >
            <div className="max-h-72 overflow-auto p-2">
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
                  <Loader2 size={13} className="animate-spin shrink-0" />
                  Buscando…
                </div>
              ) : (
                items.map((item, idx) => {
                  const isActive  = idx === activeIndex;
                  const stockKey  = `${item.articleId}|${item.variantId ?? ""}`;
                  const stockQty  = stockMap != null ? (stockMap[stockKey] ?? 0) : undefined;
                  const price     = item.articleRow.resolvedSalePrice;

                  // Línea secundaria: SKU · precio
                  const meta: string[] = [];
                  if (item.subLabel) meta.push(item.subLabel);
                  if (price != null && Number(price) > 0)
                    meta.push(`$${Number(price).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

                  // Color del stock
                  const stockColorClass =
                    stockQty === undefined ? "text-muted" :
                    stockQty < 0          ? "text-red-500" :
                    stockQty > 0          ? "text-green-500" : "text-muted";

                  return (
                    <button
                      key={item.key}
                      type="button"
                      tabIndex={-1}
                      onClick={() => pick(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "w-full rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-primary/10",
                        isActive && "bg-primary/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {/* Miniatura */}
                        <div className="shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-border bg-surface2 flex items-center justify-center">
                          {item.imgUrl
                            ? <img src={item.imgUrl} alt="" className="w-full h-full object-cover" />
                            : <Package size={14} className="text-muted opacity-50" />
                          }
                        </div>

                        {/* Texto */}
                        <div className="flex-1 min-w-0">
                          {/* Nombre + badge de tipo */}
                          <div className="flex items-center gap-2 leading-snug">
                            <span className="font-medium text-text truncate flex-1">
                              {item.displayLabel}
                            </span>
                            <span className={cn(
                              "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                              item.itemType === "ARTICLE"
                                ? "bg-primary/10 text-primary"
                                : "bg-blue-500/10 text-blue-600"
                            )}>
                              {item.itemType === "ARTICLE" ? "Artículo" : "Variante"}
                            </span>
                          </div>

                          {/* Metadatos: SKU · precio · stock */}
                          {(meta.length > 0 || stockQty !== undefined) && (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {meta.length > 0 && (
                                <span className="text-[11px] text-muted truncate">{meta.join(" · ")}</span>
                              )}
                              {stockQty !== undefined && (
                                <span className={cn("text-[11px] font-medium shrink-0", stockColorClass)}>
                                  Stock: {stockQty.toLocaleString("es-AR")}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}

        {/* Sin resultados */}
        {open && !loading && query.trim() && items.length === 0 && createPortal(
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
