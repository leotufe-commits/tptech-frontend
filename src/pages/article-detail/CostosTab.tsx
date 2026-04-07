// src/pages/article-detail/CostosTab.tsx
// Pestaña de Costos — muestra costo registrado vs costo valorizado actual
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Info,
  Loader2,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "../../components/ui/tp";
import { TPCard } from "../../components/ui/TPCard";
import { TPBadge } from "../../components/ui/TPBadges";
import { fmtMoney, COST_MODE_LABELS, articlesApi } from "../../services/articles";
import type { PricingPreviewResult, PricingStepResult, PricingAlert } from "../../services/articles";
import type { TaxRow } from "../../services/taxes";

// ---------------------------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------------------------

type CostLineView = {
  id?: string;
  type: string;
  label: string;
  quantity: string;
  unitValue: string;
  mermaPercent: string | null;
  lineAdjKind?: string | null;
  lineAdjType?: string | null;
  lineAdjValue?: string | null;
  currency?: { code: string; symbol?: string } | null;
  metalVariant?: {
    name: string;
    purity: string;
    metal: { name: string };
  } | null;
};

type LineEnrichment = {
  currentUnitValue: string | null;
  source: "METAL_QUOTE" | "REGISTERED" | "NO_REFERENCE";
  quotedAt: string | null;
};

type TaxDetail = {
  id: string;
  name: string;
  rate: string | null;
  fixedAmount: string | null;
  calculationType: string;
};

type BaseCurrency = { id: string; code: string; symbol: string } | null;

// PriceBreakdown — desglose Metal/Hechura devuelto por el motor de costo
type PriceBreakdownMetalItem = {
  variantId?: string | null;
  gramsOriginal?: number | null;
  purity?: number | null;
  gramsPure?: number | null;
  unitValue?: number | null;
  totalValue: number;
};
type PriceBreakdownAdjustment = {
  type: "BONUS" | "SURCHARGE" | "OTHER";
  label: string;
  amount: number;
};
type PriceBreakdown = {
  mode: string;
  metal: { items: PriceBreakdownMetalItem[]; total: number };
  hechura: { base: number; adjustments: PriceBreakdownAdjustment[]; total: number };
  totals: { metal: number; hechura: number; unified: number };
};

export type CostosTabProps = {
  article: any;
  taxes: TaxRow[];       // listado global de impuestos (fallback)
  refreshing: boolean;
  onRefresh: () => void;
  hideSummaryCards?: boolean; // oculta las 4 tarjetas resumen (para uso embebido)
};

// ---------------------------------------------------------------------------
// Helpers de cálculo
// ---------------------------------------------------------------------------

function n(v: any): number {
  const r = parseFloat(v ?? "0");
  return Number.isFinite(r) ? r : 0;
}

function fmtN(v: number) {
  return v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number) {
  const abs = Math.abs(v);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${abs.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Subtotal registrado de una línea (usa unitValue almacenado, incluye ajuste de línea) */
function regSubtotal(line: CostLineView): number {
  const qty   = n(line.quantity);
  const uv    = n(line.unitValue);
  const merma = n(line.mermaPercent);
  const base  = qty * uv * (1 + merma / 100);
  return applyAdj(base, line.lineAdjKind ?? "", line.lineAdjType ?? "", line.lineAdjValue != null ? n(line.lineAdjValue) : null).adjusted;
}

/** Subtotal actual de una línea (usa currentUnitValue del enriquecimiento, incluye ajuste de línea) */
function curSubtotal(line: CostLineView, enr: LineEnrichment | null): number | null {
  if (!enr || enr.currentUnitValue == null || enr.source === "NO_REFERENCE") return null;
  const qty   = n(line.quantity);
  const cuv   = n(enr.currentUnitValue);
  const merma = n(line.mermaPercent);
  const base  = qty * cuv * (1 + merma / 100);
  return applyAdj(base, line.lineAdjKind ?? "", line.lineAdjType ?? "", line.lineAdjValue != null ? n(line.lineAdjValue) : null).adjusted;
}

/** Aplica el ajuste (bonus/recargo) de los campos manual sobre un subtotal */
function applyAdj(
  base: number,
  kind: string,
  adjType: string,
  adjValue: number | null,
): { amount: number; adjusted: number } {
  if (!kind || kind === "" || adjValue == null) return { amount: 0, adjusted: base };
  const abs = Math.abs(adjValue);
  const amt = adjType === "PERCENTAGE" ? base * (abs / 100) : abs;
  const signed = kind === "SURCHARGE" ? amt : -amt;
  return { amount: signed, adjusted: base + signed };
}

/** Calcula impuesto sobre una base */
function computeTax(tax: TaxDetail, base: number): number {
  if (tax.calculationType === "PERCENTAGE") return base * (n(tax.rate) / 100);
  return n(tax.fixedAmount);
}

// ---------------------------------------------------------------------------
// Sub-componentes de UI
// ---------------------------------------------------------------------------

const TYPE_CFG: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "warning" | "info" }> = {
  METAL:   { label: "Metal",    tone: "primary"  },
  HECHURA: { label: "Hechura",  tone: "info"     },
  PRODUCT: { label: "Producto", tone: "success"  },
  SERVICE: { label: "Servicio", tone: "warning"  },
  MANUAL:  { label: "Manual",   tone: "neutral"  },
};

function VariationBadge({ reg, cur }: { reg: number | null; cur: number | null }) {
  if (reg == null || cur == null || reg === 0) return <span className="text-muted text-xs">—</span>;
  const pct = ((cur - reg) / reg) * 100;
  const abs = cur - reg;
  if (Math.abs(pct) < 0.05) return <span className="text-muted text-xs">≈ igual</span>;
  const up = abs > 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
      up ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
    )}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {fmtPct(pct)}
    </span>
  );
}

function SummaryCard({
  label, value, sub, tone = "neutral", icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "up" | "down" | "primary";
  icon?: React.ReactNode;
}) {
  const valueColor =
    tone === "up"      ? "text-amber-600 dark:text-amber-400"
    : tone === "down"  ? "text-emerald-600 dark:text-emerald-400"
    : tone === "primary" ? "text-primary"
    : "text-text";

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted uppercase tracking-wide mb-1">
        {icon}
        {label}
      </div>
      <div className={cn("text-lg font-bold tabular-nums truncate", valueColor)}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function TotalsRow({
  label, reg, cur, regColor, curColor, bold, separator,
}: {
  label: string;
  reg: string;
  cur?: string | null;
  regColor?: string;
  curColor?: string;
  bold?: boolean;
  separator?: boolean;
}) {
  return (
    <div className={cn(
      "grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-0 px-4 py-2 text-xs",
      bold && "border-t-2 border-border bg-primary/5 font-semibold",
      separator && !bold && "border-t border-border/50",
    )}>
      <span className={cn("text-muted", bold && "text-text font-semibold")}>{label}</span>
      <span className={cn("tabular-nums text-right min-w-[100px]", regColor ?? (bold ? "text-text font-bold text-sm" : "text-text/80"))}>
        {reg}
      </span>
      <span className={cn("tabular-nums text-right min-w-[100px]", curColor ?? (bold ? "text-text font-bold text-sm" : "text-text/80"))}>
        {cur ?? reg}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AlertsBlock — alertas de negocio del motor de precios
// ---------------------------------------------------------------------------

function AlertsBlock({ alerts }: { alerts: PricingAlert[] }) {
  if (!alerts || alerts.length === 0) return null;

  const cfg: Record<PricingAlert["level"], { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    error:   { bg: "bg-red-50 dark:bg-red-950/30",   border: "border-red-200 dark:border-red-800",   text: "text-red-700 dark:text-red-400",   icon: <X size={11} className="text-red-500 shrink-0 mt-0.5" /> },
    warning: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", icon: <AlertCircle size={11} className="text-amber-500 shrink-0 mt-0.5" /> },
    info:    { bg: "bg-blue-50 dark:bg-blue-950/30",  border: "border-blue-200 dark:border-blue-800",  text: "text-blue-700 dark:text-blue-400",  icon: <Info size={11} className="text-blue-500 shrink-0 mt-0.5" /> },
  };

  return (
    <div className="px-4 pt-4 pb-2 space-y-2">
      {alerts.map((alert, i) => {
        const c = cfg[alert.level];
        return (
          <div key={i} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-xs", c.bg, c.border)}>
            {c.icon}
            <span className={c.text}>{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PricingBreakdown — pasos detallados del motor de precios
// ---------------------------------------------------------------------------

/** Keys que pertenecen a la sección COSTO */
function isCostStep(key: string): boolean {
  return (
    key.startsWith("COST_") ||
    key.startsWith("MANUAL_") ||
    key.startsWith("MULTIPLIER") ||
    key.startsWith("METAL_") ||
    key === "HECHURA" ||
    key === "UNKNOWN_MODE"
  );
}

/** Keys que pertenecen a la sección PRECIO */
const PRICE_STEP_KEYS = new Set([
  "VARIANT_OVERRIDE", "PRICE_LIST", "MANUAL_OVERRIDE", "MANUAL_FALLBACK",
  "BASE_PRICE", "QUANTITY_DISCOUNT", "PROMOTION", "MARGIN", "PRECIO_FINAL",
]);

/** Devuelve una línea de descripción legible para un paso, basada en su meta */
function stepFormula(step: PricingStepResult): string | null {
  const m = step.meta ?? {};
  switch (step.key) {
    case "COST_LINES_METAL":
      if (m.qty && m.quotePrice) {
        const merma = m.merma != null && Number(m.merma) > 0 ? ` · merma ${m.merma}%` : "";
        return `${m.qty} g × $${m.quotePrice}/g${merma}`;
      }
      return null;
    case "METAL_QUOTE":
      if (m.grams && m.price) {
        const merma = m.merma != null && Number(m.merma) > 0 ? ` · merma ${m.merma}%` : "";
        return `${m.grams} g × $${m.price}/g${merma}`;
      }
      return null;
    case "HECHURA":
      if (m.mode === "PER_GRAM" && m.price && m.gramsWithMerma)
        return `${m.price}/g × ${m.gramsWithMerma} g`;
      if (m.price)
        return `Fijo: $${m.price}`;
      return null;
    case "MULTIPLIER":
      if (m.qty && m.value)
        return `${m.qty} × $${m.value}`;
      return null;
    case "MANUAL_BASE_COST":
      if (m.adjustmentKind && m.adjustmentKind !== "")
        return `Base: $${m.manualBaseCost} + ajuste`;
      return `Base: $${m.manualBaseCost}`;
    case "PRICE_LIST":
      if (m.mode && m.source)
        return `Modo ${m.mode} · Fuente: ${String(m.source).toLowerCase()}`;
      return null;
    case "QUANTITY_DISCOUNT":
      if (m.type && m.value && m.quantity)
        return `${m.type === "PERCENTAGE" ? `${m.value}%` : `$${m.value}`} · cant. ${m.quantity}`;
      return null;
    case "PROMOTION":
      if (m.type && m.value)
        return `${m.type === "PERCENTAGE" ? `${m.value}%` : `$${m.value}`} · ámbito ${m.scope ?? ""}`;
      return null;
    case "MARGIN":
      if (m.unitCost && m.finalPrice)
        return `(precio − costo) / precio`;
      return null;
    default:
      return null;
  }
}

function StepStatusIcon({ status }: { status: PricingStepResult["status"] }) {
  if (status === "ok")
    return <Check size={11} className="text-emerald-500 shrink-0 mt-0.5" />;
  if (status === "partial")
    return <AlertCircle size={11} className="text-amber-500 shrink-0 mt-0.5" />;
  if (status === "missing")
    return <X size={11} className="text-red-500 shrink-0 mt-0.5" />;
  return <Minus size={11} className="text-muted shrink-0 mt-0.5" />;
}

function StepRow({ step, sym }: { step: PricingStepResult; sym: string }) {
  const formula = stepFormula(step);
  const msg     = step.status !== "ok" && step.status !== "partial" ? step.message : null;
  const valueOk = step.value != null;

  return (
    <div className={cn(
      "grid grid-cols-[16px_1fr_auto] gap-x-2 px-3 py-1.5 text-xs rounded transition-colors",
      step.status === "missing" && "opacity-60",
      step.status === "skipped" && "opacity-40",
    )}>
      <StepStatusIcon status={step.status} />
      <div className="min-w-0">
        <span className={cn(
          "font-medium leading-snug",
          step.status === "missing" ? "text-red-600 dark:text-red-400" : "text-text",
        )}>
          {step.label}
        </span>
        {(formula || msg) && (
          <div className="text-[10px] text-muted/80 mt-0.5 font-mono">
            {formula ?? msg}
          </div>
        )}
      </div>
      <div className={cn(
        "tabular-nums font-semibold text-right self-start",
        !valueOk && "text-muted text-[10px]",
        step.key === "MARGIN" ? "text-primary" : "text-text",
        step.status === "missing" ? "text-muted" : "",
      )}>
        {valueOk
          ? step.key === "MARGIN"
            ? `${parseFloat(step.value!).toFixed(1)}%`
            : fmtMoney(parseFloat(step.value!), sym)
          : "—"
        }
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {children}
      </span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

function TotalRow({ label, value, sym, highlight = false }: {
  label: string; value: string | null; sym: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 text-xs",
      highlight
        ? "border-t-2 border-primary/30 bg-primary/5 rounded-b-xl"
        : "border-t border-border/40",
    )}>
      <span className={cn("font-medium", highlight ? "text-text font-semibold" : "text-muted")}>
        {label}
      </span>
      <span className={cn(
        "tabular-nums font-bold text-right",
        highlight ? "text-primary text-sm" : "text-text",
      )}>
        {value != null ? fmtMoney(parseFloat(value), sym) : "—"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetalHechuraBreakdown — desglose estructurado Metal / Hechura
// ---------------------------------------------------------------------------

function MetalHechuraBreakdown({
  breakdown,
  sym,
  costLines,
  compositions,
}: {
  breakdown: PriceBreakdown;
  sym: string;
  costLines: CostLineView[];
  compositions?: Array<{ variantId: string; grams: any }>;
}) {
  const metalItems = breakdown.metal.items;
  const hechura = breakdown.hechura;
  const totals = breakdown.totals;
  const hasHechura = totals.hechura > 0 || hechura.adjustments.length > 0;

  // Intentar obtener nombre de variante metálica desde costLines o compositions
  function metalName(item: PriceBreakdownMetalItem, idx: number): string {
    // COST_LINES mode: buscar en costLines por posición (solo líneas METAL)
    if (costLines.length > 0) {
      const metalCostLines = costLines.filter(l => l.type === "METAL");
      const cl = metalCostLines[idx];
      if (cl?.metalVariant) {
        return `${cl.metalVariant.metal.name} ${cl.metalVariant.name}`;
      }
      if (cl?.label) return cl.label;
    }
    // METAL_MERMA_HECHURA mode: composiciones
    if (compositions && compositions.length > 0) {
      // no tenemos name aquí (solo variantId), fallback a variantId truncado
    }
    return item.variantId ? `Variante ${item.variantId.slice(-6)}` : `Metal ${idx + 1}`;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card text-xs">
      {/* Metal */}
      {metalItems.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">Metal</span>
            <div className="flex-1 h-px bg-primary/15" />
          </div>
          {metalItems.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-1.5">
              <div className="min-w-0">
                <span className="font-medium text-text truncate">{metalName(item, i)}</span>
                {(item.gramsOriginal != null || item.purity != null) && (
                  <div className="text-[10px] text-muted font-mono mt-0.5">
                    {item.gramsOriginal != null && `${item.gramsOriginal}g`}
                    {item.purity != null && ` × ${(item.purity * 100).toFixed(1)}%`}
                    {item.gramsPure != null && ` = ${item.gramsPure}g puros`}
                    {item.unitValue != null && ` × ${fmtMoney(item.unitValue, sym)}/g`}
                  </div>
                )}
              </div>
              <span className="tabular-nums font-semibold text-text self-start pt-0.5">
                {fmtMoney(item.totalValue, sym)}
              </span>
            </div>
          ))}
          {metalItems.length > 1 && (
            <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-1.5 border-t border-border/40 bg-surface2/20">
              <span className="text-muted font-medium">Subtotal metal</span>
              <span className="tabular-nums font-bold text-text">{fmtMoney(totals.metal, sym)}</span>
            </div>
          )}
        </>
      )}

      {/* Hechura */}
      {hasHechura && (
        <>
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-info/70">Hechura</span>
            <div className="flex-1 h-px bg-info/15" />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-1.5">
            <span className="text-text/80">Hechura base</span>
            <span className="tabular-nums text-text/80">{fmtMoney(hechura.base, sym)}</span>
          </div>
          {hechura.adjustments.map((adj, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-1.5">
              <span className={cn("text-text/70", adj.type === "BONUS" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                {adj.label}
              </span>
              <span className={cn("tabular-nums font-medium", adj.type === "BONUS" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                {adj.amount >= 0 ? "+" : "−"}{fmtMoney(Math.abs(adj.amount), sym)}
              </span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-1.5 border-t border-border/40 bg-surface2/20">
            <span className="text-muted font-medium">Subtotal hechura</span>
            <span className="tabular-nums font-bold text-text">{fmtMoney(hechura.total, sym)}</span>
          </div>
        </>
      )}

      {/* Total unificado */}
      <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 border-t-2 border-primary/20 bg-primary/5">
        <span className="font-semibold text-text">Total (Metal + Hechura)</span>
        <span className="tabular-nums font-bold text-primary text-sm">{fmtMoney(totals.unified, sym)}</span>
      </div>
    </div>
  );
}

function PricingBreakdown({ data, sym }: { data: PricingPreviewResult; sym: string }) {
  const costSteps  = data.steps.filter(s => isCostStep(s.key));
  const priceSteps = data.steps.filter(s => PRICE_STEP_KEYS.has(s.key));

  const hasCostSteps  = costSteps.length > 0;
  const hasPriceSteps = priceSteps.length > 0;
  const saleTaxes     = (data.taxBreakdown ?? []).filter(t => t.taxAmount > 0);
  const hasSaleTaxes  = saleTaxes.length > 0 && !data.taxExemptByEntity;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {/* ── Sección COSTO ── */}
      {hasCostSteps && (
        <>
          <SectionTitle>Costo</SectionTitle>
          {costSteps.map((step, i) => (
            <StepRow key={`cost-${i}`} step={step} sym={sym} />
          ))}
          <TotalRow
            label="Costo base"
            value={data.unitCost}
            sym={sym}
          />
        </>
      )}

      {/* ── Sección PRECIO ── */}
      {hasPriceSteps && (
        <>
          <SectionTitle>Precio de lista</SectionTitle>
          {priceSteps
            .filter(s => s.key !== "MARGIN" && s.key !== "PRECIO_FINAL")
            .map((step, i) => (
              <StepRow key={`price-${i}`} step={step} sym={sym} />
            ))}
          <TotalRow
            label="Precio neto"
            value={data.unitPrice}
            sym={sym}
            highlight={!hasSaleTaxes}
          />

          {/* ── Impuestos sobre venta ── */}
          {hasSaleTaxes && (
            <>
              <SectionTitle>Impuestos sobre venta</SectionTitle>
              {saleTaxes.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-1.5 text-xs">
                  <div className="min-w-0">
                    <span className="text-text/80">{t.name}</span>
                    {t.rate != null && (
                      <span className="ml-1.5 text-[10px] text-muted/70 font-mono">
                        {t.rate}%{t.baseEstimated ? " · estimado" : ""}
                      </span>
                    )}
                  </div>
                  <span className="tabular-nums text-text/80 text-right">
                    +{fmtMoney(t.taxAmount, sym)}
                  </span>
                </div>
              ))}
              {data.totalWithTax != null && (
                <TotalRow label="Total final" value={data.totalWithTax} sym={sym} highlight />
              )}
            </>
          )}

          {/* Entidad exenta */}
          {data.taxExemptByEntity && (
            <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-1.5 text-xs border-t border-border/40">
              <span className="text-muted italic">Cliente exento de impuestos</span>
              <span className="text-muted">—</span>
            </div>
          )}
        </>
      )}

      {/* ── Margen ── */}
      {data.marginPercent != null && data.unitCost != null && (
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 border-t border-border/40 text-xs bg-surface2/30">
          <span className="text-muted">Margen sobre precio</span>
          {(() => {
            const mVal = parseFloat(data.marginPercent);
            const badgeCls = mVal >= 20
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : mVal >= 0
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-red-500/15 text-red-600 dark:text-red-400";
            return (
              <span className={`tabular-nums text-right font-semibold px-1.5 py-0.5 rounded-full ${badgeCls}`}>
                {mVal.toFixed(1)}%
              </span>
            );
          })()}
          <span className="tabular-nums text-right text-muted">
            {data.unitMargin != null ? fmtMoney(parseFloat(data.unitMargin), sym) : ""}
          </span>
        </div>
      )}

      {/* ── Advertencias ── */}
      {(data.partial || data.costPartial) && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertCircle size={11} className="shrink-0" />
          <span>
            {data.costPartial ? "Costo parcial: faltan cotizaciones." : ""}
            {data.partial     ? " Precio estimado: lista sin datos completos." : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function CostosTab({ article, taxes: _taxes, refreshing, onRefresh, hideSummaryCards = false }: CostosTabProps) {
  const navigate = useNavigate();

  // ── Pricing preview (motor de pasos) ────────────────────────────────────
  const [pricing, setPricing]           = useState<PricingPreviewResult | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError]   = useState<string | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const articleId = article?.id as string | undefined;

  useEffect(() => {
    if (!articleId) return;
    setPricingLoading(true);
    setPricingError(null);
    articlesApi.getPricingPreview(articleId)
      .then(data => { setPricing(data); setPricingLoading(false); })
      .catch(() => { setPricingError("No se pudo cargar el desglose."); setPricingLoading(false); });
  }, [articleId]);

  // ── Datos del artículo ────────────────────────────────────────────────────
  const costMode         = (article.costCalculationMode as string) ?? "MANUAL";
  const computed         = article.computedCostPrice as {
    value: string | null; mode: string; partial: boolean;
    metalCost?: string | null; hechuraCost?: string | null; totalGrams?: string | null;
    breakdown?: PriceBreakdown | null;
  } | undefined;
  const breakdown        = computed?.breakdown ?? null;
  const compositions     = (article.compositions ?? []) as Array<{ variantId: string; grams: any }>;
  const computedCostBase = article.computedCostBase as string | null | undefined;

  const multiplierBase   = article.multiplierBase as string | undefined;
  const multiplierValue  = article.multiplierValue  != null ? n(article.multiplierValue)  : null;
  const multiplierQty    = article.multiplierQuantity != null ? n(article.multiplierQuantity) : null;

  const manualBaseCost   = article.manualBaseCost  != null ? n(article.manualBaseCost)  : null;
  const manualAdjKind    = (article.manualAdjustmentKind  as string) ?? "";
  const manualAdjType    = (article.manualAdjustmentType  as string) ?? "";
  const manualAdjValue   = article.manualAdjustmentValue != null ? n(article.manualAdjustmentValue) : null;

  const costLines        = (article.costComposition ?? []) as CostLineView[];
  const enrichments      = (article.costLineCurrentValues ?? []) as LineEnrichment[];
  const taxDetails       = (article.taxDetails ?? []) as TaxDetail[];
  const baseCurrency     = article.baseCurrency as BaseCurrency;

  const hechuraPriceMode = article.hechuraPriceMode as string | undefined;

  const hasCostLines     = costLines.length > 0;
  const isPartial        = computed?.partial === true;

  // ── Cálculo de totales ────────────────────────────────────────────────────
  const regLinesSum = hasCostLines
    ? costLines.reduce((s, l) => s + regSubtotal(l), 0)
    : (manualBaseCost ?? (multiplierQty != null && multiplierValue != null ? multiplierQty * multiplierValue : null) ?? 0);

  // "current" usando enriquecimiento línea a línea
  const hasCurForAllLines = hasCostLines && costLines.every((_, i) => {
    const enr = enrichments[i] ?? null;
    return enr?.source !== "NO_REFERENCE" && enr?.currentUnitValue != null;
  });
  const curLinesSum = hasCostLines
    ? (() => {
        let total = 0;
        let allKnown = true;
        for (let i = 0; i < costLines.length; i++) {
          const s = curSubtotal(costLines[i], enrichments[i] ?? null);
          if (s == null) { allKnown = false; break; }
          total += s;
        }
        return allKnown ? total : null;
      })()
    : null;

  // Ajuste sobre la suma de líneas
  const adjReg = applyAdj(regLinesSum, manualAdjKind, manualAdjType, manualAdjValue);
  const adjCur = curLinesSum != null
    ? applyAdj(curLinesSum, manualAdjKind, manualAdjType, manualAdjValue)
    : null;

  const regBeforeTax = adjReg.adjusted;
  const curBeforeTax = adjCur?.adjusted ?? null;

  // "Costo actual total" — preferimos el computado del backend (incluye conversiones)
  const backendCurCost = computedCostBase != null ? n(computedCostBase) : null;
  // Para efectos de cards: usamos backendCurCost; para tabla línea a línea: curLinesSum
  const displayCurTotal = backendCurCost ?? curBeforeTax;

  // Impuestos
  const taxRowsReg = taxDetails.map(t => ({ ...t, amt: computeTax(t, regBeforeTax) }));
  const taxRowsCur = curBeforeTax != null
    ? taxDetails.map(t => ({ ...t, amt: computeTax(t, curBeforeTax) }))
    : null;
  const totalTaxReg = taxRowsReg.reduce((s, r) => s + r.amt, 0);
  const totalTaxCur = taxRowsCur?.reduce((s, r) => s + r.amt, 0) ?? null;

  const totalReg = regBeforeTax + totalTaxReg;
  const totalCur = displayCurTotal != null
    ? (displayCurTotal + (totalTaxCur ?? totalTaxReg))
    : null;

  const diffAbs = totalCur != null ? totalCur - totalReg : null;
  const diffPct = totalCur != null && totalReg !== 0
    ? ((totalCur - totalReg) / totalReg) * 100
    : null;

  // ── Formato de unidad por tipo ─────────────────────────────────────────
  function unitForLine(type: string) {
    if (type === "METAL")   return "g";
    if (type === "HECHURA") return hechuraPriceMode === "PER_GRAM" ? "g" : "pz";
    return "ud";
  }

  const sym = baseCurrency?.symbol ?? "$";

  return (
    <div className="space-y-4">

      {/* ── Barra superior: modo + recalcular ──────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Calculator size={12} className="text-muted shrink-0" />
        <span className="font-medium text-text">
          {COST_MODE_LABELS[costMode as keyof typeof COST_MODE_LABELS] ?? costMode}
        </span>
        <span className="text-border">·</span>
        <span className="text-muted">
          {costMode === "MANUAL"              && "Costo ingresado manualmente."}
          {costMode === "MULTIPLIER"          && `Cantidad × valor unitario${multiplierBase ? ` (base: ${multiplierBase.toLowerCase()})` : ""}.`}
          {costMode === "METAL_MERMA_HECHURA" && "Composición metálica con merma y hechura."}
          {hasCostLines                       && "Composición por líneas de costo."}
        </span>
        {isPartial && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
            <AlertCircle size={10} />
            Estimación parcial
          </span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1 text-[11px] text-muted hover:text-text transition disabled:opacity-50"
          title="Recalcular usando cotizaciones actuales"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Actualizando…" : "Recalcular"}
        </button>
      </div>

      {/* ── Cards resumen ──────────────────────────────────────────────── */}
      {!hideSummaryCards && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Costo registrado"
          value={fmtMoney(totalReg, sym)}
          sub={taxRowsReg.length > 0 ? `Neto: ${fmtMoney(regBeforeTax, sym)}` : undefined}
          tone="primary"
          icon={<Calculator size={11} />}
        />
        <SummaryCard
          label="Costo valorizado actual"
          value={totalCur != null ? fmtMoney(totalCur, sym) : "—"}
          sub={totalCur != null && taxRowsCur != null && taxRowsCur.length > 0
            ? `Neto: ${fmtMoney(curBeforeTax ?? 0, sym)}`
            : totalCur == null ? "Sin referencia de mercado" : undefined}
          tone="neutral"
          icon={<TrendingUp size={11} />}
        />
        <SummaryCard
          label="Diferencia"
          value={diffAbs != null ? (diffAbs >= 0 ? `+${fmtMoney(diffAbs, sym)}` : `−${fmtMoney(Math.abs(diffAbs), sym)}`) : "—"}
          tone={diffAbs == null ? "neutral" : diffAbs > 0 ? "up" : diffAbs < 0 ? "down" : "neutral"}
          icon={diffAbs != null && diffAbs !== 0 ? (diffAbs > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />) : undefined}
        />
        <SummaryCard
          label="Variación"
          value={diffPct != null ? fmtPct(diffPct) : "—"}
          sub={baseCurrency ? `Moneda base: ${baseCurrency.code}` : undefined}
          tone={diffPct == null ? "neutral" : diffPct > 0 ? "up" : diffPct < 0 ? "down" : "neutral"}
        />
      </div>
      )}

      {/* ── Tabla de composición ───────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">

        {/* Header de columnas */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[660px]">
            <thead>
              <tr className="bg-surface2/60 border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted">Componente</th>
                <th className="text-left px-3 py-2 font-medium text-muted">Tipo</th>
                <th className="text-right px-3 py-2 font-medium text-muted">Cant.</th>
                <th className="text-left px-3 py-2 font-medium text-muted">Ud.</th>
                <th className="text-right px-3 py-2 font-medium text-muted">Val. reg.</th>
                {hasCostLines && (
                  <th className="text-right px-3 py-2 font-medium text-muted">Val. actual</th>
                )}
                <th className="text-right px-3 py-2 font-medium text-muted">Merma</th>
                <th className="text-right px-3 py-2 font-medium text-muted">Sub. reg.</th>
                {hasCostLines && (
                  <th className="text-right px-3 py-2 font-medium text-muted">Sub. actual</th>
                )}
                {hasCostLines && (
                  <th className="text-right px-3 py-2 font-medium text-muted w-16">Δ</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">

              {/* ── COST_LINES: una fila por línea ── */}
              {hasCostLines && costLines.map((line, i) => {
                const enr     = enrichments[i] ?? null;
                const regSub  = regSubtotal(line);
                const curSub  = curSubtotal(line, enr);
                const tc      = TYPE_CFG[line.type] ?? { label: line.type, tone: "neutral" as const };
                const isMetal  = line.type === "METAL";
                const noRef    = enr?.source === "NO_REFERENCE";
                const regUV    = n(line.unitValue);
                const curUV    = enr?.currentUnitValue != null && !noRef ? n(enr.currentUnitValue) : null;
                const lineSym  = line.currency?.symbol ?? sym;  // símbolo de la moneda de la línea

                return (
                  <tr key={i} className={cn(
                    "hover:bg-surface2/20 transition-colors",
                    noRef && "opacity-70",
                  )}>
                    {/* Componente */}
                    <td className="px-3 py-2.5 font-medium text-text max-w-[160px]">
                      <div className="truncate">
                        {line.metalVariant
                          ? `${line.metalVariant.metal.name} ${line.metalVariant.name}`
                          : line.label}
                      </div>
                      {line.currency && line.currency.code !== baseCurrency?.code && (
                        <span className="text-[10px] text-muted font-normal">{line.currency.code}</span>
                      )}
                      {!!line.lineAdjKind && !!line.lineAdjType && (
                        <span className={cn(
                          "text-[10px] font-normal",
                          line.lineAdjKind === "BONUS" ? "text-emerald-500" : "text-amber-500",
                        )}>
                          {line.lineAdjKind === "BONUS" ? "Bonif." : "Recargo"}{" "}
                          {line.lineAdjType === "PERCENTAGE"
                            ? `${n(line.lineAdjValue ?? "0")}%`
                            : fmtMoney(n(line.lineAdjValue ?? "0"), lineSym)}
                        </span>
                      )}
                    </td>
                    {/* Tipo */}
                    <td className="px-3 py-2.5">
                      <TPBadge tone={tc.tone} size="sm">{tc.label}</TPBadge>
                    </td>
                    {/* Cantidad */}
                    <td className="px-3 py-2.5 text-right tabular-nums text-text/80">
                      {fmtN(n(line.quantity))}
                    </td>
                    {/* Unidad */}
                    <td className="px-3 py-2.5 text-muted">{unitForLine(line.type)}</td>
                    {/* Val. registrado — moneda de la línea */}
                    <td className="px-3 py-2.5 text-right tabular-nums text-text/80">
                      {lineSym}{fmtN(regUV)}
                    </td>
                    {/* Val. actual — moneda base (MetalQuote está en base currency) */}
                    {hasCostLines && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {noRef ? (
                          <span className="text-muted text-[10px]">Sin ref.</span>
                        ) : curUV != null ? (
                          <span className={cn(
                            "tabular-nums",
                            isMetal && curUV !== regUV
                              ? curUV > regUV
                                ? "text-amber-600 dark:text-amber-400 font-medium"
                                : "text-emerald-600 dark:text-emerald-400 font-medium"
                              : "text-text/80",
                          )}>
                            {sym}{fmtN(curUV)}
                          </span>
                        ) : (
                          <span className="text-muted text-[10px]">—</span>
                        )}
                      </td>
                    )}
                    {/* Merma */}
                    <td className="px-3 py-2.5 text-right tabular-nums text-text/70">
                      {n(line.mermaPercent) > 0 ? `${n(line.mermaPercent)}%` : "—"}
                    </td>
                    {/* Sub. registrado — moneda de la línea */}
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-text">
                      {fmtMoney(regSub, lineSym)}
                    </td>
                    {/* Sub. actual — moneda base */}
                    {hasCostLines && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {noRef ? (
                          <span className="text-muted text-[10px]">Sin ref.</span>
                        ) : curSub != null ? (
                          <span className={cn(
                            "font-semibold",
                            isMetal && curSub !== regSub
                              ? curSub > regSub
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                              : "text-text",
                          )}>
                            {fmtMoney(curSub, sym)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    )}
                    {/* Variación */}
                    {hasCostLines && (
                      <td className="px-3 py-2.5 text-right">
                        <VariationBadge reg={regSub} cur={curSub} />
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* ── MULTIPLIER: fila única ── */}
              {!hasCostLines && costMode === "MULTIPLIER" && (
                <tr className="hover:bg-surface2/20 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-text">Multiplicador</td>
                  <td className="px-3 py-2.5">
                    <TPBadge tone="info" size="sm">Multiplicador</TPBadge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-text/80">
                    {multiplierQty != null ? fmtN(multiplierQty) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    {multiplierBase === "GRAMS" ? "g"
                      : multiplierBase === "KILATES" ? "k"
                      : multiplierBase === "UNITS" ? "ud"
                      : multiplierBase ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-text/80">
                    {multiplierValue != null ? fmtMoney(multiplierValue, sym) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted">—</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-text">
                    {backendCurCost != null ? fmtMoney(backendCurCost, sym) : "—"}
                  </td>
                </tr>
              )}

              {/* ── MANUAL: fila única ── */}
              {!hasCostLines && costMode === "MANUAL" && (
                <tr className="hover:bg-surface2/20 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-text">Costo base</td>
                  <td className="px-3 py-2.5">
                    <TPBadge tone="neutral" size="sm">Manual</TPBadge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-text/80">1</td>
                  <td className="px-3 py-2.5 text-muted">ud</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-text/80">
                    {manualBaseCost != null ? fmtMoney(manualBaseCost, sym) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted">—</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-text">
                    {manualBaseCost != null ? fmtMoney(manualBaseCost, sym) : "—"}
                  </td>
                </tr>
              )}

              {/* ── METAL_MERMA_HECHURA: sin líneas explícitas ── */}
              {!hasCostLines && costMode === "METAL_MERMA_HECHURA" && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted text-xs">
                    Costo calculado automáticamente desde la variante de metal y los gramos del artículo. Ver desglose abajo.
                  </td>
                </tr>
              )}

              {/* Estado vacío */}
              {hasCostLines && costLines.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-muted text-xs">
                    Sin líneas de composición — editá el artículo para agregar componentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Bloque de totales ──────────────────────────────────────────── */}
        <div className="border-t border-border bg-surface2/20">

          {/* Header columnas de totales */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-1.5 border-b border-border/40">
            <span className="text-[10px] font-medium text-muted uppercase tracking-wide" />
            <span className="text-[10px] font-medium text-muted uppercase tracking-wide text-right min-w-[100px]">Registrado</span>
            <span className="text-[10px] font-medium text-muted uppercase tracking-wide text-right min-w-[100px]">Actual</span>
          </div>

          {/* Subtotal composición */}
          {hasCostLines && costLines.length > 1 && (
            <TotalsRow
              label={`Subtotal composición${computed?.totalGrams != null ? ` · ${fmtN(n(computed.totalGrams))} g` : ""}`}
              reg={fmtMoney(regLinesSum, sym)}
              cur={curLinesSum != null ? fmtMoney(curLinesSum, sym) : null}
            />
          )}

          {/* Subtotal MANUAL base (solo si tiene ajuste) */}
          {!hasCostLines && costMode === "MANUAL" && manualBaseCost != null && adjReg.amount !== 0 && (
            <TotalsRow label="Costo base" reg={fmtMoney(manualBaseCost, sym)} />
          )}

          {/* Metal / hechura (solo si el backend los reporta) */}
          {!hasCostLines && costMode === "METAL_MERMA_HECHURA" && computed?.metalCost != null && (
            <TotalsRow label="Metal (con merma)" reg={fmtMoney(n(computed.metalCost), sym)} />
          )}
          {!hasCostLines && costMode === "METAL_MERMA_HECHURA" && computed?.hechuraCost != null && (
            <TotalsRow label="Hechura" reg={fmtMoney(n(computed.hechuraCost), sym)} />
          )}

          {/* Ajuste */}
          {manualAdjKind !== "" && adjReg.amount !== 0 && (
            <TotalsRow
              separator
              label={`${manualAdjKind === "BONUS" ? "Bonificación" : "Recargo"} ${manualAdjType === "PERCENTAGE" ? `${Math.abs(manualAdjValue ?? 0)}%` : "fijo"}`}
              reg={(adjReg.amount >= 0 ? "+" : "−") + fmtMoney(Math.abs(adjReg.amount), sym)}
              cur={adjCur != null ? ((adjCur.amount >= 0 ? "+" : "−") + fmtMoney(Math.abs(adjCur.amount), sym)) : null}
              regColor={adjReg.amount < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
              curColor={adjCur != null && adjCur.amount < 0 ? "text-emerald-600 dark:text-emerald-400" : adjCur != null ? "text-amber-600 dark:text-amber-400" : undefined}
            />
          )}

          {/* Subtotal antes de impuestos */}
          <TotalsRow
            separator
            label="Subtotal sin impuestos"
            reg={fmtMoney(regBeforeTax, sym)}
            cur={curBeforeTax != null ? fmtMoney(curBeforeTax, sym) : null}
          />

          {/* Impuestos individuales */}
          {taxRowsReg.map((t, idx) => (
            <TotalsRow
              key={t.id}
              label={`${t.name} (${t.calculationType === "PERCENTAGE" ? `${n(t.rate)}%` : "fijo"}, ref.)`}
              reg={`+${fmtMoney(t.amt, sym)}`}
              cur={taxRowsCur ? `+${fmtMoney(taxRowsCur[idx]?.amt ?? 0, sym)}` : null}
              regColor="text-muted"
              curColor="text-muted"
            />
          ))}

          {/* Total final */}
          <TotalsRow
            bold
            label="Total (con impuestos)"
            reg={fmtMoney(totalReg, sym)}
            cur={totalCur != null ? fmtMoney(totalCur, sym) : "—"}
          />

          {/* Diferencia */}
          {diffAbs != null && (
            <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2 border-t border-border/50 text-xs">
              <span className="text-muted">Diferencia valorización</span>
              <span className={cn(
                "tabular-nums text-right font-medium flex items-center gap-1 justify-end",
                diffAbs > 0 ? "text-amber-600 dark:text-amber-400" : diffAbs < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted",
              )}>
                {diffAbs > 0 ? <TrendingUp size={11} /> : diffAbs < 0 ? <TrendingDown size={11} /> : null}
                {diffAbs >= 0 ? `+${fmtMoney(diffAbs, sym)}` : `−${fmtMoney(Math.abs(diffAbs), sym)}`}
                {diffPct != null && (
                  <span className="text-[10px] opacity-80">({fmtPct(diffPct)})</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Desglose Metal / Hechura ───────────────────────────────────── */}
      {breakdown && (breakdown.metal.items.length > 0 || breakdown.hechura.total > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Desglose Metal / Hechura</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          <MetalHechuraBreakdown
            breakdown={breakdown}
            sym={sym}
            costLines={costLines}
            compositions={compositions}
          />
        </div>
      )}

      {/* ── Trazabilidad ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-surface2/30 px-4 py-3">
        <div className="flex items-start gap-2">
          <Info size={13} className="text-muted shrink-0 mt-0.5" />
          <div className="space-y-1 text-[11px] text-muted">
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {baseCurrency && (
                <span>
                  <span className="font-medium text-text/70">Moneda base:</span>{" "}
                  {baseCurrency.symbol} ({baseCurrency.code})
                </span>
              )}
              <span>
                <span className="font-medium text-text/70">Fuente valorización:</span>{" "}
                {hasCostLines
                  ? "Cotización actual de metal (MetalQuote) por línea"
                  : "Cotización actual del sistema"}
              </span>
              {isPartial && (
                <span className="text-amber-600 dark:text-amber-400">
                  ⚠ Valorización parcial — faltan cotizaciones para algunas líneas
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted/70 italic">
              El costo valorizado actual es comparativo e informativo. No sobrescribe el costo registrado del artículo.
            </p>
          </div>
        </div>
      </div>

      {/* ── CTA Simulador ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate(`/herramientas/simulador-precios?articleId=${article.id}`)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-xs text-muted hover:text-text transition-colors"
      >
        <FlaskConical size={13} className="shrink-0" />
        <span>Abrir en Simulador de Precios para hacer proyecciones what-if</span>
      </button>

      {/* ── Desglose paso a paso ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header expandible */}
        <button
          type="button"
          onClick={() => setBreakdownOpen(o => !o)}
          className="w-full flex items-center gap-2 px-4 py-3 text-xs font-medium text-text hover:bg-surface2/30 transition-colors"
        >
          {breakdownOpen
            ? <ChevronDown size={13} className="text-muted shrink-0" />
            : <ChevronRight size={13} className="text-muted shrink-0" />
          }
          <Calculator size={12} className="text-muted shrink-0" />
          <span>Desglose del cálculo (paso a paso)</span>
          {pricingLoading && <Loader2 size={11} className="animate-spin text-muted ml-auto" />}
          {!pricingLoading && pricing && (
            <span className="ml-auto text-muted font-normal">
              {pricing.unitPrice != null
                ? `Precio: ${fmtMoney(parseFloat(pricing.unitPrice), sym)}`
                : "Sin precio"}
              {pricing.unitCost != null
                ? ` · Costo: ${fmtMoney(parseFloat(pricing.unitCost), sym)}`
                : ""}
            </span>
          )}
        </button>

        {/* Contenido */}
        {breakdownOpen && (
          <div className="border-t border-border">
            {pricingLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted">
                <Loader2 size={13} className="animate-spin" />
                Calculando...
              </div>
            ) : pricingError ? (
              <div className="flex items-center gap-2 px-4 py-4 text-xs text-red-500">
                <AlertCircle size={13} />
                {pricingError}
              </div>
            ) : pricing ? (
              <>
                <AlertsBlock alerts={pricing.alerts ?? []} />
                <PricingBreakdown data={pricing} sym={sym} />
              </>
            ) : null}
          </div>
        )}
      </div>

    </div>
  );
}
