// src/pages/PricingSimulator.tsx
// Simulador de precios — valida el motor de cálculo sin crear artículos
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FlaskConical,
  Loader2,
  Minus,
  Package,
  RotateCcw,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "../components/ui/tp";
import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPCard } from "../components/ui/TPCard";
import { CostSummaryCard } from "../components/ui/CostSummaryCard";
import { CostBreakdown as CostBreakdownPanel } from "../components/ui/CostBreakdown";
import type { CostBreakdownRow } from "../components/ui/CostBreakdown";
import { TPField } from "../components/ui/TPField";
import TPNumberInput from "../components/ui/TPNumberInput";
import { TPButton } from "../components/ui/TPButton";
import TPSelect from "../components/ui/TPSelect";
import TPComboFixed from "../components/ui/TPComboFixed";
import {
  articlesApi,
  fmtMoney,
  COST_MODE_LABELS,
} from "../services/articles";
import ArticleSearchSelect from "../components/ui/ArticleSearchSelect";
import EntitySearchSelect from "../components/ui/EntitySearchSelect";
import type {
  ArticleRow,
  ArticleDetail,
  ArticleVariant,
  PricingPreviewResult,
  PricingStepResult,
  PricingAlert,
  CheckoutResult,
} from "../services/articles";
import type { EntityRow } from "../services/commercial-entities";
import { paymentsApi } from "../services/payments";
import type { PaymentMethodRow } from "../services/payments";
import { quantityDiscountsApi } from "../services/quantity-discounts";
import type { QuantityDiscountRow } from "../services/quantity-discounts";
import { sellersApi } from "../services/sellers";
import type { SellerRow } from "../services/sellers";
import { priceListsApi } from "../services/price-lists";
import type { PriceListRow } from "../services/price-lists";
import { listCurrencies } from "../services/valuation";
import type { CurrencyRow } from "../services/valuation";
import type { TaxBreakdownItem } from "../services/articles";

type AppliedTax = { name: string; rate: number; amount: number };

// ---------------------------------------------------------------------------
// Helpers de visualización (mismos que CostosTab)
// ---------------------------------------------------------------------------

// Labels más claros para pasos de costo (reemplaza los técnicos del backend)
const COST_LABEL_MAP: Record<string, string> = {
  MANUAL_BASE_COST:      "Hechura",             // legacy MANUAL → hechura fija
  MANUAL_CURRENCY:       "Origen en moneda extranjera",
  MULTIPLIER_CURRENCY:   "Origen en moneda extranjera",
  COST_LINES_METAL:      "Metal",
  COST_LINES_HECHURA:    "Hechura",
  METAL_QUOTE:           "Metal",
  HECHURA:               "Hechura",
  MULTIPLIER:            "Hechura",             // legacy MULTIPLIER → hechura por unidad
  UNKNOWN_MODE:          "Costo",
};

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

const PRICE_STEP_KEYS = new Set([
  "VARIANT_OVERRIDE", "PRICE_LIST", "ROUNDING", "MANUAL_OVERRIDE", "MANUAL_FALLBACK",
  "BASE_PRICE", "QUANTITY_DISCOUNT", "PROMOTION", "ENTITY_COMMERCIAL_RULE", "MARGIN", "PRECIO_FINAL",
]);

const DISCOUNT_APPLY_ON_LABELS: Record<string, string> = {
  TOTAL:         "",          // TOTAL es el comportamiento normal, no hace falta aclarar
  METAL:         " (metal)",
  HECHURA:       " (hechura)",
  METAL_Y_HECHURA: " (metal+hechura)",
};

const TAX_APPLY_ON_LABELS: Record<string, string> = {
  TOTAL:                    "sobre precio final",
  SUBTOTAL_AFTER_DISCOUNT:  "sobre precio c/descuento",
  SUBTOTAL_BEFORE_DISCOUNT: "sobre precio s/descuento",
  METAL:                    "sobre metal",
  HECHURA:                  "sobre hechura",
  METAL_Y_HECHURA:          "sobre metal + hechura",
};

const ROUNDING_MODE_LABELS: Record<string, string> = {
  INTEGER:   "al entero",
  DECIMAL_1: "a 1 decimal",
  DECIMAL_2: "a 2 decimales",
  TEN:       "a la decena",
  HUNDRED:   "a la centena",
};
const ROUNDING_DIR_SYMBOLS: Record<string, string> = {
  UP:      "↑",
  DOWN:    "↓",
  NEAREST: "↕",
};

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
      if (m.price) return `Fijo: $${m.price}`;
      return null;
    case "MANUAL_CURRENCY":
    case "MULTIPLIER_CURRENCY": {
      const ccode = String(m.currencyCode ?? m.fromCurrencyId ?? "");
      if (m.originalAmount != null && m.rate != null && ccode)
        return `${ccode} ${parseFloat(String(m.originalAmount)).toFixed(2)} × ${parseFloat(String(m.rate)).toFixed(4)}`;
      return null;
    }
    case "MULTIPLIER":
      if (m.qty && m.value) return `${m.qty} × $${m.value}`;
      return null;
    case "MANUAL_BASE_COST":
      if (m.adjustmentKind && m.adjustmentKind !== "") {
        const tipo = m.adjustmentKind === "BONUS" ? "bonificación" : "recargo";
        return `$${m.manualBaseCost} con ${tipo} aplicado`;
      }
      return `$${m.manualBaseCost}`;
    case "PRICE_LIST":
      if (m.mode && m.source)
        return `Modo ${m.mode} · Fuente: ${String(m.source).toLowerCase()}`;
      return null;
    case "ROUNDING": {
      const dirSym  = ROUNDING_DIR_SYMBOLS[String(m.direction ?? "")] ?? "";
      const modeLbl = ROUNDING_MODE_LABELS[String(m.mode      ?? "")] ?? String(m.mode ?? "");
      return `${dirSym} ${modeLbl}`.trim() || null;
    }
    case "QUANTITY_DISCOUNT": {
      const SCOPE_DESC: Record<string, string> = { CATEGORY: "cat.", BRAND: "marca", GROUP: "grupo", GENERAL: "general" };
      const scopeSuffix = m.scopeType && m.scopeType !== "ARTICLE" && m.scopeType !== "VARIANT"
        ? ` · ${SCOPE_DESC[String(m.scopeType)] ?? String(m.scopeType).toLowerCase()}${m.scopeLabel ? `: ${m.scopeLabel}` : ""}` : "";
      if (m.type && m.discountAmount != null) {
        const discAmt   = parseFloat(String(m.discountAmount));
        const qty       = m.evaluationMode && m.evaluationMode !== "LINE" && m.effectiveQty
          ? ` · total ${m.effectiveQty} u.` : m.quantity ? ` · cant. ${m.quantity}` : "";
        const baseApply = String(m.applyOn ?? "TOTAL");
        const baseLabel = DISCOUNT_APPLY_ON_LABELS[baseApply] ?? "";
        const applyLbl  = m.discountBaseEstimated && baseLabel
          ? baseLabel.replace(")", " estimado)")
          : baseLabel;
        if (m.type === "PERCENTAGE" && m.discountBase != null)
          return `$${parseFloat(String(m.discountBase)).toFixed(2)}${applyLbl} × ${m.value}%${scopeSuffix} = −$${discAmt.toFixed(2)}${qty}`;
        return `−$${discAmt.toFixed(2)}${applyLbl}${scopeSuffix}${qty}`;
      }
      if (m.type && m.value && m.quantity)
        return `${m.type === "PERCENTAGE" ? `${m.value}%` : `$${m.value}`}${scopeSuffix} · cant. ${m.quantity}`;
      return null;
    }
    case "PROMOTION": {
      if (m.type && m.discountAmount != null) {
        const discAmt   = parseFloat(String(m.discountAmount));
        const scope     = m.scope ? ` · ${String(m.scope).toLowerCase()}` : "";
        const baseApply = String(m.applyOn ?? "TOTAL");
        const baseLabel = DISCOUNT_APPLY_ON_LABELS[baseApply] ?? "";
        const applyLbl  = m.discountBaseEstimated && baseLabel
          ? baseLabel.replace(")", " estimado)")
          : baseLabel;
        if (m.type === "PERCENTAGE" && m.discountBase != null)
          return `$${parseFloat(String(m.discountBase)).toFixed(2)}${applyLbl} × ${m.value}% = −$${discAmt.toFixed(2)}${scope}`;
        return `−$${discAmt.toFixed(2)}${applyLbl}${scope}`;
      }
      if (m.type && m.value)
        return `${m.type === "PERCENTAGE" ? `${m.value}%` : `$${m.value}`} · ámbito ${m.scope ?? ""}`;
      return null;
    }
    case "ENTITY_COMMERCIAL_RULE": {
      const ruleType  = String(m.ruleType  ?? "");
      const valueType = String(m.valueType ?? "");
      const applyOn   = String(m.applyOn   ?? "TOTAL");
      const baseLabel = DISCOUNT_APPLY_ON_LABELS[applyOn] ?? "";
      if (ruleType === "DISCOUNT" || ruleType === "BONUS") {
        const discAmt  = parseFloat(String(m.discountAmount ?? 0));
        const applyLbl = m.discountBaseEstimated && baseLabel
          ? baseLabel.replace(")", " estimado)") : baseLabel;
        if (valueType === "PERCENTAGE" && m.discountBase != null)
          return `$${parseFloat(String(m.discountBase)).toFixed(2)}${applyLbl} × ${m.value}% = −$${discAmt.toFixed(2)}`;
        return `−$${discAmt.toFixed(2)}${applyLbl}`;
      }
      if (ruleType === "SURCHARGE") {
        const surAmt   = parseFloat(String(m.surchargeAmount ?? 0));
        const applyLbl = m.surchargeBaseEstimated && baseLabel
          ? baseLabel.replace(")", " estimado)") : baseLabel;
        if (valueType === "PERCENTAGE" && m.surchargeBase != null)
          return `$${parseFloat(String(m.surchargeBase)).toFixed(2)}${applyLbl} × ${m.value}% = +$${surAmt.toFixed(2)}`;
        return `+$${surAmt.toFixed(2)}${applyLbl}`;
      }
      return null;
    }
    case "MARGIN":
      return "(precio − costo) / precio";
    default:
      // COST_LINES_* con conversión de moneda embebida en meta
      if (step.key.startsWith("COST_LINES_") && m.originalAmount != null && m.rate) {
        const orig = parseFloat(String(m.originalAmount));
        const rate = parseFloat(String(m.rate));
        const cid  = String(m.currencyCode ?? m.fromCurrencyId ?? "");
        if (cid) return `${cid} ${orig.toFixed(2)} × ${rate.toFixed(4)}`;
      }
      return null;
  }
}

function StepStatusIcon({ status }: { status: PricingStepResult["status"] }) {
  if (status === "ok")      return <Check      size={11} className="text-emerald-500 shrink-0 mt-0.5" />;
  if (status === "partial") return <AlertCircle size={11} className="text-amber-500  shrink-0 mt-0.5" />;
  if (status === "missing") return <X           size={11} className="text-red-500    shrink-0 mt-0.5" />;
  return <Minus size={11} className="text-muted shrink-0 mt-0.5" />;
}

function StepRow({ step, sym, superseded, rate = 1, dsym }: { step: PricingStepResult; sym: string; superseded?: boolean; rate?: number; dsym?: string }) {
  const _sym = dsym ?? sym;
  const formula = stepFormula(step);
  const msg     = step.status !== "ok" && step.status !== "partial" ? step.message : null;
  const valueOk = step.value != null;

  // Valor del beneficio que perdió la competencia (meta.competing + meta.competingResult)
  const competingVal =
    step.status === "skipped" &&
    (step.meta?.competing as boolean) &&
    step.meta?.competingResult != null
      ? parseFloat(String(step.meta.competingResult))
      : null;

  return (
    <div className={cn(
      "grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2 text-xs transition-colors",
      step.status === "missing" && "opacity-60",
      step.status === "skipped" && competingVal == null && "opacity-35",
      superseded && "opacity-50",
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
          <div className="text-[10px] text-muted/55 mt-0.5 font-mono tracking-tight">{formula ?? msg}</div>
        )}
      </div>
      <div className={cn(
        "tabular-nums font-bold text-right self-start",
        competingVal != null   ? "line-through text-muted/50"
        : superseded           ? "line-through text-muted/50"
        : !valueOk             ? "text-muted/50 text-[10px]"
        : step.key === "MARGIN"? "text-primary"
        :                        "text-text",
        step.status === "missing" ? "text-muted/50" : "",
      )}>
        {competingVal != null
          ? fmtMoney(competingVal / rate, _sym)
          : valueOk
            ? step.key === "MARGIN"
              ? `${parseFloat(step.value!).toFixed(1)}%`
              : fmtMoney(parseFloat(step.value!) / rate, _sym)
            : "—"
        }
      </div>
    </div>
  );
}

function CostStepRow({ step, sym, labelOverride, rate, dsym }: { step: PricingStepResult; sym: string; labelOverride?: string; rate?: number; dsym?: string }) {
  const label = labelOverride !== undefined ? labelOverride : (COST_LABEL_MAP[step.key] ?? step.label);
  return (
    <StepRow
      step={{ ...step, label }}
      sym={sym}
      rate={rate}
      dsym={dsym}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-muted/10 border-y border-border/50 mt-1 first:mt-0 first:border-t-0">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted shrink-0">{children}</span>
    </div>
  );
}

function TotalRow({ label, value, sym, highlight = false, rate = 1, dsym }: {
  label: string; value: string | null; sym: string; highlight?: boolean; rate?: number; dsym?: string;
}) {
  const _sym = dsym ?? sym;
  return (
    <div className={cn(
      "grid grid-cols-[1fr_auto] gap-x-4 px-4 text-xs",
      highlight
        ? "py-3 border-t-2 border-primary/40 bg-primary/5"
        : "py-2 border-t border-border/40",
    )}>
      <span className={cn(
        "font-semibold",
        highlight ? "text-text text-[13px]" : "text-muted",
      )}>{label}</span>
      <span className={cn(
        "tabular-nums font-bold text-right",
        highlight ? "text-primary text-base" : "text-text",
      )}>
        {value != null ? fmtMoney(parseFloat(value) / rate, _sym) : "—"}
      </span>
    </div>
  );
}

function PricingBreakdown({
  data,
  sym,
  appliedTaxes,
  totalFinal,
  costBreakdown,
  costComposition,
  compositions,
  displayRate,
  displaySym,
  clientCtx,
}: {
  data: PricingPreviewResult;
  sym: string;
  appliedTaxes: AppliedTax[];
  totalFinal: number | null;
  costBreakdown?: CostBreakdown | null;
  costComposition?: Array<{
    type: string;
    label?: string;
    metalVariant?: { name: string; metal?: { name: string } | null } | null;
  }> | null;
  compositions?: Array<{
    metalVariant?: { name: string; metal?: { name: string } | null } | null;
  }> | null;
  displayRate?: number;
  displaySym?: string;
  clientCtx?: "CONSUMER" | "BUSINESS" | "EXEMPT";
}) {
  const dispRate = displayRate ?? 1;
  const dsym = displaySym ?? sym;
  function fm(v: number) { return fmtMoney(v / dispRate, dsym); }
  const costSteps  = data.steps.filter(s => isCostStep(s.key));
  const priceSteps = data.steps.filter(s => PRICE_STEP_KEYS.has(s.key));
  const hasTaxes   = appliedTaxes.length > 0;

  // Ganancia y margen para el bloque RESULTADO
  const gain   = data.unitCost != null && data.unitPrice != null
    ? parseFloat(data.unitPrice) - parseFloat(data.unitCost) : null;
  const mPct   = data.marginPercent != null ? parseFloat(data.marginPercent) : null;
  const mColor = mPct == null ? "text-text"
    : mPct >= 0  ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";
  const mBg = mPct == null ? ""
    : mPct >= 0  ? "bg-emerald-500/5 border-emerald-500/20"
    : "bg-red-500/5 border-red-500/20";

  const [costOpen,  setCostOpen]  = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);

  // Separar pasos de precio base de ajustes comerciales
  const ADJ_KEYS = new Set(["PROMOTION", "QUANTITY_DISCOUNT", "ENTITY_COMMERCIAL_RULE"]);
  // basePriceSteps: todo excepto PRECIO_FINAL y los ajustes comerciales
  // Incluye: VARIANT_OVERRIDE, PRICE_LIST, ROUNDING, MANUAL_OVERRIDE, MANUAL_FALLBACK, MARGIN
  const basePriceSteps = priceSteps.filter(s => s.key !== "PRECIO_FINAL" && !ADJ_KEYS.has(s.key));
  const adjPriceSteps  = priceSteps.filter(s => ADJ_KEYS.has(s.key));
  const hasAdjBlock    = adjPriceSteps.some(s =>
    (s.status === "ok" && s.value) || (s.status === "skipped" && (s.meta?.competing as boolean))
  );

  // Grupo visual para COST_LINES según tipo
  function costLineGroup(key: string): string | null {
    if (key === "COST_LINES_METAL") return "Materiales";
    if (key === "COST_LINES_HECHURA") return "Fabricación";
    if (key === "COST_LINES_PRODUCT") return "Productos";
    if (key === "COST_LINES_SERVICE") return "Servicios";
    if (key.startsWith("COST_LINES_") &&
        key !== "COST_LINES_FINAL" &&
        key !== "COST_LINES_BASE_CURRENCY" &&
        key !== "COST_LINES_FALLBACK") return "Otros";
    return null;
  }

  // Sub-fila de merma para METAL_QUOTE y COST_LINES_METAL
  function MermaSubRow({ step }: { step: PricingStepResult }) {
    const m = step.meta ?? {};
    const merma = Number(m.merma);
    if (!merma || !step.value) return null;
    const grams    = step.key === "METAL_QUOTE"
      ? parseFloat(String(m.grams   ?? 0))
      : parseFloat(String(m.qty     ?? 0));
    const price    = step.key === "METAL_QUOTE"
      ? parseFloat(String(m.price   ?? 0))
      : parseFloat(String(m.quotePrice ?? 0));
    const baseCost  = grams * price;
    const mermaCost = parseFloat(step.value) - baseCost;
    if (mermaCost < 0.001) return null;
    return (
      <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-3 pb-1.5 text-[10px] opacity-60">
        <span />
        <span className="text-muted font-mono">
          sin merma: {fm(baseCost)} · merma {merma}%: +{fm(mermaCost)}
        </span>
        <span />
      </div>
    );
  }

  // Renderizado enriquecido de pasos de costo
  function renderCostSteps() {
    const rows: React.ReactNode[] = [];
    const skipIndices = new Set<number>();
    let lastGroup: string | null = null;
    let groupRunningTotal = 0;

    // Listas para correlación posicional de variantes de metal
    const metalCostLines = (costComposition ?? []).filter(c => c.type === "METAL");
    const compositionList = compositions ?? [];
    let metalLineIdx = 0;
    let quoteIdx = 0;

    function metalVariantLabel(v: { name: string; metal?: { name: string } | null } | null | undefined): string | undefined {
      if (!v) return undefined;
      return v.metal?.name ? `${v.metal.name} · ${v.name}` : v.name;
    }

    // Emite una fila de subtotal para el grupo que acaba de cerrarse
    function flushGroupSubtotal(prevGroup: string | null, key: string) {
      if (prevGroup !== null && groupRunningTotal > 0.001) {
        rows.push(
          <div key={`sub-${key}`} className="grid grid-cols-[1fr_auto] gap-x-3 px-5 py-1 text-[10px] border-t border-border/20">
            <span className="text-muted">Subtotal {prevGroup.toLowerCase()}</span>
            <span className="tabular-nums text-muted text-right">{fm(groupRunningTotal)}</span>
          </div>
        );
      }
      groupRunningTotal = 0;
    }

    costSteps.forEach((step, i) => {
      if (skipIndices.has(i)) return;

      const nextStep = costSteps[i + 1];

      // ── Bloque de origen en moneda extranjera (MANUAL_CURRENCY / MULTIPLIER_CURRENCY) ──
      if ((step.key === "MANUAL_CURRENCY" || step.key === "MULTIPLIER_CURRENCY") && step.status === "ok") {
        const m    = step.meta ?? {};
        const orig = parseFloat(String(m.originalAmount ?? 0));
        const rate = parseFloat(String(m.rate ?? 0));
        const cid  = String(m.currencyCode ?? m.fromCurrencyId ?? "");
        const conv = step.value ? parseFloat(step.value) : null;

        // MULTIPLIER: recuperar qty/value del siguiente paso MULTIPLIER
        let originLine = `${cid} ${orig.toFixed(2)}`;
        if (step.key === "MULTIPLIER_CURRENCY" && nextStep?.key === "MULTIPLIER" && nextStep.status === "ok") {
          const nm  = nextStep.meta ?? {};
          const qty = nm.qty   ? parseFloat(String(nm.qty))   : null;
          const val = nm.value ? parseFloat(String(nm.value)) : null;
          if (qty != null && val != null) {
            originLine = `${qty} × ${cid} ${val.toFixed(2)} = ${cid} ${orig.toFixed(2)}`;
          }
          skipIndices.add(i + 1);
        }

        // Detectar ajuste del paso subsiguiente
        let adjustedFinal: number | null = null;
        let adjLabel = "";
        const adjSource = step.key === "MANUAL_CURRENCY"    ? nextStep?.key === "MANUAL_BASE_COST"  ? nextStep : null
                        : step.key === "MULTIPLIER_CURRENCY" ? nextStep?.key === "MULTIPLIER"        ? nextStep : null
                        : null;
        if (adjSource?.status === "ok" && adjSource.value && conv != null) {
          const fv = parseFloat(adjSource.value);
          if (Math.abs(fv - conv) > 0.001) {
            adjustedFinal = fv;
            const ak = String(adjSource.meta?.adjustmentKind ?? "");
            adjLabel = ak === "BONUS" ? "Bonificación" : ak === "SURCHARGE" ? "Recargo" : "Ajuste";
          }
        }
        if (step.key === "MANUAL_CURRENCY" && nextStep?.key === "MANUAL_BASE_COST") {
          skipIndices.add(i + 1);
        }

        const adjAmount = adjustedFinal != null && conv != null ? adjustedFinal - conv : null;

        rows.push(
          <React.Fragment key={i}>
            {/* Bloque de origen */}
            <div className="px-3 pt-2 pb-1.5 text-xs border-t border-border/20">
              <div className="text-[10px] font-semibold text-text uppercase tracking-wide mb-1">
                Origen · {cid}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-3 font-mono text-[11px]">
                <span className="text-text">{originLine}</span>
                <span className="tabular-nums text-muted text-right">{cid} {orig.toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-muted/70 font-mono mt-0.5">
                Tasa: 1 {cid} = {sym}{rate.toFixed(4)}
              </div>
            </div>
            {/* Valor convertido */}
            {conv != null && (
              <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-3 py-1.5 text-xs border-t border-border/20">
                <Check size={11} className="text-text shrink-0 mt-0.5" />
                <span className="font-medium text-text">Convertido</span>
                <span className="tabular-nums font-bold text-right text-text">{fm(conv)}</span>
              </div>
            )}
            {/* Ajuste sobre valor convertido (si aplica) */}
            {adjAmount != null && (
              <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-3 py-1 text-xs">
                <span />
                <span className="font-medium text-text">{adjLabel || "Ajuste"}</span>
                <span className="tabular-nums font-bold text-right text-text">
                  {adjAmount > 0 ? "+" : ""}{fm(adjAmount)}
                </span>
              </div>
            )}
          </React.Fragment>
        );
        return;
      }

      // ── MANUAL_BASE_COST sin conversión → desglose de ajuste ──
      if (step.key === "MANUAL_BASE_COST" && costBreakdown && step.status === "ok") {
        rows.push(
          <React.Fragment key={i}>
            <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-3 py-1.5 text-xs">
              <Check size={11} className="text-text shrink-0 mt-0.5" />
              <span className="font-medium text-text">Costo base</span>
              <span className="tabular-nums font-bold text-right text-text">
                {fm(costBreakdown.baseCost)}
              </span>
            </div>
            <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-3 py-1 text-xs">
              <span />
              <span className="font-medium text-text">
                {costBreakdown.kind === "BONUS" ? "Bonificación" : "Recargo"}
                {costBreakdown.adjPercent != null && (
                  ` (${costBreakdown.kind === "BONUS" ? "-" : "+"}${costBreakdown.adjPercent}%)`
                )}
              </span>
              <span className="tabular-nums font-bold text-right text-text">
                {costBreakdown.kind === "BONUS" ? "-" : "+"}
                {fm(Math.abs(costBreakdown.adjAmount))}
              </span>
            </div>
          </React.Fragment>
        );
        return;
      }

      // ── METAL_MERMA_HECHURA_TOTAL → desglose completo (metal / merma / hechura) ──
      if (step.key === "METAL_MERMA_HECHURA_TOTAL") {
        const m          = step.meta ?? {};
        const metalTotal = m.metalCost != null ? parseFloat(String(m.metalCost)) : null;
        const hechura    = m.hechura   != null ? parseFloat(String(m.hechura))   : null;

        // Calcular metal sin merma y merma total desde los pasos METAL_QUOTE individuales
        const metalQuoteSteps = costSteps.filter(s => s.key === "METAL_QUOTE" && s.status === "ok" && s.value);
        const totalMetalSinMerma = metalQuoteSteps.reduce((acc, s) => {
          const grams = parseFloat(String(s.meta?.grams ?? 0));
          const price = parseFloat(String(s.meta?.price ?? 0));
          return acc + grams * price;
        }, 0);
        const totalMermaImpact = metalTotal != null ? metalTotal - totalMetalSinMerma : 0;

        rows.push(
          <React.Fragment key={i}>
            {/* Desglose: metal sin merma + merma + fabricación */}
            {metalQuoteSteps.length > 0 && (
              <>
                {totalMetalSinMerma > 0.001 && (
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 px-5 py-0.5 text-[10px] text-muted">
                    <span>Metal (sin merma)</span>
                    <span className="tabular-nums text-right">{fm(totalMetalSinMerma)}</span>
                  </div>
                )}
                {totalMermaImpact > 0.001 && (
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 px-5 py-0.5 text-[10px] text-muted">
                    <span>Merma (impacto)</span>
                    <span className="tabular-nums text-right text-text">+{fm(totalMermaImpact)}</span>
                  </div>
                )}
                {(totalMetalSinMerma > 0.001 || totalMermaImpact > 0.001) && metalTotal != null && (
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 px-5 py-0.5 text-[10px] text-muted border-t border-border/20">
                    <span>Total metal</span>
                    <span className="tabular-nums text-right">{fm(metalTotal)}</span>
                  </div>
                )}
              </>
            )}
            {hechura != null && hechura > 0.001 && (
              <div className="grid grid-cols-[1fr_auto] gap-x-3 px-5 py-0.5 text-[10px] text-muted">
                <span>Fabricación</span>
                <span className="tabular-nums text-right">{fm(hechura)}</span>
              </div>
            )}
            <CostStepRow step={step} sym={sym} rate={dispRate} dsym={dsym} />
          </React.Fragment>
        );
        return;
      }

      // ── Cabecera y subtotal para grupos COST_LINES ──
      const group = costLineGroup(step.key);
      if (group !== null && group !== lastGroup) {
        flushGroupSubtotal(lastGroup, `pre-${i}`);
        rows.push(
          <div key={`gh-${i}`} className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-muted/70 uppercase tracking-wide">
            {group}
          </div>
        );
        lastGroup = group;
      } else if (group === null && lastGroup !== null) {
        flushGroupSubtotal(lastGroup, `close-${i}`);
        lastGroup = null;
      }

      // Acumular total del grupo
      if (group !== null && step.status === "ok" && step.value) {
        groupRunningTotal += parseFloat(step.value);
      }

      // ── Label override para identificación real de cada línea ──
      let labelOverride: string | undefined;
      if (step.key === "COST_LINES_METAL") {
        labelOverride = metalVariantLabel(metalCostLines[metalLineIdx++]?.metalVariant);
      } else if (step.key === "METAL_QUOTE") {
        labelOverride = metalVariantLabel(compositionList[quoteIdx++]?.metalVariant);
      } else if (step.key === "COST_LINES_HECHURA") {
        if (step.label && !step.label.startsWith("Línea de costo")) {
          labelOverride = step.label;
        }
      } else if (step.key === "COST_LINES_PRODUCT" || step.key === "COST_LINES_SERVICE") {
        const code = step.meta?.lineCode as string | null;
        const isGeneric = !step.label || step.label.startsWith("Línea de costo");
        const baseName = isGeneric
          ? (step.key === "COST_LINES_PRODUCT" ? "Producto" : "Servicio")
          : step.label;
        labelOverride = code ? `${baseName} · ${code}` : baseName;
      }

      // ── Paso normal ──
      rows.push(<CostStepRow key={i} step={step} sym={sym} labelOverride={labelOverride} rate={dispRate} dsym={dsym} />);

      // Sub-fila de merma para pasos de metal
      if ((step.key === "METAL_QUOTE" || step.key === "COST_LINES_METAL") && step.status === "ok") {
        rows.push(<MermaSubRow key={`merma-${i}`} step={step} />);
      }

      // Sub-fila de gramos finos (datos calculados en backend)
      if ((step.key === "METAL_QUOTE" || step.key === "COST_LINES_METAL") && step.status === "ok") {
        const m = step.meta ?? {};
        const gramsOriginal      = m.gramsOriginal      != null ? parseFloat(String(m.gramsOriginal))      : null;
        const purity             = m.purity             != null ? parseFloat(String(m.purity))             : null;
        const gramsFineEquivalent = m.gramsFineEquivalent != null ? parseFloat(String(m.gramsFineEquivalent)) : null;
        if (gramsOriginal != null && purity != null && gramsFineEquivalent != null) {
          const f4 = (n: number) => parseFloat(n.toFixed(4)).toString();
          rows.push(
            <div key={`purity-${i}`} className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-3 pb-1.5 text-[10px] opacity-55">
              <span />
              <span className="text-muted font-mono">
                {f4(gramsOriginal)} g × {f4(purity)} = {f4(gramsFineEquivalent)} g fino
              </span>
              <span />
            </div>
          );
        }
      }
    });

    // Flush subtotal del último grupo si quedó abierto
    flushGroupSubtotal(lastGroup, "end");

    return rows;
  }

  // Numeración dinámica de bloques
  let _bn = 0;
  const bn1 = costSteps.length > 0  ? ++_bn : 0;
  const bn2 = priceSteps.length > 0 ? ++_bn : 0;
  const bn3 = hasAdjBlock           ? ++_bn : 0;
  const showTaxBlock = hasTaxes || !!data.taxExemptByEntity;
  const bn4 = showTaxBlock           ? ++_bn : 0;
  const bn5 = priceSteps.length > 0 ? ++_bn : 0;

  return (
    <div className="flex flex-col gap-3">

      {/* ══════════════════════════════════════════════════
          CARD 1 — COSTO
      ══════════════════════════════════════════════════ */}
      {costSteps.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          {/* Header — clickeable para colapsar */}
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/10 border-b border-border/40 hover:bg-muted/15 transition-colors text-left"
            onClick={() => setCostOpen(o => !o)}
          >
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-muted/25 text-[9px] font-bold text-muted shrink-0 tabular-nums">{bn1}</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted flex-1">Costo</span>
            <ChevronDown size={14} className={cn("text-muted shrink-0 transition-transform", costOpen && "rotate-180")} />
          </button>

          {costOpen && renderCostSteps()}

          {/* Subtotal: Costo base + impuestos de compra — usa CostBreakdownPanel */}
          {costOpen && (() => {
            const costBase    = data.unitCost    != null ? parseFloat(data.unitCost)    / dispRate : null;
            const costTaxAmt  = data.costTaxAmount != null ? parseFloat(data.costTaxAmount) / dispRate : null;
            const costWithTax = data.costWithTax  != null ? parseFloat(data.costWithTax)  / dispRate : null;

            // Construir filas de impuesto para CostBreakdownPanel
            const taxRows: CostBreakdownRow[] = (() => {
              if (data.costTaxBreakdown && data.costTaxBreakdown.length > 0) {
                return data.costTaxBreakdown.map(t => ({
                  kind:   "tax" as const,
                  label:  t.name,
                  detail: t.rate != null ? `${t.rate}%` : undefined,
                  amount: t.taxAmount / dispRate,
                }));
              }
              if (costTaxAmt != null && costTaxAmt > 0.005) {
                return [{ kind: "tax" as const, label: "Impuestos compra", amount: costTaxAmt }];
              }
              return [];
            })();

            return (
              <CostBreakdownPanel
                rows={taxRows}
                baseAmount={costBase}
                totalAmount={costWithTax}
                currencySymbol={dsym}
                mode={
                  data.costMode === "MANUAL" || data.costMode === "MULTIPLIER"
                    ? "COST_LINES"
                    : ((data.costMode as any) ?? "COST_LINES")
                }
                hideHeader
                className="rounded-none border-0 border-t-2 border-border/50"
              />
            );
          })()}
        </div>
      )}

      {/* Conector visual: Costo → Precio base */}
      {costSteps.length > 0 && priceSteps.length > 0 && (
        <div className="flex items-center gap-2 px-2">
          <div className="flex-1 border-t border-dashed border-border/40" />
          <div className="flex items-center gap-1 text-[10px] text-muted/45 shrink-0">
            <ArrowDown size={10} />
            <span>formación del precio</span>
          </div>
          <div className="flex-1 border-t border-dashed border-border/40" />
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          CARD 2 — PRECIO DE LISTA + AJUSTES + RESULTADO
      ══════════════════════════════════════════════════ */}
      {priceSteps.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden bg-card">

          {/* — Bloque 2: Precio de venta — */}
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/10 border-b border-border/40 hover:bg-muted/15 transition-colors text-left"
            onClick={() => setPriceOpen(o => !o)}
          >
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-sky-500/15 text-[9px] font-bold text-sky-600 dark:text-sky-400 shrink-0 tabular-nums">{bn2}</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted flex-1">Precio base</span>
            <ChevronDown size={14} className={cn("text-muted shrink-0 transition-transform", priceOpen && "rotate-180")} />
          </button>

          {priceOpen && basePriceSteps.map((step, i) => {
            // PRICE_LIST + METAL_HECHURA → expandir en Metal / Hechura / Subtotal
            if (step.key === "PRICE_LIST" && step.status === "ok" && data.metalHechuraBreakdown) {
              const mhb = data.metalHechuraBreakdown;
              const baseSumRnd = Math.round((mhb.metalSale + mhb.hechuraSale) * 100) / 100;
              return (
                <React.Fragment key={i}>
                  {mhb.metalSale > 0 && (
                    <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2.5 text-xs border-t border-border/20">
                      <ChevronRight size={11} className="text-muted shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-medium text-text">Metal</span>
                        <div className="text-[10px] text-muted/60 font-mono mt-0.5">
                          costo {fm(mhb.metalCost)} × {(1 + mhb.metalMarginPct / 100).toFixed(2)} (+{mhb.metalMarginPct}%)
                        </div>
                      </div>
                      <span className="tabular-nums font-bold text-right text-text self-start">{fm(mhb.metalSale)}</span>
                    </div>
                  )}
                  {mhb.hechuraSale > 0 && (
                    <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2.5 text-xs border-t border-border/20">
                      <ChevronRight size={11} className="text-muted shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-medium text-text">Hechura / Mano de obra</span>
                        <div className="text-[10px] text-muted/60 font-mono mt-0.5">
                          costo {fm(mhb.hechuraCost)} × {(1 + mhb.hechuraMarginPct / 100).toFixed(2)} (+{mhb.hechuraMarginPct}%)
                        </div>
                      </div>
                      <span className="tabular-nums font-bold text-right text-text self-start">{fm(mhb.hechuraSale)}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 text-xs border-t-2 border-border/40 bg-muted/5">
                    <span className="font-semibold text-text">Subtotal venta</span>
                    <span className="tabular-nums font-bold text-right text-sm text-text">{fm(baseSumRnd)}</span>
                  </div>
                </React.Fragment>
              );
            }
            // PRICE_LIST normal — ajuste implícito si hay markup
            if (step.key === "PRICE_LIST" && step.status === "ok" && step.value && data.unitCost) {
              const priceVal = parseFloat(step.value);
              const costVal  = parseFloat(data.unitCost);
              const markup   = priceVal - costVal;
              if (Math.abs(markup) > 0.001 && costVal > 0) {
                const markupPct = markup / costVal * 100;
                return (
                  <React.Fragment key={i}>
                    <StepRow step={step} sym={sym} rate={dispRate} dsym={dsym} />
                    <div className="grid grid-cols-[16px_1fr] gap-x-2 px-4 py-1">
                      <span />
                      <span className="text-[10px] text-muted/60 font-mono tracking-tight">
                        ajuste ({markup > 0 ? "+" : ""}{markupPct.toFixed(1)}% s/costo)
                      </span>
                    </div>
                  </React.Fragment>
                );
              }
            }
            // ROUNDING — movido a BLOQUE 1 (es parte de la lista de precios)
            if (step.key === "ROUNDING" && step.status === "ok" && step.value && step.meta?.preRounding != null) {
              const before  = parseFloat(String(step.meta.preRounding));
              const after   = parseFloat(step.value!);
              const diff    = after - before;
              const dirSym  = ROUNDING_DIR_SYMBOLS[String(step.meta.direction ?? "")] ?? "";
              const modeLbl = ROUNDING_MODE_LABELS[String(step.meta.mode ?? "")] ?? String(step.meta.mode ?? "");
              const hasDiff = Math.abs(diff) > 0.001;
              return (
                <div key={i} className="px-4 py-2 text-xs border-t border-border/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ChevronRight size={11} className="text-muted shrink-0" />
                      <span className="font-medium text-text">Redondeo</span>
                      {(dirSym || modeLbl) && (
                        <span className="text-[10px] text-muted/60 font-mono ml-1">{dirSym} {modeLbl}</span>
                      )}
                    </div>
                    {hasDiff && (
                      <span className="tabular-nums font-bold text-right shrink-0 text-text">
                        {diff > 0 ? "+" : ""}{fm(diff)}
                      </span>
                    )}
                  </div>
                  {hasDiff && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/25 flex items-center justify-between gap-2 pl-[19px]">
                      <span className="text-muted/55 text-[10px]">precio redondeado</span>
                      <span className="tabular-nums font-bold text-right shrink-0 text-text">{fm(after)}</span>
                    </div>
                  )}
                </div>
              );
            }

            // MARGIN — margen resultante (informativo, al final del bloque base)
            if (step.key === "MARGIN" && step.value) {
              const pct = parseFloat(step.value);
              return (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2 border-t border-border/20 bg-primary/3">
                  <span className="text-xs text-muted">Margen resultante</span>
                  <span className="tabular-nums font-bold text-sm text-right text-primary">{pct.toFixed(1)}%</span>
                </div>
              );
            }

            return <StepRow key={i} step={step} sym={sym} rate={dispRate} dsym={dsym} />;
          })}

          {/* — Bloque 3: Ajustes comerciales (condicional) — */}
          {priceOpen && hasAdjBlock && (
            <>
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500/5 border-y border-emerald-500/20">
                <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-emerald-500/15 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0 tabular-nums">{bn3}</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-500">Ajustes comerciales</span>
              </div>

              {/* Badge de acumulabilidad */}
              {(data.stackingMode === "CHAINED" || data.stackingMode === "BEST_OF_QD" || data.stackingMode === "BEST_OF_PROMO") && (
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[11px] border-b border-border/40",
                  data.stackingMode === "CHAINED"
                    ? "bg-sky-500/5 text-sky-600 dark:text-sky-400"
                    : "bg-amber-500/5 text-amber-600 dark:text-amber-400"
                )}>
                  <AlertCircle size={11} className="shrink-0" />
                  {data.stackingMode === "CHAINED" && "Ambos beneficios son acumulables — se aplicaron en cadena."}
                  {data.stackingMode === "BEST_OF_QD" && "No acumulables — ganó el descuento por cantidad (mejor precio)."}
                  {data.stackingMode === "BEST_OF_PROMO" && "No acumulables — ganó la promoción (mejor precio)."}
                </div>
              )}

              {adjPriceSteps.map((step, i) => {
                if (step.status === "skipped" && !(step.meta?.competing as boolean)) return null;

                // ENTITY_COMMERCIAL_RULE — condición propia de la entidad
                if (step.key === "ENTITY_COMMERCIAL_RULE") {
                  const ruleType   = String(step.meta?.ruleType ?? "");
                  const isDiscount = ruleType === "DISCOUNT" || ruleType === "BONUS";
                  const isSurcharge = ruleType === "SURCHARGE";
                  const amt     = step.value != null ? parseFloat(step.value) : null;
                  const formula = stepFormula(step);
                  const isEstimated = !!(step.meta?.discountBaseEstimated || step.meta?.surchargeBaseEstimated);
                  return (
                    <div key={`adj-${i}`} className={cn(
                      "grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2.5 text-xs border-t border-border/20",
                      isDiscount  && "bg-emerald-500/5",
                      isSurcharge && "bg-orange-500/5",
                    )}>
                      <StepStatusIcon status={step.status} />
                      <div className="min-w-0">
                        <span className={cn(
                          "font-medium",
                          isDiscount ? "text-red-500 dark:text-red-400" : "text-text",
                        )}>
                          {step.label}
                        </span>
                        {formula && (
                          <div className="text-[10px] text-muted/55 mt-0.5 font-mono tracking-tight">{formula}</div>
                        )}
                        {isEstimated && (
                          <div className="mt-0.5 text-[10px] text-muted/40 italic">Base estimada según composición del artículo</div>
                        )}
                      </div>
                      <div className={cn(
                        "tabular-nums font-bold text-right self-start",
                        isDiscount ? "text-red-500 dark:text-red-400" : "text-text",
                      )}>
                        {amt != null ? (isDiscount ? `−${fm(amt)}` : `+${fm(amt)}`) : "—"}
                      </div>
                    </div>
                  );
                }

                // PROMOTION / QUANTITY_DISCOUNT
                if (step.key === "PROMOTION" || step.key === "QUANTITY_DISCOUNT") {
                  const isWinner = step.status === "ok" && step.value != null;
                  const isLoser  = step.status === "skipped" && (step.meta?.competing as boolean);
                  const competingVal = isLoser && step.meta?.competingResult != null
                    ? parseFloat(String(step.meta.competingResult)) : null;
                  const finalVal = step.value != null ? parseFloat(step.value) : null;
                  const formula  = stepFormula(step);
                  return (
                    <div key={`adj-${i}`} className={cn(
                      "grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2.5 text-xs border-t border-border/20",
                      isWinner && "bg-emerald-500/5",
                      isLoser  && "opacity-50",
                    )}>
                      <StepStatusIcon status={step.status} />
                      <div className="min-w-0">
                        <span className={cn("font-medium", isWinner ? "text-red-500 dark:text-red-400" : "text-text")}>
                          {step.label}
                        </span>
                        {formula && (
                          <div className="text-[10px] text-muted/55 mt-0.5 font-mono tracking-tight">{formula}</div>
                        )}
                      </div>
                      <div className={cn(
                        "tabular-nums font-bold text-right self-start",
                        isWinner  ? "text-red-500 dark:text-red-400"
                        : isLoser ? "line-through text-muted/50"
                        :           "text-muted/50",
                      )}>
                        {competingVal != null ? fm(competingVal) : finalVal != null ? fm(finalVal) : "—"}
                      </div>
                    </div>
                  );
                }

                return <StepRow key={`adj-${i}`} step={step} sym={sym} rate={dispRate} dsym={dsym} />;
              })}
            </>
          )}

          {/* — BLOQUE 3: Impuestos (si hay impuestos o entidad exenta) — */}
          {showTaxBlock && (
            <>
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/8 border-y border-amber-500/25">
                <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-700 dark:text-amber-400 shrink-0 tabular-nums">{bn4}</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-500">Impuestos</span>
              </div>

              {data.taxExemptByEntity ? (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/5 border-b border-border/20">
                  <svg className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5Zm0 6.5a.875.875 0 1 1 0-1.75A.875.875 0 0 1 8 11Z"/>
                  </svg>
                  <span className="text-xs text-amber-700 dark:text-amber-400">Sin impuestos — cliente exento.</span>
                </div>
              ) : (
                (data.taxBreakdown ?? []).map((t, i) => {
                  const applyLblBase = TAX_APPLY_ON_LABELS[t.applyOn] ?? t.applyOn;
                  const applyLbl = t.baseEstimated ? `${applyLblBase} estimado` : applyLblBase;
                  const base  = t.base;
                  const rate  = t.rate;
                  const fixed = t.fixedAmount;
                  let formula: string | null = null;
                  if (t.calculationType === "PERCENTAGE" && rate != null) {
                    formula = `${fm(base)} × ${rate}% = +${fm(t.taxAmount)}`;
                  } else if (t.calculationType === "FIXED_AMOUNT") {
                    formula = `Monto fijo`;
                  } else if (t.calculationType === "PERCENTAGE_PLUS_FIXED" && rate != null && fixed != null) {
                    formula = `${fm(base)} × ${rate}% + ${fm(fixed)} = +${fm(t.taxAmount)}`;
                  }
                  return (
                    <div key={i} className="px-4 py-2.5 text-xs border-b border-border/20 bg-amber-500/5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="font-medium text-text">{t.name}</span>
                          <span className="ml-1.5 text-[10px] text-muted/55">({applyLbl})</span>
                        </div>
                        <span className="tabular-nums font-bold text-right shrink-0 text-text">
                          +{fm(t.taxAmount)}
                        </span>
                      </div>
                      {formula && (
                        <div className="mt-1 text-[10px] text-muted/50 font-mono tracking-tight">
                          {formula}
                        </div>
                      )}
                      {t.applyOnOverriddenByEntity && (
                        <div className="mt-0.5 text-[10px] text-muted/60 italic">
                          {t.entityOverrideSource === "INDIVIDUAL"
                            ? "Base personalizada para este impuesto"
                            : "Base personalizada por el cliente"}
                        </div>
                      )}
                      {t.baseEstimated && (
                        <div className="mt-0.5 text-[10px] text-muted/40 italic">
                          Base estimada (sin datos exactos de composición)
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* — BLOQUE RESULTADO — */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-primary/5 border-y border-primary/20">
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-primary/20 text-[9px] font-bold text-primary shrink-0 tabular-nums">{bn5}</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary/80">Total final</span>
          </div>

          {/* Resumen de subtotales (solo si hay impuestos) */}
          {hasTaxes && (
            <>
              <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 border-b border-border/25">
                <span className="text-xs text-muted">Precio neto</span>
                <span className="tabular-nums font-bold text-sm text-right text-text">
                  {data.unitPrice != null ? fm(parseFloat(data.unitPrice)) : "—"}
                </span>
              </div>
              {data.taxAmount != null && parseFloat(data.taxAmount) > 0 && (
                <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 border-b border-border/25">
                  <span className="text-xs text-muted">Impuestos de venta</span>
                  <span className="tabular-nums font-bold text-sm text-right text-text">
                    +{fm(parseFloat(data.taxAmount))}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Precio final — fila prominente */}
          {(() => {
            const isExempt  = clientCtx === "EXEMPT";
            const netPrice  = data.unitPrice != null ? parseFloat(data.unitPrice) : null;
            // Con impuestos y no exento → total es el número principal
            const heroPrice = (!isExempt && hasTaxes && totalFinal != null) ? totalFinal : netPrice;
            const heroLabel = (!isExempt && hasTaxes) ? "Total final" : "Precio neto";
            const taxTot    = hasTaxes && totalFinal != null && netPrice != null ? totalFinal - netPrice : null;
            return (
              <>
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-4 bg-primary/8 border-t-2 border-primary/30">
                  <div>
                    <span className="font-bold text-text text-sm">{heroLabel}</span>
                    {!hasTaxes && !isExempt && (
                      <div className="text-[10px] text-muted/50 mt-0.5 italic">sin impuestos de venta</div>
                    )}
                  </div>
                  <span className="tabular-nums font-extrabold text-primary text-xl text-right leading-tight">
                    {heroPrice != null ? fm(heroPrice) : "—"}
                  </span>
                </div>
                {/* Composición: neto + impuestos */}
                {!isExempt && hasTaxes && netPrice != null && taxTot != null && (
                  <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 border-t border-border/25">
                    <span className="text-xs text-muted">Neto: {fm(netPrice)}{" · "}imp.: +{fm(taxTot)}</span>
                    <span />
                  </div>
                )}
                {/* Exento: nota */}
                {isExempt && (
                  <div className="px-4 py-2 text-[11px] text-muted italic border-t border-border/25">
                    Cliente exento de impuestos
                  </div>
                )}
              </>
            );
          })()}

          {/* Ganancia y Margen */}
          {(gain != null || mPct != null) && (
            <div className={cn("grid grid-cols-2 divide-x border-t", mBg, gain != null && mPct != null ? "divide-border/30" : "")}>
              {gain != null && (
                <div className="px-4 py-3">
                  <p className="text-[10px] text-muted mb-0.5 uppercase tracking-wide font-medium">Ganancia</p>
                  <p className={cn("text-base font-extrabold tabular-nums", mColor)}>
                    {fm(gain)}
                  </p>
                  {data.unitCost != null && parseFloat(data.unitCost) > 0 && gain != null && (
                    <p className="text-[10px] text-muted/60 mt-0.5 tabular-nums">
                      {((gain / parseFloat(data.unitCost)) * 100).toFixed(1)}% s/costo
                    </p>
                  )}
                </div>
              )}
              {mPct != null && (
                <div className="px-4 py-3 flex flex-col justify-between">
                  <p className="text-[10px] text-muted mb-1.5 uppercase tracking-wide font-medium">Margen</p>
                  <div className={cn(
                    "inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-sm font-bold tabular-nums",
                    mPct >= 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  )}>
                    <TrendingUp size={12} />
                    {mPct.toFixed(1)}%
                  </div>
                  <p className="text-[10px] text-muted/60 mt-1.5">sobre precio de venta</p>
                </div>
              )}
            </div>
          )}

          {/* Alertas de datos parciales */}
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
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// CheckoutBreakdown — sección de pago
// ---------------------------------------------------------------------------

function CheckoutBreakdown({ data, sym }: { data: CheckoutResult; sym: string }) {
  const hasAdj = data.paymentAdjustment !== 0;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <SectionTitle>Pago</SectionTitle>

      {/* CHECKOUT_BASE */}
      <div className="grid grid-cols-[1fr_auto] gap-x-2 px-3 py-1.5 text-xs">
        <span className="text-muted font-medium">Subtotal</span>
        <span className="tabular-nums font-bold text-text text-right">
          {fmtMoney(data.baseAmount, sym)}
        </span>
      </div>

      {/* PAYMENT_ADJUSTMENT */}
      {hasAdj && (
        <div className="grid grid-cols-[1fr_auto] gap-x-2 px-3 py-1.5 text-xs border-t border-border/40">
          <div>
            <span className={cn("font-medium", data.paymentAdjustment > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              {data.paymentAdjustment > 0 ? "Recargo" : "Descuento"} por pago
            </span>
            {data.steps.find(s => s.code === "PAYMENT_ADJUSTMENT") && (
              <div className="text-[10px] text-muted/80 mt-0.5 font-mono">
                {data.steps.find(s => s.code === "PAYMENT_ADJUSTMENT")!.formula}
              </div>
            )}
          </div>
          <span className={cn("tabular-nums font-bold text-right self-start", data.paymentAdjustment > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
            {data.paymentAdjustment > 0 ? "+" : ""}{fmtMoney(data.paymentAdjustment, sym)}
          </span>
        </div>
      )}

      {/* CHECKOUT_FINAL */}
      <TotalRow
        label="Total con pago"
        value={String(data.finalAmount)}
        sym={sym}
        highlight
      />

      {/* INSTALLMENT_VALUE */}
      {data.installments != null && data.installmentAmount != null && (
        <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 text-xs border-t border-border/40 bg-surface2/30">
          <span className="text-muted">
            {data.installments} {data.installments === 1 ? "cuota" : "cuotas"}
          </span>
          <span className="tabular-nums font-bold text-right text-primary">
            {fmtMoney(data.installmentAmount, sym)} c/u
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CheckoutSummaryCards — versión tarjeta del resumen de pago
// ---------------------------------------------------------------------------

function CheckoutSummaryCards({ data, sym }: { data: CheckoutResult; sym: string }) {
  const items = [
    { label: "Subtotal",     value: data.baseAmount,       tone: "neutral" as const },
    { label: "Recargo",      value: data.paymentAdjustment, tone: (data.paymentAdjustment > 0 ? "down" : data.paymentAdjustment < 0 ? "up" : "neutral") as "up"|"down"|"neutral" },
    ...(data.installments != null && data.installmentAmount != null
      ? [{ label: `${data.installments} cuota${data.installments === 1 ? "" : "s"}`, value: data.installmentAmount, tone: "primary" as const }]
      : []),
    { label: "Total final",  value: data.finalAmount,       tone: "primary" as const },
  ];

  const toneColor = {
    neutral: "text-text",
    primary: "text-primary",
    up:      "text-emerald-600 dark:text-emerald-400",
    down:    "text-amber-600 dark:text-amber-400",
  };

  return (
    <div className={cn("grid grid-cols-2 gap-3", items.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
      {items.map(item => (
        <div key={item.label} className="rounded-xl border border-border bg-card px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">{item.label}</div>
          <div className={cn("text-base font-bold tabular-nums truncate", toneColor[item.tone])}>
            {fmtMoney(item.value, sym)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryGrid — resumen comercial superior
// ---------------------------------------------------------------------------

const BASE_SOURCE_LABELS: Record<string, string> = {
  PRICE_LIST_CATEGORY: "Lista de categoría",
  PRICE_LIST_GENERAL:  "Lista general",
  PRICE_LIST_CLIENT:   "Lista del cliente",
  MANUAL_OVERRIDE:     "Precio manual",
  MANUAL_FALLBACK:     "Precio manual",
  PROMOTION:           "Promoción",
  QUANTITY_DISCOUNT:   "Desc. por cantidad",
};

type CostBreakdown = {
  baseCost:   number;
  adjAmount:  number;
  adjPercent: number | null;
  kind:       "BONUS" | "SURCHARGE";
};

function SummaryGrid({
  data,
  sym,
  appliedTaxes,
  totalFinal,
  costBreakdown,
  quantity,
  simCostValue,
  simCurrencySymbol,
  simPriceListName,
  simViewMode,
  priceLists,
  displayRate,
  displaySym,
}: {
  data: PricingPreviewResult;
  sym: string;
  appliedTaxes: AppliedTax[];
  totalFinal: number | null;
  costBreakdown?: CostBreakdown | null;
  quantity?: number | null;
  simCostValue?: number | null;
  simCurrencySymbol?: string;
  simPriceListName?: string | null;
  simViewMode?: "UNIFICADO" | "DESGLOSADO";
  priceLists?: PriceListRow[];
  displayRate?: number;
  displaySym?: string;
}) {
  const hasTaxes = appliedTaxes.length > 0;
  const rate = displayRate ?? 1;
  const dsym = displaySym ?? sym;
  function fm(v: number) { return fmtMoney(v / rate, dsym); }

  const marginTone = (() => {
    if (data.marginPercent == null) return "neutral" as const;
    const m = parseFloat(data.marginPercent);
    if (m >= 20) return "up" as const;
    if (m >= 0)  return "neutral" as const;
    return "down" as const;
  })();

  const marginToneColor = {
    neutral: "text-amber-500 dark:text-amber-400",
    up:      "text-emerald-600 dark:text-emerald-400",
    down:    "text-red-500 dark:text-red-400",
  }[marginTone];

  const baseSourceLabel = data.baseSource
    ? (BASE_SOURCE_LABELS[data.baseSource] ?? null)
    : null;

  // Nombre de la lista aplicada (del meta del paso PRICE_LIST)
  const priceListStep      = data.steps.find(s => s.key === "PRICE_LIST" && s.status === "ok");
  const priceListName      = priceListStep?.meta?.priceListName as string | undefined;
  const priceListMode      = priceListStep?.meta?.mode as string | undefined;
  const priceListStepId    = priceListStep?.meta?.priceListId as string | undefined;
  // Lista real resuelta: sirve para obtener marginMetal/marginHechura/marginTotal exactos
  const resolvedPriceList  = priceLists?.find(pl => pl.id === priceListStepId) ?? null;

  const PRICE_LIST_MODE_LABELS: Record<string, string> = {
    MARGIN_TOTAL:  "Total % unificado — margen único sobre el costo total (la ganancia se genera en la hechura)",
    METAL_HECHURA: "Metal / Hechura — margen independiente para cada componente",
    COST_PER_GRAM: "Por gramo — precio calculado por gramo de material",
  };

  // Descuento/Promoción aplicada
  const hasDiscount   = data.steps.some(s => s.key === "QUANTITY_DISCOUNT" && s.status === "ok");
  const hasPromotion  = data.steps.some(s => s.key === "PROMOTION"         && s.status === "ok");

  // Desglose de costo (para modo DESGLOSADO)
  const desglosado = (() => {
    if (!data.unitCost) return null;

    // Modo METAL_MERMA_HECHURA
    const mmhStep = data.steps.find(s => s.key === "METAL_MERMA_HECHURA_TOTAL" && s.status === "ok");
    if (mmhStep?.meta) {
      const metal   = mmhStep.meta.metalCost   != null ? parseFloat(mmhStep.meta.metalCost   as string) : null;
      const hechura = mmhStep.meta.hechura      != null ? parseFloat(mmhStep.meta.hechura      as string) : null;
      const total   = parseFloat(data.unitCost);
      const otros   = metal != null && hechura != null ? total - metal - hechura : null;
      return { metal, hechura, otros };
    }

    // Modo COST_LINES
    const metalStep   = data.steps.find(s => s.key === "COST_LINES_METAL"   && s.status === "ok");
    const hechuraStep = data.steps.find(s => s.key === "COST_LINES_HECHURA" && s.status === "ok");
    if (metalStep || hechuraStep) {
      const metal   = metalStep?.value   != null ? parseFloat(metalStep.value)   : null;
      const hechura = hechuraStep?.value != null ? parseFloat(hechuraStep.value) : null;
      const total   = parseFloat(data.unitCost);
      const base    = (metal ?? 0) + (hechura ?? 0);
      const otros   = total - base > 0.001 ? total - base : null;
      return { metal, hechura, otros };
    }

    return null;
  })();

  // Total × cantidad
  const qty        = quantity && quantity > 1 ? quantity : null;
  const totalByQty = qty && data.unitPrice ? parseFloat(data.unitPrice) * qty : null;

  // Resumen de impuestos corto para el card — usa taxBreakdown del backend
  const taxSummary = hasTaxes
    ? (data.taxBreakdown ?? []).map(t => {
        if (t.calculationType === "PERCENTAGE" && t.rate != null) return `${t.name} ${t.rate}%`;
        if (t.calculationType === "FIXED_AMOUNT") return `${t.name} (fijo)`;
        if (t.rate != null) return `${t.name} ${t.rate}%+fijo`;
        return t.name;
      }).join(" · ")
    : null;

  // Totales para KPIs
  const taxesTotal = appliedTaxes.reduce((s, t) => s + t.amount, 0);
  const taxPctOfPrice = data.unitPrice && hasTaxes
    ? (taxesTotal / parseFloat(data.unitPrice) * 100)
    : null;

  // Precio final calculado (con o sin impuestos)
  const precioFinal = hasTaxes
    ? (totalFinal != null ? totalFinal : null)
    : (data.unitPrice != null ? parseFloat(data.unitPrice) : null);

  // Líneas de costo no metálicas para el bloque Moneda
  function renderMonedaLines() {
    const productSteps = data.steps.filter(
      s => s.key === "COST_LINES_PRODUCT" && s.status === "ok" && s.value != null
    );
    const serviceSteps = data.steps.filter(
      s => s.key === "COST_LINES_SERVICE" && s.status === "ok" && s.value != null
    );
    const otherSteps = desglosado?.otros != null
      ? data.steps.filter(
          s => s.key.startsWith("COST_LINES_") &&
               !["COST_LINES_METAL","COST_LINES_HECHURA","COST_LINES_PRODUCT","COST_LINES_SERVICE",
                 "COST_LINES_FINAL","COST_LINES_BASE_CURRENCY","COST_LINES_FALLBACK"].includes(s.key) &&
               s.status === "ok" && s.value != null
        )
      : [];

    function renderLine(s: PricingStepResult, key: string) {
      const nombre = s.label && !s.label.startsWith("Línea de costo")
        ? s.label : ((s.meta as any)?.lineLabel ?? s.label);
      const codigo = (s.meta as any)?.lineCode ?? null;
      return (
        <div key={key} className="flex justify-between text-[10px] text-muted tabular-nums">
          <span className="truncate mr-2">
            {nombre}
            {codigo && <span className="text-muted/60 ml-1">· {codigo}</span>}
          </span>
          <span>{fm(parseFloat(s.value!))}</span>
        </div>
      );
    }

    return (
      <>
        {/* Hechura */}
        {desglosado?.hechura != null && (
          <div className="flex justify-between text-[10px] text-muted tabular-nums">
            <span>Hechura</span><span>{fm(desglosado.hechura)}</span>
          </div>
        )}
        {/* Productos y servicios no metálicos */}
        {productSteps.map((s, i) => renderLine(s, `prod-${i}`))}
        {serviceSteps.map((s, i) => renderLine(s, `svc-${i}`))}
        {otherSteps.map((s, i) => renderLine(s, `oth-${i}`))}
        {productSteps.length === 0 && serviceSteps.length === 0 && otherSteps.length === 0 && desglosado?.otros != null && (
          <div className="flex justify-between text-[10px] text-muted tabular-nums">
            <span>Otros</span><span>{fm(desglosado.otros)}</span>
          </div>
        )}
        {/* Recargo / Bonificación */}
        {costBreakdown && (
          <div className={cn("flex justify-between text-[10px] tabular-nums", costBreakdown.kind === "BONUS" ? "text-red-500 dark:text-red-400" : "")}>
            <span>{costBreakdown.kind === "BONUS" ? "Bonificación" : "Recargo"}{costBreakdown.adjPercent != null ? ` (${costBreakdown.kind === "BONUS" ? "-" : "+"}%)` : ""}</span>
            <span>{costBreakdown.kind === "BONUS" ? "-" : "+"}{fm(Math.abs(costBreakdown.adjAmount))}</span>
          </div>
        )}
        {/* Impuestos — con fórmula compacta */}
        {(data.taxBreakdown ?? []).map((t, i) => {
          const applyLblBase = TAX_APPLY_ON_LABELS[t.applyOn] ?? t.applyOn;
          const applyLbl = t.baseEstimated ? `${applyLblBase} estimado` : applyLblBase;
          let formulaShort: string | null = null;
          if (t.calculationType === "PERCENTAGE" && t.rate != null)
            formulaShort = `${fm(t.base)} × ${t.rate}%`;
          else if (t.calculationType === "FIXED_AMOUNT")
            formulaShort = "fijo";
          else if (t.calculationType === "PERCENTAGE_PLUS_FIXED" && t.rate != null)
            formulaShort = `${fm(t.base)} × ${t.rate}% + fijo`;
          return (
            <div key={i} className="text-[10px] text-text tabular-nums">
              <div className="flex justify-between">
                <span>+ {t.name} <span className="text-muted/50 not-italic">({applyLbl})</span></span>
                <span>+{fm(t.taxAmount)}</span>
              </div>
              {formulaShort && (
                <div className="text-muted/45 font-mono tracking-tight pl-2">{formulaShort}</div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  const hasMonedaContent = desglosado?.hechura != null || desglosado?.otros != null || hasTaxes || !!costBreakdown ||
    data.steps.some(s => (s.key === "COST_LINES_PRODUCT" || s.key === "COST_LINES_SERVICE") && s.status === "ok");

  // Tipo de costo inferido de los pasos (para subtexto del card Costo)
  const costModeLabel = (() => {
    const ok = new Set(data.steps.filter(s => s.status === "ok").map(s => s.key));
    if (ok.has("METAL_MERMA_HECHURA_TOTAL") || ok.has("METAL_QUOTE")) {
      return ok.has("MANUAL_CURRENCY") || ok.has("MULTIPLIER_CURRENCY")
        ? "Metal + Hechura · Moneda extranjera"
        : "Metal + Hechura";
    }
    if (ok.has("COST_LINES_METAL") || ok.has("COST_LINES_HECHURA")) return "Líneas de costo";
    if (ok.has("MULTIPLIER")) return ok.has("MULTIPLIER_CURRENCY") ? "Multiplicador · Moneda extranjera" : "Por multiplicador";
    if (ok.has("MANUAL_BASE_COST")) return ok.has("MANUAL_CURRENCY") ? "Costo manual · Moneda extranjera" : "Costo manual";
    return "Costo simple";
  })();

  // Markup = ganancia / costo × 100
  const markupPercent = (() => {
    if (!data.unitCost || !data.unitPrice) return null;
    const cost = parseFloat(data.unitCost);
    if (cost <= 0) return null;
    return (parseFloat(data.unitPrice) - cost) / cost * 100;
  })();

  // Ganancia monetaria por unidad
  const gainAmount = data.unitCost != null && data.unitPrice != null
    ? parseFloat(data.unitPrice) - parseFloat(data.unitCost)
    : null;

  return (
    <div className="space-y-3">

      {simViewMode !== "DESGLOSADO" ? (

        /* ── VALOR UNIFICADO: 4 cards comerciales ── */
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          {/* Costo — usa CostSummaryCard; montos pre-convertidos a moneda de display */}
          <CostSummaryCard
            baseAmount={data.unitCost    != null ? parseFloat(data.unitCost)    / rate : null}
            taxAmount={data.costTaxAmount != null ? parseFloat(data.costTaxAmount) / rate : null}
            totalAmount={data.costWithTax != null ? parseFloat(data.costWithTax)  / rate : null}
            currencySymbol={dsym}
          />

          {/* Precio neto / con impuestos */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
              {hasTaxes ? "Con impuestos" : "Precio neto"}
            </p>
            <p className="text-lg font-bold tabular-nums truncate text-primary">
              {precioFinal != null ? fm(precioFinal) : "—"}
            </p>
            {hasTaxes && data.unitPrice != null && (
              <p className="text-[10px] text-muted mt-0.5 tabular-nums truncate">Neto: {fm(parseFloat(data.unitPrice))}</p>
            )}
            {!hasTaxes && (
              <p className="text-[10px] text-muted/50 mt-0.5 truncate italic">Sin impuestos</p>
            )}
            {simPriceListName ? (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 truncate font-medium">Sim: {simPriceListName}</p>
            ) : (priceListName || baseSourceLabel) ? (
              <p className="text-[10px] text-muted mt-0.5 truncate">{priceListName ?? baseSourceLabel}</p>
            ) : null}
            {(hasDiscount || hasPromotion) && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                {hasPromotion ? "Promoción aplicada" : "Desc. por cantidad"}
              </p>
            )}
            {qty != null && (
              <p className="text-[10px] text-muted mt-0.5 tabular-nums">
                {qty} u · {fm((precioFinal ?? 0) * qty)}
              </p>
            )}
          </div>

          {/* Ganancia */}
          <div className="rounded-xl border border-border bg-card px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">Ganancia</p>
            <p className={cn("text-lg font-bold tabular-nums truncate", marginToneColor)}>
              {gainAmount != null ? fm(gainAmount) : "—"}
            </p>
            {markupPercent != null && (
              <p className="text-[10px] text-muted mt-0.5 tabular-nums">
                {markupPercent.toFixed(1)}% s/costo
              </p>
            )}
          </div>

          {/* Margen */}
          {(() => {
            const mVal = data.marginPercent != null ? parseFloat(data.marginPercent) : null;
            const borderCls = mVal == null ? "border-border bg-card"
              : mVal >= 0  ? "border-emerald-500/25 bg-emerald-500/5"
              : "border-red-500/25 bg-red-500/5";
            const badgeMCls = mVal == null ? "bg-muted/20 text-muted"
              : mVal >= 0  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
            return (
              <div className={cn("rounded-xl border px-3 py-3", borderCls)}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">Margen</p>
                {mVal != null ? (
                  <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-base font-bold tabular-nums", badgeMCls)}>
                    <TrendingUp size={13} />
                    {mVal.toFixed(1)}%
                  </div>
                ) : (
                  <p className="text-lg font-bold tabular-nums truncate text-muted">—</p>
                )}
                <p className="text-[10px] text-muted mt-1">Sobre precio de venta</p>
              </div>
            );
          })()}

        </div>

      ) : (

        /* ── VALOR DESGLOSADO: precio de venta por componente ── */
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">

          {data.metalHechuraBreakdown ? (() => {
            const mhb = data.metalHechuraBreakdown!;
            // baseSum: suma de precios de venta de cada componente (antes de descuentos/recargos)
            const baseSum  = mhb.metalSale + mhb.hechuraSale;
            // netPrice: precio final tras descuentos/recargos de lista (antes de impuestos)
            const netPrice = data.unitPrice != null ? parseFloat(data.unitPrice) : null;
            // Redondear a 2 decimales antes de comparar para evitar ruido de punto flotante
            const baseSumRnd  = Math.round(baseSum  * 100) / 100;
            const netPriceRnd = netPrice != null ? Math.round(netPrice * 100) / 100 : null;
            // adjustment: diferencia entre el subtotal y el precio neto
            //   < 0 → bonificación o descuento  |  > 0 → recargo
            const adjustment    = netPriceRnd != null ? netPriceRnd - baseSumRnd : 0;
            const hasAdjustment = Math.abs(adjustment) >= 0.01;
            const adjPct        = baseSum > 0 && hasAdjustment ? (adjustment / baseSum * 100) : 0;
            const adjLabel      = adjustment < 0
              ? (hasPromotion ? "Promoción" : "Bonificación")
              : "Recargo";

            return (
              <>
                {/* ─ 1. METAL ─────────────────────────────────────────── */}
                {mhb.metalSale > 0 && (
                  <div className="px-3 py-2.5">
                    <div className="flex justify-between tabular-nums">
                      <span className="text-xs font-semibold text-text">Metal</span>
                      <span className="text-xs font-bold text-text">{fm(mhb.metalSale)}</span>
                    </div>
                    <div className="text-[10px] text-muted/60 font-mono mt-0.5">
                      costo {fm(mhb.metalCost)} × {(1 + mhb.metalMarginPct / 100).toFixed(2)} (+{mhb.metalMarginPct}%)
                    </div>
                  </div>
                )}

                {/* ─ 2. HECHURA ───────────────────────────────────────── */}
                {mhb.hechuraSale > 0 && (
                  <div className="px-3 py-2.5">
                    <div className="flex justify-between tabular-nums">
                      <span className="text-xs font-semibold text-text">Hechura / Mano de obra</span>
                      <span className="text-xs font-bold text-text">{fm(mhb.hechuraSale)}</span>
                    </div>
                    <div className="text-[10px] text-muted/60 font-mono mt-0.5">
                      costo {fm(mhb.hechuraCost)} × {(1 + mhb.hechuraMarginPct / 100).toFixed(2)} (+{mhb.hechuraMarginPct}%)
                    </div>
                  </div>
                )}

                {/* ─ 3. SUBTOTAL VENTA ────────────────────────────────── */}
                <div className="flex justify-between items-center px-3 py-2 bg-muted/5 text-xs border-t-2 border-border/40">
                  <span className="text-muted font-semibold">Subtotal venta</span>
                  <span className="tabular-nums font-bold text-text">{fm(baseSumRnd)}</span>
                </div>

                {/* ─ 4. BONIFICACIÓN / RECARGO (solo cuando aplica) ──── */}
                {hasAdjustment && (
                  <div className={cn(
                    "flex justify-between items-center px-3 py-2 text-xs",
                    adjustment < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{adjLabel}</span>
                      {Math.abs(adjPct) >= 0.01 && (
                        <span className="opacity-70 font-mono text-[10px]">
                          ({adjPct > 0 ? "+" : ""}{adjPct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums font-bold">
                      {adjustment > 0 ? "+" : "−"}{fm(Math.abs(adjustment))}
                    </span>
                  </div>
                )}

                {/* ─ 5. PRECIO NETO (solo cuando hay ajuste) ──────────── */}
                {hasAdjustment && netPriceRnd != null && (
                  <div className="flex justify-between items-center px-3 py-2 bg-muted/5 text-xs border-t border-border/40">
                    <span className="text-muted font-semibold">Precio neto</span>
                    <span className="tabular-nums font-bold text-text">{fm(netPriceRnd)}</span>
                  </div>
                )}

                {/* ─ 6. IMPUESTOS ─────────────────────────────────────── */}
                {appliedTaxes.map((t, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-1.5 text-xs">
                    <span className="text-muted">
                      {t.name}
                      <span className="opacity-60 ml-1">({t.rate}%)</span>
                    </span>
                    <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">
                      +{fm(t.amount)}
                    </span>
                  </div>
                ))}

                {/* ─ 7. TOTAL FINAL ────────────────────────────────────── */}
                <div className="px-3 py-3 bg-primary/5 border-t-2 border-primary/20">
                  <div className="flex justify-between items-center tabular-nums">
                    <span className="text-xs font-semibold text-muted">
                      {hasTaxes ? "Total con impuestos" : "Precio neto"}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {precioFinal != null ? fm(precioFinal) : "—"}
                    </span>
                  </div>
                  {qty != null && (
                    <p className="text-[10px] text-muted mt-1 tabular-nums">
                      {qty} u · {fm((precioFinal ?? 0) * qty)}
                    </p>
                  )}
                </div>
              </>
            );
          })() : (
            /* ── Otros modos (sin desglose METAL_HECHURA): mantener costos ── */
            <>
              {/* Bloque Metal */}
              {desglosado?.metal != null && desglosado.metal > 0 && (
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Metal</p>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[10px] text-muted tabular-nums">
                      <span>Metal</span>
                      <span>{fm(desglosado.metal)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bloque Moneda */}
              {hasMonedaContent && (
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Moneda</p>
                  <div className="space-y-0.5">
                    {renderMonedaLines()}
                  </div>
                </div>
              )}

              {/* Precio neto / con impuestos */}
              <div className="px-3 py-2.5 bg-primary/5">
                <div className="flex justify-between text-[10px] font-bold tabular-nums">
                  <span className="text-muted">{hasTaxes ? "Total con impuestos" : "Precio neto"}</span>
                  <span className="text-primary">{precioFinal != null ? fm(precioFinal) : "—"}</span>
                </div>
                {(hasDiscount || hasPromotion) && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {hasPromotion ? "Promoción aplicada" : "Desc. por cantidad"}
                  </p>
                )}
                {qty != null && (
                  <p className="text-[10px] text-muted mt-0.5 tabular-nums">
                    {qty} u · {fm((precioFinal ?? 0) * qty)}
                  </p>
                )}
              </div>
            </>
          )}

        </div>

      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function PricingSimulator() {
  const SYM = "$";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isFromArticles = searchParams.get("from") === "articles";
  const handleBack = () => {
    if (isFromArticles) { navigate("/articulos"); return; }
    if (window.history.length > 1) { navigate(-1); } else { navigate("/articulos"); }
  };

  // Inputs comerciales
  const [article,  setArticle]  = useState<ArticleRow | null>(null);
  const [variants, setVariants] = useState<ArticleVariant[]>([]);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number | null>(1);
  const [client,   setClient]   = useState<EntityRow | null>(null);

  // Inputs de pago
  const [paymentMethods,    setPaymentMethods]    = useState<PaymentMethodRow[]>([]);
  const [paymentMethodId,   setPaymentMethodId]   = useState<string>("");
  const [installmentsQty,   setInstallmentsQty]   = useState<number>(0);

  // Descuentos por cantidad
  const [quantityDiscounts,    setQuantityDiscounts]    = useState<QuantityDiscountRow[]>([]);
  const [selectedDiscountIds,  setSelectedDiscountIds]  = useState<string[]>([]);

  // Vendedor
  const [sellers,   setSellers]   = useState<SellerRow[]>([]);
  const [sellerId,  setSellerId]  = useState<string>("");

  // Simulación
  const [priceLists,     setPriceLists]     = useState<PriceListRow[]>([]);
  const [currencies,     setCurrencies]     = useState<CurrencyRow[]>([]);
  const [simPriceListId, setSimPriceListId] = useState<string>("");
  const [simCurrencyId,  setSimCurrencyId]  = useState<string>("");
  const [simViewMode,    setSimViewMode]    = useState<"UNIFICADO" | "DESGLOSADO">("UNIFICADO");
  const [simPanelOpen,   setSimPanelOpen]   = useState(false);

  // ── What-if interactivo ──────────────────────────────────────────────────
  const [whatIfOpen,         setWhatIfOpen]         = useState(false);
  const [whatIfCost,         setWhatIfCost]         = useState<number | null>(null);
  const [whatIfMargin,       setWhatIfMargin]       = useState<number | null>(null);
  const [whatIfPrice,        setWhatIfPrice]        = useState<number | null>(null);
  const [whatIfDiscount,     setWhatIfDiscount]     = useState<number | null>(null);
  const [whatIfDiscountType, setWhatIfDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");

  const whatIfActive = whatIfCost != null || whatIfMargin != null || whatIfPrice != null || whatIfDiscount != null;

  const isSimulating = !!(simPriceListId || simCurrencyId || simViewMode !== "UNIFICADO" || whatIfActive);

  function resetSimulation() {
    setSimPriceListId("");
    setSimCurrencyId("");
    setSimViewMode("UNIFICADO");
    setWhatIfCost(null);
    setWhatIfMargin(null);
    setWhatIfPrice(null);
    setWhatIfDiscount(null);
    setWhatIfDiscountType("PERCENT");
  }

  useEffect(() => {
    priceListsApi.list()
      .then(list => setPriceLists(list.filter(p => p.isActive && !p.deletedAt)))
      .catch(() => {});
    listCurrencies()
      .then((resp: any) => {
        const list: CurrencyRow[] = resp?.rows ?? resp ?? [];
        setCurrencies(list.filter(c => c.isActive));
      })
      .catch(() => {});
  }, []);

  // Lightbox de imagen del artículo
  const [imgLightbox, setImgLightbox] = useState(false);

  // Detalle del artículo (para leer manualTaxIds)
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);

  // Impuestos vienen del backend — no se cargan localmente

  // Resultado
  const [result,  setResult]  = useState<PricingPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Desglose de costo base + ajuste (solo modo MANUAL sin conversión de moneda)
  const costBreakdown = useMemo(() => {
    if (!result) return null;
    const baseStep = result.steps.find(s => s.key === "MANUAL_BASE_COST");
    if (!baseStep || baseStep.status !== "ok" || !baseStep.value || !baseStep.meta?.manualBaseCost) return null;
    // Si hay conversión de moneda no mostramos el desglose (los valores serían en distinta moneda)
    const hasCurrencyConversion = result.steps.some(s => s.key === "MANUAL_CURRENCY");
    if (hasCurrencyConversion) return null;

    const baseCost   = parseFloat(baseStep.meta.manualBaseCost as string);
    const finalCost  = parseFloat(baseStep.value);
    const adjAmount  = finalCost - baseCost;
    const kind       = baseStep.meta.adjustmentKind as string | undefined;

    if (!kind || kind === "" || Math.abs(adjAmount) < 0.001) return null;

    // Porcentaje del ajuste (de articleDetail si está disponible)
    let adjPercent: number | null = null;
    if (
      articleDetail?.manualAdjustmentType === "PERCENTAGE" &&
      articleDetail?.manualAdjustmentValue
    ) {
      adjPercent = parseFloat(articleDetail.manualAdjustmentValue);
    }

    return { baseCost, adjAmount, adjPercent, kind: kind as "BONUS" | "SURCHARGE" };
  }, [result, articleDetail]);

  // Impuestos: mapeados desde el breakdown que devuelve el backend
  const appliedTaxes = useMemo<AppliedTax[]>(() => {
    return (result?.taxBreakdown ?? []).map((t: TaxBreakdownItem) => ({
      name:   t.name,
      rate:   t.rate ?? 0,
      amount: t.taxAmount,
    }));
  }, [result?.taxBreakdown]);

  const totalFinal = useMemo<number | null>(() => {
    if (!result?.totalWithTax) return null;
    return parseFloat(result.totalWithTax);
  }, [result?.totalWithTax]);

  // Contexto fiscal del cliente seleccionado (determina qué precio destacar)
  const simCtx = useMemo<"CONSUMER" | "BUSINESS" | "EXEMPT">(() => {
    if (result?.taxExemptByEntity) return "EXEMPT";
    const cond = (client?.ivaCondition ?? "").toLowerCase();
    if (cond.includes("consumidor final")) return "CONSUMER";
    return "BUSINESS"; // incluye sin cliente — neto como default neutro
  }, [client, result?.taxExemptByEntity]);

  // KPI resumen superior: Precio final / Metal / Moneda
  const kpiDesglose = useMemo(() => {
    if (!result) return null;
    const hasTaxes = appliedTaxes.length > 0;
    const precio = hasTaxes
      ? (totalFinal ?? null)
      : (result.unitPrice != null ? parseFloat(result.unitPrice) : null);
    if (precio == null || precio <= 0) return null;

    // Valor de metal en precio de venta
    let metalSale = 0;
    if (result.metalHechuraBreakdown && result.metalHechuraBreakdown.metalSale > 0) {
      // Modo METAL_HECHURA: el breakdown ya trae el valor de venta del metal
      metalSale = result.metalHechuraBreakdown.metalSale;
    } else {
      // Otros modos: estimar proporcionalmente desde costo
      const mmhStep       = result.steps.find(s => s.key === "METAL_MERMA_HECHURA_TOTAL" && s.status === "ok");
      const metalStepsKpi = result.steps.filter(s => s.key === "COST_LINES_METAL" && s.status === "ok" && s.value != null);
      const metalCostRaw  = mmhStep?.meta?.metalCost != null
        ? parseFloat(mmhStep.meta.metalCost as string)
        : metalStepsKpi.reduce((acc: number, s: any) => acc + parseFloat(String(s.value ?? "0")), 0);
      const unitCost  = result.unitCost  != null ? parseFloat(result.unitCost)  : 0;
      const unitPrice = result.unitPrice != null ? parseFloat(result.unitPrice) : 0;
      if (metalCostRaw > 0 && unitCost > 0 && unitPrice > 0) {
        metalSale = (metalCostRaw / unitCost) * unitPrice;
      }
    }

    const monedaSale = precio - metalSale;
    const metalPct   = metalSale > 0 ? metalSale / precio * 100 : 0;
    const monedaPct  = 100 - metalPct;

    return { precio, metalSale, monedaSale, metalPct, monedaPct };
  }, [result, appliedTaxes, totalFinal]);

  // Alertas de negocio calculadas en frontend (sin backend)
  const frontendAlerts = useMemo<{ level: "error" | "warning" | "info"; message: string }[]>(() => {
    if (!result?.unitCost || !result?.unitPrice) return [];
    const cost     = parseFloat(result.unitCost);
    const price    = parseFloat(result.unitPrice);
    const mPct     = result.marginPercent ? parseFloat(result.marginPercent) : null;
    const taxTotal = appliedTaxes.reduce((s, t) => s + t.amount, 0);
    const out: { level: "error" | "warning" | "info"; message: string }[] = [];

    if (price < cost) {
      out.push({ level: "error", message: "El precio de venta es menor al costo. Se vendería a pérdida." });
    } else if (mPct != null && mPct < 20) {
      out.push({ level: "warning", message: `Margen del ${mPct.toFixed(1)}% — lo recomendado es superar el 20% para cubrir gastos fijos.` });
    }
    if (appliedTaxes.length > 0 && price > 0 && taxTotal / price * 100 > 30) {
      out.push({ level: "info", message: `Los impuestos representan el ${(taxTotal / price * 100).toFixed(1)}% del precio. Verificá si la configuración fiscal es correcta.` });
    }
    return out;
  }, [result, appliedTaxes]);

  // ── Cálculo what-if (puramente local, no toca el backend) ───────────────
  const whatIfResult = useMemo(() => {
    if (!result) return null;
    const origCost  = result.unitCost  != null ? parseFloat(result.unitCost)  : null;
    const origPrice = result.unitPrice != null ? parseFloat(result.unitPrice) : null;
    const origGain  = origCost != null && origPrice != null ? origPrice - origCost : null;
    const origMargin = result.marginPercent != null ? parseFloat(result.marginPercent) : null;

    const effCost = whatIfCost ?? origCost;

    // Precio efectivo: precio explícito > precio derivado de margen > precio original
    let effPrice: number | null;
    if (whatIfPrice != null) {
      effPrice = whatIfPrice;
    } else if (whatIfMargin != null && effCost != null) {
      const m = whatIfMargin / 100;
      effPrice = m < 1 ? effCost / (1 - m) : null;
    } else {
      effPrice = origPrice;
    }

    // Aplicar descuento sobre el precio efectivo
    if (whatIfDiscount != null && whatIfDiscount > 0 && effPrice != null) {
      if (whatIfDiscountType === "PERCENT") {
        effPrice = effPrice * (1 - whatIfDiscount / 100);
      } else {
        effPrice = Math.max(0, effPrice - whatIfDiscount);
      }
    }

    const gain   = effCost != null && effPrice != null ? effPrice - effCost : null;
    const margin = effCost != null && effPrice != null && effPrice > 0
      ? (effPrice - effCost) / effPrice * 100 : null;

    return { cost: effCost, price: effPrice, gain, margin, origCost, origPrice, origGain, origMargin };
  }, [result, whatIfCost, whatIfMargin, whatIfPrice, whatIfDiscount, whatIfDiscountType]);

  // Comisión del vendedor (solo informativa, no modifica el precio)
  const selectedSeller = sellers.find(s => s.id === sellerId) ?? null;
  const commissionResult = useMemo(() => {
    if (!selectedSeller || !result) return null;
    const { commissionType, commissionValue, commissionBase } = selectedSeller;
    if (commissionType === "NONE" || !commissionValue) return null;
    const value = parseFloat(commissionValue);
    if (isNaN(value) || value <= 0) return null;

    // Base de cálculo
    const unitPrice  = result.unitPrice  != null ? parseFloat(result.unitPrice)  : null;
    const unitCost   = result.unitCost   != null ? parseFloat(result.unitCost)   : null;
    const unitMargin = unitPrice != null && unitCost != null ? unitPrice - unitCost : null;
    const gross      = totalFinal ?? unitPrice;

    let base: number | null;
    let baseLabel: string;
    if (commissionBase === "GROSS") {
      base = gross;
      baseLabel = "precio final";
    } else if (commissionBase === "NET") {
      base = unitPrice;
      baseLabel = "precio neto";
    } else {
      base = unitMargin;
      baseLabel = "ganancia";
    }
    if (base == null || base <= 0) return null;

    let amount: number;
    let formula: string;
    if (commissionType === "PERCENTAGE") {
      amount  = base * value / 100;
      formula = `${value}% sobre ${baseLabel}`;
    } else {
      amount  = value;
      formula = "monto fijo";
    }
    return { amount, formula, base, baseLabel, commissionType, value };
  }, [selectedSeller, result, totalFinal]);

  // Resetear what-if al cambiar de artículo
  useEffect(() => {
    setWhatIfCost(null);
    setWhatIfMargin(null);
    setWhatIfPrice(null);
    setWhatIfDiscount(null);
    setWhatIfDiscountType("PERCENT");
  }, [article?.id]);

  // Carga medios de pago activos
  useEffect(() => {
    paymentsApi.list()
      .then(list => setPaymentMethods(list.filter(p => p.isActive && !p.deletedAt)))
      .catch(() => {});
  }, []);

  // Carga vendedores activos
  useEffect(() => {
    sellersApi.list()
      .then((list: SellerRow[]) => setSellers(list.filter(s => s.isActive && !s.deletedAt)))
      .catch(() => {});
  }, []);

  // Pre-carga desde query params (?articleId=X&variantId=Y&quantity=Z)
  const initDone = useRef(false);
  // Guarda el variantId que vino por URL para aplicarlo después de cargar variantes
  const pendingVariantId = useRef<string | null>(null);
  useEffect(() => {
    if (initDone.current) return;
    const artId = searchParams.get("articleId");
    const vid   = searchParams.get("variantId");
    const qty   = searchParams.get("quantity");
    if (!artId) return;
    initDone.current = true;
    if (vid) pendingVariantId.current = vid;
    if (qty) setQuantity(parseFloat(qty) || 1);
    articlesApi.getOne(artId)
      .then(detail => setArticle(detail as any))
      .catch(() => {/* silencioso — el usuario puede seleccionar manualmente */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carga detalle del artículo para composiciones, ajuste manual, etc.
  useEffect(() => {
    if (!article) { setArticleDetail(null); return; }
    articlesApi.getOne(article.id)
      .then(d => setArticleDetail(d))
      .catch(() => setArticleDetail(null));
  }, [article]);

  // Carga descuentos por cantidad cuando cambia el artículo
  useEffect(() => {
    if (!article) { setQuantityDiscounts([]); setSelectedDiscountIds([]); return; }
    quantityDiscountsApi.list({ articleId: article.id, take: 100 })
      .then(r => setQuantityDiscounts(r.data.filter(d => d.isActive && !d.deletedAt)))
      .catch(() => setQuantityDiscounts([]));
    setSelectedDiscountIds([]);
  }, [article]);

  // Carga variantes cuando cambia el artículo
  useEffect(() => {
    if (!article) {
      setVariants([]);
      setVariantId(null);
      return;
    }
    articlesApi.variants.list(article.id)
      .then(v => {
        setVariants(v);
        // Si hay un variantId pendiente de query params, usarlo; si no, el primero
        const pending = pendingVariantId.current;
        if (pending && v.some(vv => vv.id === pending)) {
          setVariantId(pending);
          pendingVariantId.current = null;
        } else {
          setVariantId(v.length > 0 ? v[0].id : null);
        }
      })
      .catch(() => setVariants([]));
  }, [article]);

  // Medios de pago seleccionado actual
  const selectedPM = paymentMethods.find(p => p.id === paymentMethodId) ?? null;
  // Planes de cuotas activos del medio seleccionado
  const availablePlans = selectedPM?.installmentPlans?.filter(p => p.isActive) ?? [];

  // Simula automáticamente cuando cambian los parámetros
  const simulate = useCallback(async (
    art: ArticleRow | null,
    vid: string | null,
    qty: number | null,
    cli: EntityRow | null,
    pmId: string,
    instQty: number,
    plOverride?: string,
    qdIds?: string[],
  ) => {
    if (!art) return;
    setLoading(true);
    setError(null);
    try {
      const res = await articlesApi.getPricingPreview(art.id, {
        variantId:           vid ?? null,
        clientId:            cli?.id ?? null,
        quantity:            qty ?? 1,
        paymentMethodId:     pmId || null,
        installmentsQty:     instQty || null,
        priceListId:         plOverride || null,
        quantityDiscountIds: qdIds?.length ? qdIds : undefined,
      });
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? "Error al simular");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Autosimular con debounce cuando cambian los inputs (comerciales y de pago)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!article) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      simulate(article, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId || undefined, selectedDiscountIds);
    }, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [article, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId, selectedDiscountIds, simulate]);

  // Re-simular cuando el costo de un artículo cambia (guardado desde ArticleModal)
  const articleRef = useRef(article);
  articleRef.current = article;
  useEffect(() => {
    function onArticleCostChanged(e: Event) {
      const art = articleRef.current;
      if (!art) return;
      const detail = (e as CustomEvent<{ articleId: string }>).detail;
      if (detail?.articleId && detail.articleId !== art.id) return;
      simulate(art, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId || undefined, selectedDiscountIds);
    }
    window.addEventListener("tptech:article-cost-changed", onArticleCostChanged);
    return () => window.removeEventListener("tptech:article-cost-changed", onArticleCostChanged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulate, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId]);

  const hasVariants = variants.length > 0;

  // Simulación de moneda (solo visual)
  const baseCurrency = currencies.find(c => c.isBase) ?? null;
  const simCurrency  = currencies.find(c => c.id === simCurrencyId) ?? null;
  const simCostValue = simCurrency && result?.unitCost && simCurrency.latestRate != null
    ? parseFloat(result.unitCost) * simCurrency.latestRate
    : null;
  const simPriceList = priceLists.find(p => p.id === simPriceListId) ?? null;

  // Conversión visual de moneda (solo presentación, no afecta cálculos)
  const displayRate = simCurrency?.latestRate ?? 1;
  const displaySym  = simCurrency?.symbol     ?? SYM;

  return (
    <TPSectionShell
      title="Simulador de precios"
      subtitle="Validá el motor de cálculo en tiempo real sin modificar artículos."
      icon={<Calculator size={22} />}
      right={
        <TPButton variant="secondary" onClick={handleBack} iconLeft={<ArrowLeft size={16} />}>
          {isFromArticles ? "Volver a Artículos" : "Volver"}
        </TPButton>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">

        {/* ── Columna izquierda — Parámetros ── */}
        <div className="lg:sticky lg:top-6">
          <TPCard title="Parámetros">
            <div className="space-y-3">

              {/* Thumbnail del artículo seleccionado */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "w-20 h-20 rounded-2xl border border-border bg-surface2 overflow-hidden flex items-center justify-center",
                    article?.mainImageUrl && "cursor-zoom-in hover:opacity-90 transition-opacity"
                  )}
                  onClick={() => article?.mainImageUrl && setImgLightbox(true)}
                >
                  {article?.mainImageUrl ? (
                    <img
                      src={article.mainImageUrl}
                      alt={article.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={28} className="text-muted/40" />
                  )}
                </div>
                {article && (
                  <div className="text-center">
                    <div className="text-xs font-medium text-text truncate max-w-[220px]">{article.name}</div>
                    {article.sku && <div className="text-[10px] text-muted">{article.sku}</div>}
                  </div>
                )}
              </div>

              {/* Artículo */}
              <TPField label="Artículo" required>
                <ArticleSearchSelect
                  selected={article}
                  onSelect={setArticle}
                  onClear={() => {
                    setArticle(null);
                    setResult(null);
                    setError(null);
                  }}
                />
              </TPField>

              {/* Variante */}
              {hasVariants && (
                <TPField label="Variante">
                  <select
                    value={variantId ?? ""}
                    onChange={e => setVariantId(e.target.value || null)}
                    className="tp-input w-full"
                  >
                    <option value="">Sin variante específica</option>
                    {variants.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name || v.code}
                        {v.sku ? ` · ${v.sku}` : ""}
                      </option>
                    ))}
                  </select>
                </TPField>
              )}

              {/* Cantidad */}
              <TPField label="Cantidad">
                <TPNumberInput
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  step={1}
                  decimals={0}
                  placeholder="1"
                />
              </TPField>

              {/* Cliente (opcional) */}
              <TPField label="Cliente" hint="Opcional — aplica la lista de precios y el descuento/recargo configurados para ese cliente.">
                <EntitySearchSelect
                  role="client"
                  selected={client}
                  onSelect={setClient}
                  onClear={() => setClient(null)}
                />
              </TPField>

              {/* Vendedor (opcional) */}
              {sellers.length > 0 && (
                <TPField label="Vendedor" hint="Opcional — calcula la comisión del vendedor">
                  <TPComboFixed
                    value={sellerId}
                    onChange={setSellerId}
                    searchable
                    searchPlaceholder="Buscar vendedor…"
                    options={[
                      { value: "", label: "Sin vendedor" },
                      ...sellers.map(s => ({
                        value: s.id,
                        label: s.displayName || `${s.firstName} ${s.lastName}`.trim(),
                      })),
                    ]}
                  />
                </TPField>
              )}

              {/* Divider */}
              <div className="border-t border-border/60 pt-3">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={13} className="text-muted shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Forma de pago</span>
                </div>

                {/* Medio de pago */}
                <TPField label="Medio de pago" hint="Opcional — aplica recargo o descuento">
                  <select
                    value={paymentMethodId}
                    onChange={e => {
                      setPaymentMethodId(e.target.value);
                      setInstallmentsQty(0); // reset cuotas al cambiar medio
                    }}
                    className="tp-input w-full"
                  >
                    <option value="">Sin forma de pago</option>
                    {paymentMethods.map(pm => (
                      <option key={pm.id} value={pm.id}>{pm.name}</option>
                    ))}
                  </select>
                </TPField>

                {/* Cuotas — solo si el medio tiene planes */}
                {availablePlans.length > 0 && (
                  <TPField label="Cuotas" hint="Opcional">
                    <select
                      value={installmentsQty}
                      onChange={e => setInstallmentsQty(parseInt(e.target.value, 10) || 0)}
                      className="tp-input w-full"
                    >
                      <option value={0}>Sin cuotas</option>
                      {availablePlans.map(plan => (
                        <option key={plan.installments} value={plan.installments}>
                          {plan.installments} {plan.installments === 1 ? "cuota" : "cuotas"}
                          {parseFloat(plan.interestRate) > 0 ? ` (+${plan.interestRate}%)` : " sin interés"}
                        </option>
                      ))}
                    </select>
                  </TPField>
                )}
              </div>

              {/* ── Configuración de simulación ── */}
              <div className="rounded-2xl border border-border bg-card">

                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-border">
                  {/* Título — toca para expandir en mobile */}
                  <button
                    type="button"
                    onClick={() => setSimPanelOpen(v => !v)}
                    className="flex items-center gap-2 text-left md:pointer-events-none md:cursor-default min-w-0"
                  >
                    <FlaskConical size={13} className="text-muted shrink-0" />
                    <span className="text-sm font-semibold text-text truncate">Configuración de simulación</span>
                    {isSimulating && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full px-2 py-0.5 font-semibold shrink-0">
                        activa
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      className={cn(
                        "text-muted shrink-0 transition-transform duration-200 md:hidden",
                        simPanelOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Reset — siempre visible si hay simulación activa */}
                  {isSimulating && (
                    <button
                      type="button"
                      onClick={resetSimulation}
                      className="flex items-center gap-1 text-[10px] text-muted hover:text-text transition-colors shrink-0"
                    >
                      <RotateCcw size={10} />
                      <span className="hidden sm:inline">Restablecer</span>
                    </button>
                  )}
                </div>

                {/* Body — siempre visible en desktop, accordion en mobile */}
                <div className={cn("p-4 space-y-3", simPanelOpen ? "block" : "hidden md:block")}>
                  <TPField label="Vista del cálculo" hint="Define cómo se muestra el resultado">
                    <TPSelect
                      value={simViewMode}
                      onChange={v => setSimViewMode(v as "UNIFICADO" | "DESGLOSADO")}
                      options={[
                        { value: "UNIFICADO",  label: "Valor Unificado" },
                        { value: "DESGLOSADO", label: "Valor Desglosado" },
                      ]}
                    />
                  </TPField>

                  <TPField label="Lista de precios" hint="Define el precio de venta aplicado">
                    <TPSelect
                      value={simPriceListId}
                      onChange={setSimPriceListId}
                      options={[
                        { value: "", label: "Lista real del artículo" },
                        ...priceLists.map(pl => ({ value: pl.id, label: pl.name })),
                      ]}
                    />
                  </TPField>

                  {/* Descuentos por cantidad (multi-select) */}
                  {quantityDiscounts.length > 0 && (
                    <TPField label="Descuento por cantidad" hint="Seleccioná uno o más — el motor aplica BEST_OF o STACKABLE según config">
                      <div className="space-y-1">
                        {quantityDiscounts.map(qd => {
                          const checked = selectedDiscountIds.includes(qd.id);
                          const scopeLabel = qd.article ? qd.article.name
                            : qd.category ? qd.category.name
                            : qd.group    ? qd.group.name
                            : qd.brand    ? qd.brand
                            : "General";
                          const tierSummary = qd.tiers.length > 0
                            ? qd.tiers.map(t => `×${t.minQty}: ${t.type === "PERCENTAGE" ? `${t.value}%` : `$${t.value}`}`).join(", ")
                            : "";
                          return (
                            <label
                              key={qd.id}
                              className={cn(
                                "flex items-start gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors select-none",
                                checked
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-border/40 hover:border-border/70 bg-muted/5",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 shrink-0 accent-primary"
                                checked={checked}
                                onChange={e => {
                                  setSelectedDiscountIds(prev =>
                                    e.target.checked
                                      ? [...prev, qd.id]
                                      : prev.filter(id => id !== qd.id)
                                  );
                                }}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-text leading-snug">{scopeLabel}</p>
                                {tierSummary && (
                                  <p className="text-[10px] text-muted/60 tabular-nums leading-snug">{tierSummary}</p>
                                )}
                                {qd.isStackable && (
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">acumulable</span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                        {selectedDiscountIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedDiscountIds([])}
                            className="text-[10px] text-muted hover:text-text transition-colors"
                          >
                            Limpiar selección
                          </button>
                        )}
                      </div>
                    </TPField>
                  )}

                  <TPField label="Moneda de visualización" hint="Solo cambia cómo se muestran los importes">
                    <TPSelect
                      value={simCurrencyId}
                      onChange={setSimCurrencyId}
                      options={[
                        {
                          value: "",
                          label: baseCurrency
                            ? `${baseCurrency.code} (moneda base)`
                            : "Moneda base del sistema",
                        },
                        ...currencies.filter(c => !c.isBase).map(c => ({
                          value: c.id,
                          label: c.code + (c.name ? ` — ${c.name}` : ""),
                        })),
                      ]}
                    />
                  </TPField>
                </div>

              </div>

              {/* ── ¿Qué pasaría si...? ── */}
              {result && (
                <div className={cn("rounded-2xl border bg-card overflow-hidden transition-colors", whatIfActive ? "border-amber-500/30" : "border-border")}>
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => setWhatIfOpen(v => !v)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/5 transition-colors text-left border-b border-border/0"
                    style={{ borderBottomWidth: whatIfOpen ? 1 : 0 }}
                  >
                    <FlaskConical size={13} className={whatIfActive ? "text-primary" : "text-muted"} />
                    <span className="flex-1 text-sm font-semibold text-text">¿Qué pasaría si…?</span>
                    {whatIfActive && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold shrink-0">
                        simulando
                      </span>
                    )}
                    <ChevronDown size={14} className={cn("text-muted shrink-0 transition-transform", whatIfOpen && "rotate-180")} />
                  </button>

                  {whatIfOpen && (
                    <div className="p-4 space-y-3">
                      <p className="text-[10px] text-muted/60 -mt-1">
                        Modificá los valores para simular escenarios sin cambiar el artículo.
                      </p>

                      {/* Costo */}
                      <TPField label="Costo">
                        <TPNumberInput
                          value={whatIfCost}
                          onChange={setWhatIfCost}
                          placeholder={whatIfResult?.origCost != null ? String(whatIfResult.origCost.toFixed(2)) : "Costo actual"}
                        />
                        {whatIfCost != null && whatIfResult?.origCost != null && (
                          <p className="text-[10px] text-muted mt-1">
                            Original: {fmtMoney(whatIfResult.origCost, SYM)}
                            {" · "}
                            <span className={whatIfCost > whatIfResult.origCost ? "text-amber-500" : "text-emerald-500"}>
                              {whatIfCost > whatIfResult.origCost ? "+" : ""}
                              {(((whatIfCost - whatIfResult.origCost) / whatIfResult.origCost) * 100).toFixed(1)}%
                            </span>
                          </p>
                        )}
                      </TPField>

                      {/* Margen objetivo */}
                      <TPField label="Margen objetivo (%)" hint="Calcula el precio desde el costo">
                        <div className="relative">
                          <TPNumberInput
                            value={whatIfMargin}
                            onChange={setWhatIfMargin}
                            placeholder={whatIfResult?.origMargin != null ? String(whatIfResult.origMargin.toFixed(1)) : "Margen actual"}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted pointer-events-none">%</span>
                        </div>
                        {whatIfMargin != null && whatIfResult?.price != null && (
                          <p className="text-[10px] text-muted mt-1">
                            Precio resultante: <strong className="text-text">{fmtMoney(whatIfResult.price, SYM)}</strong>
                          </p>
                        )}
                      </TPField>

                      {/* Precio de venta */}
                      <TPField
                        label="Precio de venta"
                        hint={whatIfMargin != null && whatIfPrice != null
                          ? "Usando este precio — tiene prioridad sobre el margen objetivo"
                          : "Tiene prioridad sobre el margen si ambos están definidos"}
                      >
                        <TPNumberInput
                          value={whatIfPrice}
                          onChange={setWhatIfPrice}
                          placeholder={whatIfResult?.origPrice != null ? String(whatIfResult.origPrice.toFixed(2)) : "Precio actual"}
                        />
                        {whatIfPrice != null && whatIfResult?.origPrice != null && (
                          <p className="text-[10px] text-muted mt-1">
                            Original: {fmtMoney(whatIfResult.origPrice, SYM)}
                            {" · "}
                            <span className={whatIfPrice > whatIfResult.origPrice ? "text-emerald-500" : "text-amber-500"}>
                              {whatIfPrice > whatIfResult.origPrice ? "+" : ""}
                              {(((whatIfPrice - whatIfResult.origPrice) / whatIfResult.origPrice) * 100).toFixed(1)}%
                            </span>
                          </p>
                        )}
                      </TPField>

                      {/* Descuento manual */}
                      <TPField label="Descuento">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <TPNumberInput
                              value={whatIfDiscount}
                              onChange={setWhatIfDiscount}
                              placeholder="0"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setWhatIfDiscountType(t => t === "PERCENT" ? "FIXED" : "PERCENT")}
                            className="px-3 rounded-xl border border-border text-xs font-semibold text-muted hover:text-text hover:border-primary/40 transition-colors bg-muted/5 shrink-0"
                          >
                            {whatIfDiscountType === "PERCENT" ? "%" : SYM}
                          </button>
                        </div>
                      </TPField>

                      {/* Resultado comparativo */}
                      {whatIfActive && whatIfResult && (
                        <div className="border-t border-border/40 pt-3 space-y-3">

                          {/* Aviso de modo simulación */}
                          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <FlaskConical size={11} className="shrink-0 text-amber-600 dark:text-amber-400" />
                            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                              Simulando — los cambios no se guardan
                            </span>
                          </div>

                          {/* Tabla: Actual vs Simulado */}
                          <div className="rounded-xl border border-amber-500/15 overflow-hidden text-xs">
                            {/* Header columnas */}
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-muted/10 border-b border-border/30">
                              <span />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted text-right">Actual</span>
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 text-right">Simulado</span>
                            </div>

                            {/* Precio neto */}
                            {whatIfResult.origPrice != null && whatIfResult.price != null && (() => {
                              const delta    = whatIfResult.price - whatIfResult.origPrice;
                              const deltaPct = whatIfResult.origPrice > 0 ? (delta / whatIfResult.origPrice) * 100 : 0;
                              const changed  = Math.abs(delta) > 0.001;
                              const up       = delta > 0;
                              return (
                                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2.5 border-b border-border/20">
                                  <div>
                                    <span className="font-medium text-text">Precio neto</span>
                                    {changed && (
                                      <span className={cn("ml-1.5 text-[10px] font-semibold", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                                        {up ? "↑" : "↓"} {Math.abs(deltaPct).toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                  <span className={cn("tabular-nums text-right", changed ? "text-muted/60 line-through" : "text-text font-semibold")}>
                                    {fmtMoney(whatIfResult.origPrice, SYM)}
                                  </span>
                                  <span className={cn("font-extrabold tabular-nums text-right", changed ? "text-amber-600 dark:text-amber-400" : "text-text")}>
                                    {fmtMoney(whatIfResult.price, SYM)}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Ganancia */}
                            {whatIfResult.origGain != null && whatIfResult.gain != null && (() => {
                              const delta   = whatIfResult.gain - whatIfResult.origGain;
                              const changed = Math.abs(delta) > 0.001;
                              const up      = delta > 0;
                              const gc      = whatIfResult.margin == null ? "text-text"
                                : whatIfResult.margin >= 20 ? "text-emerald-600 dark:text-emerald-400"
                                : whatIfResult.margin >= 0  ? "text-amber-500 dark:text-amber-400"
                                : "text-red-500 dark:text-red-400";
                              return (
                                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2 border-b border-border/20">
                                  <div>
                                    <span className="font-medium text-text">Ganancia</span>
                                    {changed && (
                                      <span className={cn("ml-1.5 text-[10px] font-semibold", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                                        {up ? "↑" : "↓"} {up ? "+" : ""}{fmtMoney(delta, SYM)}
                                      </span>
                                    )}
                                  </div>
                                  <span className={cn("tabular-nums text-right", changed ? "text-muted/60 line-through" : "text-text font-semibold")}>
                                    {fmtMoney(whatIfResult.origGain, SYM)}
                                  </span>
                                  <span className={cn("font-bold tabular-nums text-right", changed ? gc : "text-text")}>
                                    {fmtMoney(whatIfResult.gain, SYM)}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Margen */}
                            {whatIfResult.origMargin != null && whatIfResult.margin != null && (() => {
                              const m       = whatIfResult.margin;
                              const origM   = whatIfResult.origMargin;
                              const delta   = m - origM;
                              const changed = Math.abs(delta) > 0.05;
                              const up      = delta > 0;
                              const mc      = m >= 0
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
                              return (
                                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2">
                                  <div>
                                    <span className="font-medium text-text">Margen</span>
                                    {changed && (
                                      <span className={cn("ml-1.5 text-[10px] font-semibold", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                                        {up ? "↑" : "↓"} {up ? "+" : ""}{delta.toFixed(1)} pp
                                      </span>
                                    )}
                                  </div>
                                  <span className={cn("tabular-nums text-right", changed ? "text-muted/60" : "text-text font-semibold")}>
                                    {origM.toFixed(1)}%
                                  </span>
                                  <div className="flex justify-end">
                                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold tabular-nums", mc)}>
                                      <TrendingUp size={10} />
                                      {m.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Resetear — botón prominente */}
                          <button
                            type="button"
                            onClick={() => {
                              setWhatIfCost(null);
                              setWhatIfMargin(null);
                              setWhatIfPrice(null);
                              setWhatIfDiscount(null);
                              setWhatIfDiscountType("PERCENT");
                            }}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted hover:text-text hover:border-primary/30 transition-colors bg-muted/5"
                          >
                            <RotateCcw size={12} />
                            Resetear simulación
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Botón manual */}
              <TPButton
                variant="primary"
                className="w-full mt-1"
                loading={loading}
                disabled={!article}
                onClick={() => simulate(article, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId || undefined, selectedDiscountIds)}
                iconLeft={<Calculator size={15} />}
              >
                Simular
              </TPButton>

              {/* Guía mínima */}
              <div className="rounded-xl border border-border/50 bg-muted/5 px-3 py-3 space-y-1.5 text-[11px] text-muted">
                <div className="font-semibold text-text/70 text-xs mb-2">¿Qué usar para cada caso?</div>
                <div>· <strong className="text-text/80">Lista de precios</strong> — precio base según tipo de cliente o categoría.</div>
                <div>· <strong className="text-text/80">Descuento por cantidad</strong> — baja el precio al comprar muchas unidades.</div>
                <div>· <strong className="text-text/80">Promoción</strong> — beneficio temporal por evento o fecha.</div>
                <div>· <strong className="text-text/80">Ajuste del cliente</strong> — descuento o recargo fijo asignado a esa entidad.</div>
              </div>


            </div>
          </TPCard>
        </div>

        {/* ── Columna derecha — Resultado ── */}
        <div className="min-w-0 space-y-5">

          {/* Estado vacío */}
          {!article && !result && (
            <div className="rounded-2xl border border-border bg-card flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Calculator size={36} className="text-border" />
              <p className="text-sm text-muted">Seleccioná un artículo para simular el cálculo.</p>
            </div>
          )}

          {/* Cargando */}
          {loading && (
            <div className="rounded-2xl border border-border bg-card flex items-center justify-center gap-2 py-10">
              <Loader2 size={18} className="animate-spin text-muted" />
              <span className="text-sm text-muted">Calculando…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 flex items-center gap-2 px-4 py-4 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Resultado */}
          {!loading && result && (
            <>
              {/* ── KPI cards principales ── */}
              {(() => {
                const costBase    = result.unitCost     != null ? parseFloat(result.unitCost)     / displayRate : null;
                const costTax     = result.costTaxAmount != null ? parseFloat(result.costTaxAmount) / displayRate : null;
                const costTotal   = result.costWithTax  != null ? parseFloat(result.costWithTax)  / displayRate : null;
                const netPriceD   = result.unitPrice    != null ? parseFloat(result.unitPrice)    / displayRate : null;
                const finalPriceD = (appliedTaxes.length > 0 && totalFinal != null && simCtx !== "EXEMPT")
                  ? totalFinal / displayRate
                  : netPriceD;
                const taxesTotalD = appliedTaxes.reduce((s, t) => s + t.amount, 0) / displayRate;
                const gainAmtD    = result.unitCost != null && result.unitPrice != null
                  ? (parseFloat(result.unitPrice) - parseFloat(result.unitCost)) / displayRate : null;
                const mVal = result.marginPercent != null ? parseFloat(result.marginPercent) : null;

                const mBorderCls = mVal == null ? "border-border bg-card"
                  : mVal >= 0  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-red-500/25 bg-red-500/5";
                const mBadgeCls = mVal == null ? "bg-muted/20 text-muted"
                  : mVal >= 0  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
                const gainColor = mVal == null ? "text-text"
                  : mVal >= 0  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500 dark:text-red-400";

                return (
                  <div className="grid grid-cols-3 gap-3">
                    {/* Card 1 — Costo */}
                    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Costo</p>
                      <p className="text-xl font-bold tabular-nums truncate text-text">
                        {(costTotal ?? costBase) != null ? fmtMoney((costTotal ?? costBase)!, displaySym) : "—"}
                      </p>
                      {/* Base · imp. (formato unificado) */}
                      {costBase != null && (
                        <p className="text-[10px] text-muted mt-1 tabular-nums">
                          Base: {fmtMoney(costBase, displaySym)}
                          {costTax != null && costTax > 0.001 && (
                            <><span className="mx-1 opacity-40">·</span>imp.: +{fmtMoney(costTax, displaySym)}</>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Card 2 — Margen */}
                    <div className={cn("rounded-xl border px-4 py-3.5", mBorderCls)}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Margen</p>
                      {mVal != null ? (
                        <>
                          <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-lg font-extrabold tabular-nums", mBadgeCls)}>
                            <TrendingUp size={14} />
                            {mVal.toFixed(1)}%
                          </div>
                          {gainAmtD != null && (
                            <p className={cn("text-[10px] mt-1.5 tabular-nums", gainColor)}>
                              Ganancia: {fmtMoney(gainAmtD, displaySym)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xl font-bold text-muted">—</p>
                      )}
                    </div>

                    {/* Card 3 — Total final (consolidado) */}
                    {(() => {
                      const qty            = Math.max(quantity ?? 1, 1);
                      const rawPriceB      = result.unitPrice != null ? parseFloat(result.unitPrice) : null;
                      const origFinalB     = rawPriceB != null
                        ? ((appliedTaxes.length > 0 && totalFinal != null) ? totalFinal : rawPriceB)
                        : null;
                      const checkoutFinalB = result.checkoutResult?.finalAmount ?? null;
                      const hasCheckoutAdj = !whatIfActive && checkoutFinalB != null && (result.checkoutResult?.paymentAdjustment ?? 0) !== 0;
                      // Cuando hay ajuste de pago, mostrar precio UNITARIO como hero
                      const heroPriceB = whatIfActive && whatIfResult?.price != null
                        ? whatIfResult.price
                        : hasCheckoutAdj && checkoutFinalB != null
                          ? checkoutFinalB / qty
                          : origFinalB != null ? (simCtx !== "EXEMPT" ? origFinalB : rawPriceB) : null;
                      const heroPriceD  = heroPriceB  != null ? heroPriceB  / displayRate : null;
                      const origFinalD  = origFinalB  != null ? origFinalB  / displayRate : null;
                      // Total × cantidad para mostrar abajo
                      const checkoutTotalD = hasCheckoutAdj && checkoutFinalB != null ? checkoutFinalB / displayRate : null;
                      const qtyD = !hasCheckoutAdj && quantity != null && quantity > 1 && heroPriceD != null
                        ? heroPriceD * quantity : null;

                      const cardLabel = hasCheckoutAdj
                        ? "Total con pago"
                        : (appliedTaxes.length > 0 && simCtx !== "EXEMPT" ? "Total final" : "Precio neto");

                      return (
                        <div className={cn(
                          "rounded-xl border px-4 py-3.5",
                          whatIfActive ? "border-amber-500/30 bg-amber-500/5" : "border-primary/25 bg-primary/5"
                        )}>
                          {/* Badge what-if */}
                          {whatIfActive && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mb-1.5">
                              <FlaskConical size={9} />
                              Simulación interactiva
                            </div>
                          )}

                          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-1.5">{cardLabel}</p>
                          <p className={cn("text-xl font-bold tabular-nums truncate", whatIfActive ? "text-amber-600 dark:text-amber-400" : "text-primary")}>
                            {heroPriceD != null ? fmtMoney(heroPriceD, displaySym) : "—"}
                          </p>

                          {/* What-if: precio original como referencia */}
                          {whatIfActive && heroPriceD != null && origFinalD != null && Math.abs(heroPriceD - origFinalD) > 0.001 && (
                            <p className="text-[10px] text-muted mt-1">
                              Original: {fmtMoney(origFinalD, displaySym)}
                              <span className={heroPriceD > origFinalD ? " text-emerald-500" : " text-red-400"}>
                                {" "}({heroPriceD > origFinalD ? "+" : ""}{(((heroPriceD - origFinalD) / origFinalD) * 100).toFixed(1)}%)
                              </span>
                            </p>
                          )}

                          {/* Checkout adj */}
                          {!whatIfActive && hasCheckoutAdj && (() => {
                            const cr  = result.checkoutResult!;
                            const adj = cr.paymentAdjustment;
                            return (
                              <p className="text-[10px] text-muted mt-1">
                                Precio: {origFinalD != null ? fmtMoney(origFinalD, displaySym) : "—"}
                                {" · "}
                                <span className={adj > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                                  {adj > 0 ? "recargo" : "desc."} pago: {adj > 0 ? "+" : ""}{fmtMoney(adj / displayRate, displaySym)}
                                </span>
                                {cr.installments != null && cr.installmentAmount != null && (
                                  <span className="text-muted/70">
                                    {" · "}{cr.installments} cuotas de {fmtMoney(cr.installmentAmount / displayRate, displaySym)} c/u
                                  </span>
                                )}
                              </p>
                            );
                          })()}

                          {/* Neto + impuestos */}
                          {!whatIfActive && !hasCheckoutAdj && appliedTaxes.length > 0 && simCtx !== "EXEMPT" && netPriceD != null && (
                            <p className="text-[10px] text-muted mt-1 tabular-nums">
                              Neto: {fmtMoney(netPriceD, displaySym)}
                              {taxesTotalD > 0 && <><span className="mx-1 opacity-40">·</span><span className="text-amber-600 dark:text-amber-400">imp.: +{fmtMoney(taxesTotalD, displaySym)}</span></>}
                            </p>
                          )}

                          {/* Exento */}
                          {!whatIfActive && simCtx === "EXEMPT" && (
                            <p className="text-[10px] text-muted/60 mt-1 italic">Cliente exento de impuestos</p>
                          )}

                          {/* Simulación activa */}
                          {isSimulating && !whatIfActive && (
                            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted/60 mt-1.5">
                              <FlaskConical size={9} className="shrink-0" />
                              <span>Simulación activa</span>
                              {simPriceList && <><span className="opacity-40">·</span><span>Lista: {simPriceList.name}</span></>}
                              {simCurrency  && <><span className="opacity-40">·</span><span>Importes en {simCurrency.code}</span></>}
                              <button type="button" onClick={resetSimulation} className="flex items-center gap-0.5 underline hover:no-underline ml-0.5 transition-colors">
                                <RotateCcw size={9} />
                                Restablecer
                              </button>
                            </p>
                          )}

                          {/* Cantidad / total — abajo a la derecha */}
                          {checkoutTotalD != null && qty > 1 && (
                            <p className="text-right text-[11px] text-muted/70 tabular-nums mt-2">
                              {qty} u · {fmtMoney(checkoutTotalD, displaySym)}
                            </p>
                          )}
                          {qtyD != null && (
                            <p className="text-right text-[11px] text-muted/70 tabular-nums mt-2">
                              {quantity} u · {fmtMoney(qtyD, displaySym)}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Alertas de negocio (backend + frontend) */}
              {((result.alerts ?? []).length > 0 || frontendAlerts.length > 0) && (
                <div className="space-y-2">
                  {(result.alerts ?? []).map((alert: PricingAlert, i: number) => (
                    <div
                      key={`be-${i}`}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                        alert.level === "error"
                          ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"
                          : alert.level === "warning"
                          ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                          : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400"
                      }`}
                    >
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <span>{alert.message}</span>
                    </div>
                  ))}
                  {frontendAlerts.map((alert, i) => (
                    <div
                      key={`fe-${i}`}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                        alert.level === "error"
                          ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"
                          : alert.level === "warning"
                          ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                          : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400"
                      }`}
                    >
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Resumen comercial — lista aplicada */}
              {(() => {
                const priceListStep = result.steps.find((s: any) => s.key === "PRICE_LIST" && s.status === "ok");
                const priceListName = priceListStep?.meta?.priceListName as string | undefined;
                if (!priceListName) return null;
                return (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 rounded-lg bg-muted/5 text-xs">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span className="font-medium text-text">{simPriceList?.name ?? priceListName}</span>
                      <span className="opacity-50">·</span>
                      <span>Lista aplicada</span>
                    </span>
                  </div>
                );
              })()}


              {/* ── Cálculo del precio + Costo — enriquecidos ── */}
              {(() => {
                const baseStep = result.steps.find((s: any) =>
                  ["VARIANT_OVERRIDE", "PRICE_LIST", "MANUAL_OVERRIDE", "MANUAL_FALLBACK"].includes(s.key) && s.status === "ok"
                );
                const discStep  = result.steps.find((s: any) => s.key === "QUANTITY_DISCOUNT" && s.status === "ok");
                const promoStep = result.steps.find((s: any) => s.key === "PROMOTION"         && s.status === "ok");
                const rndStep   = result.steps.find((s: any) => s.key === "ROUNDING"          && s.status === "ok" && s.meta?.preRounding != null);
                const ruleStep  = result.steps.find((s: any) => s.key === "ENTITY_COMMERCIAL_RULE" && s.status === "ok");
                const hasTaxesL = appliedTaxes.length > 0 && !result.taxExemptByEntity;

                function fm2(v: number) { return fmtMoney(v / displayRate, displaySym); }

                const netP    = result.unitPrice != null ? parseFloat(result.unitPrice) : null;
                // Siempre preferir totalWithTax para el precio final: cuando hay impuestos es el
                // neto+impuestos; cuando no los hay es el neto (=unitPrice) — pero si se aplicó
                // redondeo TOTAL, totalWithTax ya lo incorpora aunque unitPrice esté sin redondear.
                const finalP  = totalFinal != null ? totalFinal : netP;

                const basePriceVal = baseStep?.value != null ? parseFloat(baseStep.value) : null;

                const mmhStep      = result.steps.find((s: any) => s.key === "METAL_MERMA_HECHURA_TOTAL" && s.status === "ok");
                const metalStepsAll   = result.steps.filter((s: any) => s.key === "COST_LINES_METAL"   && s.status === "ok" && s.value != null);
                const hechuraStepsAll = result.steps.filter((s: any) => s.key === "COST_LINES_HECHURA" && s.status === "ok" && s.value != null);
                const metalCostRaw = mmhStep?.meta?.metalCost != null
                  ? parseFloat(mmhStep.meta.metalCost as string)
                  : (metalStepsAll.length > 0
                    ? metalStepsAll.reduce((acc: number, s: any) => acc + parseFloat(s.value), 0)
                    : null);
                const hechuraCostRaw = mmhStep?.meta?.hechura != null
                  ? parseFloat(mmhStep.meta.hechura as string)
                  : (hechuraStepsAll.length > 0
                    ? hechuraStepsAll.reduce((acc: number, s: any) => acc + parseFloat(s.value), 0)
                    : null);
                const unitCostVal    = result.unitCost != null ? parseFloat(result.unitCost) : null;
                const costTaxAmt     = result.costTaxAmount != null ? parseFloat(result.costTaxAmount) : null;
                const hasCostComposition = metalCostRaw != null || hechuraCostRaw != null || unitCostVal != null;

                const productStepsRaw = result.steps.filter((s: any) => s.key === "COST_LINES_PRODUCT" && s.status === "ok" && s.value != null);
                const serviceStepsRaw = result.steps.filter((s: any) => s.key === "COST_LINES_SERVICE"  && s.status === "ok" && s.value != null);
                const productCostRaw  = productStepsRaw.length > 0
                  ? productStepsRaw.reduce((acc: number, s: any) => acc + parseFloat(s.value), 0) : null;
                const serviceCostRaw  = serviceStepsRaw.length > 0
                  ? serviceStepsRaw.reduce((acc: number, s: any) => acc + parseFloat(s.value), 0) : null;

                // Pasos METAL_QUOTE para contexto de metal
                const metalQuoteSteps = result.steps.filter((s: any) =>
                  (s.key === "METAL_QUOTE" || s.key === "COST_LINES_METAL") && s.status === "ok" && s.value != null
                );

                if (!basePriceVal && !hasCostComposition) return null;

                const PRICE_LIST_MODE_SHORT: Record<string, string> = {
                  MARGIN_TOTAL: "margen total", METAL_HECHURA: "metal+hechura",
                  COST_PER_GRAM: "por gramo",   FIXED: "precio fijo",
                };
                const SOURCE_SHORT: Record<string, string> = {
                  GENERAL: "lista general", CATEGORY: "lista de categoría", CLIENT: "lista del cliente",
                };

                function sub(text: string) {
                  return <p className="text-[10px] mt-0.5 leading-snug">{text}</p>;
                }

                /** Revierte applyAdjustment: dado el valor post-ajuste devuelve el pre-ajuste */
                function reverseLineAdj(post: number, kind: string, type: string, val: number): number {
                  if (type === "PERCENTAGE") {
                    const f = kind === "BONUS" ? (1 - val / 100) : (1 + val / 100);
                    return f !== 0 ? post / f : post;
                  }
                  if (type === "FIXED_AMOUNT") return kind === "BONUS" ? post + val : post - val;
                  return post;
                }

                return (
                  <div className="space-y-4">

                    {/* ─ Costo ─────────────────────────────────────────── */}
                    {hasCostComposition && unitCostVal != null && (() => {
                      // ── helpers locales ───────────────────────────────────────────────────
                      const LINE_TYPE_NAMES: Record<string, string> = {
                        COST_LINES_METAL:   "Metal",
                        COST_LINES_HECHURA: "Hechura",
                        COST_LINES_PRODUCT: "Producto",
                        COST_LINES_SERVICE: "Servicio",
                        COST_LINES_MANUAL:  "Manual",
                      };

                      // Render del ajuste por línea — formato compacto: −10% → −$3.500 / $31.500
                      // renderLineAdj eliminado — renderOtherRow usa formato inline

                      // ── 1. Líneas individuales ────────────────────────────────────────────
                      const allLineSteps = result.steps.filter((s: any) =>
                        Object.keys(LINE_TYPE_NAMES).includes(s.key)
                        && s.status === "ok" && s.value != null
                      );
                      const metalOnlySteps = result.steps.filter((s: any) =>
                        s.key === "METAL_QUOTE" && s.status === "ok" && s.value != null
                      );
                      const hechuraMMHStep = result.steps.find((s: any) =>
                        s.key === "HECHURA" && s.status === "ok" && s.value != null
                      );

                      const lineRows: React.ReactNode[] = [];
                      let hechuraLineSteps: any[] = [];

                      // ── helper: fila de metal ─────────────────────────────────────────────
                      const renderMetalRow = (key: string, name: string, cost: number, grams: number | null, price: number | null, mermaVal: number, symbol?: string | null) => {
                        const mermaS = mermaVal > 0 ? ` · merma ${mermaVal}%` : "";
                        const grStr  = grams != null ? grams.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : null;
                        return (
                          <div key={key} className="space-y-0.5">
                            <div className="flex justify-between items-baseline">
                              <span className="font-medium text-text/80">
                                {name}
                                {symbol && <span className="ml-1 text-[9px] text-muted/50">({symbol})</span>}
                              </span>
                              <span className="font-bold tabular-nums">{fm2(cost)}</span>
                            </div>
                            {grStr != null && price != null && (
                              <p className="text-[9px] text-muted/55 tabular-nums mt-0.5">
                                {grStr} gr × {fm2(price)}/gr{mermaS}
                              </p>
                            )}
                          </div>
                        );
                      };

                      // ── helper: fila de hechura / otros — formato inline ──────────────────
                      const GENERIC_TYPE_LABELS = new Set(Object.values(LINE_TYPE_NAMES));
                      const renderOtherRow = (key: string, step: any) => {
                        const m       = step.meta ?? {};
                        const postAdj = parseFloat(step.value);
                        const adjKind = String(m.lineAdjKind  ?? "");
                        const adjType = String(m.lineAdjType  ?? "");
                        const adjVal  = m.lineAdjValue != null ? parseFloat(String(m.lineAdjValue)) : null;
                        const hasAdj  = adjKind !== "" && adjType !== "" && adjVal != null;
                        let preAdj = postAdj;
                        if (hasAdj) {
                          preAdj = (m.originalAmount != null && m.rate != null)
                            ? parseFloat(String(m.originalAmount)) * parseFloat(String(m.rate))
                            : reverseLineAdj(postAdj, adjKind, adjType, adjVal!);
                        }
                        const rawLabel    = String(m.lineLabel ?? m.lineCode ?? "");
                        const customLabel = rawLabel && !GENERIC_TYPE_LABELS.has(rawLabel) ? rawLabel : null;

                        // Prefijo de conversión de moneda: "USD 10 × 1.600"
                        let convPrefix: string | null = null;
                        let convAmt:    number | null = null;
                        if (m.originalAmount != null && m.rate != null && m.currencyCode) {
                          const origAmt  = parseFloat(String(m.originalAmount));
                          const convRate = parseFloat(String(m.rate));
                          const code     = String(m.currencyCode);
                          const rateStr  = convRate.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
                          convPrefix = `${code} ${fmtMoney(origAmt, "").trim()} × ${rateStr}`;
                          convAmt    = origAmt * convRate;
                        }

                        // Monto intermedio (antes del ajuste, post-conversión)
                        const midAmt = convAmt ?? (hasAdj ? preAdj : postAdj);

                        const isBonif  = adjKind === "BONUS";
                        const adjLabel = hasAdj
                          ? adjType === "PERCENTAGE" && adjVal != null
                            ? `${isBonif ? "−" : "+"}${adjVal.toLocaleString("es-AR", { maximumFractionDigits: 4 })}%`
                            : `${isBonif ? "−" : "+"} fijo`
                          : null;

                        // Layout: fórmula izquierda / valor final derecha
                        // Sin adj:   customLabel? | $35.000
                        // Con adj:   $35.000 → −10% =  |  $31.500
                        // Conv+adj:  USD 10 × 1.600 → $16.000 → −10% =  |  $14.400
                        const leftContent = hasAdj ? (
                          <span className="text-[11px] tabular-nums text-muted/60 leading-snug flex flex-wrap items-baseline gap-x-0.5">
                            {convPrefix && (
                              <>
                                <span>{convPrefix}</span>
                                <span className="text-muted/35"> →</span>
                                <span>{fm2(convAmt!)}</span>
                                <span className="text-muted/35"> →</span>
                              </>
                            )}
                            {!convPrefix && <span>{fm2(preAdj)}</span>}
                            {!convPrefix && <span className="text-muted/35"> →</span>}
                            <span className={cn(
                              "font-medium",
                              isBonif ? "text-emerald-600/70 dark:text-emerald-400/70"
                                      : "text-amber-600/70 dark:text-amber-400/70"
                            )}>
                              {adjLabel}
                            </span>
                            <span className="text-muted/35"> =</span>
                          </span>
                        ) : convPrefix ? (
                          <span className="text-[11px] tabular-nums text-muted/60 leading-snug flex flex-wrap items-baseline gap-x-0.5">
                            <span>{convPrefix}</span>
                            <span className="text-muted/35"> →</span>
                          </span>
                        ) : (
                          customLabel
                            ? <span className="text-[9px] text-muted/50 font-medium">{customLabel}</span>
                            : <span />
                        );

                        const rightValue = (
                          <span className={cn(
                            "text-[11px] tabular-nums font-bold shrink-0",
                            hasAdj
                              ? isBonif ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-amber-600 dark:text-amber-400"
                              : "text-foreground/80"
                          )}>
                            {fm2(postAdj)}
                          </span>
                        );

                        return (
                          <div key={key}>
                            {/* Label personalizado sobre la fila (solo cuando hay conv o adj que ya ocupa el left) */}
                            {customLabel && (hasAdj || convPrefix) && (
                              <p className="text-[9px] text-muted/50 font-medium mb-0.5">{customLabel}</p>
                            )}
                            <div className="flex items-baseline justify-between gap-2">
                              {leftContent}
                              {rightValue}
                            </div>
                          </div>
                        );
                      };

                      if (allLineSteps.length > 0) {
                        // COST_LINES mode
                        const metalSteps = allLineSteps.filter((s: any) => s.key === "COST_LINES_METAL");
                        const otherSteps = allLineSteps.filter((s: any) => s.key !== "COST_LINES_METAL");
                        hechuraLineSteps = otherSteps;
                        const hasBoth    = metalSteps.length > 0 && otherSteps.length > 0;

                        if (hasBoth) {
                          lineRows.push(
                            <div key="group-metal" className="space-y-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/40">Metales</p>
                              {metalSteps.map((step: any, i: number) => {
                                const m  = step.meta ?? {};
                                const nm = (m.variantName as string | null | undefined) ?? "Metal";
                                const q  = m.qty        != null ? parseFloat(String(m.qty))        : null;
                                const p  = m.quotePrice != null ? parseFloat(String(m.quotePrice)) : null;
                                return renderMetalRow(`cl-m-${i}`, nm, parseFloat(step.value), q, p, m.merma ? Number(m.merma) : 0, m.metalSymbol as string | null);
                              })}
                            </div>
                          );
                          lineRows.push(
                            <div key="group-other" className="space-y-1.5 border-t border-border/20 pt-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/40">Hechura / Otros</p>
                              <div className="space-y-1">
                                {otherSteps.map((step: any, i: number) => {
                                  const isArticle = step.key === "COST_LINES_PRODUCT" || step.key === "COST_LINES_SERVICE";
                                  const prevIsHechura = i > 0 && (otherSteps[i - 1].key === "COST_LINES_HECHURA");
                                  const showDivider = isArticle && prevIsHechura;
                                  return (
                                    <React.Fragment key={`cl-o-wrap-${i}`}>
                                      {showDivider && <div className="border-t border-border/30 my-0.5" />}
                                      {renderOtherRow(`cl-o-${i}`, step)}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        } else {
                          metalSteps.forEach((step: any, i: number) => {
                            const m  = step.meta ?? {};
                            const nm = (m.variantName as string | null | undefined) ?? "Metal";
                            const q  = m.qty        != null ? parseFloat(String(m.qty))        : null;
                            const p  = m.quotePrice != null ? parseFloat(String(m.quotePrice)) : null;
                            lineRows.push(renderMetalRow(`cl-m-${i}`, nm, parseFloat(step.value), q, p, m.merma ? Number(m.merma) : 0, m.metalSymbol as string | null));
                          });
                          otherSteps.forEach((step: any, i: number) => lineRows.push(renderOtherRow(`cl-o-${i}`, step)));
                        }

                      } else if (metalOnlySteps.length > 0 || hechuraMMHStep) {
                        // METAL_MERMA_HECHURA mode
                        const hasBoth = metalOnlySteps.length > 0 && hechuraMMHStep != null;

                        if (hasBoth) {
                          lineRows.push(
                            <div key="group-metal-mmh" className="space-y-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/40">Metales</p>
                              {metalOnlySteps.map((step: any, qi: number) => {
                                const qm = step.meta ?? {};
                                const nm = (qm.variantName as string | null | undefined) ?? `Variante ${qi + 1}`;
                                const gr = qm.grams != null ? parseFloat(String(qm.grams)) : qm.qty != null ? parseFloat(String(qm.qty)) : null;
                                const pr = qm.price != null ? parseFloat(String(qm.price)) : qm.quotePrice != null ? parseFloat(String(qm.quotePrice)) : null;
                                return renderMetalRow(`mq-${qi}`, nm, parseFloat(String(step.value)), gr, pr, qm.merma ? Number(qm.merma) : 0, qm.metalSymbol as string | null);
                              })}
                            </div>
                          );
                        } else {
                          metalOnlySteps.forEach((step: any, qi: number) => {
                            const qm = step.meta ?? {};
                            const nm = (qm.variantName as string | null | undefined) ?? `Variante ${qi + 1}`;
                            const gr = qm.grams != null ? parseFloat(String(qm.grams)) : qm.qty != null ? parseFloat(String(qm.qty)) : null;
                            const pr = qm.price != null ? parseFloat(String(qm.price)) : qm.quotePrice != null ? parseFloat(String(qm.quotePrice)) : null;
                            lineRows.push(renderMetalRow(`mq-${qi}`, nm, parseFloat(String(step.value)), gr, pr, qm.merma ? Number(qm.merma) : 0, qm.metalSymbol as string | null));
                          });
                        }

                        if (hechuraMMHStep) {
                          const hm    = (hechuraMMHStep.meta ?? {}) as any;
                          const hCost = parseFloat(String(hechuraMMHStep.value));
                          const hFmt  = hm.mode === "PER_GRAM" && hm.price && hm.gramsWithMerma
                            ? `${fm2(parseFloat(String(hm.price)))} × ${hm.gramsWithMerma} gr`
                            : hm.price ? `Fijo: ${fm2(parseFloat(String(hm.price)))}` : null;
                          const hNode = (
                            <div key="hechura-mmh" className="space-y-0.5">
                              <div className="flex justify-between items-baseline">
                                <span className="font-medium text-text/80">Hechura / Mano de obra</span>
                                <span className="font-bold tabular-nums">{fm2(hCost)}</span>
                              </div>
                              {hFmt && <p className="text-[9px] text-muted/55 tabular-nums mt-0.5">{hFmt}</p>}
                            </div>
                          );
                          if (hasBoth) {
                            lineRows.push(
                              <div key="group-other-mmh" className="space-y-1.5 border-t border-border/20 pt-1.5">
                                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/40">Hechura / Otros</p>
                                <div className="space-y-1">
                                  {hNode}
                                </div>
                              </div>
                            );
                          } else {
                            lineRows.push(hNode);
                          }
                        }

                      } else {
                        // MANUAL / MULTIPLIER — fila única con sub-texto
                        const multStep   = result.steps.find((s: any) => s.key === "MULTIPLIER"       && s.status === "ok");
                        const manualStep = result.steps.find((s: any) => s.key === "MANUAL_BASE_COST"  && s.status === "ok");
                        const currStep   = result.steps.find((s: any) =>
                          (s.key === "MULTIPLIER_CURRENCY" || s.key === "MANUAL_CURRENCY") && s.status === "ok"
                        );
                        let preAdjBase: number | null = null;
                        let adjustKind: string | null = null;
                        let adjustAmt:  number | null = null;
                        if (manualStep) {
                          const mm = (manualStep.meta ?? {}) as any;
                          if (mm.adjustmentKind && mm.adjustmentKind !== "") {
                            adjustKind = mm.adjustmentKind;
                            const cm = currStep ? (currStep.meta ?? {}) as any : null;
                            preAdjBase = cm?.convertedAmount != null ? parseFloat(String(cm.convertedAmount))
                              : mm.manualBaseCost != null ? parseFloat(String(mm.manualBaseCost)) : null;
                            if (preAdjBase != null) adjustAmt = unitCostVal - preAdjBase;
                          }
                        }
                        let costSub: string | null = null;
                        if (currStep) {
                          const cm = (currStep.meta ?? {}) as any;
                          const origAmt  = cm.originalAmount  != null ? parseFloat(String(cm.originalAmount))  : null;
                          const convRate = cm.rate             != null ? parseFloat(String(cm.rate))             : null;
                          const convAmt  = cm.convertedAmount  != null ? parseFloat(String(cm.convertedAmount))  : null;
                          const code     = String(cm.currencyCode ?? cm.fromCurrencyId ?? "");
                          if (origAmt != null && convRate != null && code) {
                            const rateStr  = convRate.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
                            const baseDisp = preAdjBase ?? convAmt ?? unitCostVal;
                            costSub = `${code} ${fmtMoney(origAmt, "").trim()} × ${rateStr} = ${fm2(baseDisp)}`;
                          }
                        } else if (multStep) {
                          const partial = stepFormula(multStep as any);
                          costSub = partial ? `${partial} = ${fm2(unitCostVal)}` : `Cantidad × valor unitario = ${fm2(unitCostVal)}`;
                        } else if (!manualStep) {
                          const mode = String(result.costMode ?? "");
                          costSub = mode === "MULTIPLIER" ? `Cantidad × valor unitario = ${fm2(unitCostVal)}`
                            : mode === "METAL_MERMA_HECHURA" ? "Metal + merma + hechura"
                            : mode === "MANUAL" ? "Costo manual del artículo"
                            : "Costo del artículo";
                        }
                        const displayBase = preAdjBase ?? unitCostVal;
                        lineRows.push(
                          <React.Fragment key="manual-base">
                            <div>
                              <div className="flex justify-between items-baseline">
                                <span className="text-muted">Costo base</span>
                                <span className="tabular-nums">{fm2(displayBase)}</span>
                              </div>
                              {costSub && sub(costSub)}
                            </div>
                            {adjustKind != null && adjustAmt != null && (
                              <div>
                                <div className="flex justify-between items-baseline text-muted">
                                  <span>{adjustKind === "BONUS" ? "Bonificación" : "Recargo"}</span>
                                  <span className="tabular-nums">
                                    {adjustKind === "BONUS" ? "−" : "+"}{fm2(Math.abs(adjustAmt))}
                                  </span>
                                </div>
                                {preAdjBase != null && Math.abs(preAdjBase) > 0.001 && (() => {
                                  const pct = Math.abs(adjustAmt! / preAdjBase!) * 100;
                                  return sub(`${fm2(preAdjBase)} × ${pct.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}% = ${fm2(Math.abs(adjustAmt!))}`);
                                })()}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      }

                      // ── 2. Ajuste global (COST_LINES_FINAL) ──────────────────────────────
                      let globalAdjEl: React.ReactNode = null;
                      const finalStep = result.steps.find((s: any) => s.key === "COST_LINES_FINAL" && s.status === "ok" && s.value != null);
                      if (finalStep) {
                        const sumLines = result.steps
                          .filter((s: any) => Object.keys(LINE_TYPE_NAMES).includes(s.key) && s.status === "ok" && s.value != null)
                          .reduce((acc: number, s: any) => acc + parseFloat(s.value), 0);
                        const finalVal  = parseFloat(String(finalStep.value));
                        const globalAdj = finalVal - sumLines;
                        if (Math.abs(globalAdj) >= 0.01) {
                          const isBonif  = globalAdj < 0;
                          const gm       = (finalStep.meta ?? {}) as any;
                          const adjType  = String(gm.adjustmentType  ?? "");
                          const adjValue = gm.adjustmentValue != null ? parseFloat(String(gm.adjustmentValue)) : null;
                          const adjBase  = gm.sumLines != null ? parseFloat(String(gm.sumLines)) : sumLines;
                          const suffix   = adjType === "PERCENTAGE" && adjValue != null
                            ? ` ${adjValue.toLocaleString("es-AR", { maximumFractionDigits: 4 })}%`
                            : adjType === "FIXED_AMOUNT" && adjValue != null
                              ? ` (fijo ${fm2(adjValue)})` : "";
                          const formula  = adjType === "PERCENTAGE" && adjValue != null && adjBase > 0
                            ? `${fm2(adjBase)} × ${adjValue}% = ${isBonif ? "−" : "+"}${fm2(Math.abs(globalAdj))}`
                            : `${fm2(adjBase)} ${isBonif ? "−" : "+"} ${fm2(Math.abs(globalAdj))} = ${fm2(finalVal)}`;
                          globalAdjEl = (
                            <div className="border-t border-border/30 pt-1.5 mt-0.5">
                              <div className="flex justify-between items-baseline text-muted">
                                <span>{isBonif ? "Bonif. global" : "Recargo global"}{suffix}</span>
                                <span className={cn("tabular-nums", isBonif ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                                  {isBonif ? "−" : "+"}{fm2(Math.abs(globalAdj))}
                                </span>
                              </div>
                              {sub(formula)}
                            </div>
                          );
                        }
                      }

                      // ── 3. Impuestos de compra ────────────────────────────────────────────
                      const taxItems    = (result as any).costTaxBreakdown as any[] | undefined ?? [];
                      const hasCostTax  = taxItems.length > 0 && costTaxAmt != null && costTaxAmt > 0.001;
                      const taxEls: React.ReactNode[] = hasCostTax ? taxItems.map((t: any, i: number) => {
                        const taxAmt   = parseFloat(String(t.taxAmount ?? 0));
                        const hasFormula = t.rate != null && unitCostVal != null;
                        const leftLabel  = t.rate != null
                          ? <><span className="text-muted/70">{t.name}</span><span className="ml-1 text-[9px] text-muted/45 font-mono">{unitCostVal != null ? `${fm2(unitCostVal)} × ${t.rate}%` : `${t.rate}%`}</span></>
                          : <span className="text-muted/70">{t.name}</span>;
                        return (
                          <div key={`ctax-${i}`} className="flex items-baseline justify-between gap-2">
                            <span className="text-[11px]">{leftLabel}</span>
                            <span className="tabular-nums text-[11px] text-amber-600 dark:text-amber-400 shrink-0">+{fm2(taxAmt)}</span>
                          </div>
                        );
                      }) : [];

                      // ── 4. Total ──────────────────────────────────────────────────────────
                      const totalCostVal = result.costWithTax != null ? parseFloat(result.costWithTax) : unitCostVal;

                      // ── Equivalente por variante metálica (purity × (1−merma)) ────────────
                      // Agrupa por variante metálica final (variantId → variantName).
                      // factor = purity × (1 − merma/100)
                      // equivGr = qty × factor
                      // Se guarda quotePrice y effectiveGrams para mostrar la valorización.
                      type MetalVariantEquiv = {
                        qty: number; factor: number; equivGr: number; rawValue: number;
                        purity: number | null; merma: number | null;
                        quotePrice: number | null;
                      };
                      type MetalPadreAccum = {
                        displayName: string;
                        symbol: string | null;
                        variants: MetalVariantEquiv[];
                        totalEquivGr: number;
                        totalRawValue: number;
                        quotePrice: number | null;   // cotización compartida de la variante
                      };
                      const metalPadreMap = new Map<string, MetalPadreAccum>();

                      const metalStepsForEquiv = allLineSteps.length > 0
                        ? allLineSteps.filter((s: any) => s.key === "COST_LINES_METAL")
                        : metalOnlySteps;

                      metalStepsForEquiv.forEach((step: any) => {
                        const m     = step.meta ?? {};
                        const isMMH = step.key !== "COST_LINES_METAL";
                        const qty   = isMMH
                          ? (m.grams != null ? parseFloat(String(m.grams)) : m.qty   != null ? parseFloat(String(m.qty))   : null)
                          : (m.qty   != null ? parseFloat(String(m.qty))   : m.grams != null ? parseFloat(String(m.grams)) : null);
                        if (qty == null || qty <= 0.0001) return;

                        const purityVal     = m.purity     != null ? parseFloat(String(m.purity))     : null;
                        const mermaVal      = m.merma      != null ? parseFloat(String(m.merma))      : null;
                        const quotePriceVal = m.quotePrice != null ? parseFloat(String(m.quotePrice))
                                           : m.price      != null ? parseFloat(String(m.price))       : null;

                        let factor: number;
                        let equivGr: number;
                        if (purityVal != null) {
                          const mermaMul = mermaVal != null && mermaVal > 0 ? (1 - mermaVal / 100) : 1;
                          factor  = purityVal * mermaMul;
                          equivGr = qty * factor;
                        } else {
                          const merma = mermaVal ?? 0;
                          factor  = 1 / (1 + merma / 100);
                          equivGr = qty * factor;
                        }

                        const rawVal = step.value != null ? parseFloat(String(step.value)) : 0;

                        // Agrupar por metal padre (metalId o metalName): Oro, Plata, Platino, etc.
                        const groupKey = (m.metalId   as string | null | undefined)
                                      ?? (m.metalName as string | null | undefined)
                                      ?? (m.variantName as string | null | undefined)
                                      ?? "Metal";
                        const displayName = (m.metalName  as string | null | undefined)
                                         ?? (m.variantName as string | null | undefined)
                                         ?? "Metal";
                        const metalSymbol = (m.metalSymbol as string | null | undefined) ?? null;

                        const prev = metalPadreMap.get(groupKey) ?? {
                          displayName,
                          symbol: metalSymbol,
                          variants: [],
                          totalEquivGr: 0,
                          totalRawValue: 0,
                          quotePrice: quotePriceVal,
                        };
                        prev.variants.push({ qty, factor, equivGr, rawValue: rawVal, purity: purityVal, merma: mermaVal, quotePrice: quotePriceVal });
                        prev.totalEquivGr  += equivGr;
                        prev.totalRawValue += rawVal;
                        metalPadreMap.set(groupKey, prev);
                      });

                      // ── Factor de ajuste global y hechura equivalente ─────────────────────
                      let adjFactorMetal   = 1;
                      let hechuraEquiv: number | null = null;

                      if (result.metalHechuraBreakdown && unitCostVal != null) {
                        const mhb = result.metalHechuraBreakdown;
                        if (mhb.hechuraCost > 0.001) hechuraEquiv = mhb.hechuraCost;
                        const totalRawMetal = Array.from(metalPadreMap.values())
                          .reduce((a, v) => a + v.totalRawValue, 0);
                        if (totalRawMetal > 0.001 && mhb.metalCost > 0.001)
                          adjFactorMetal = mhb.metalCost / totalRawMetal;
                      } else if (allLineSteps.length > 0 && unitCostVal != null) {
                        const mSum = allLineSteps
                          .filter((s: any) => s.key === "COST_LINES_METAL")
                          .reduce((a: number, s: any) => a + parseFloat(s.value), 0);
                        const hSum = allLineSteps
                          .filter((s: any) => s.key !== "COST_LINES_METAL")
                          .reduce((a: number, s: any) => a + parseFloat(s.value), 0);
                        const linesTotal = mSum + hSum;
                        const adjFactor  = linesTotal > 0.001 ? unitCostVal / linesTotal : 1;
                        adjFactorMetal   = adjFactor;
                        if (hSum > 0.001) hechuraEquiv = hSum * adjFactor;
                      } else if (hechuraMMHStep && unitCostVal != null) {
                        const hSum = parseFloat(String(hechuraMMHStep.value));
                        if (hSum > 0.001) hechuraEquiv = hSum;
                      }

                      const metalPadreEntries = Array.from(metalPadreMap.entries());
                      const hasEquivBlock = metalPadreEntries.length > 0 || hechuraEquiv != null;

                      const totalEl = (
                        <div className="pt-1.5 mt-0.5 border-t border-border/40 space-y-1">
                          {/* ── Costo neto / Impuestos / Total ── */}
                          {hasCostTax && unitCostVal != null ? (
                            <>
                              <div className="flex justify-between items-baseline text-muted">
                                <span>Costo neto</span>
                                <span className="tabular-nums">{fm2(unitCostVal)}</span>
                              </div>
                              <div className="flex justify-between items-baseline text-muted">
                                <span>Imp. compra</span>
                                <span className="tabular-nums text-amber-600 dark:text-amber-400">+{fm2(costTaxAmt!)}</span>
                              </div>
                              <div className="flex justify-between font-bold border-t border-border/30 pt-0.5">
                                <span>Total</span>
                                <span className="tabular-nums">{fm2(totalCostVal)}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between font-bold">
                              <span>Costo neto</span>
                              <span className="tabular-nums">{fm2(totalCostVal)}</span>
                            </div>
                          )}

                          {/* ── Equivalentes liquidables (solo en modo DESGLOSADO) ── */}
                          {hasEquivBlock && simViewMode === "DESGLOSADO" && (
                            <div className="pb-1 space-y-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/50">
                                Equivalentes
                              </p>

                              {/* ── Grid de cards ── */}
                              <div className="grid grid-cols-2 gap-1.5">
                                {/* Cards por metal padre */}
                                {metalPadreEntries.map(([padreKey, padre], pi) => {
                                  const totalValue = padre.totalRawValue * adjFactorMetal;
                                  const totalGrStr = padre.totalEquivGr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                                  const sampleV    = padre.variants.find(v => v.quotePrice != null && v.purity != null && v.purity > 0.0001);
                                  const purePrice  = sampleV != null ? sampleV.quotePrice! / sampleV.purity! : null;

                                  const hasAdj       = Math.abs(adjFactorMetal - 1) > 0.001;
                                  const adjAmt       = totalValue - padre.totalRawValue;
                                  const adjPct       = (adjFactorMetal - 1) * 100;
                                  const isAdjBonif   = adjFactorMetal < 1;

                                  return (
                                    <div key={`equiv-padre-${pi}`}
                                      className="rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5 space-y-1.5">

                                      {/* ── Cabecera: nombre izq / gramos + cotización der ── */}
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-[16px] font-bold uppercase tracking-wider text-foreground/60 leading-none mt-0.5 shrink-0">
                                          {padre.displayName}
                                          {padre.symbol && <span className="text-[10px] font-normal text-foreground/35 ml-1">({padre.symbol})</span>}
                                        </p>
                                        <div className="text-right shrink-0">
                                          <p className="text-[26px] tabular-nums font-bold text-foreground/90 leading-tight">
                                            {padre.symbol && <span className="text-[13px] font-semibold text-muted/70 mr-1">{padre.symbol}</span>}{totalGrStr} gr
                                          </p>
                                          {purePrice != null && (
                                            <p className="text-[9px] tabular-nums text-muted/45 leading-none mt-2">
                                              × {fm2(purePrice)} / gr
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* ── Resumen: base → ajuste → total ── */}
                                      <div className="space-y-0.5">
                                        {purePrice != null && (
                                          <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-[9px] text-muted/50">Base</span>
                                            <span className="text-[10px] tabular-nums text-foreground/55">
                                              {totalGrStr} × {fm2(purePrice)} = {fm2(padre.totalRawValue)}
                                            </span>
                                          </div>
                                        )}
                                        {hasAdj && (
                                          <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-[9px] text-muted/50">Ajuste global</span>
                                            <span className={cn("text-[10px] tabular-nums",
                                              isAdjBonif ? "text-emerald-600/80 dark:text-emerald-400/80"
                                                         : "text-amber-600/80 dark:text-amber-400/80"
                                            )}>
                                              {isAdjBonif ? "−" : "+"}{Math.abs(adjPct).toFixed(2)}% = {isAdjBonif ? "−" : "+"}{fm2(Math.abs(adjAmt))}
                                            </span>
                                          </div>
                                        )}
                                        <div className="flex items-baseline justify-between gap-2">
                                          <span className="text-[9px] text-muted/50">Total metal</span>
                                          <span className="text-[13px] tabular-nums font-semibold text-foreground/80">{fm2(totalValue)}</span>
                                        </div>
                                      </div>

                                      {/* ── Detalle fórmulas al pie ── */}
                                      <div className="border-t border-border/20 pt-1.5">
                                        <p className="text-[8px] font-semibold uppercase tracking-widest text-muted/35 mb-0.5">Detalle</p>
                                        <div className="space-y-px">
                                          {padre.variants.map((v, vi) => {
                                            const qStr = v.qty.toLocaleString("es-AR",    { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                                            const fStr = v.factor.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                                            const gStr = v.equivGr.toLocaleString("es-AR",{ minimumFractionDigits: 2, maximumFractionDigits: 4 });
                                            let factorTitle = "";
                                            if (v.purity != null) {
                                              const pPct = (v.purity * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 });
                                              factorTitle = v.merma != null && v.merma > 0
                                                ? `${fStr} = pureza ${pPct}% × merma ${v.merma}%`
                                                : `${fStr} = pureza ${pPct}%`;
                                            } else if (v.merma != null && v.merma > 0) {
                                              factorTitle = `${fStr} = factor merma ${v.merma}%`;
                                            }
                                            return (
                                              <div key={vi} title={factorTitle || undefined}
                                                className="text-[9px] text-muted/40 tabular-nums cursor-default leading-snug">
                                                {qStr} × {fStr} → {gStr} gr
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Card Hechura */}
                                {hechuraEquiv != null && (() => {
                                  const hechuraTaxLines = taxItems
                                    .filter((t: any) => t.rate != null && parseFloat(String(t.rate)) > 0)
                                    .map((t: any) => {
                                      const rate   = parseFloat(String(t.rate));
                                      const taxAmt = hechuraEquiv! * rate / 100;
                                      return { name: t.name, rate, taxAmt };
                                    })
                                    .filter(t => t.taxAmt > 0.001);
                                  const hechuraTaxTotal    = hechuraTaxLines.reduce((a, t) => a + t.taxAmt, 0);
                                  const hechuraTotalConIVA = hechuraEquiv + hechuraTaxTotal;
                                  const displayTotal       = hechuraTaxLines.length > 0 ? hechuraTotalConIVA : hechuraEquiv;

                                  return (
                                    <div className="rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5 space-y-1.5">

                                      {/* ── Cabecera: título izq / total der ── */}
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-[16px] font-bold uppercase tracking-wider text-foreground/60 leading-none mt-0.5 shrink-0">
                                          Hechura
                                        </p>
                                        <p className="text-[26px] tabular-nums font-bold text-foreground/90 leading-none text-right shrink-0">
                                          {fm2(displayTotal)}
                                        </p>
                                      </div>

                                      {/* ── Resumen: subtotal → impuestos → total ── */}
                                      <div className="space-y-0.5">
                                        <div className="flex items-baseline justify-between gap-2">
                                          <span className="text-[9px] text-muted/50">Subtotal</span>
                                          <span className="text-[10px] tabular-nums text-foreground/55">{fm2(hechuraEquiv!)}</span>
                                        </div>
                                        {hechuraTaxLines.map((t, ti) => (
                                          <div key={`htax-sum-${ti}`} className="flex items-baseline justify-between gap-2">
                                            <span className="text-[9px] text-muted/50">{t.name} {t.rate}%</span>
                                            <span className="text-[10px] tabular-nums text-amber-600 dark:text-amber-400 font-medium shrink-0">+{fm2(t.taxAmt)}</span>
                                          </div>
                                        ))}
                                        {hechuraTaxLines.length > 0 && (
                                          <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-[9px] text-muted/50">Total hechura</span>
                                            <span className="text-[13px] tabular-nums font-semibold text-foreground/80">{fm2(displayTotal)}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* ── Detalle línea por línea ── */}
                                      {hechuraLineSteps.length > 0 && (
                                        <div className="border-t border-border/20 pt-1.5 space-y-0">
                                          <p className="text-[8px] font-semibold uppercase tracking-widest text-muted/35 mb-0.5">Detalle</p>
                                          <div className="space-y-1 text-xs">
                                            {hechuraLineSteps.map((step: any, i: number) => (
                                              <div key={`heq-${i}`}>
                                                {renderOtherRow(`heq-row-${i}`, step)}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      );

                      return (
                        <div className="rounded-xl border border-border bg-card px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5">Costo</p>
                          <div className="space-y-2 text-xs">
                            {lineRows}
                            {globalAdjEl}
                            {taxEls.length > 0 && (
                              <div className="border-t border-border/30 pt-1.5 mt-0.5 space-y-2">
                                {taxEls}
                              </div>
                            )}
                            {totalEl}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ─ Cálculo del precio ─────────────────────────────── */}
                    {basePriceVal != null && (
                      <div className="rounded-xl border border-border bg-card px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5">
                          Cálculo del precio
                        </p>
                        <div className="space-y-2.5 text-xs">

                          {/* Precio base */}
                          {result.metalHechuraBreakdown ? (
                            /* Con METAL_HECHURA: mostrar Metal y Hechura por separado (ambos modos) */
                            <>
                              {result.metalHechuraBreakdown.metalSale > 0 && (() => {
                                const mhb2   = result.metalHechuraBreakdown!;
                                const factor = metalCostRaw && metalCostRaw > 0 ? mhb2.metalSale / metalCostRaw : 1;
                                const marginPct = parseFloat(String(mhb2.metalMarginPct ?? 0));

                                if (metalQuoteSteps.length > 0) {
                                  // Agrupar por metal padre
                                  type PadreSaleAccum = { displayName: string; symbol: string | null; totalCost: number; totalEquivGr: number };
                                  const padreMap = new Map<string, PadreSaleAccum>();
                                  for (const step of metalQuoteSteps) {
                                    const m     = (step.meta ?? {}) as any;
                                    const qCost = step.value != null ? parseFloat(String(step.value)) : 0;
                                    const qty   = m.qty   != null ? parseFloat(String(m.qty))   : m.grams != null ? parseFloat(String(m.grams)) : 0;
                                    const pur   = m.purity != null ? parseFloat(String(m.purity)) : null;
                                    const mer   = m.merma  != null ? parseFloat(String(m.merma))  : 0;
                                    let equivGr = m.gramsFineEquivalent != null
                                      ? parseFloat(String(m.gramsFineEquivalent))
                                      : pur != null ? qty * pur * (1 - mer / 100) : qty * (1 / (1 + mer / 100));
                                    const gKey  = (m.metalId as string | null) ?? (m.metalName as string | null) ?? "Metal";
                                    const prev  = padreMap.get(gKey) ?? { displayName: (m.metalName as string | null) ?? "Metal", symbol: (m.metalSymbol as string | null) ?? null, totalCost: 0, totalEquivGr: 0 };
                                    prev.totalCost    += qCost;
                                    prev.totalEquivGr += equivGr;
                                    padreMap.set(gKey, prev);
                                  }

                                  return (
                                    <div className="space-y-2">
                                      {Array.from(padreMap.values()).map((padre, pi) => {
                                        const salePadre   = padre.totalCost * factor;
                                        const salePerGram = padre.totalEquivGr > 0.0001 ? salePadre / padre.totalEquivGr : null;
                                        const grStr       = padre.totalEquivGr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                                        return (
                                          <div key={pi}>
                                            <div className="flex items-baseline justify-between gap-2">
                                              <span className="font-medium text-text/80">
                                                {padre.displayName}
                                                {padre.symbol && <span className="ml-1 text-[9px] text-muted/50">({padre.symbol})</span>}
                                              </span>
                                              <span className="font-bold tabular-nums">{fm2(salePadre)}</span>
                                            </div>
                                            {salePerGram != null && (
                                              <p className="text-[9px] text-muted/55 tabular-nums mt-0.5">
                                                {grStr} gr × {fm2(salePerGram)}/gr{marginPct > 0 ? ` · +${marginPct.toFixed(1)}% margen` : ""}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                // Fallback sin pasos individuales: fila única
                                return (
                                  <div>
                                    <div className="flex justify-between items-baseline">
                                      <span className="text-muted">Metal</span>
                                      <span className="font-bold tabular-nums">{fm2(mhb2.metalSale)}</span>
                                    </div>
                                    {metalCostRaw != null && metalCostRaw > 0 && sub(
                                      `costo ${fm2(metalCostRaw)} × ${factor.toFixed(2)}${marginPct > 0 ? ` (+${marginPct}% margen)` : ""}`
                                    )}
                                  </div>
                                );
                              })()}
                              {result.metalHechuraBreakdown.hechuraSale > 0 && (
                                <div>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-muted">Hechura / Mano de obra</span>
                                    <span className="font-bold tabular-nums">{fm2(result.metalHechuraBreakdown.hechuraSale)}</span>
                                  </div>
                                  {hechuraCostRaw != null && hechuraCostRaw > 0 && sub(
                                    `costo ${fm2(hechuraCostRaw)} × ${(result.metalHechuraBreakdown.hechuraSale / hechuraCostRaw).toFixed(2)} (+${result.metalHechuraBreakdown.hechuraMarginPct}%)`
                                  )}
                                </div>
                              )}
                              {(discStep?.value != null || promoStep?.value != null) && (
                                <div className="flex justify-between items-baseline">
                                  <span className="text-muted text-[10px]">Subtotal venta</span>
                                  <span className="font-bold tabular-nums line-through text-muted/40">
                                    {fm2(result.metalHechuraBreakdown.metalSale + result.metalHechuraBreakdown.hechuraSale)}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            /* Unificado / sin desglose MH: igual que antes */
                            <div>
                              <div className="flex justify-between items-baseline">
                                <span>
                                  {baseStep?.key === "VARIANT_OVERRIDE" ? "Precio de variante"
                                   : baseStep?.key === "MANUAL_OVERRIDE" || baseStep?.key === "MANUAL_FALLBACK" ? "Precio manual"
                                   : `Precio de lista${baseStep?.meta?.priceListName ? ` · ${baseStep.meta.priceListName}` : ""}`}
                                </span>
                                <span className={cn("font-bold tabular-nums", (discStep?.value != null || promoStep?.value != null) && "line-through text-muted/40")}>
                                  {fm2(basePriceVal)}
                                </span>
                              </div>
                              {(() => {
                                const parts: string[] = [];
                                const mode = PRICE_LIST_MODE_SHORT[String(baseStep?.meta?.mode ?? "")] ?? null;
                                if (mode) parts.push(mode);
                                const src = SOURCE_SHORT[String(baseStep?.meta?.source ?? "")] ?? null;
                                if (src) parts.push(src);
                                let mkPct: number | null = null;
                                if (baseStep?.key === "PRICE_LIST" && unitCostVal && unitCostVal > 0 && basePriceVal > 0) {
                                  mkPct = (basePriceVal - unitCostVal) / unitCostVal * 100;
                                  if (Math.abs(mkPct) > 0.1) parts.push(`margen ${mkPct > 0 ? "+" : ""}${mkPct.toFixed(0)}%`);
                                }
                                const factor = unitCostVal && unitCostVal > 0 && basePriceVal > 0
                                  ? basePriceVal / unitCostVal : null;
                                return (
                                  <>
                                    {parts.length > 0 && sub(parts.join(" · "))}
                                    {factor != null && unitCostVal != null && sub(`${fm2(unitCostVal)} × ${factor.toFixed(2)} = ${fm2(basePriceVal)}`)}
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {/* Descuento por cantidad */}
                          {discStep?.value != null && (() => {
                            const m           = (discStep as any).meta ?? {};
                            const priceAfter  = parseFloat(discStep.value);
                            const discAmt     = m.discountAmount != null ? parseFloat(String(m.discountAmount)) : (basePriceVal - priceAfter);
                            // Scope suffix
                            const scopeSuffix = (() => {
                              if (!m.scopeType || m.scopeType === "ARTICLE" || m.scopeType === "VARIANT") return "";
                              const SL: Record<string, string> = { CATEGORY: "cat.", BRAND: "marca", GROUP: "grupo", GENERAL: "general" };
                              const prefix = SL[String(m.scopeType)] ?? String(m.scopeType).toLowerCase();
                              return m.scopeLabel ? ` · ${prefix}: ${m.scopeLabel}` : ` · ${prefix}`;
                            })();
                            // Condition formula
                            const parts: string[] = [];
                            if (m.type === "PERCENTAGE" && m.value != null) {
                              const applyCtx = m.applyOn && m.applyOn !== "TOTAL" ? ` (${String(m.applyOn).toLowerCase()})` : "";
                              const evalMode = m.evaluationMode && m.evaluationMode !== "LINE" ? ` · acum. ${String(m.evaluationMode).replace("_TOTAL", "").toLowerCase()}` : "";
                              parts.push(`${m.value}%${applyCtx}${evalMode}`);
                            } else if (m.type === "FIXED" && m.quantity) {
                              parts.push(`${m.quantity} u.`);
                            }
                            if (m.effectiveQty && m.evaluationMode !== "LINE") parts.push(`total ${m.effectiveQty} u.`);
                            return (
                              <div>
                                <div className="flex justify-between items-baseline">
                                  <span className="text-red-500 dark:text-red-400">Desc. por cantidad{scopeSuffix}</span>
                                  <span className="font-bold tabular-nums shrink-0 ml-2">{fm2(priceAfter)}</span>
                                </div>
                                {m.type === "PERCENTAGE" && m.value != null
                                  ? sub(`antes ${fm2(basePriceVal)} · −${m.value}%`)
                                  : sub(`antes ${fm2(basePriceVal)} · −${fm2(discAmt)}`)}
                              </div>
                            );
                          })()}

                          {/* Promoción */}
                          {promoStep?.value != null && (() => {
                            const m          = (promoStep as any).meta ?? {};
                            const priceAfter = parseFloat(promoStep.value);
                            const discAmt    = m.discountAmount != null ? parseFloat(String(m.discountAmount)) : null;
                            // Base de la promo: si hubo QD antes, su resultado; si no, el precio de lista
                            const qdPrice    = discStep?.value != null ? parseFloat(discStep.value) : null;
                            const priceBefore = qdPrice ?? basePriceVal;
                            // Scope suffix
                            const scopeSuffix = (() => {
                              if (!m.scope || m.scope === "ALL" || m.scope === "ARTICLE" || m.scope === "VARIANT") return "";
                              const SL: Record<string, string> = { CATEGORY: "categoría", BRAND: "marca", GROUP: "grupo" };
                              return ` · ${SL[String(m.scope)] ?? String(m.scope).toLowerCase()}`;
                            })();
                            // Formula
                            const applyCtx = m.applyOn && m.applyOn !== "TOTAL" ? ` (${String(m.applyOn).toLowerCase()})` : "";
                            const formula  = m.type === "PERCENTAGE" && m.value != null ? `${m.value}%${applyCtx}` : null;
                            return (
                              <div>
                                <div className="flex justify-between items-baseline">
                                  <span className="text-red-500 dark:text-red-400">Promoción{scopeSuffix}</span>
                                  <span className="font-bold tabular-nums shrink-0 ml-2">{fm2(priceAfter)}</span>
                                </div>
                                {m.type === "PERCENTAGE" && m.value != null
                                  ? sub(`antes ${fm2(priceBefore)} · −${m.value}%`)
                                  : sub(`antes ${fm2(priceBefore)} · −${fm2(discAmt ?? (priceBefore - priceAfter))}`)}
                              </div>
                            );
                          })()}

                          {/* Ajuste comercial del cliente */}
                          {ruleStep?.value != null && (() => {
                            const ruleType   = String(ruleStep.meta?.ruleType ?? "");
                            const isDiscount = ruleType === "DISCOUNT" || ruleType === "BONUS";
                            const amt        = parseFloat(ruleStep.value);
                            const m          = (ruleStep as any).meta ?? {};
                            const vt         = String(m.valueType ?? "");
                            const applyCtx   = m.applyOn && m.applyOn !== "TOTAL" ? ` (${String(m.applyOn).toLowerCase()})` : "";
                            // Para descuentos: mostrar precio resultante en lugar del delta
                            const priceBeforeRule = promoStep?.value != null ? parseFloat(promoStep.value)
                              : discStep?.value != null ? parseFloat(discStep.value)
                              : basePriceVal;
                            const priceAfterRule = isDiscount ? priceBeforeRule - amt : priceBeforeRule + amt;
                            return (
                              <div>
                                <div className={cn("flex justify-between items-baseline",
                                  isDiscount ? "text-red-500 dark:text-red-400" : ""
                                )}>
                                  <span>{isDiscount ? "Desc. del cliente" : "Recargo del cliente"}</span>
                                  {isDiscount
                                    ? <span className="font-bold tabular-nums shrink-0 ml-2">{fm2(priceAfterRule)}</span>
                                    : <span className="font-bold tabular-nums">+{fm2(amt)}</span>
                                  }
                                </div>
                                {isDiscount
                                  ? sub(`antes ${fm2(priceBeforeRule)}${vt === "PERCENTAGE" && m.value != null ? ` · −${m.value}%${applyCtx}` : ` · −${fm2(amt)}`}`)
                                  : vt === "PERCENTAGE" && m.value != null && sub(`${m.value}%${applyCtx}`)
                                }
                              </div>
                            );
                          })()}

                          {/* Redondeo PRICE / NET — antes de impuestos */}
                          {rndStep?.value != null && rndStep.meta?.preRounding != null && String(rndStep.meta?.applyOn ?? "PRICE") !== "TOTAL" && (() => {
                            const pre     = parseFloat(String(rndStep.meta.preRounding));
                            const rounded = parseFloat(rndStep.value);
                            const diff    = rounded - pre;
                            if (Math.abs(diff) < 0.001) return null;
                            const dirSym  = ROUNDING_DIR_SYMBOLS[String(rndStep.meta?.direction ?? "")] ?? "";
                            const modeLbl = ROUNDING_MODE_LABELS[String(rndStep.meta?.mode ?? "")] ?? String(rndStep.meta?.mode ?? "");
                            const applyOnMeta = String(rndStep.meta?.applyOn ?? "PRICE");
                            const applyOnLbl  = applyOnMeta === "NET" ? "sobre precio neto" : "sobre precio de lista";
                            const ctxLine     = [`${dirSym} ${modeLbl}`.trim(), applyOnLbl].filter(Boolean).join(" · ");
                            return (
                              <div>
                                <div className="flex justify-between items-baseline">
                                  <span>Redondeo</span>
                                  <span className="font-bold tabular-nums">{diff > 0 ? "+" : ""}{fm2(diff)}</span>
                                </div>
                                {ctxLine && sub(ctxLine)}
                                {sub(`${fm2(pre)} → ${fm2(rounded)}`)}
                              </div>
                            );
                          })()}


                          {/* Impuestos — uno por impuesto con fórmula */}
                          {hasTaxesL && (result.taxBreakdown ?? []).map((t: any, i: number) => {
                            const applyLbl = t.applyOn !== "TOTAL" ? (TAX_APPLY_ON_LABELS[t.applyOn] ?? "") : "";
                            let formulaLeft: string | null = null;
                            if (t.calculationType === "PERCENTAGE" && t.rate != null)
                              formulaLeft = `${fm2(t.base)} × ${t.rate}%${applyLbl ? ` (${applyLbl})` : ""}`;
                            else if (t.calculationType === "FIXED_AMOUNT")
                              formulaLeft = "fijo";
                            else if (t.calculationType === "PERCENTAGE_PLUS_FIXED" && t.rate != null)
                              formulaLeft = `${fm2(t.base)} × ${t.rate}% + fijo${applyLbl ? ` (${applyLbl})` : ""}`;
                            return (
                              <div key={i} className="flex items-baseline justify-between gap-2">
                                <span className="text-[11px]">
                                  <span className="text-foreground/75">{t.name}</span>
                                  {formulaLeft && <span className="ml-1 text-[9px] text-muted/50 font-mono">{formulaLeft}</span>}
                                </span>
                                <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400 shrink-0">+{fm2(t.taxAmount)}</span>
                              </div>
                            );
                          })}

                          {/* Redondeo TOTAL — después de impuestos */}
                          {rndStep?.value != null && rndStep.meta?.preRounding != null && String(rndStep.meta?.applyOn ?? "PRICE") === "TOTAL" && (() => {
                            const pre     = parseFloat(String(rndStep.meta.preRounding));
                            const rounded = parseFloat(rndStep.value);
                            const diff    = rounded - pre;
                            if (Math.abs(diff) < 0.001) return null;
                            const dirSym  = ROUNDING_DIR_SYMBOLS[String(rndStep.meta?.direction ?? "")] ?? "";
                            const modeLbl = ROUNDING_MODE_LABELS[String(rndStep.meta?.mode ?? "")] ?? String(rndStep.meta?.mode ?? "");
                            const roundTarget = hasTaxesL ? "sobre total con impuestos" : "sobre precio final";
                            const ctxLine = [`${dirSym} ${modeLbl}`.trim(), roundTarget].filter(Boolean).join(" · ");
                            return (
                              <div>
                                <div className="flex justify-between items-baseline">
                                  <span>Redondeo</span>
                                  <span className="font-bold tabular-nums">{diff > 0 ? "+" : ""}{fm2(diff)}</span>
                                </div>
                                {ctxLine && sub(ctxLine)}
                                {sub(`${fm2(pre)} → ${fm2(rounded)}`)}
                              </div>
                            );
                          })()}

                          {/* Total final / Neto antes de pago */}
                          {finalP != null && (() => {
                            const taxTotal = appliedTaxes.reduce((s, t) => s + t.amount, 0);
                            const baseForTotal = netP ?? basePriceVal;
                            const formulaTotal = hasTaxesL && taxTotal > 0 && baseForTotal != null
                              ? `${fm2(baseForTotal)} + ${fm2(taxTotal)} = ${fm2(finalP)}`
                              : null;
                            const cr = result.checkoutResult;
                            const hasAdj = cr != null && cr.paymentAdjustment !== 0;
                            const finalLabel = hasAdj
                              ? (hasTaxesL ? "Total con impuestos" : "Precio neto")
                              : (hasTaxesL ? "Total final" : "Precio neto");
                            return (
                              <>
                                <div className="pt-1.5 mt-0.5 border-t border-border/40">
                                  <div className="flex justify-between items-center font-bold">
                                    <span>{finalLabel}</span>
                                    <span className="tabular-nums text-sm">{fm2(finalP)}</span>
                                  </div>
                                  {formulaTotal && sub(formulaTotal)}
                                </div>

                                {/* Forma de pago — integrado en el flujo del precio */}
                                {/* El backend devuelve montos totales (× cantidad); dividimos por qty para mantener la vista unitaria */}
                                {hasAdj && cr != null && (() => {
                                  const qty         = Math.max(quantity ?? 1, 1);
                                  const adjUnit     = cr.paymentAdjustment / qty;
                                  const finalUnit   = cr.finalAmount / qty;
                                  const installUnit = cr.installmentAmount != null ? cr.installmentAmount / qty : null;
                                  const isRecarg    = adjUnit > 0;
                                  const pmStep      = cr.steps.find((s: any) => s.code === "PAYMENT_ADJUSTMENT");
                                  // Reconstruir fórmula en base unitaria
                                  const baseUnit = cr.baseAmount / qty;
                                  let unitFormula: string | null = null;
                                  if (pmStep) {
                                    const rateMatch = pmStep.formula.match(/×\s*([\d.,]+)%/);
                                    if (rateMatch) {
                                      unitFormula = `${fm2(baseUnit)} × ${rateMatch[1]}% = ${fm2(adjUnit)}`;
                                    } else {
                                      unitFormula = `${fm2(Math.abs(adjUnit))} (fijo)`;
                                    }
                                  }
                                  return (
                                    <>
                                      <div className="pt-1.5 mt-0.5 border-t border-border/40">
                                        <div className="flex justify-between items-baseline">
                                          <span className={isRecarg ? "" : "text-red-500 dark:text-red-400"}>
                                            {selectedPM?.name ?? "Forma de pago"}{isRecarg ? " (recargo)" : " (descuento)"}
                                          </span>
                                          <span className={cn("tabular-nums font-bold", isRecarg ? "" : "text-red-500 dark:text-red-400")}>
                                            {isRecarg ? "+" : ""}{fm2(adjUnit)}
                                          </span>
                                        </div>
                                        {unitFormula && sub(unitFormula)}
                                      </div>
                                      <div>
                                        <div className="flex justify-between items-center font-bold">
                                          <span>Total con pago</span>
                                          <span className="tabular-nums text-sm">{fm2(finalUnit)}</span>
                                        </div>
                                      </div>
                                      {cr.installments != null && installUnit != null && (
                                        <div className="pt-1 border-t border-border/20">
                                          <div className="flex justify-between items-baseline text-muted">
                                            <span>{cr.installments} {cr.installments === 1 ? "cuota" : "cuotas"}</span>
                                            <span className="tabular-nums font-bold text-primary">{fm2(installUnit)} c/u</span>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </>
                            );
                          })()}

                          {/* ── Equivalentes de venta (solo en modo DESGLOSADO) ── */}
                          {simViewMode === "DESGLOSADO" && (result.metalHechuraBreakdown || (hasTaxesL && netP != null)) && (
                            <div className="border-t border-border/30 pt-1.5 mt-1 space-y-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/50">
                                Equivalentes de venta
                              </p>

                              {/* Cards por metal padre + hechura — mismo patrón visual que costo */}
                              {result.metalHechuraBreakdown && (() => {
                                const mhb        = result.metalHechuraBreakdown!;
                                const saleFactor = metalCostRaw && metalCostRaw > 0 ? mhb.metalSale / metalCostRaw : 1;
                                const marginPct  = parseFloat(String(mhb.metalMarginPct ?? 0));

                                // Agrupar metalQuoteSteps por metal padre (misma lógica que "Cálculo del precio")
                                type PadreSaleStep = { variantName: string; equivGr: number; cost: number; quotePrice: number | null };
                                type PadreSaleCard = { displayName: string; symbol: string | null; totalCost: number; totalEquivGr: number; steps: PadreSaleStep[] };
                                const padreMap = new Map<string, PadreSaleCard>();
                                for (const step of metalQuoteSteps) {
                                  const m     = (step.meta ?? {}) as any;
                                  const qCost = step.value != null ? parseFloat(String(step.value)) : 0;
                                  const qty   = m.qty != null ? parseFloat(String(m.qty)) : m.grams != null ? parseFloat(String(m.grams)) : 0;
                                  const pur   = m.purity != null ? parseFloat(String(m.purity)) : null;
                                  const mer   = m.merma  != null ? parseFloat(String(m.merma))  : 0;
                                  const equivGr = m.gramsFineEquivalent != null
                                    ? parseFloat(String(m.gramsFineEquivalent))
                                    : pur != null ? qty * pur * (1 - mer / 100) : qty * (1 / (1 + mer / 100));
                                  const quoteP = m.quotePrice != null ? parseFloat(String(m.quotePrice)) : null;
                                  const gKey = (m.metalId as string | null) ?? (m.metalName as string | null) ?? "Metal";
                                  const prev = padreMap.get(gKey) ?? { displayName: (m.metalName as string | null) ?? "Metal", symbol: (m.metalSymbol as string | null) ?? null, totalCost: 0, totalEquivGr: 0, steps: [] };
                                  prev.totalCost    += qCost;
                                  prev.totalEquivGr += equivGr;
                                  prev.steps.push({ variantName: (m.variantName as string | null) ?? (m.metalName as string | null) ?? "Variante", equivGr, cost: qCost, quotePrice: quoteP });
                                  padreMap.set(gKey, prev);
                                }

                                const padreEntries  = Array.from(padreMap.values());
                                const hechuraSaleV  = mhb.hechuraSale  > 0.001 ? mhb.hechuraSale  : null;
                                const hMarginPct    = parseFloat(String(mhb.hechuraMarginPct ?? 0));

                                if (padreEntries.length === 0 && !hechuraSaleV) return null;

                                return (
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {/* Una card por metal padre */}
                                    {padreEntries.map((padre, pi) => {
                                      const salePadre   = padre.totalCost * saleFactor;
                                      const salePerGram = padre.totalEquivGr > 0.0001 ? salePadre / padre.totalEquivGr : null;
                                      const grStr       = padre.totalEquivGr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                                      return (
                                        <div key={pi} className="rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5 space-y-1.5">
                                          {/* Cabecera: nombre izq / gramos + cotización der */}
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-[16px] font-bold uppercase tracking-wider text-foreground/60 leading-none mt-0.5 shrink-0">
                                              {padre.displayName}
                                              {padre.symbol && <span className="text-[10px] font-normal text-foreground/35 ml-1">({padre.symbol})</span>}
                                            </p>
                                            <div className="text-right shrink-0">
                                              <p className="text-[22px] tabular-nums font-bold text-foreground/90 leading-tight">
                                                {padre.symbol && <span className="text-[12px] font-semibold text-muted/70 mr-1">{padre.symbol}</span>}{grStr} gr
                                              </p>
                                              {salePerGram != null && (
                                                <p className="text-[9px] tabular-nums text-muted/45 leading-none mt-2">
                                                  × {fm2(salePerGram)} / gr
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          {/* Total venta */}
                                          <div className="space-y-0.5">
                                            <div className="flex items-baseline justify-between gap-2">
                                              <span className="text-[9px] text-muted/50">Total metal</span>
                                              <span className="text-[13px] tabular-nums font-semibold text-foreground/80">{fm2(salePadre)}</span>
                                            </div>
                                            {marginPct > 0.01 && (
                                              <p className="text-[9px] text-muted/40 text-right">+{marginPct.toFixed(1)}% margen</p>
                                            )}
                                          </div>

                                          {/* Detalle por variante */}
                                          {padre.steps.length > 0 && (
                                            <div className="border-t border-border/20 pt-1.5">
                                              <p className="text-[8px] font-semibold uppercase tracking-widest text-muted/35 mb-0.5">Detalle</p>
                                              <div className="space-y-1">
                                                {padre.steps.map((s, si) => {
                                                  const saleLine  = s.cost * saleFactor;
                                                  const grLineStr = s.equivGr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                                                  // precio por gramo de esta línea: usar quotePrice de venta si disponible, si no el padre-level
                                                  const linePerGr = s.equivGr > 0.0001 ? saleLine / s.equivGr : salePerGram;
                                                  return (
                                                    <div key={si}>
                                                      <p className="text-[9px] text-muted/50 font-medium leading-snug">{s.variantName}</p>
                                                      <div className="text-[9px] text-muted/40 tabular-nums leading-snug">
                                                        {grLineStr} gr{linePerGr != null ? ` × ${fm2(linePerGr)} = ${fm2(saleLine)}` : ` = ${fm2(saleLine)}`}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {/* Card no-metal: Hechura */}
                                    {hechuraSaleV != null && (() => {
                                      const hCost  = hechuraCostRaw  ?? 0;
                                      const pCost  = productCostRaw  ?? 0;
                                      const sCost  = serviceCostRaw  ?? 0;
                                      // Subtotal de costo no-metal (fuente autoritativa del backend)
                                      const totalCostNM = mhb.hechuraCost > 0.001 ? mhb.hechuraCost : (hCost + pCost + sCost);
                                      const marginAmt   = hechuraSaleV - totalCostNM;
                                      // Impuestos proporcionales sobre el subtotal de venta no-metal
                                      const nmTaxLines  = appliedTaxes
                                        .filter((t: any) => t.rate != null && t.rate > 0)
                                        .map((t: any) => ({ name: t.name, rate: t.rate, taxAmt: hechuraSaleV * t.rate / 100 }))
                                        .filter((t: any) => t.taxAmt > 0.001);
                                      const nmTaxTotal  = nmTaxLines.reduce((a: number, t: any) => a + t.taxAmt, 0);
                                      const nmTotal     = hechuraSaleV + nmTaxTotal;

                                      return (
                                        <div className="rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5 space-y-1.5">
                                          {/* Cabecera */}
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-[13px] font-bold uppercase tracking-wider text-foreground/60 leading-none mt-0.5 shrink-0">
                                              Hechura
                                            </p>
                                            <p className="text-[22px] tabular-nums font-bold text-foreground/90 leading-none text-right shrink-0">
                                              {fm2(nmTotal > 0.001 ? nmTotal : hechuraSaleV)}
                                            </p>
                                          </div>

                                          {/* Desglose por tipo: costo → +margen% = venta */}
                                          <div className="space-y-1">
                                            {([
                                              { label: "Hechuras", cost: hCost },
                                              { label: "Productos", cost: pCost },
                                              { label: "Servicios", cost: sCost },
                                            ] as { label: string; cost: number }[])
                                              .filter(item => item.cost > 0.001)
                                              .map((item, idx) => {
                                                const saleItem = item.cost * (1 + hMarginPct / 100);
                                                return (
                                                  <div key={idx} className="space-y-0">
                                                    <p className="text-[9px] text-muted/50 font-medium">{item.label}</p>
                                                    <div className="flex items-baseline justify-between gap-2">
                                                      {hMarginPct > 0.01 ? (
                                                        <span className="text-[11px] tabular-nums text-muted/60 leading-snug flex flex-wrap items-baseline gap-x-0.5">
                                                          <span>{fm2(item.cost)}</span>
                                                          <span className="text-muted/35"> →</span>
                                                          <span className="text-emerald-600/70 dark:text-emerald-400/70 font-medium">+{hMarginPct.toFixed(1)}%</span>
                                                          <span className="text-muted/35"> =</span>
                                                        </span>
                                                      ) : (
                                                        <span />
                                                      )}
                                                      <span className="text-[11px] tabular-nums font-medium text-foreground/70 shrink-0">{fm2(saleItem)}</span>
                                                    </div>
                                                  </div>
                                                );
                                              })
                                            }
                                            {/* Subtotal venta */}
                                            <div className="flex items-baseline justify-between gap-2 border-t border-border/20 pt-0.5 mt-0.5">
                                              <span className="text-[9px] text-muted/50">Subtotal venta</span>
                                              <span className="text-[11px] tabular-nums font-medium text-foreground/70">{fm2(hechuraSaleV)}</span>
                                            </div>
                                            {/* Impuestos */}
                                            {nmTaxLines.map((t: any, ti: number) => (
                                              <div key={`nmtax-${ti}`} className="flex items-baseline justify-between gap-2">
                                                <span className="text-[9px] text-muted/50">{t.name} {t.rate}%</span>
                                                <span className="text-[10px] tabular-nums text-amber-600 dark:text-amber-400 font-medium shrink-0">+{fm2(t.taxAmt)}</span>
                                              </div>
                                            ))}
                                            {nmTaxLines.length > 0 && (
                                              <div className="flex items-baseline justify-between gap-2 border-t border-border/20 pt-0.5 mt-0.5">
                                                <span className="text-[9px] text-muted/50">Total</span>
                                                <span className="text-[13px] tabular-nums font-semibold text-foreground/80">{fm2(nmTotal)}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })()}

                              {/* Precio neto → impuestos → total */}
                              {netP != null && (
                                <div className="space-y-0.5">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-[10px] text-muted/60">Precio neto</span>
                                    <span className="text-[11px] tabular-nums text-foreground/70">{fm2(netP)}</span>
                                  </div>
                                  {hasTaxesL && appliedTaxes.map((t, ti) => (
                                    <div key={`sv-tax-${ti}`} className="flex items-baseline justify-between gap-2">
                                      <span className="text-[9px] text-muted/50">
                                        {t.name}{t.rate != null ? ` ${t.rate}%` : ""}
                                      </span>
                                      <span className="text-[11px] tabular-nums text-amber-600 dark:text-amber-400 font-medium shrink-0">
                                        +{fm2(t.amount)}
                                      </span>
                                    </div>
                                  ))}
                                  {hasTaxesL && finalP != null && finalP !== netP && (
                                    <div className="flex items-baseline justify-between gap-2 border-t border-border/30 pt-0.5 mt-0.5">
                                      <span className="text-[10px] font-semibold text-foreground/70">Total</span>
                                      <span className="text-[12px] tabular-nums font-bold text-foreground/90">{fm2(finalP)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}

              {/* Comisión del vendedor */}
              {selectedSeller && commissionResult && (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">Comisión</p>
                    <p className="text-xs font-medium text-text truncate">
                      {selectedSeller.displayName || `${selectedSeller.firstName} ${selectedSeller.lastName}`.trim()}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">{commissionResult.formula}</p>
                    {commissionResult.commissionType === "PERCENTAGE" ? (
                      <p className="text-[10px] text-muted opacity-60 font-mono mt-0.5">
                        {fmtMoney(commissionResult.base / displayRate, displaySym)} × {commissionResult.value}% = {fmtMoney(commissionResult.amount / displayRate, displaySym)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted opacity-60 mt-0.5">
                        Monto fijo: {fmtMoney(commissionResult.amount / displayRate, displaySym)}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold tabular-nums text-text shrink-0">
                    {fmtMoney(commissionResult.amount / displayRate, displaySym)}
                  </p>
                </div>
              )}
              {selectedSeller && !commissionResult && (
                <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/5 px-4 py-2.5 text-xs text-muted">
                  <span className="font-medium">{selectedSeller.displayName || `${selectedSeller.firstName} ${selectedSeller.lastName}`.trim()}</span>
                  <span className="opacity-50">·</span>
                  <span>Sin comisión configurada</span>
                </div>
              )}

            </>
          )}

        </div>
      </div>

      {/* Lightbox imagen artículo */}
      {imgLightbox && article?.mainImageUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setImgLightbox(false)}
        >
          <img
            src={article.mainImageUrl}
            alt={article.name}
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setImgLightbox(false)}
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition"
          >
            <X size={20} />
          </button>
        </div>
      )}

    </TPSectionShell>
  );
}
