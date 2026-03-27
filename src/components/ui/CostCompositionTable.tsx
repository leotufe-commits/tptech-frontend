// src/components/ui/CostCompositionTable.tsx
import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  Gem, Plus, X, Wrench, Package, Layers, DollarSign,
  Calculator, ChevronDown, Trash2, GripVertical,
} from "lucide-react";
import TPNumberInput from "./TPNumberInput";
import TPComboFixed  from "./TPComboFixed";
import TPInput       from "./TPInput";
import { cn }        from "./tp";
import type { CostLine, CostLineType } from "../../services/articles";
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
  costPrice: number | null;
  salePrice: number | null;
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
  METAL:   { label: "Metal",    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",    rowBg: "bg-amber-500/[0.04]",   rowBorder: "border-amber-500/20",    icon: <Gem      size={10} /> },
  HECHURA: { label: "Hechura",  badge: "bg-blue-500/15  text-blue-400  border-blue-500/30",     rowBg: "bg-blue-500/[0.04]",    rowBorder: "border-blue-500/20",     icon: <Wrench   size={10} /> },
  PRODUCT: { label: "Producto", badge: "bg-violet-500/15 text-violet-400 border-violet-500/30", rowBg: "bg-violet-500/[0.04]",  rowBorder: "border-violet-500/20",   icon: <Package  size={10} /> },
  SERVICE: { label: "Servicio", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", rowBg: "bg-emerald-500/[0.04]", rowBorder: "border-emerald-500/20", icon: <Layers size={10} /> },
  MANUAL:  { label: "Manual",   badge: "bg-slate-500/15  text-slate-400  border-slate-500/30",  rowBg: "bg-slate-500/[0.04]",   rowBorder: "border-slate-500/20",    icon: <DollarSign size={10} /> },
};

export const TYPE_OPTIONS: { value: CostLineType; label: string }[] = [
  { value: "METAL",   label: "Metal" },
  { value: "HECHURA", label: "Hechura" },
  { value: "PRODUCT", label: "Producto" },
  { value: "SERVICE", label: "Servicio" },
];

// ---------------------------------------------------------------------------
// Layout: grid fijo 8 columnas (handle + 7 originales)
// [handle 20px] [badge 96px] [moneda 72px] [desc minmax(96px,1fr)] [qty 180px] [op 20px] [price 180px] [result+x 180px]
// ---------------------------------------------------------------------------
const GRID = "grid grid-cols-[20px_96px_72px_minmax(96px,1fr)_180px_20px_180px_180px] items-center gap-x-2";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function emptyLine(type: CostLineType, defaults: Partial<CostLine> = {}): CostLine {
  return { type, label: type === "HECHURA" ? "Hechura / Mano de Obra" : "", quantity: 1, unitValue: 0, currencyId: null, mermaPercent: null, metalVariantId: null, sortOrder: 0, ...defaults };
}

function lineRawSubtotal(line: CostLine): number | null {
  if (!line.quantity || !line.unitValue) return null;
  if (line.type === "METAL") return line.quantity * (1 + (line.mermaPercent ?? 0) / 100) * line.unitValue;
  return line.quantity * line.unitValue;
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
// CurrencyPill — dropdown compacto con portal
// ---------------------------------------------------------------------------
function CurrencyPill({ value, onChange, currencies, baseCurrencyId }: {
  value: string; onChange: (id: string) => void; currencies: CurrencyOption[]; baseCurrencyId: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const curr = currencies.find(c => c.id === value) ?? currencies.find(c => c.id === baseCurrencyId);

  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (currencies.length <= 1) {
    return (
      <span className="inline-flex items-center justify-center px-2 h-8 rounded-lg bg-surface2/40 border border-border text-xs font-semibold text-muted w-full">
        {curr?.code ?? "—"}
      </span>
    );
  }

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
    setOpen(v => !v);
  }

  return (
    <>
      <button
        ref={btnRef} type="button" onClick={openMenu} title="Cambiar moneda"
        className="inline-flex items-center justify-center gap-0.5 px-2 h-8 rounded-lg border border-border bg-surface2/40 text-xs font-semibold text-text hover:bg-surface2 hover:border-primary/40 transition w-full"
      >
        {curr?.code ?? "—"} <ChevronDown size={9} className="text-muted" />
      </button>
      {open && ReactDOM.createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left, position: "fixed", zIndex: 9999, minWidth: 120 }}
          className="rounded-xl border border-border bg-card shadow-lg py-1 overflow-hidden"
        >
          {currencies.map(c => (
            <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); }}
              className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface2 transition text-left", c.id === value ? "font-semibold text-primary" : "text-text")}
            >
              <span className="font-semibold w-8 shrink-0">{c.code}</span>
              <span className="text-muted">{c.symbol}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
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
      className={cn(GRID, "rounded-xl border px-2 py-1.5", cfg.rowBg, cfg.rowBorder)}
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
      <CurrencyPill
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
        <TPComboFixed
          value={line.catalogItemId ?? ""}
          onChange={(v) => {
            const catalogItemId = v || null;
            const item = items.find(i => i.id === catalogItemId);
            const rawPrice = item?.costPrice ?? null;
            let unitValue: number;
            if (rawPrice != null) {
              // Precio disponible → convertir si la línea usa moneda distinta a la base
              const lineCurrId = line.currencyId ?? baseCurrencyId;
              if (lineCurrId !== baseCurrencyId) {
                const rate = currencies.find(c => c.id === lineCurrId)?.latestRate ?? null;
                unitValue = rate != null ? Math.round((rawPrice / rate) * 10000) / 10000 : rawPrice;
              } else {
                unitValue = rawPrice;
              }
            } else {
              // Sin precio → limpiar el campo (no heredar precio de ítem anterior)
              unitValue = 0;
            }
            update(idx, {
              catalogItemId,
              label: item?.label ?? (item as any)?.name ?? line.label,
              unitValue,
            });
          }}
          options={[{ value: "", label: "— Sin seleccionar —" }, ...items.map(i => ({ value: i.id, label: i.label ?? (i as any).name ?? i.id }))]}
          placeholder={line.type === "PRODUCT" ? "Buscar producto..." : "Buscar servicio..."}
          searchable
        />
      )}

      {/* Col 4 — Cantidad */}
      <TPNumberInput
        value={line.quantity}
        onChange={(v) => update(idx, { quantity: v ?? (line.type === "METAL" ? 0 : 1) })}
        placeholder="0.00"
        min={0}
        decimals={2}
        suffix={line.type === "METAL" ? <span className="text-[10px] text-muted">g</span> : undefined}
        wrapClassName="space-y-0"
      />

      {/* Col 5 — Operador × */}
      <span className="text-muted text-xs text-center select-none">×</span>

      {/* Col 6 — Precio unitario */}
      <div className="space-y-0.5">
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
        {line.type === "METAL" && (() => {
          const mv = metalVariants.find(m => m.id === line.metalVariantId);
          if (!mv?.latestQuotePrice) return null;
          const stored  = line.unitValue ?? 0;
          const current = mv.latestQuotePrice;
          if (Math.abs(current - stored) < 0.005) return null;
          const diff = current - stored;
          return (
            <div className="flex items-center gap-1 text-[10px] leading-tight">
              <span className="text-amber-400/80">Cot: {lineSym} {fmtNum(current)}</span>
              <span className={diff > 0 ? "text-emerald-400" : "text-red-400"}>
                ({diff > 0 ? "+" : ""}{fmtNum(diff, 2)})
              </span>
            </div>
          );
        })()}
      </div>

      {/* Col 7 — Subtotal + eliminar */}
      <div className="flex items-center justify-end gap-1.5">
        <span className={cn(
          "tabular-nums text-sm font-semibold whitespace-nowrap text-right",
          rawSub != null && rawSub > 0 ? "text-text" : "text-muted/30"
        )}>
          {rawSub != null && rawSub > 0 ? `${lineSym} ${fmtNum(rawSub)}` : "—"}
        </span>
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
  const othersTotal  = lines.filter(l => l.type !== "METAL" && l.type !== "HECHURA").reduce((s, l) => s + (lineSubtotal(l, currencies, baseCurrencyId) ?? 0), 0);
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
              <div className="col-span-7 flex items-center gap-1.5 text-xs text-amber-400 justify-end pr-2">
                <Gem size={10} /> Subtotal metal
              </div>
              <div className="text-right pr-8 text-xs tabular-nums text-muted font-medium">
                {baseCurrencySymbol} {fmtNum(metalTotal)}
              </div>
            </div>
          )}
          {hechuraTotal > 0 && (
            <div className={cn(GRID, "px-2 py-0.5")}>
              <div className="col-span-7 flex items-center gap-1.5 text-xs text-blue-400 justify-end pr-2">
                <Wrench size={10} /> Subtotal hechura
              </div>
              <div className="text-right pr-8 text-xs tabular-nums text-muted font-medium">
                {baseCurrencySymbol} {fmtNum(hechuraTotal)}
              </div>
            </div>
          )}
          {othersTotal > 0 && (
            <div className={cn(GRID, "px-2 py-0.5")}>
              <div className="col-span-7 flex items-center gap-1.5 text-xs text-muted justify-end pr-2">
                <DollarSign size={10} /> Subtotal otros
              </div>
              <div className="text-right pr-8 text-xs tabular-nums text-muted font-medium">
                {baseCurrencySymbol} {fmtNum(othersTotal)}
              </div>
            </div>
          )}
          <div className={cn(GRID, "px-2 pt-2 border-t border-border mt-1")}>
            <div className="col-span-7 flex items-center gap-1.5 text-sm font-semibold text-text justify-end pr-2">
              <Calculator size={13} /> Total estimado
            </div>
            <div className="text-right pr-8 text-sm tabular-nums font-semibold text-emerald-400">
              {baseCurrencySymbol} {fmtNum(metalTotal + hechuraTotal + othersTotal)}
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
