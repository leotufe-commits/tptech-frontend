// src/pages/article-detail/CostRow.tsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { GripVertical, Star, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import TPComboFixed  from "../../components/ui/TPComboFixed";
import TPInput       from "../../components/ui/TPInput";
import TPNumberInput from "../../components/ui/TPNumberInput";
import TPIconButton  from "../../components/ui/TPIconButton";
import { cn } from "../../components/ui/tp";
import { _previewLineAdjSkeleton, type MetalVariantOption, type CurrencyOption } from "../../components/ui/CostCompositionTable";

import type { CostLine, QuantityUnit, ArticleVariant } from "../../services/articles";
import type { Unit } from "../../services/units";
import type { MetalVariantRow } from "../../services/valuation";

// ---------------------------------------------------------------------------
// Grid layout — compartido por el encabezado y cada fila
// ---------------------------------------------------------------------------
export const COST_GRID =
  "grid grid-cols-[24px_80px_75px_1fr_150px_180px_131px_188px_120px_32px] items-center gap-x-2";

// ---------------------------------------------------------------------------
// Constantes visuales
// ---------------------------------------------------------------------------
export const COST_TYPE_CHIP: Record<string, { label: string; cls: string }> = {
  METAL:   { label: "Metal",    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  HECHURA: { label: "Hechura",  cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400"   },
  PRODUCT: { label: "Producto", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  SERVICE: { label: "Servicio", cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
};

export const COST_ROW_BG: Record<string, string> = {
  METAL:   "bg-amber-500/5  hover:bg-amber-500/10",
  HECHURA: "bg-blue-500/5   hover:bg-blue-500/10",
  PRODUCT: "bg-violet-500/5 hover:bg-violet-500/10",
  SERVICE: "bg-green-500/5  hover:bg-green-500/10",
};

const COST_ROW_BORDER_L: Record<string, string> = {
  METAL:   "border-l-amber-400/60",
  HECHURA: "border-l-blue-400/60",
  PRODUCT: "border-l-violet-400/60",
  SERVICE: "border-l-green-400/60",
};

const SUBTOTAL_COLOR: Record<string, string> = {
  METAL:   "text-amber-600 dark:text-amber-400",
  HECHURA: "text-blue-600 dark:text-blue-400",
  PRODUCT: "text-violet-600 dark:text-violet-400",
  SERVICE: "text-green-600 dark:text-green-400",
};

// ---------------------------------------------------------------------------
// Tipo para ítems de producto / servicio
// ---------------------------------------------------------------------------
export type ProductItem = {
  id: string;
  name: string;
  sku?: string | null;
  stock?: number | null;
  costPrice: number | null;
  costPriceNative?: number | null;
  manualCurrencyId: string | null;
  /** URL de imagen principal del artículo (mainImageUrl). Vacío si no hay. */
  mainImageUrl?: string;
  /** Nombre de la categoría, opcional para enriquecer el render del combo. */
  categoryName?: string;
};

// ---------------------------------------------------------------------------
// Helper de cálculo — SKELETON mientras el usuario edita la composición.
//
// El cálculo autoritativo de costo vive en el pricing-engine del backend y se
// consume vía articlesApi.previewCostLines (POST /articles/:id/cost-lines/preview).
// Esta función es solo aproximación para feedback visual inmediato.
// ---------------------------------------------------------------------------
export function calcCostLine(
  line: CostLine,
  currencyOptions: CurrencyOption[],
  baseCurrencyId: string,
): number {
  if (!line.quantity || !line.unitValue) return 0;
  let raw = line.quantity * line.unitValue;
  if (line.type !== "METAL")
    raw = _previewLineAdjSkeleton(raw, line.lineAdjKind ?? "", line.lineAdjType ?? "", line.lineAdjValue ?? null);
  const currId = line.currencyId ?? baseCurrencyId;
  if (currId !== baseCurrencyId) {
    const curr = currencyOptions.find(c => c.id === currId);
    if (curr?.latestRate != null) raw = raw * curr.latestRate;
    else return 0;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export type SortableCostRowProps = {
  id: string;
  line: CostLine;

  baseCurrencyId: string;
  selSym: string;

  metalVariants: MetalVariantRow[];
  metalVariantOptions: MetalVariantOption[];
  currencyOptions: CurrencyOption[];
  productItems: ProductItem[];
  serviceItems: ProductItem[];
  /** Fase 6 — fuente unificada para el selector de cantidad por peso (g, kt, etc.).
   *  Reemplaza al antiguo CatalogItem[] de MULTIPLIER_BASE.
   *  El valor que se persiste sigue siendo string (Unit.code), no FK. */
  weightUnits: Unit[];

  onPatch: (patch: Partial<CostLine>) => void;
  onRemove: () => void;
  onSetMetalFavorite: (variantId: string) => Promise<void>;
  onToggleUnitFavorite: (itemId: string, isFavorite: boolean) => void;
  /** Cuando true, el padre es un combo comercial: oculta el selector "Sí/No descuenta stock"
   *  (siempre Sí, forzado por backend) y simplifica la UI de la línea PRODUCT. */
  isCombo?: boolean;
  /** Devuelve la lista de variantes activas del artículo componente (cache).
   *  `undefined` cuando todavía no se cargó; `[]` cuando no tiene variantes. */
  getVariantsForArticle?: (articleId: string) => ArticleVariant[] | undefined;
  /** Dispara la carga lazy de variantes para un artículo (idempotente). */
  loadVariantsForArticle?: (articleId: string) => void;
  /** True cuando el modal ya intentó guardar al menos una vez — habilita
   *  mostrar el error rojo del sub-selector de variante. */
  submitted?: boolean;
};

// ---------------------------------------------------------------------------
// SortableCostRow
// ---------------------------------------------------------------------------
export function SortableCostRow({
  id,
  line,
  baseCurrencyId,
  selSym,
  metalVariants,
  metalVariantOptions,
  currencyOptions,
  productItems,
  serviceItems,
  weightUnits,
  onPatch,
  onRemove,
  onSetMetalFavorite,
  onToggleUnitFavorite,
  isCombo = false,
  getVariantsForArticle,
  loadVariantsForArticle,
  submitted = false,
}: SortableCostRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0, width: 120 });
  const [focused,       setFocused]       = useState(false);
  const [stockFavorite, setStockFavorite] = useState("true");

  function fmtN(n: number) {
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const isMetal = line.type === "METAL";
  const lineTotal = calcCostLine(line, currencyOptions, baseCurrencyId);
  const currForLine =
    currencyOptions.find(c => c.id === (line.currencyId ?? baseCurrencyId)) ??
    currencyOptions.find(c => c.isBase);
  const chip = COST_TYPE_CHIP[line.type] ?? { label: line.type, cls: "bg-surface2 text-muted" };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}
      className={cn(
        COST_GRID,
        "px-2 py-2.5 transition-colors group border-l-2",
        COST_ROW_BG[line.type] ?? "hover:bg-surface2/30",
        COST_ROW_BORDER_L[line.type] ?? "border-l-border/40",
        focused && "ring-1 ring-inset ring-primary/20",
        isDragging && "opacity-40 shadow-lg z-10",
      )}
    >
      {/* ── 1. Handle de arrastre ────────────────────────── */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted/25 hover:text-muted/60 transition touch-none self-center"
        title="Arrastrar para reordenar"
      >
        <GripVertical size={13} />
      </button>

      {/* ── 2. Chip de tipo ──────────────────────────────── */}
      <div className="self-center">
        <span className={cn(
          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none whitespace-nowrap",
          chip.cls,
        )}>
          {chip.label}
        </span>
      </div>

      {/* ── 3. Selector de moneda ───────────────────────── */}
      <div className="self-center">
        <TPComboFixed
          value={line.currencyId ?? baseCurrencyId}
          onChange={(v) => {
            const newCurrId = v || null;
            const oldRate   = currencyOptions.find(c => c.id === (line.currencyId ?? baseCurrencyId))?.latestRate ?? 1;
            const newRate   = currencyOptions.find(c => c.id === (newCurrId    ?? baseCurrencyId))?.latestRate ?? 1;
            const inBase    = line.unitValue * oldRate;
            const converted = newRate ? Math.round((inBase / newRate) * 10000) / 10000 : line.unitValue;
            onPatch({ currencyId: newCurrId, unitValue: converted });
          }}
          options={currencyOptions.map(c => ({ value: c.id, label: c.code }))}
        />
      </div>

      {/* ── 4. Descripción / Variante ───────────────────── */}
      <div className="self-center min-w-0 [&_input]:font-medium">
        {isMetal ? (
          <TPComboFixed
            value={line.metalVariantId ?? ""}
            onChange={(v) => {
              const mv     = metalVariantOptions.find(m => m.id === v);
              const mvFull = metalVariants.find(m => m.id === v);
              const sf     = mvFull?.saleFactor ?? 1;
              const mermaPercent = Math.abs(sf - 1) > 0.000001
                ? Math.round((sf - 1) * 10000) / 100
                : null;
              const mermaMul  = 1 + (mermaPercent ?? 0) / 100;
              const basePrice = mvFull?.suggestedPrice != null
                ? Number(mvFull.suggestedPrice)
                : (mv?.latestQuotePrice != null && sf > 0
                  ? Math.round(mv.latestQuotePrice / sf * 10000) / 10000
                  : null);
              let unitValue = basePrice != null
                ? Math.round(basePrice * mermaMul * 100) / 100
                : (mv?.latestQuotePrice ?? line.unitValue);
              if (line.currencyId && line.currencyId !== baseCurrencyId) {
                const lineRate = currencyOptions.find(c => c.id === line.currencyId)?.latestRate ?? 1;
                if (lineRate) unitValue = Math.round((unitValue / lineRate) * 10000) / 10000;
              }
              onPatch({ metalVariantId: v || null, unitValue, mermaPercent });
            }}
            options={[
              { value: "", label: "Seleccionar variante..." },
              ...metalVariantOptions.map(mv => ({
                value: mv.id,
                label: mv.label,
                isFavorite: mv.isFavorite,
                sublabel: mv.latestQuotePrice != null ? `${selSym} ${fmtN(mv.latestQuotePrice)}/g` : undefined,
              })),
            ]}
            searchable
            favoriteValue={metalVariants.find(m => m.isFavorite)?.id}
            onSetFavorite={(variantId) => void onSetMetalFavorite(variantId)}
          />
        ) : line.type === "PRODUCT" ? (
          <ProductSelector
            line={line}
            productItems={productItems}
            currencyOptions={currencyOptions}
            baseCurrencyId={baseCurrencyId}
            selSym={selSym}
            onPatch={onPatch}
            getVariantsForArticle={getVariantsForArticle}
            loadVariantsForArticle={loadVariantsForArticle}
            submitted={submitted}
            fmtN={fmtN}
          />
        ) : line.type === "SERVICE" ? (
          <TPComboFixed
            value={line.catalogItemId ?? ""}
            onChange={(v) => {
              const item = serviceItems.find(s => s.id === v);
              if (!item) { onPatch({ label: v, catalogItemId: null }); return; }
              let unitValue  = item.costPrice ?? line.unitValue;
              let currencyId = item.manualCurrencyId ?? line.currencyId;
              if (line.currencyId && item.costPrice != null) {
                const itemRate = currencyOptions.find(c => c.id === (item.manualCurrencyId ?? baseCurrencyId))?.latestRate ?? 1;
                const lineRate = currencyOptions.find(c => c.id === line.currencyId)?.latestRate ?? 1;
                const inBase   = item.costPrice * itemRate;
                unitValue  = lineRate ? Math.round((inBase / lineRate) * 10000) / 10000 : inBase;
                currencyId = line.currencyId;
              }
              onPatch({ label: item.name ?? v, catalogItemId: item.id, unitValue, currencyId });
            }}
            options={[
              { value: "", label: "Seleccionar servicio..." },
              ...serviceItems.map(s => ({
                value:    s.id,
                label:    s.name,
                sublabel: buildOptionSublabel({ item: s, isService: true, selSym, fmtN }),
                imageUrl: s.mainImageUrl ?? "",
              })),
            ]}
            searchable
          />
        ) : (
          <TPInput
            value={line.label}
            onChange={(v) => onPatch({ label: v })}
            placeholder="Precio / Hechura..."
          />
        )}
      </div>

      {/* ── 5. Cantidad ─────────────────────────────────── */}
      <div className="self-center [&_input]:text-muted/70">
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <TPNumberInput
              value={line.quantity}
              onChange={(v) => onPatch({ quantity: v ?? 0 })}
              decimals={2}
              step={isMetal ? 0.1 : undefined}
              min={0}
            />
          </div>

          {/* Selector de unidad solo para HECHURA */}
          {line.type === "HECHURA" && (
            <div
              className="relative shrink-0"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setPickerOpen(false);
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  setPickerPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 120) });
                  setPickerOpen(prev => !prev);
                }}
                className="h-7 px-1 flex items-center rounded border border-border bg-transparent text-[10px] font-bold text-muted hover:text-text hover:border-primary/50 transition"
                title={line.quantityUnit || "u"}
              >
                {((line.quantityUnit || "u")[0] ?? "u").toUpperCase()}
              </button>

              {pickerOpen && ReactDOM.createPortal(
                <div
                  style={{
                    position: "fixed",
                    top: pickerPos.top,
                    left: pickerPos.left,
                    minWidth: pickerPos.width,
                    zIndex: 9999,
                  }}
                  className="rounded-lg border border-border bg-surface shadow-lg py-1 max-h-48 overflow-y-auto"
                >
                  {weightUnits.filter(w => w.isActive).map(w => (
                    <div key={w.id} className="flex items-center gap-1 px-2 hover:bg-surface2 transition">
                      <button
                        type="button"
                        onMouseDown={() => {
                          onPatch({ quantityUnit: w.code as QuantityUnit });
                          setPickerOpen(false);
                        }}
                        className={cn(
                          "flex-1 text-left py-1.5 text-xs",
                          line.quantityUnit === w.code && "text-primary font-semibold",
                        )}
                      >
                        {w.name} <span className="text-muted">({w.code})</span>
                      </button>
                      <button
                        type="button"
                        title={w.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (!w.isFavorite) onPatch({ quantityUnit: w.code as QuantityUnit });
                          onToggleUnitFavorite(w.id, !!w.isFavorite);
                        }}
                        className={cn(
                          "shrink-0 transition-colors",
                          w.isFavorite ? "text-yellow-400" : "text-muted/20 hover:text-yellow-400",
                        )}
                      >
                        <Star size={11} className={w.isFavorite ? "fill-yellow-400" : ""} />
                      </button>
                    </div>
                  ))}
                  {/* Preserva valor legacy si no existe en weightUnits */}
                  {line.quantityUnit && !weightUnits.some(w => w.code === line.quantityUnit) && (
                    <div className="px-2 py-1.5 text-[11px] text-muted italic border-t border-border/30">
                      {line.quantityUnit} (legacy)
                    </div>
                  )}
                </div>,
                document.body,
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 6. Precio unitario ──────────────────────────── */}
      <div className="self-center [&_input]:font-semibold">
        <TPNumberInput
          value={line.unitValue}
          onChange={(v) => {
            const newUnitValue = v ?? 0;
            if (isMetal && line.metalVariantId) {
              const mvFull    = metalVariants.find(m => m.id === line.metalVariantId);
              const basePrice = mvFull?.suggestedPrice != null
                ? Number(mvFull.suggestedPrice)
                : (mvFull?.finalSalePrice != null && mvFull?.saleFactor != null && Number(mvFull.saleFactor) > 0
                  ? Math.round(Number(mvFull.finalSalePrice) / Number(mvFull.saleFactor) * 10000) / 10000
                  : null);
              if (basePrice != null && basePrice > 0 && newUnitValue > 0) {
                const newMerma = Math.round((newUnitValue / basePrice - 1) * 10000) / 100;
                onPatch({ unitValue: newUnitValue, mermaPercent: newMerma });
                return;
              }
            }
            onPatch({ unitValue: newUnitValue });
          }}
          decimals={2}
          min={0}
          leftIcon={<span className="text-[10px] font-semibold text-muted">{currForLine?.symbol ?? selSym}</span>}
        />
      </div>

      {/* ── 7. Merma % (METAL) / Afecta stock (PRODUCT/SERVICE) ── */}
      <div className="self-center">
        {isMetal ? (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <TPNumberInput
                value={line.mermaPercent}
                onChange={(v) => {
                  const newMerma  = v ?? null;
                  const mvFull    = metalVariants.find(m => m.id === line.metalVariantId);
                  const basePrice = mvFull?.suggestedPrice != null
                    ? Number(mvFull.suggestedPrice)
                    : (mvFull?.finalSalePrice != null && mvFull?.saleFactor != null && Number(mvFull.saleFactor) > 0
                      ? Math.round(Number(mvFull.finalSalePrice) / Number(mvFull.saleFactor) * 10000) / 10000
                      : null);
                  if (basePrice != null) {
                    const mermaMul   = 1 + (newMerma ?? 0) / 100;
                    let newUnitValue = Math.round(basePrice * mermaMul * 100) / 100;
                    if (line.currencyId && line.currencyId !== baseCurrencyId) {
                      const lineRate = currencyOptions.find(c => c.id === line.currencyId)?.latestRate ?? 1;
                      if (lineRate) newUnitValue = Math.round((newUnitValue / lineRate) * 10000) / 10000;
                    }
                    onPatch({ mermaPercent: newMerma, unitValue: newUnitValue });
                  } else {
                    onPatch({ mermaPercent: newMerma });
                  }
                }}
                decimals={2}
                min={-99}
                max={100}
              />
            </div>
            <span className="shrink-0 text-xs font-bold text-muted/80 select-none leading-none">%</span>
          </div>
        ) : line.type === "PRODUCT" && !isCombo ? (
          <TPComboFixed
            value={String(line.affectsStock ?? true)}
            onChange={(v) => onPatch({ affectsStock: v === "true" })}
            options={[
              { value: "true",  label: "Sí descuenta stock", shortLabel: "Stock: Sí" },
              { value: "false", label: "No descuenta stock",  shortLabel: "Stock: No" },
            ]}
            favoriteValue={stockFavorite}
            onSetFavorite={setStockFavorite}
          />
        ) : (
          /* Combo: en sus líneas PRODUCT siempre se descuenta stock (forzado por backend). */
          <span className="text-[10px] text-muted/30">—</span>
        )}
      </div>

      {/* ── 8. Bonif. / Recargo (no METAL) ─────────────── */}
      <div className="self-center">
        {line.type !== "METAL" ? (
          <div className="flex items-center gap-1">
            {/* Toggle ±: "" → BONUS → SURCHARGE → "" */}
            <button
              type="button"
              onClick={() => {
                if (line.lineAdjKind === "")          onPatch({ lineAdjKind: "BONUS",     lineAdjType: line.lineAdjType || "PERCENTAGE" });
                else if (line.lineAdjKind === "BONUS") onPatch({ lineAdjKind: "SURCHARGE" });
                else                                   onPatch({ lineAdjKind: "",         lineAdjType: "", lineAdjValue: null });
              }}
              className={cn(
                "shrink-0 h-7 w-7 rounded border text-[11px] font-bold transition grid place-items-center",
                line.lineAdjKind === "BONUS"     && "border-emerald-500/50 text-emerald-500 bg-emerald-500/5",
                line.lineAdjKind === "SURCHARGE" && "border-amber-500/50 text-amber-500 bg-amber-500/5",
                line.lineAdjKind === ""          && "border-border/50 text-muted/35",
              )}
              title="Bonificación (−) / Recargo (+)"
            >
              {line.lineAdjKind === "SURCHARGE" ? "+" : line.lineAdjKind === "BONUS" ? "−" : "±"}
            </button>
            <div className="flex-1 min-w-0">
              <TPNumberInput
                value={line.lineAdjValue}
                onChange={(v) => onPatch({ lineAdjValue: v ?? null })}
                decimals={2}
                min={0}
                disabled={line.lineAdjKind === ""}
              />
            </div>
            {/* Toggle %/$ */}
            <button
              type="button"
              onClick={() => onPatch({
                lineAdjType: (line.lineAdjType || "PERCENTAGE") === "PERCENTAGE" ? "FIXED_AMOUNT" : "PERCENTAGE",
              })}
              disabled={line.lineAdjKind === ""}
              className={cn(
                "shrink-0 h-7 w-7 rounded border text-[10px] font-bold transition grid place-items-center",
                line.lineAdjKind !== ""
                  ? "border-border text-muted hover:text-text hover:border-primary/50"
                  : "border-border/30 text-muted/25 cursor-default",
              )}
              title="Cambiar entre % y monto fijo"
            >
              {(line.lineAdjType || "PERCENTAGE") === "PERCENTAGE" ? "%" : "$"}
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-muted/30">—</span>
        )}
      </div>

      {/* ── 9. Subtotal ─────────────────────────────────── */}
      <div className="self-center text-right">
        {lineTotal > 0 ? (
          <div>
            <div className="flex items-baseline justify-end gap-0.5">
              <span className="text-[10px] text-muted/40">+</span>
              <span className={cn("tabular-nums font-bold text-sm", SUBTOTAL_COLOR[line.type] ?? "text-text")}>
                {selSym} {fmtN(lineTotal)}
              </span>
            </div>
            <div className="text-[10px] text-muted/50 tabular-nums">
              {fmtN(line.quantity)} {line.quantityUnit} &times; {currForLine?.symbol ?? selSym} {fmtN(line.unitValue)}
            </div>
            {isMetal && metalVariants.find(m => m.id === line.metalVariantId)?.purity != null && (
              <div className="text-[10px] text-muted/40 tabular-nums">
                ley {fmtN(metalVariants.find(m => m.id === line.metalVariantId)!.purity)}
                {line.mermaPercent != null && line.mermaPercent !== 0 && ` · ajuste ${fmtN(line.mermaPercent)}%`}
              </div>
            )}
            {line.currencyId && line.currencyId !== baseCurrencyId && currForLine?.latestRate != null && (
              <div className="text-[10px] text-muted/40 tabular-nums">
                Resultado: {currForLine.symbol} {fmtN(lineTotal / currForLine.latestRate)}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted/30">—</span>
        )}
      </div>

      {/* ── 10. Botón eliminar ──────────────────────────── */}
      <div className="self-center">
        <TPIconButton
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 h-7 w-7 hover:text-red-400 hover:border-red-400/40 transition-all ml-auto"
          title="Eliminar fila"
        >
          <X size={13} />
        </TPIconButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductSelector — combo único con artículos simples y variantes mezcladas
//
// El combo lista cada componente vendible:
//  - Artículo sin variantes → 1 opción (artículo padre).
//  - Artículo con variantes → N opciones (una por variante). El padre no
//    aparece como opción separada porque no es vendible solo en este flujo.
//
// El value del combo codifica articleId + variantId con separador "::":
//  - "art-id"             → artículo simple (catalogVariantId queda en null).
//  - "art-id::var-id"     → variante específica.
//
// Al elegir, el `onChange` parsea el value y emite el patch correcto al
// pricing-engine (catalogItemId siempre, catalogVariantId solo si aplica).
// Al reabrir un artículo guardado, el value se reconstruye desde
// (line.catalogItemId, line.catalogVariantId) y el combo selecciona la opción
// correcta — siempre que la cache de variantes esté cargada para ese padre.
// ---------------------------------------------------------------------------

const VARIANT_SEP = "::";

// ---------------------------------------------------------------------------
// Helpers de render para opciones del combo de componentes
// ---------------------------------------------------------------------------
//
// `buildOptionSublabel` arma una línea compacta con SKU · categoría · stock ·
// costo. Cualquier campo faltante se omite. Para servicios no se muestra
// stock — se reemplaza con la palabra "Servicio" — y para variantes el
// stock por variante puede no estar disponible: en ese caso se omite.
// ---------------------------------------------------------------------------
function buildOptionSublabel(opts: {
  item: ProductItem;
  variant?: ArticleVariant | null;
  isService?: boolean;
  selSym: string;
  fmtN: (n: number) => string;
}): string | undefined {
  const { item, variant, isService, selSym, fmtN } = opts;
  const parts: string[] = [];
  // SKU: prefiero el de la variante si existe; cae al del padre.
  const sku = (variant?.sku?.trim() || item.sku?.trim() || "");
  if (sku) parts.push(`SKU: ${sku}`);
  if (item.categoryName) parts.push(item.categoryName);
  if (isService) {
    parts.push("Servicio");
  } else if (variant) {
    // Stock por variante: hoy no llega del backend en el listado, lo omito.
  } else if (item.stock != null) {
    parts.push(`Stock: ${fmtN(item.stock)}`);
  } else {
    parts.push("Sin stock");
  }
  parts.push(
    item.costPrice != null
      ? `Costo: ${selSym} ${fmtN(item.costPrice)}`
      : "Costo no disponible",
  );
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

type ProductSelectorProps = {
  line: CostLine;
  productItems: ProductItem[];
  currencyOptions: CurrencyOption[];
  baseCurrencyId: string;
  selSym: string;
  onPatch: (patch: Partial<CostLine>) => void;
  getVariantsForArticle?: (articleId: string) => ArticleVariant[] | undefined;
  loadVariantsForArticle?: (articleId: string) => void;
  submitted: boolean;
  fmtN: (n: number) => string;
};

function ProductSelector({
  line,
  productItems,
  currencyOptions,
  baseCurrencyId,
  selSym,
  onPatch,
  getVariantsForArticle,
  loadVariantsForArticle,
  submitted,
  fmtN,
}: ProductSelectorProps) {
  // Precargar variantes de TODOS los productItems en paralelo. La cache vive
  // arriba (ArticleModal), así que esta carga se ejecuta una sola vez por
  // artículo durante la sesión, sin importar cuántas filas haya. Mientras
  // un artículo está sin cargar, aparece como opción "simple" en el combo;
  // cuando se completa, sus variantes se materializan automáticamente
  // gracias al bumper de version (variantsCacheVersion).
  useEffect(() => {
    if (!loadVariantsForArticle) return;
    for (const p of productItems) loadVariantsForArticle(p.id);
  }, [productItems, loadVariantsForArticle]);

  // Construir el value actual del combo desde la línea persistida.
  const currentValue = line.catalogItemId
    ? (line.catalogVariantId
        ? `${line.catalogItemId}${VARIANT_SEP}${line.catalogVariantId}`
        : line.catalogItemId)
    : "";

  // Detección de inconsistencia en datos legacy: línea con artículo que ya
  // tiene variantes pero quedó sin `catalogVariantId`. El combo no permite
  // elegir el padre solo, así que la línea queda inválida hasta que el usuario
  // elija una variante. Lo marcamos en rojo cuando ya se intentó guardar.
  const variantsForLine = line.catalogItemId && getVariantsForArticle
    ? getVariantsForArticle(line.catalogItemId)
    : undefined;
  const variantMissing =
    !!line.catalogItemId &&
    !line.catalogVariantId &&
    (variantsForLine?.length ?? 0) > 0;

  // Construir opciones planas: por cada productItem, lista variantes si las
  // tiene, o el artículo simple si no.
  type FlatOpt = {
    value: string;
    label: string;
    sublabel?: string;
    imageUrl?: string;
    articleId: string;
    variantId: string | null;
    item: ProductItem;
  };
  const flatOptions: FlatOpt[] = [];
  for (const p of productItems) {
    const variants = getVariantsForArticle ? getVariantsForArticle(p.id) : undefined;
    if (variants && variants.length > 0) {
      for (const v of variants) {
        flatOptions.push({
          value:     `${p.id}${VARIANT_SEP}${v.id}`,
          label:     `${p.name} — ${v.name}`,
          sublabel:  buildOptionSublabel({ item: p, variant: v, selSym, fmtN }),
          // Thumbnail: imagen de la variante si existe, sino la del padre.
          imageUrl:  v.imageUrl?.trim() || p.mainImageUrl || "",
          articleId: p.id,
          variantId: v.id,
          item:      p,
        });
      }
    } else {
      flatOptions.push({
        value:     p.id,
        label:     p.name,
        sublabel:  buildOptionSublabel({ item: p, selSym, fmtN }),
        imageUrl:  p.mainImageUrl || "",
        articleId: p.id,
        variantId: null,
        item:      p,
      });
    }
  }

  function handleChange(rawValue: string) {
    if (!rawValue) {
      onPatch({ label: "", catalogItemId: null, catalogVariantId: null });
      return;
    }
    const opt = flatOptions.find(o => o.value === rawValue);
    if (!opt) {
      // Value desconocido (p. ej. legacy sin cache aún): preservar lo que vino.
      onPatch({ label: rawValue, catalogItemId: rawValue, catalogVariantId: null });
      return;
    }
    let unitValue  = opt.item.costPrice ?? line.unitValue;
    let currencyId = opt.item.manualCurrencyId ?? line.currencyId;
    if (line.currencyId && opt.item.costPrice != null) {
      const itemRate = currencyOptions.find(c => c.id === (opt.item.manualCurrencyId ?? baseCurrencyId))?.latestRate ?? 1;
      const lineRate = currencyOptions.find(c => c.id === line.currencyId)?.latestRate ?? 1;
      const inBase   = opt.item.costPrice * itemRate;
      unitValue  = lineRate ? Math.round((inBase / lineRate) * 10000) / 10000 : inBase;
      currencyId = line.currencyId;
    }
    onPatch({
      label:            opt.label,
      catalogItemId:    opt.articleId,
      catalogVariantId: opt.variantId,
      unitValue,
      currencyId,
    });
  }

  return (
    <div className="space-y-1">
      <TPComboFixed
        value={currentValue}
        onChange={handleChange}
        options={[
          { value: "", label: "Seleccionar producto..." },
          ...flatOptions.map(o => ({
            value:    o.value,
            label:    o.label,
            sublabel: o.sublabel,
            // `imageUrl: ""` activa el placeholder del combo (icono genérico)
            // y mantiene el alineamiento con las opciones que sí tienen imagen.
            imageUrl: o.imageUrl ?? "",
          })),
        ]}
        searchable
      />
      {submitted && variantMissing && (
        <p className="text-[10px] leading-tight text-rose-600 dark:text-rose-400">
          Este componente tiene variantes. Seleccioná una variante específica.
        </p>
      )}
    </div>
  );
}
