// src/components/ui/CostCompositionTable.tsx
import React, { useState, useEffect } from "react";
import {
  Gem, Plus, X, Wrench, Package, Layers, DollarSign,
  Calculator, Trash2, GripVertical, AlertTriangle,
} from "lucide-react";
import TPNumberInput    from "./TPNumberInput";
import TPAdjTypeButton from "./TPAdjTypeButton";
import TPComboFixed    from "./TPComboFixed";
import TPInput         from "./TPInput";
import TPCurrencyPill  from "./TPCurrencyPill";
import ArticleSearchSelect from "./ArticleSearchSelect";
import { cn } from "./tp";
import type { CostLine, CostLineType, ArticleRow } from "../../services/articles";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type MetalVariantOption = {
  id: string;
  label: string;
  latestQuotePrice: number | null;
  isFavorite?: boolean;
  metalId?: string;
};

export type CurrencyOption = {
  id: string;
  code: string;
  symbol: string;
  isBase: boolean;
  latestRate?: number | null;
};

export type CatalogItemOption = {
  id: string;
  label: string;
  sku?: string | null;
  stock?: number | null;
  /** Costo en moneda BASE (para sincronización automática con cotización).
   *  Viene de computedCostBase del backend. Puede ser null si no hay tasa cargada. */
  costPrice: number | null;
  salePrice: number | null;
  /** Moneda original del costo (solo artículos MANUAL en divisa extranjera) */
  manualCurrencyId?: string | null;
  /** Costo en moneda ORIGINAL del artículo (para carga inicial sin conversión).
   *  Solo presente en artículos MANUAL. Puede diferir de costPrice si costPrice está en base. */
  costPriceNative?: number | null;
};

type Props = {
  lines: CostLine[];
  onChange: (lines: CostLine[]) => void;
  metalVariants: MetalVariantOption[];
  currencies: CurrencyOption[];
  baseCurrencyId: string;
  baseCurrencySymbol: string;
  defaultMermaPercent?: number | null;
  productItems?: CatalogItemOption[];
  serviceItems?: CatalogItemOption[];
  hideAddButtons?: boolean;
};

// ---------------------------------------------------------------------------
// Configuración visual por tipo
// ---------------------------------------------------------------------------
export const TYPE_CFG: Record<CostLineType, {
  label: string;
  badge: string;
  rowBg: string;
  rowBorder: string;
  icon: React.ReactNode;
}> = {
  METAL:   { label: "Metal",    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",    rowBg: "bg-amber-500/[0.08]",   rowBorder: "border-amber-500/30",    icon: <Gem      size={10} /> },
  HECHURA: { label: "Hechura",  badge: "bg-blue-500/15  text-blue-400  border-blue-500/30",     rowBg: "bg-blue-500/[0.08]",    rowBorder: "border-blue-500/30",     icon: <Wrench   size={10} /> },
  PRODUCT: { label: "Producto", badge: "bg-violet-500/15 text-violet-400 border-violet-500/30", rowBg: "bg-violet-500/[0.08]",  rowBorder: "border-violet-500/30",   icon: <Package  size={10} /> },
  SERVICE: { label: "Servicio", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", rowBg: "bg-emerald-500/[0.08]", rowBorder: "border-emerald-500/30", icon: <Layers size={10} /> },
  MANUAL:  { label: "Manual",   badge: "bg-slate-500/15  text-slate-400  border-slate-500/30",  rowBg: "bg-slate-500/[0.08]",   rowBorder: "border-slate-500/30",    icon: <DollarSign size={10} /> },
};

export const TYPE_OPTIONS: { value: CostLineType; label: string }[] = [
  { value: "METAL",   label: "Metal" },
  { value: "HECHURA", label: "Hechura" },
  { value: "PRODUCT", label: "Producto" },
  { value: "SERVICE", label: "Servicio" },
];

// ---------------------------------------------------------------------------
// Layout: grid fijo 9 columnas (handle + 8)
// [handle 20px] [badge 96px] [moneda 72px] [desc minmax(96px,1fr)] [qty 160px] [op 20px] [price 160px] [adj 180px] [result+x 150px]
// ---------------------------------------------------------------------------
const GRID = "grid grid-cols-[20px_96px_72px_minmax(276px,4fr)_160px_20px_160px_210px_150px] items-center gap-x-6";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function emptyLine(type: CostLineType, defaults: Partial<CostLine> = {}): CostLine {
  return { type, label: type === "HECHURA" ? "Hechura / Mano de Obra" : "", quantity: 1, quantityUnit: "", unitValue: 0, currencyId: null, mermaPercent: null, metalVariantId: null, sortOrder: 0, lineAdjKind: "", lineAdjType: "", lineAdjValue: null, ...defaults };
}

export function applyLineAdj(base: number, kind: string, type: string, val: number | null): number {
  if (!kind || !type || val == null) return base;
  if (type === "PERCENTAGE") {
    return Math.max(0, base * (kind === "BONUS" ? (1 - val / 100) : (1 + val / 100)));
  }
  if (type === "FIXED_AMOUNT") {
    return Math.max(0, base + (kind === "BONUS" ? -val : val));
  }
  return base;
}

function lineRawSubtotal(line: CostLine): number | null {
  if (!line.quantity || !line.unitValue) return null;
  let raw: number;
  if (line.type === "METAL") {
    raw = line.quantity * (1 + (line.mermaPercent ?? 0) / 100) * line.unitValue;
  } else {
    raw = line.quantity * line.unitValue;
  }
  return applyLineAdj(raw, line.lineAdjKind ?? "", line.lineAdjType ?? "", line.lineAdjValue ?? null);
}

function lineSubtotal(line: CostLine, currencies: CurrencyOption[], baseCurrencyId: string): number | null {
  const raw = lineRawSubtotal(line);
  if (raw == null) return null;
  const currId = line.currencyId ?? baseCurrencyId;
  if (currId !== baseCurrencyId) {
    const curr = currencies.find(c => c.id === currId);
    if (curr?.latestRate != null) return raw * curr.latestRate;
    return null;
  }
  return raw;
}

function fmtNum(v: number, decimals = 2) {
  return v.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}



// ---------------------------------------------------------------------------
// SortableRow — fila arrastrable
// ---------------------------------------------------------------------------
type RowProps = {
  id: string;
  line: CostLine;
  idx: number;
  update: (idx: number, patch: Partial<CostLine>) => void;
  onRemoveRequest: (idx: number) => void;
  metalVariants: MetalVariantOption[];
  currencies: CurrencyOption[];
  baseCurrencyId: string;
  baseCurrencySymbol: string;
  productItems: CatalogItemOption[];
  serviceItems: CatalogItemOption[];
};

function SortableRow({
  id, line, idx, update, onRemoveRequest,
  metalVariants, currencies, baseCurrencyId, baseCurrencySymbol,
  productItems, serviceItems,
}: RowProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  // Estado del artículo seleccionado para PRODUCT/SERVICE
  const [artRow, setArtRow] = useState<ArticleRow | null>(() => {
    if (!line.catalogItemId) return null;
    // Inicializar desde la lista pre-cargada si está disponible
    const items = line.type === "PRODUCT" ? productItems : serviceItems;
    const found = items?.find(i => i.id === line.catalogItemId);
    if (!found) return null;
    return {
      id: found.id,
      name: found.label,
      sku: found.sku ?? "",
      costPrice: found.costPrice != null ? String(found.costPrice) : null,
      stockMode: "NONE",
      stockData: found.stock != null ? { total: found.stock } : null,
    } as unknown as ArticleRow;
  });

  // Sincronizar artRow cuando cambia el catálogo (p.ej. tras guardar un artículo referenciado)
  useEffect(() => {
    if (!line.catalogItemId) return;
    const items = line.type === "PRODUCT" ? productItems : serviceItems;
    const found = items.find(i => i.id === line.catalogItemId);
    if (!found) return;
    setArtRow(prev => {
      // Solo actualizar si algún dato relevante cambió (evita re-renders innecesarios)
      const newCost = found.costPrice != null ? String(found.costPrice) : null;
      if (prev?.id === found.id && prev?.name === found.label && (prev as any)?.costPrice === newCost) return prev;
      return {
        id: found.id,
        name: found.label,
        sku: found.sku ?? "",
        costPrice: newCost,
        stockMode: "NONE",
        stockData: found.stock != null ? { total: found.stock } : null,
      } as unknown as ArticleRow;
    });
  }, [line.catalogItemId, line.type, productItems, serviceItems]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    zIndex:  isDragging ? 10 : undefined,
  };

  const cfg     = TYPE_CFG[line.type];
  const rawSub  = lineRawSubtotal(line);
  const lineCurr = line.currencyId
    ? currencies.find(c => c.id === line.currencyId)
    : currencies.find(c => c.id === baseCurrencyId);
  const lineSym  = lineCurr?.symbol ?? baseCurrencySymbol;
  // Aviso: moneda no base sin cotización → el subtotal no se puede convertir
  const hasRateIssue = !!line.currencyId && line.currencyId !== baseCurrencyId && !lineCurr?.latestRate;
  const items    = line.type === "PRODUCT" ? productItems : serviceItems;

  // Cambia cuando cambia la referencia → fuerza remount de TPNumberInput (unitValue)
  // para evitar que isEditing interno bloquee la actualización del valor.
  // HECHURA y MANUAL usan "manual" constante → nunca se remonta.
  const unitValueKey =
    line.type === "METAL"
      ? (line.metalVariantId ?? "none")
      : line.type === "PRODUCT" || line.type === "SERVICE"
      ? (line.catalogItemId ?? "none")
      : "manual";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(GRID, "rounded-xl border px-2 py-1.5", cfg.rowBg, hasRateIssue ? "border-amber-500/50 bg-amber-500/[0.06]" : cfg.rowBorder)}
    >
      {/* Col 0 — Drag handle */}
      <button
        type="button"
        title="Arrastrar para reordenar"
        className="cursor-grab active:cursor-grabbing text-muted/30 hover:text-muted transition flex items-center justify-center h-full"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={13} />
      </button>

      {/* Col 1 — Badge tipo */}
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border w-fit", cfg.badge)}>
        {cfg.icon} {cfg.label}
      </span>

      {/* Col 2 — Moneda */}
      <TPCurrencyPill
        value={line.currencyId ?? baseCurrencyId}
        onChange={(newId) => {
          const oldId = line.currencyId ?? baseCurrencyId;
          if (newId === oldId || line.unitValue <= 0) {
            update(idx, { currencyId: newId === baseCurrencyId ? null : newId });
            return;
          }
          const oldRate = oldId === baseCurrencyId ? 1 : (currencies.find(c => c.id === oldId)?.latestRate ?? null);
          const newRate = newId === baseCurrencyId ? 1 : (currencies.find(c => c.id === newId)?.latestRate ?? null);
          if (oldRate != null && newRate != null) {
            const inBase = line.unitValue * oldRate;
            const inNew  = inBase / newRate;
            update(idx, { currencyId: newId === baseCurrencyId ? null : newId, unitValue: Math.round(inNew * 10000) / 10000 });
          } else {
            update(idx, { currencyId: newId === baseCurrencyId ? null : newId });
          }
        }}
        currencies={currencies}
        baseCurrencyId={baseCurrencyId}
      />

      {/* Col 3 — Descripción / Variante */}
      {line.type === "METAL" && (
        <TPComboFixed
          value={line.metalVariantId ?? ""}
          onChange={(v) => {
            const variantId = v || null;
            const mv = metalVariants.find(m => m.id === variantId);
            let unitValue: number;
            if (mv?.latestQuotePrice != null) {
              // Precio disponible → aplicar conversión de moneda si corresponde
              const raw = mv.latestQuotePrice;
              if (line.currencyId && line.currencyId !== baseCurrencyId) {
                const rate = currencies.find(c => c.id === line.currencyId)?.latestRate ?? null;
                unitValue = rate != null ? Math.round((raw / rate) * 10000) / 10000 : raw;
              } else {
                unitValue = raw;
              }
            } else {
              // Sin cotización → limpiar el campo (no heredar precio de variante anterior)
              unitValue = 0;
            }
            update(idx, { metalVariantId: variantId, unitValue });
          }}
          options={metalVariants.map(m => ({ value: m.id, label: m.label }))}
          placeholder="Buscar metal..."
          searchable
        />
      )}
      {line.type === "HECHURA" && (
        <TPInput
          value={line.label}
          onChange={(v) => update(idx, { label: v })}
          placeholder="Descripción de la hechura…"
        />
      )}
      {(line.type === "PRODUCT" || line.type === "SERVICE") && (
        <ArticleSearchSelect
          selected={artRow}
          articleType={line.type}
          placeholder={line.type === "PRODUCT" ? "Buscar producto…" : "Buscar servicio…"}
          onSelect={(row) => {
            setArtRow(row);
            // row es ArticleRow, que tiene:
            //   costPrice         → valor en moneda ORIGINAL (USD 9 para artículo MANUAL en USD)
            //   manualCurrencyId  → moneda del costo MANUAL (USD_ID o null)
            //   computedCostBase  → equivalente en moneda BASE (ARS); puede ser null sin tasa

            const sourceCurrId =
              row.manualCurrencyId && row.manualCurrencyId !== baseCurrencyId
                ? row.manualCurrencyId
                : baseCurrencyId;

            let unitValue: number;
            if (sourceCurrId !== baseCurrencyId) {
              // Artículo con costo en divisa extranjera (MANUAL USD):
              // row.costPrice ya está en la moneda original (USD 9) → usar directamente.
              // NO dividir por tasa: el valor ya NO está en moneda base.
              const native = row.costPrice != null ? parseFloat(String(row.costPrice)) : null;
              unitValue = native != null && Number.isFinite(native) ? native : 0;
            } else {
              // Artículo en moneda base (MANUAL ARS, MULTIPLIER, METAL_MERMA_HECHURA, etc.):
              // Preferir computedCostBase (ya incorpora ajustes y modo de cálculo).
              // Fallback a costPrice si computedCostBase no está disponible.
              const base = row.computedCostBase != null ? parseFloat(String(row.computedCostBase)) : null;
              const cp   = row.costPrice       != null ? parseFloat(String(row.costPrice))        : null;
              unitValue = (base != null && Number.isFinite(base) && base > 0)
                ? base
                : (cp   != null && Number.isFinite(cp)   && cp   > 0 ? cp : 0);
            }
            update(idx, { catalogItemId: row.id, label: row.name, unitValue, currencyId: sourceCurrId });
          }}
          onClear={() => {
            setArtRow(null);
            update(idx, { catalogItemId: null, label: "", unitValue: 0 });
          }}
        />
      )}

      {/* Col 4 — Cantidad */}
      <TPNumberInput
        value={line.quantity}
        onChange={(v) => update(idx, { quantity: v ?? (line.type === "METAL" ? 0 : 1) })}
        placeholder="0.00"
        min={0}
        decimals={2}
        step={line.type === "METAL" ? 0.1 : 1}
        suffix={line.type === "METAL" ? <span className="text-[10px] text-muted">g</span> : undefined}
        wrapClassName="space-y-0"
      />

      {/* Col 5 — Operador × */}
      <span className="text-muted text-xs text-center select-none">×</span>

      {/* Col 6 — Precio unitario */}
      <TPNumberInput
        key={`uv-${unitValueKey}-${line.currencyId ?? "base"}`}
        value={line.unitValue}
        onChange={(v) => update(idx, { unitValue: v ?? 0 })}
        placeholder="0.00"
        min={0}
        decimals={2}
        leftIcon={<span className="text-[11px] font-semibold text-muted">{lineSym}</span>}
        wrapClassName="space-y-0"
      />

      {/* Col 7 — Ajuste por línea (entre precio y subtotal) */}
      {!line.lineAdjKind ? (
        <button
          type="button"
          onClick={() => update(idx, { lineAdjKind: "BONUS", lineAdjType: "PERCENTAGE", lineAdjValue: null })}
          title="Agregar bonificación o recargo"
          className="w-full h-[42px] rounded-xl border border-dashed border-border/40 text-muted/25 hover:text-muted/60 hover:border-border/70 transition flex items-center justify-center"
        >
          <Plus size={13} />
        </button>
      ) : (
        <div className="flex items-center gap-1">
          {/* ± — alterna entre Bonificación y Recargo */}
          <button
            type="button"
            title={line.lineAdjKind === "SURCHARGE" ? "Recargo — click para cambiar a bonificación" : "Bonificación — click para cambiar a recargo"}
            onClick={() => update(idx, { lineAdjKind: line.lineAdjKind === "SURCHARGE" ? "BONUS" : "SURCHARGE" })}
            className={cn(
              "h-[42px] w-9 shrink-0 rounded-xl border flex items-center justify-center text-sm font-bold transition-colors select-none",
              line.lineAdjKind === "SURCHARGE"
                ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30"
                : "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
            )}
          >
            ±
          </button>
          {/* Input del monto */}
          <div className="flex-1 min-w-0">
            <TPNumberInput
              value={line.lineAdjValue}
              onChange={v => update(idx, { lineAdjValue: v ?? null })}
              min={0}
              decimals={2}
              wrapClassName="space-y-0"
              suffix={line.lineAdjType === "PERCENTAGE" ? <span className="text-[11px] font-bold">%</span> : undefined}
              leftIcon={line.lineAdjType === "FIXED_AMOUNT" ? <span className="text-[11px] font-semibold text-muted">{lineSym}</span> : undefined}
            />
          </div>
          {/* % / $ toggle */}
          <TPAdjTypeButton
            value={(line.lineAdjType || "PERCENTAGE") as "PERCENTAGE" | "FIXED_AMOUNT"}
            onChange={t => update(idx, { lineAdjType: t })}
          />
          {/* Quitar */}
          <button
            type="button"
            onClick={() => update(idx, { lineAdjKind: "", lineAdjType: "", lineAdjValue: null })}
            title="Quitar ajuste"
            className="text-muted/30 hover:text-red-400 transition shrink-0"
          >
            <X size={9} />
          </button>
        </div>
      )}

      {/* Col 8 — Subtotal + eliminar */}
      <div className="flex items-center justify-end gap-1.5">
        {hasRateIssue ? (
          <span
            className="inline-flex items-center gap-1 text-xs text-amber-400 tabular-nums whitespace-nowrap"
            title={`${lineCurr?.code ?? "Moneda"} sin cotización — el subtotal no puede convertirse a ${baseCurrencySymbol}`}
          >
            <AlertTriangle size={11} className="shrink-0" />
            Sin cotización
          </span>
        ) : (
          <span className={cn(
            "tabular-nums text-sm font-semibold whitespace-nowrap text-right",
            rawSub != null && rawSub > 0 ? "text-text" : "text-muted/30"
          )}>
            {rawSub != null && rawSub > 0 ? `${lineSym} ${fmtNum(rawSub)}` : "—"}
          </span>
        )}
        <button
          type="button"
          onClick={() => onRemoveRequest(idx)}
          title="Eliminar fila"
          className="h-7 w-7 shrink-0 rounded-lg grid place-items-center text-muted/40 hover:text-red-400 hover:bg-red-500/10 transition"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function CostCompositionTable({
  lines, onChange, metalVariants, currencies, baseCurrencyId, baseCurrencySymbol,
  defaultMermaPercent, productItems = [], serviceItems = [], hideAddButtons = false,
}: Props) {

  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function update(idx: number, patch: Partial<CostLine>) {
    const next = lines.map((l, i) => i === idx ? { ...l, ...patch } : l);
    onChange(next);
  }
  function remove(idx: number) {
    onChange(lines.filter((_, i) => i !== idx));
  }
  function add(type: CostLineType) {
    const extra: Partial<CostLine> = { sortOrder: lines.length };
    if (type === "METAL") extra.mermaPercent = defaultMermaPercent ?? null;
    onChange([...lines, emptyLine(type, extra)]);
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = Number(active.id);
    const toIdx   = Number(over.id);
    if (isNaN(fromIdx) || isNaN(toIdx)) return;
    onChange(arrayMove(lines, fromIdx, toIdx).map((l, i) => ({ ...l, sortOrder: i })));
  }

  const metalTotal   = lines.filter(l => l.type === "METAL")  .reduce((s, l) => s + (lineSubtotal(l, currencies, baseCurrencyId) ?? 0), 0);
  const hechuraTotal = lines.filter(l => l.type === "HECHURA").reduce((s, l) => s + (lineSubtotal(l, currencies, baseCurrencyId) ?? 0), 0);
  const productTotal = lines.filter(l => l.type === "PRODUCT").reduce((s, l) => s + (lineSubtotal(l, currencies, baseCurrencyId) ?? 0), 0);
  const serviceTotal = lines.filter(l => l.type === "SERVICE").reduce((s, l) => s + (lineSubtotal(l, currencies, baseCurrencyId) ?? 0), 0);
  const manualTotal  = lines.filter(l => l.type === "MANUAL") .reduce((s, l) => s + (lineSubtotal(l, currencies, baseCurrencyId) ?? 0), 0);
  const hasLines = lines.length > 0;

  const pendingLine = confirmRemoveIdx !== null ? lines[confirmRemoveIdx] : null;

  return (
    <div className="space-y-1 overflow-x-auto">

      {/* ── Header de columnas ─────────────────────────────────────────────── */}
      {hasLines && (
        <div className={cn(GRID, "px-2 mb-1")}>
          <div /> {/* handle */}
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wide">Tipo</div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wide">Moneda</div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wide">Descripción / Variante</div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wide text-center">Cantidad</div>
          <div />
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wide text-center">Precio unit.</div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wide text-center">Bonif./Recargo</div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wide text-right pr-8">Subtotal</div>
        </div>
      )}

      {/* ── Filas con DnD ──────────────────────────────────────────────────── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={lines.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
          {lines.map((line, idx) => (
            <SortableRow
              key={`${line.id ?? "new"}-${idx}`}
              id={String(idx)}
              line={line}
              idx={idx}
              update={update}
              onRemoveRequest={setConfirmRemoveIdx}
              metalVariants={metalVariants}
              currencies={currencies}
              baseCurrencyId={baseCurrencyId}
              baseCurrencySymbol={baseCurrencySymbol}
              productItems={productItems}
              serviceItems={serviceItems}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* ── Botones agregar ──────────────────────────────────────────────── */}
      {!hideAddButtons && (
        <div className="flex items-center gap-2 flex-wrap pt-2">
          <span className="text-xs text-muted shrink-0">Agregar:</span>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => add(opt.value)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-border bg-surface2/30 text-muted hover:text-text hover:bg-surface2 transition"
            >
              <Plus size={10} /> {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Totales alineados con columna Subtotal ───────────────────────── */}
      {hasLines && (
        <div className="mt-2">
          {metalTotal > 0 && (
            <div className={cn(GRID, "px-2 py-0.5")}>
              <div className="col-span-8 flex items-center gap-1.5 text-xs text-amber-400 justify-end pr-2">
                <Gem size={10} /> Subtotal metal
              </div>
              <div className="text-right pr-8 text-xs tabular-nums text-muted font-medium">
                {baseCurrencySymbol} {fmtNum(metalTotal)}
              </div>
            </div>
          )}
          {hechuraTotal > 0 && (
            <div className={cn(GRID, "px-2 py-0.5")}>
              <div className="col-span-8 flex items-center gap-1.5 text-xs text-blue-400 justify-end pr-2">
                <Wrench size={10} /> Subtotal hechura
              </div>
              <div className="text-right pr-8 text-xs tabular-nums text-muted font-medium">
                {baseCurrencySymbol} {fmtNum(hechuraTotal)}
              </div>
            </div>
          )}
          {productTotal > 0 && (
            <div className={cn(GRID, "px-2 py-0.5")}>
              <div className="col-span-8 flex items-center gap-1.5 text-xs text-violet-400 justify-end pr-2">
                <Package size={10} /> Subtotal productos
              </div>
              <div className="text-right pr-8 text-xs tabular-nums text-muted font-medium">
                {baseCurrencySymbol} {fmtNum(productTotal)}
              </div>
            </div>
          )}
          {serviceTotal > 0 && (
            <div className={cn(GRID, "px-2 py-0.5")}>
              <div className="col-span-8 flex items-center gap-1.5 text-xs text-emerald-400 justify-end pr-2">
                <Layers size={10} /> Subtotal servicios
              </div>
              <div className="text-right pr-8 text-xs tabular-nums text-muted font-medium">
                {baseCurrencySymbol} {fmtNum(serviceTotal)}
              </div>
            </div>
          )}
          {manualTotal > 0 && (
            <div className={cn(GRID, "px-2 py-0.5")}>
              <div className="col-span-8 flex items-center gap-1.5 text-xs text-muted justify-end pr-2">
                <DollarSign size={10} /> Subtotal otros
              </div>
              <div className="text-right pr-8 text-xs tabular-nums text-muted font-medium">
                {baseCurrencySymbol} {fmtNum(manualTotal)}
              </div>
            </div>
          )}
          <div className={cn(GRID, "px-2 pt-2 border-t border-border mt-1")}>
            <div className="col-span-8 flex items-center gap-1.5 text-sm font-semibold text-text justify-end pr-2">
              <Calculator size={13} /> Total estimado
            </div>
            <div className="text-right pr-8 text-sm tabular-nums font-semibold text-emerald-400">
              {baseCurrencySymbol} {fmtNum(metalTotal + hechuraTotal + productTotal + serviceTotal + manualTotal)}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación de borrado ──────────────────────────────────────── */}
      <ConfirmDeleteDialog
        open={confirmRemoveIdx !== null}
        title="Eliminar componente"
        description={
          pendingLine
            ? `¿Querés eliminar "${TYPE_CFG[pendingLine.type].label}${pendingLine.label ? ` — ${pendingLine.label}` : ""}" de la composición del costo? Esta acción impactará en el total estimado.`
            : "¿Querés eliminar este componente de la composición del costo? Esta acción impactará en el total estimado."
        }
        confirmText="Eliminar"
        onConfirm={() => {
          if (confirmRemoveIdx !== null) remove(confirmRemoveIdx);
          setConfirmRemoveIdx(null);
        }}
        onClose={() => setConfirmRemoveIdx(null)}
      />
    </div>
  );
}
