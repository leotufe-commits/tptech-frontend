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
import { resolveAdjustmentLabel } from "../components/ui/TPPriceCompositionKpis";
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
// Fase 2 — helper visual unificado del breakdown del factor (bruto / ajuste / efectivo).
// POLICY R4.1: cero matemática nueva; solo decide qué texto mostrar.
import {
  buildFactorBreakdown,
  extractCostAdjustmentFromSteps,
} from "../lib/pricing-factor-display";
// Fase 4.2 — componente reutilizable para el JSX del hint del factor efectivo
// (antes duplicado 6× en este archivo). Render puramente visual.
import FactorBreakdownHint from "../components/ui/FactorBreakdownHint";
// Fase 5 — telemetría DEV-only para tracking de fallbacks pre-v7. No-op en prod.
import { trackLegacyPricingPath } from "../lib/pricing-legacy-telemetry";
import type {
  ArticleRow,
  ArticleDetail,
  ArticleVariant,
  PricingPreviewResult,
  PricingStepResult,
  PricingAlert,
  CheckoutResult,
} from "../services/articles";
import type { EntityRow, EntityMermaOverride } from "../services/commercial-entities";
import { commercialEntitiesExtApi } from "../services/commercial-entities";
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
import { salesChannelsApi } from "../services/sales-channels";
import type { SalesChannelRow } from "../services/sales-channels";
import { couponsApi } from "../services/coupons";
import { shippingApi } from "../services/shipping";
import type { ShippingCarrierRow } from "../services/shipping";
// ── Fase 2A: contrato unificado de pricing (Simulador / Factura / Comparador) ──
//
// Este Simulador construye su payload con `buildPricingPreviewPayload` (vía
// `toArticlePricingPreviewArgs`) para que las tres pantallas tengan un único
// punto de armado de request. Por ahora el RESPONSE sigue siendo el raw
// `PricingPreviewResult` porque la UI consume `steps`, `composition`,
// `metalHechuraBreakdown`, `cost*`, `costOverrideContext` y `stackingMode` —
// campos que todavía NO están en `NormalizedPricingResult`.
//
// TODO Fase 2.1: extender el contrato con esos campos y reemplazar el
// consumo del response por el normalizado.
import {
  toArticlePricingPreviewArgs,
  normalizeArticlePricingPreview,
  logParity,
  type PricingPreviewPayload,
  type NormalizedPricingResult,
} from "../lib/pricing";

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
  COST_LINES_LOGISTICS:  "Envío / Logística",
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
  // COMBO_COST: costo del combo (suma de costos de componentes — emitido por el motor
  // cuando article.commercialMode === "COMBO_COMMERCIAL"). El precio se resuelve por
  // el flujo normal (PRICE_LIST/MANUAL/FALLBACK) sobre este costo derivado.
  "COMBO_COST",
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

// Etiquetas largas y legibles para el bloque informativo "Redondeo por
// artículo / lista" (vs los símbolos compactos `ROUNDING_DIR_SYMBOLS` y los
// labels en minúscula `ROUNDING_MODE_LABELS` que se usan inline).
const APPLIED_ROUNDING_APPLY_ON_LABEL: Record<string, string> = {
  PRICE: "Precio de lista",
  NET:   "Precio sin impuestos",
  TOTAL: "Total con impuestos",
};
const APPLIED_ROUNDING_MODE_LABEL: Record<string, string> = {
  INTEGER:   "Entero",
  DECIMAL_1: "Décimo",
  DECIMAL_2: "Centavo",
  TEN:       "Decena",
  HUNDRED:   "Centena",
};
const APPLIED_ROUNDING_DIRECTION_LABEL: Record<string, string> = {
  NEAREST: "Más cercano",
  UP:      "Hacia arriba",
  DOWN:    "Hacia abajo",
};

function stepFormula(step: PricingStepResult): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (step.meta ?? {}) as Record<string, any>;
  // Formateo local: 2 decimales para gramos/precios, 3 para merma (regla del simulador)
  const n2 = (v: number | string) =>
    parseFloat(String(v)).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const n3 = (v: number | string) =>
    parseFloat(String(v)).toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  switch (step.key) {
    case "COST_LINES_METAL":
      if (m.qty && m.quotePrice) {
        const mermaVal = m.merma != null ? Number(m.merma) : 0;
        const priceWithMerma = Number(m.quotePrice) * (1 + mermaVal / 100);
        // L1 (label del StepRow = metalName) — ya manejado en renderCostSteps labelOverride
        // L2: "AU18K · Oro 18 Kilates"
        const vSku  = m.variantSku  ? String(m.variantSku)  : "";
        const vName = m.variantName ? String(m.variantName) : "";
        const vId   = vSku && vName ? `${vSku} · ${vName}` : vSku || vName;
        // L3: cálculo
        const calcLine = `${n2(m.qty)} g × $${n2(priceWithMerma)}/g`;
        const lines = [vId, calcLine].filter(Boolean);
        if (mermaVal > 0) lines.push(`merma ${n3(m.merma)}%`);
        return lines.join("\n");
      }
      return null;
    case "METAL_QUOTE":
      if (m.grams && m.price) {
        const mermaVal = m.merma != null ? Number(m.merma) : 0;
        const priceWithMerma = Number(m.price) * (1 + mermaVal / 100);
        const vSku  = m.variantSku  ? String(m.variantSku)  : "";
        const vName = m.variantName ? String(m.variantName) : "";
        const vId   = vSku && vName ? `${vSku} · ${vName}` : vSku || vName;
        const calcLine = `${n2(m.grams)} g × $${n2(priceWithMerma)}/g`;
        const lines = [vId, calcLine].filter(Boolean);
        if (mermaVal > 0) lines.push(`merma ${n3(m.merma)}%`);
        return lines.join("\n");
      }
      return null;
    case "HECHURA":
      if (m.mode === "PER_GRAM" && m.price && m.gramsWithMerma)
        return `${n2(m.price)}/g × ${n2(m.gramsWithMerma)} g`;
      if (m.price) return `Fijo: $${n2(m.price)}`;
      return null;
    case "MANUAL_CURRENCY":
    case "MULTIPLIER_CURRENCY": {
      const ccode = String(m.currencyCode ?? m.fromCurrencyId ?? "");
      if (m.originalAmount != null && m.rate != null && ccode)
        return `${ccode} ${n2(m.originalAmount)} × ${n2(m.rate)}`;
      return null;
    }
    case "MULTIPLIER":
      if (m.qty && m.value) return `${n2(m.qty)} × $${n2(m.value)}`;
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
        // Formato unificado: "Base: $X × Y% = −$Z"
        if (m.type === "PERCENTAGE" && m.discountBase != null)
          return `Base: $${parseFloat(String(m.discountBase)).toFixed(2)}${applyLbl} × ${m.value}% = −$${discAmt.toFixed(2)}${scopeSuffix}${qty}`;
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
        // Formato unificado: "Base: $X × Y% = −$Z"
        if (m.type === "PERCENTAGE" && m.discountBase != null)
          return `Base: $${parseFloat(String(m.discountBase)).toFixed(2)}${applyLbl} × ${m.value}% = −$${discAmt.toFixed(2)}${scope}`;
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
        // Formato unificado: "Base: $X × Y% = −$Z"
        if (valueType === "PERCENTAGE" && m.discountBase != null)
          return `Base: $${parseFloat(String(m.discountBase)).toFixed(2)}${applyLbl} × ${m.value}% = −$${discAmt.toFixed(2)}`;
        return `−$${discAmt.toFixed(2)}${applyLbl}`;
      }
      if (ruleType === "SURCHARGE") {
        const surAmt   = parseFloat(String(m.surchargeAmount ?? 0));
        const applyLbl = m.surchargeBaseEstimated && baseLabel
          ? baseLabel.replace(")", " estimado)") : baseLabel;
        // Formato unificado: "Base: $X × Y% = +$Z"
        if (valueType === "PERCENTAGE" && m.surchargeBase != null)
          return `Base: $${parseFloat(String(m.surchargeBase)).toFixed(2)}${applyLbl} × ${m.value}% = +$${surAmt.toFixed(2)}`;
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
        if (cid) return `${cid} ${n2(orig)} × ${n2(rate)}`;
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
          <div className="text-[10px] text-muted/55 mt-0.5 font-mono tracking-tight">
            {formula
              ? formula.split("\n").map((line, li) => <div key={li}>{line}</div>)
              : msg}
          </div>
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
      "grid grid-cols-[1fr_auto] items-center gap-x-4 px-4",
      highlight
        ? "py-2.5 border-t-2 border-primary/20 bg-primary/5"
        : "py-2 border-t border-border/40",
    )}>
      <span className={cn(
        highlight ? "text-sm font-bold text-text" : "text-xs font-semibold text-muted",
      )}>{label}</span>
      <span className={cn(
        "tabular-nums text-right",
        highlight ? "text-base font-extrabold text-primary" : "text-xs font-bold text-text",
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
  quantity = 1,
  paymentMethodName,
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
  /** Cantidad seleccionada — usada para convertir totales × qty del checkout a unitario. */
  quantity?: number;
  /** Nombre del medio de pago seleccionado (para etiquetar la línea de forma de pago). */
  paymentMethodName?: string;
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
  // Cupón ya no se renderiza en "Ajustes comerciales" — vive en el cierre unificado.
  // hasAdjBlock se basa solo en ajustes del MOTOR (qty / promo / regla cliente).
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
          sin merma: {fm(baseCost)} · merma {merma.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%: +{fm(mermaCost)}
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
                Tasa: 1 {cid} = {sym}{rate.toFixed(2)}
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
        // Línea 1 del StepRow = nombre del metal padre ("Oro", "Plata"…)
        // La fórmula (línea 2+) muestra código + nombre variante + cálculo
        const metaMetalName = step.meta?.metalName ? String(step.meta.metalName) : null;
        labelOverride = metaMetalName ?? metalVariantLabel(metalCostLines[metalLineIdx]?.metalVariant);
        metalLineIdx++;
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
      } else if (step.key === "COST_LINES_LOGISTICS") {
        // Para envío: usar el step.label completo del backend (incluye variante: fijo/peso/gratis · simulación)
        const isGeneric = !step.label || step.label.startsWith("Línea de costo");
        labelOverride = isGeneric ? "Envío" : step.label;
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
        if (gramsOriginal != null && gramsFineEquivalent != null) {
          const f2 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          // Pureza efectiva = gramsFineEquivalent / gramsOriginal
          // Incluye merma cuando aplica (p.ej. 0,750 × 1,10 = 0,825)
          const effectivePurity = gramsOriginal > 0 ? gramsFineEquivalent / gramsOriginal : (purity ?? null);
          rows.push(
            <div key={`purity-${i}`} className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-3 pb-1.5 text-[10px] opacity-55">
              <span />
              <span className="text-muted font-mono">
                {f2(gramsOriginal)} g × {effectivePurity != null ? f2(effectivePurity) : "?"} = {f2(gramsFineEquivalent)} g fino
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
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted flex-1">Subtotal</span>
            <ChevronDown size={14} className={cn("text-muted shrink-0 transition-transform", priceOpen && "rotate-180")} />
          </button>

          {/* Costo base de referencia — punto de partida del cálculo de precio */}
          {priceOpen && data.unitCost != null && (
            <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2 text-xs border-t border-border/20 bg-surface2/20">
              <span />
              <span className="text-muted">Costo sin imp.</span>
              <span className="tabular-nums text-muted text-right">{fm(parseFloat(data.unitCost))}</span>
            </div>
          )}

          {priceOpen && basePriceSteps.map((step, i) => {
            // PRICE_LIST + METAL_HECHURA → expandir en Metal / Hechura / Subtotal
            if (step.key === "PRICE_LIST" && step.status === "ok" && data.metalHechuraBreakdown) {
              const mhb = data.metalHechuraBreakdown;
              const baseSumRnd = Math.round((mhb.metalSale + mhb.hechuraSale) * 100) / 100;
              return (
                <React.Fragment key={i}>
                  {mhb.metalSale > 0 && (() => {
                    // Fase 2 — breakdown visual unificado del factor de metal.
                    const effFactorM = mhb.metalCost > 0.0001 ? mhb.metalSale / mhb.metalCost : null;
                    const fbM = buildFactorBreakdown({
                      grossMarginPct: mhb.metalMarginPct,
                      effectiveFactor: effFactorM,
                      costAdjustment: extractCostAdjustmentFromSteps(data.steps),
                    });
                    return (
                    <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2.5 text-xs border-t border-border/20">
                      <ChevronRight size={11} className="text-muted shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-medium text-text">Metal</span>
                        <div className="text-[10px] text-muted/60 font-mono mt-0.5">
                          {mhb.metalGramsBase != null
                            ? <>{(mhb.metalGramsSale ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gr × {fm(mhb.metalPricePerGram ?? 0)}/gr (lista {fbM.grossText ?? `+${mhb.metalMarginPct}%`})</>
                            : <>costo {fm(mhb.metalCost)} × {(1 + mhb.metalMarginPct / 100).toFixed(2)} (lista {fbM.grossText ?? `+${mhb.metalMarginPct}%`})</>
                          }
                        </div>
                        <FactorBreakdownHint
                          hasDivergence={fbM.hasDivergence}
                          compactLine={fbM.compactLine}
                          className="mt-0.5"
                        />
                      </div>
                      <span className="tabular-nums font-bold text-right text-text self-start">{fm(mhb.metalSale)}</span>
                    </div>
                    );
                  })()}
                  {mhb.hechuraSale > 0 && (() => {
                    // Fase 2 — breakdown visual unificado del factor de hechura.
                    // Cuando hay ajuste global de costo, separa: lista bruta · ajuste · efectivo.
                    const effFactor = mhb.hechuraCost > 0.0001 ? mhb.hechuraSale / mhb.hechuraCost : null;
                    const fb = buildFactorBreakdown({
                      grossMarginPct: mhb.hechuraMarginPct,
                      effectiveFactor: effFactor,
                      costAdjustment: extractCostAdjustmentFromSteps(data.steps),
                    });
                    return (
                    <div className="grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2.5 text-xs border-t border-border/20">
                      <ChevronRight size={11} className="text-muted shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-medium text-text">Hechura / Mano de obra</span>
                        <div className="text-[10px] text-muted/60 font-mono mt-0.5">
                          costo {fm(mhb.hechuraCost)} × {(1 + mhb.hechuraMarginPct / 100).toFixed(2)} (lista {fb.grossText ?? `+${mhb.hechuraMarginPct}%`})
                        </div>
                        <FactorBreakdownHint
                          hasDivergence={fb.hasDivergence}
                          compactLine={fb.compactLine}
                          className="mt-0.5"
                        />
                      </div>
                      <span className="tabular-nums font-bold text-right text-text self-start">{fm(mhb.hechuraSale)}</span>
                    </div>
                    );
                  })()}
                  {/* Subtotal — solo cuando hay ambos componentes (si solo hay uno, repite el mismo valor) */}
                  {mhb.metalSale > 0 && mhb.hechuraSale > 0 && (
                    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2 border-t border-border/40">
                      <span className="text-xs font-bold text-text">Subtotal</span>
                      <span className="tabular-nums text-right text-sm font-bold text-text">{fm(baseSumRnd)}</span>
                    </div>
                  )}
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
                  <div className="mt-1.5 pt-1.5 border-t border-border/25 pl-[19px] text-[10px] italic text-muted/65">
                    El redondeo por comprobante no aplica acá; se aplica solo al total del documento de venta.
                  </div>
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
                // Convención de color: descuentos = rojo / recargos = verde (perspectiva del vendedor)
                if (step.key === "ENTITY_COMMERCIAL_RULE") {
                  const m = step.meta ?? {};
                  const ruleType   = String(m.ruleType ?? "");
                  const isDiscount = ruleType === "DISCOUNT" || ruleType === "BONUS";
                  const isSurcharge = ruleType === "SURCHARGE";
                  const amt     = step.value != null ? parseFloat(step.value) : null;
                  const formula = stepFormula(step);
                  const isEstimated = !!(m.discountBaseEstimated || m.surchargeBaseEstimated);
                  const isZeroImpact = amt != null && Math.abs(amt) < 0.005;
                  const colorClass = isZeroImpact
                    ? "text-muted"
                    : isDiscount
                      ? "text-red-500 dark:text-red-400"
                      : isSurcharge
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-text";
                  // Etiqueta enriquecida: "Regla cliente: <step.label> (-X%)"
                  const valueType = String(m.valueType ?? "");
                  const pctLabel = valueType === "PERCENTAGE" && m.value != null
                    ? `(${isDiscount ? "-" : "+"}${m.value}%)`
                    : null;
                  return (
                    <div key={`adj-${i}`} className={cn(
                      "grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2.5 text-xs border-t border-border/20",
                      isDiscount  && !isZeroImpact && "bg-red-500/5",
                      isSurcharge && !isZeroImpact && "bg-emerald-500/5",
                      isZeroImpact && "opacity-40",
                    )}>
                      <StepStatusIcon status={step.status} />
                      <div className="min-w-0">
                        <span className={cn("font-medium", colorClass)}>
                          Regla cliente · {step.label}
                          {pctLabel && (
                            <span className="ml-1 text-[10px] text-muted/70 font-mono">{pctLabel}</span>
                          )}
                        </span>
                        {formula && (
                          <div className="text-[10px] text-muted/55 mt-0.5 font-mono tracking-tight">{formula}</div>
                        )}
                        {isEstimated && (
                          <div className="mt-0.5 text-[10px] text-muted/40 italic">Base estimada según composición del artículo</div>
                        )}
                        {isZeroImpact && (
                          <div className="text-[10px] text-muted/40 mt-0.5 italic">Sin impacto en este precio</div>
                        )}
                      </div>
                      <div className={cn("tabular-nums font-bold text-right self-start", colorClass)}>
                        {amt != null ? (isDiscount ? `−${fm(amt)}` : `+${fm(amt)}`) : "—"}
                      </div>
                    </div>
                  );
                }

                // PROMOTION / QUANTITY_DISCOUNT — etiqueta enriquecida con origen + porcentaje
                if (step.key === "PROMOTION" || step.key === "QUANTITY_DISCOUNT") {
                  const isWinner = step.status === "ok" && step.value != null;
                  const isLoser  = step.status === "skipped" && (step.meta?.competing as boolean);
                  const competingVal = isLoser && step.meta?.competingResult != null
                    ? parseFloat(String(step.meta.competingResult)) : null;
                  const finalVal = step.value != null ? parseFloat(step.value) : null;
                  const formula  = stepFormula(step);
                  const m = step.meta ?? {};
                  const discAmt = m.discountAmount != null ? parseFloat(String(m.discountAmount)) : null;
                  // Zero-impact: regla aplica pero no descuenta nada (transparencia visual)
                  const isZeroImpact = isWinner && discAmt != null && Math.abs(discAmt) < 0.005;

                  // Componer etiqueta humana: "Tipo: Nombre (-X%)"
                  const SCOPE_NAME: Record<string, string> = {
                    ARTICLE: "artículo", VARIANT: "variante", CATEGORY: "categoría",
                    BRAND:   "marca",    GROUP:   "grupo",    GENERAL:  "general", ALL: "todos",
                  };
                  const pctLabel = m.type === "PERCENTAGE" && m.value != null
                    ? `(-${m.value}%)`
                    : m.type === "FIXED" && m.value != null
                      ? `(-${fm(parseFloat(String(m.value)))})`
                      : null;
                  let title: string;
                  if (step.key === "QUANTITY_DISCOUNT") {
                    const scopeLbl = m.scopeLabel ? String(m.scopeLabel)
                      : m.scopeType ? (SCOPE_NAME[String(m.scopeType)] ?? String(m.scopeType).toLowerCase())
                      : null;
                    title = scopeLbl
                      ? `Desc. por cantidad · ${scopeLbl}`
                      : "Desc. por cantidad";
                  } else {
                    // PROMOTION: step.label ya viene como "Promoción: <name>"; agregar scope si no es ALL
                    const scope = m.scope ? String(m.scope) : null;
                    const scopeSuffix = scope && scope !== "ALL" ? ` · ${SCOPE_NAME[scope] ?? scope.toLowerCase()}` : "";
                    title = `${step.label}${scopeSuffix}`;
                  }

                  return (
                    <div key={`adj-${i}`} className={cn(
                      "grid grid-cols-[16px_1fr_auto] gap-x-2 px-4 py-2.5 text-xs border-t border-border/20",
                      isWinner && !isZeroImpact && "bg-emerald-500/5",
                      isLoser  && "opacity-50",
                      isZeroImpact && "opacity-40",
                    )}>
                      <StepStatusIcon status={step.status} />
                      <div className="min-w-0">
                        <span className={cn(
                          "font-medium",
                          isZeroImpact ? "text-muted"
                          : isWinner   ? "text-red-500 dark:text-red-400"
                          :              "text-text",
                        )}>
                          {title}
                          {pctLabel && (
                            <span className="ml-1 text-[10px] text-muted/70 font-mono">{pctLabel}</span>
                          )}
                        </span>
                        {formula && (
                          <div className="text-[10px] text-muted/55 mt-0.5 font-mono tracking-tight">{formula}</div>
                        )}
                        {isZeroImpact && (
                          <div className="text-[10px] text-muted/40 mt-0.5 italic">Sin impacto en este precio</div>
                        )}
                      </div>
                      <div className={cn(
                        "tabular-nums font-bold text-right self-start",
                        isZeroImpact      ? "text-muted/40"
                        : isWinner        ? "text-red-500 dark:text-red-400"
                        : isLoser         ? "line-through text-muted/50"
                        :                   "text-muted/50",
                      )}>
                        {competingVal != null ? fm(competingVal) : finalVal != null ? fm(finalVal) : "—"}
                      </div>
                    </div>
                  );
                }

                return <StepRow key={`adj-${i}`} step={step} sym={sym} rate={dispRate} dsym={dsym} />;
              })}
              {/* Cupón removido de "Ajustes comerciales": ahora vive solo en el cierre unificado
                  (Total producto → Cupón → Canal → Pago → Envío → Total a pagar). Esto elimina
                  duplicación con el cierre y mantiene el bloque "Ajustes comerciales" para
                  ajustes del MOTOR (qty / promo / regla cliente). */}
            </>
          )}

          {/* — BLOQUE 3: Impuestos (si hay impuestos o entidad exenta) — */}
          {showTaxBlock && (
            <>
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/15 border-y border-border/30">
                <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-muted/40 text-[9px] font-bold text-muted shrink-0 tabular-nums">{bn4}</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Impuestos</span>
              </div>

              {data.taxExemptByEntity ? (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/10 border-b border-border/20">
                  <svg className="w-3.5 h-3.5 shrink-0 text-muted" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5Zm0 6.5a.875.875 0 1 1 0-1.75A.875.875 0 0 1 8 11Z"/>
                  </svg>
                  <span className="text-xs text-muted">Sin impuestos — cliente exento.</span>
                </div>
              ) : (
                (data.taxBreakdown ?? []).map((t, i) => {
                  const applyLblBase = TAX_APPLY_ON_LABELS[t.applyOn] ?? t.applyOn;
                  const applyLbl = t.baseEstimated ? `${applyLblBase} estimado` : applyLblBase;
                  const base  = t.base;
                  const rate  = t.rate;
                  const fixed = t.fixedAmount;
                  // Formato unificado "Base: $X × Y% = +$Z" (Venta = bloque resultado del simulador)
                  let formula: string | null = null;
                  if (t.calculationType === "PERCENTAGE" && rate != null) {
                    formula = `Base: ${fm(base)} × ${rate}% = +${fm(t.taxAmount)}`;
                  } else if (t.calculationType === "FIXED_AMOUNT") {
                    formula = `Monto fijo = +${fm(t.taxAmount)}`;
                  } else if (t.calculationType === "PERCENTAGE_PLUS_FIXED" && rate != null && fixed != null) {
                    formula = `Base: ${fm(base)} × ${rate}% + ${fm(fixed)} = +${fm(t.taxAmount)}`;
                  }
                  // Etiqueta con tipo y % en el nombre, contexto Venta
                  const taxTitle = t.calculationType === "PERCENTAGE" && rate != null
                    ? `${t.name} ${rate}% (Venta)`
                    : `${t.name} (Venta)`;
                  return (
                    <div key={i} className="px-4 py-2.5 text-xs border-b border-border/20 bg-muted/5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="font-medium text-muted">{taxTitle}</span>
                          <span className="ml-1.5 text-[10px] text-muted/55">({applyLbl})</span>
                        </div>
                        <span className="tabular-nums font-semibold text-right shrink-0 text-muted">
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

          {/* Subtotales del bloque resultado — solo cuando los impuestos producen una transformación real
              (regla: si el subtotal === valor anterior visible, no renderizar) */}
          {(() => {
            const taxesAddValue = data.taxAmount != null && parseFloat(data.taxAmount) > 0.005;
            if (!hasTaxes || !taxesAddValue) return null;
            return (
              <>
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2 border-b border-border/25">
                  <span className="text-xs font-medium text-muted">Precio sin impuestos</span>
                  <span className="tabular-nums text-right text-sm font-bold text-text">
                    {data.unitPrice != null ? fm(parseFloat(data.unitPrice)) : "—"}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2 border-b border-border/25">
                  <span className="text-xs font-medium text-muted">Impuestos de venta</span>
                  <span className="tabular-nums text-right text-sm font-semibold text-muted">
                    +{fm(parseFloat(data.taxAmount!))}
                  </span>
                </div>
              </>
            );
          })()}

          {/* ── CIERRE UNIFICADO — misma fórmula en breakdown principal, DESGLOSADO y card HECHURA ──
              Orden obligatorio:
                1. Total producto (post impuestos, sin canal/cupón/pago/envío)
                2. Cupón (si aplica)
                3. Canal (si aplica)
                4. Forma de pago / recargo (si aplica)
                5. Total con pago (solo cuando además hay envío, como subtotal intermedio)
                6. Envío (si aplica)
                7. Total a pagar
              SSOT: amounts del backend (couponResult, channelResult, checkoutResult, shippingResult). */}
          {(() => {
            const isExempt  = clientCtx === "EXEMPT";
            const netPrice  = data.unitPrice != null ? parseFloat(data.unitPrice) : null;
            const taxesAddValue = data.taxAmount != null && parseFloat(data.taxAmount) > 0.005;
            // Total producto = totalWithTax (sin canal, sin cupón, sin pago, sin envío)
            const productTotal = (!isExempt && hasTaxes && taxesAddValue && totalFinal != null) ? totalFinal : netPrice;

            // Cupón / Canal / Pago / Envío — directo del backend (SSOT)
            const channelAmt    = data.channelResult?.channelAmount ?? 0;
            const couponDiscAmt = data.couponResult?.applied ? (data.couponResult.discountAmount ?? 0) : 0;
            const cr           = data.checkoutResult;
            const qtyForPay    = Math.max(quantity ?? 1, 1);
            const hasPay       = cr != null && cr.paymentAdjustment !== 0;
            const payAdjUnit   = hasPay ? cr!.paymentAdjustment / qtyForPay : 0;
            const ship         = data.shippingResult;
            const hasShipping  = !!ship;
            const shipAmt      = ship?.amount ?? 0;

            // Total con pago = producto + canal − cupón + pago. Si hay checkoutResult, el backend
            // ya armó cr.finalAmount/qty con esos componentes (SSOT).
            const productConPago = hasPay && cr != null
              ? cr.finalAmount / qtyForPay
              : (productTotal != null ? productTotal + channelAmt - couponDiscAmt : null);

            // Total a pagar = (producto + canal − cupón + pago) + envío
            const grandTotal = productConPago != null
              ? productConPago + shipAmt
              : null;

            const productLabel = (!isExempt && hasTaxes && taxesAddValue) ? "Total producto" : "Precio sin impuestos";
            const couponLabel  = data.couponResult?.couponCode ? `Cupón ${data.couponResult.couponCode}` : "Cupón";
            const channelLabel = data.channelResult?.channelName ?? "Canal";
            const payName      = paymentMethodName ?? "Forma de pago";
            const isPayRecarg  = payAdjUnit > 0;
            const isChRecarg   = channelAmt > 0;
            // Mostrar "Total con pago" como subtotal intermedio solo si hay también envío (sino redunda con Total a pagar)
            const showTotalConPago = hasPay && hasShipping;
            // Mostrar "Total a pagar" como cierre destacado cuando hay cualquier ajuste post-producto
            const hasAnyPostProductAdj = couponDiscAmt > 0.005 || Math.abs(channelAmt) > 0.005 || hasPay || hasShipping;

            return (
              <>
                {/* 1. Total producto (puro) */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2.5 bg-primary/5 border-t-2 border-primary/20">
                  <div>
                    <span className="text-sm font-bold text-text">{productLabel}</span>
                    {!hasTaxes && !isExempt && !hasAnyPostProductAdj && (
                      <div className="text-[10px] text-muted/50 mt-0.5 italic">sin impuestos de venta</div>
                    )}
                  </div>
                  <span className="tabular-nums text-right text-sm font-bold text-text">
                    {productTotal != null ? fm(productTotal) : "—"}
                  </span>
                </div>

                {/* 2. Cupón */}
                {couponDiscAmt > 0.005 && (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 text-sm border-t border-border/30 pt-1 mt-1">
                    <span className="text-red-500 dark:text-red-400">{couponLabel}</span>
                    <span className="tabular-nums text-right font-semibold text-red-500 dark:text-red-400">−{fm(couponDiscAmt)}</span>
                  </div>
                )}

                {/* 3. Canal */}
                {Math.abs(channelAmt) > 0.005 && (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 text-sm border-t border-border/30 pt-1 mt-1">
                    <span className={cn(isChRecarg ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {channelLabel} {isChRecarg ? "(recargo)" : "(descuento)"}
                    </span>
                    <span className={cn("tabular-nums text-right font-semibold", isChRecarg ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {channelAmt > 0 ? "+" : ""}{fm(channelAmt)}
                    </span>
                  </div>
                )}

                {/* 4. Forma de pago / recargo */}
                {hasPay && (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 text-sm border-t border-border/30 pt-1 mt-1">
                    <span className={cn(isPayRecarg ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {payName} {isPayRecarg ? "(recargo)" : "(descuento)"}
                    </span>
                    <span className={cn("tabular-nums text-right font-semibold", isPayRecarg ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {payAdjUnit > 0 ? "+" : ""}{fm(payAdjUnit)}
                    </span>
                  </div>
                )}

                {/* 5. Total con pago (subtotal intermedio cuando además hay envío) */}
                {showTotalConPago && (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-1.5 border-t border-border/30">
                    <span className="text-xs font-semibold text-muted">Total con pago</span>
                    <span className="tabular-nums text-right text-sm font-bold text-text">
                      {productConPago != null ? fm(productConPago) : "—"}
                    </span>
                  </div>
                )}

                {/* 6. Envío */}
                {hasShipping && (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 text-sm text-muted border-t border-border/30 pt-1 mt-1">
                    <span>{ship!.label}</span>
                    <span className="tabular-nums text-right">+{fm(shipAmt)}</span>
                  </div>
                )}

                {/* 7. Total a pagar (cierre destacado) — único valor protagonista */}
                {hasAnyPostProductAdj && grandTotal != null && (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 mx-4 mt-1 px-2 py-1 rounded bg-primary/5 border-t-2 border-primary/20">
                    <span className="text-base font-extrabold text-text">Total a pagar</span>
                    <span className="tabular-nums text-right text-base font-extrabold text-primary">
                      {fm(grandTotal)}
                    </span>
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
              {hasTaxes ? "Con impuestos" : "Sin impuestos"}
            </p>
            <p className="text-lg font-bold tabular-nums truncate text-primary">
              {precioFinal != null ? fm(precioFinal) : "—"}
            </p>
            {hasTaxes && data.unitPrice != null && (
              <p className="text-[10px] text-muted mt-0.5 tabular-nums truncate">Sin imp.: {fm(parseFloat(data.unitPrice))}</p>
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
            // Snapshot del backend con desglose post-descuento por componente
            // (puede ser null cuando la lista no es METAL_HECHURA o cuando el
            // motor no tiene desglose disponible). Cuando está, es la fuente
            // de verdad — el frontend solo renderiza, NO recalcula.
            const csb = data.componentSaleBreakdown ?? null;
            const csbMetal   = csb?.metal   ?? null;
            const csbHechura = csb?.hechura ?? null;
            // Valor visible por componente: final post-descuento si el backend
            // lo expone; pre-descuento (heredado) si no.
            const metalShown   = csbMetal?.final   ?? mhb.metalSale;
            const hechuraShown = csbHechura?.final ?? mhb.hechuraSale;
            // baseSum: suma de precios de venta por componente (post-descuento
            // cuando el snapshot lo expone, pre-descuento si no).
            const baseSum  = metalShown + hechuraShown;
            // netPrice: precio final tras todos los descuentos (incluido cualquier
            // ajuste TOTAL que NO se rola por componente).
            const netPrice = data.unitPrice != null ? parseFloat(data.unitPrice) : null;
            // Redondear a 2 decimales antes de comparar para evitar ruido de punto flotante
            const baseSumRnd  = Math.round(baseSum  * 100) / 100;
            const netPriceRnd = netPrice != null ? Math.round(netPrice * 100) / 100 : null;
            // adjustment: diferencia residual entre la suma de los componentes
            // (post sus propios descuentos) y el precio neto. Solo aparece si
            // hay un descuento a nivel TOTAL que no se imputó a un componente.
            //   < 0 → bonificación o descuento global
            //   > 0 → recargo global
            const adjustment    = netPriceRnd != null ? netPriceRnd - baseSumRnd : 0;
            const hasAdjustment = Math.abs(adjustment) >= 0.01;
            const adjPct        = baseSum > 0 && hasAdjustment ? (adjustment / baseSum * 100) : 0;
            const adjLabel      = adjustment < 0
              ? (hasPromotion ? "Promoción" : "Bonificación")
              : "Recargo";

            return (
              <>
                {/* ─ 1. METAL ─────────────────────────────────────────── */}
                {mhb.metalSale > 0 && (() => {
                  // Fase 2 — breakdown visual unificado del factor de metal.
                  const effFactorDM = mhb.metalCost > 0.0001 ? mhb.metalSale / mhb.metalCost : null;
                  const fbDM = buildFactorBreakdown({
                    grossMarginPct: mhb.metalMarginPct,
                    effectiveFactor: effFactorDM,
                    costAdjustment: extractCostAdjustmentFromSteps(data.steps),
                  });
                  return (
                  <div className="px-3 py-2.5">
                    <div className="flex justify-between tabular-nums">
                      <span className="text-xs font-semibold text-text">Metal</span>
                      <span className="text-xs font-bold text-text">{fm(metalShown)}</span>
                    </div>
                    <div className="text-[10px] text-muted/60 font-mono mt-0.5">
                      {mhb.metalGramsBase != null
                        ? <>{(mhb.metalGramsSale ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gr × {fm(mhb.metalPricePerGram ?? 0)}/gr (lista {fbDM.grossText ?? `+${mhb.metalMarginPct}%`})</>
                        : <>costo {fm(mhb.metalCost)} × {(1 + mhb.metalMarginPct / 100).toFixed(2)} (lista {fbDM.grossText ?? `+${mhb.metalMarginPct}%`})</>
                      }
                    </div>
                    <FactorBreakdownHint
                      hasDivergence={fbDM.hasDivergence}
                      compactLine={fbDM.compactLine}
                      className="mt-0.5"
                    />
                    {/* Ajustes post-margen imputados al METAL — render directo del snapshot. */}
                    {csbMetal && csbMetal.adjustments.length > 0 && (
                      <div className="mt-1.5 space-y-0.5 border-t border-border/30 pt-1">
                        <div className="flex justify-between tabular-nums text-[10px] text-muted">
                          <span>Subtotal metal</span>
                          <span>{fm(csbMetal.base)}</span>
                        </div>
                        {csbMetal.adjustments.map((adj, i) => (
                          <div key={`m-adj-${adj.kind}-${i}`} className={cn(
                            "flex justify-between tabular-nums text-[10px]",
                            adj.amount > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          )}>
                            <span>{resolveAdjustmentLabel(adj)}</span>
                            <span>{adj.amount > 0 ? "−" : "+"}{fm(Math.abs(adj.amount))}</span>
                          </div>
                        ))}
                        <div className="flex justify-between tabular-nums text-[10px] font-semibold text-text">
                          <span>Metal final</span>
                          <span>{fm(csbMetal.final)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* ─ 2. HECHURA ───────────────────────────────────────── */}
                {mhb.hechuraSale > 0 && (() => {
                  // Fase 2 — breakdown visual unificado del factor de hechura.
                  const effFactorDH = mhb.hechuraCost > 0.0001 ? mhb.hechuraSale / mhb.hechuraCost : null;
                  const fbDH = buildFactorBreakdown({
                    grossMarginPct: mhb.hechuraMarginPct,
                    effectiveFactor: effFactorDH,
                    costAdjustment: extractCostAdjustmentFromSteps(data.steps),
                  });
                  return (
                  <div className="px-3 py-2.5">
                    <div className="flex justify-between tabular-nums">
                      <span className="text-xs font-semibold text-text">Hechura / Mano de obra</span>
                      <span className="text-xs font-bold text-text">{fm(hechuraShown)}</span>
                    </div>
                    <div className="text-[10px] text-muted/60 font-mono mt-0.5">
                      costo {fm(mhb.hechuraCost)} × {(1 + mhb.hechuraMarginPct / 100).toFixed(2)} (lista {fbDH.grossText ?? `+${mhb.hechuraMarginPct}%`})
                    </div>
                    <FactorBreakdownHint
                      hasDivergence={fbDH.hasDivergence}
                      compactLine={fbDH.compactLine}
                      className="mt-0.5"
                    />
                    {/* Ajustes post-margen imputados a HECHURA — render directo del
                        snapshot del backend (componentSaleBreakdown). Cada ajuste
                        fue aplicado por el motor con applyOn=HECHURA. */}
                    {csbHechura && csbHechura.adjustments.length > 0 && (
                      <div className="mt-1.5 space-y-0.5 border-t border-border/30 pt-1">
                        <div className="flex justify-between tabular-nums text-[10px] text-muted">
                          <span>Subtotal hechura</span>
                          <span>{fm(csbHechura.base)}</span>
                        </div>
                        {csbHechura.adjustments.map((adj, i) => (
                          <div key={`h-adj-${adj.kind}-${i}`} className={cn(
                            "flex justify-between tabular-nums text-[10px]",
                            adj.amount > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          )}>
                            <span>{resolveAdjustmentLabel(adj)}</span>
                            <span>{adj.amount > 0 ? "−" : "+"}{fm(Math.abs(adj.amount))}</span>
                          </div>
                        ))}
                        <div className="flex justify-between tabular-nums text-[10px] font-semibold text-text">
                          <span>Hechura final</span>
                          <span>{fm(csbHechura.final)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* ─ 3. SUBTOTAL ────────────────────────────────── */}
                <div className="flex justify-between items-center px-3 py-2 bg-muted/5 text-xs border-t-2 border-border/40">
                  <span className="text-muted font-semibold">Subtotal</span>
                  <span className="tabular-nums font-bold text-text">{fm(baseSumRnd)}</span>
                </div>

                {/* ─ 4. BONIFICACIÓN / RECARGO RESIDUAL (solo nivel TOTAL).
                    Cuando el snapshot por componente está disponible, los
                    descuentos METAL/HECHURA ya fueron imputados arriba; sólo
                    aparece acá la diferencia que no rola por componente
                    (descuentos applyOn=TOTAL, redondeos, etc.). */}
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
                    <span className="text-muted font-semibold">Precio sin impuestos</span>
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
                    <span className="tabular-nums font-medium text-muted">
                      +{fm(t.amount)}
                    </span>
                  </div>
                ))}

                {/* ─ 7. TOTAL FINAL ────────────────────────────────────── */}
                <div className="px-3 py-3 bg-primary/5 border-t-2 border-primary/20">
                  <div className="flex justify-between items-center tabular-nums">
                    <span className="text-xs font-semibold text-muted">
                      {hasTaxes ? "Total con impuestos" : "Sin impuestos"}
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
                  <span className="text-muted">{hasTaxes ? "Total con impuestos" : "Sin impuestos"}</span>
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

  // Canal de venta
  const [salesChannels,  setSalesChannels]  = useState<SalesChannelRow[]>([]);
  const [channelId,      setChannelId]      = useState<string>("");

  // Cupón
  const [couponCode,       setCouponCode]       = useState<string>("");
  const [couponApplied,    setCouponApplied]    = useState<string>("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError,      setCouponError]      = useState<string | null>(null);

  // Descuentos por cantidad
  const [quantityDiscounts,    setQuantityDiscounts]    = useState<QuantityDiscountRow[]>([]);
  const [selectedDiscountIds,  setSelectedDiscountIds]  = useState<string[]>([]);

  // Método de entrega — usa los carriers reales del sistema. La traducción a
  // shippingMode/Value/Weight (protocolo interno del motor) se hace en un useMemo.
  const [shippingCarriers, setShippingCarriers] = useState<ShippingCarrierRow[]>([]);
  const [shippingCarrierId, setShippingCarrierId] = useState<string>("");
  // Tarifa elegida manualmente cuando el carrier tiene más de una activa.
  // Vacío = usar la primera activa por defecto (compatibilidad con comportamiento previo).
  const [shippingRateId, setShippingRateId] = useState<string>("");

  // Vendedor
  const [sellers,   setSellers]   = useState<SellerRow[]>([]);
  const [sellerId,  setSellerId]  = useState<string>("");

  // Simulación
  const [priceLists,     setPriceLists]     = useState<PriceListRow[]>([]);
  const [currencies,     setCurrencies]     = useState<CurrencyRow[]>([]);
  const [clientMermaOverrides, setClientMermaOverrides] = useState<EntityMermaOverride[]>([]);
  const [simPriceListId, setSimPriceListId] = useState<string>("");
  const [simCurrencyId,  setSimCurrencyId]  = useState<string>("");
  const [simViewMode,    setSimViewMode]    = useState<"UNIFICADO" | "DESGLOSADO">("DESGLOSADO");
  // "source" rastrea de dónde vino cada valor:
  //   "system"   → valor por defecto del sistema, sin tocar
  //   "default"  → cargado desde localStorage (favorita); el cliente puede pisarlo
  //   "client"   → heredado del cliente seleccionado
  //   "manual"   → el usuario lo cambió explícitamente en esta sesión
  const [simCurrencySource,  setSimCurrencySource]  = useState<"system" | "default" | "client" | "manual">("system");
  const [simViewModeSource,  setSimViewModeSource]  = useState<"system" | "default" | "client" | "manual">("system");

  const SIM_DEFAULTS_KEY = "tptech_sim_defaults_v1";
  const [simDefaults, setSimDefaults] = useState<{ viewMode?: string; priceListId?: string; currencyId?: string }>(() => {
    try { return JSON.parse(localStorage.getItem(SIM_DEFAULTS_KEY) ?? "{}") ?? {}; } catch { return {}; }
  });

  const [simPanelOpen,   setSimPanelOpen]   = useState(false);

  // ── Colapsado de detalle técnico (UI puro, no afecta cálculo) ─────────────
  // Modelo "por sección — 4 flags independientes":
  //  · `costUnitExpanded`         → bloque "Costo unitario" (líneas + impuestos + total + qty)
  //  · `priceCalcExpanded`        → bloque "Cálculo del precio" (precio base + ajustes + cierre)
  //  · `costCompositionExpanded`  → cards de "Composición del costo" (metales + hechura)
  //  · `priceCompositionExpanded` → cards de "Composición del precio" (metales + hechura)
  //
  // ── Estado INICIAL determinístico al montar / cambiar de vista ──
  //  · Vista UNIFICADO  → todo colapsado (vista compacta)
  //  · Vista DESGLOSADO → bloques EXPANDIDOS (sección visible) + cards COLAPSADOS internamente
  //
  // No se persiste en localStorage: cada entrada al simulador arranca con la regla
  // determinística por vista. El usuario puede expandir/colapsar durante la sesión,
  // pero al salir y volver entra al estado por defecto.
  const initialExpansionForView = (view: "UNIFICADO" | "DESGLOSADO") => ({
    costUnit:  view === "DESGLOSADO",
    priceCalc: view === "DESGLOSADO",
    costComp:  false,
    priceComp: false,
  });
  const [costUnitExpanded,         setCostUnitExpanded]         = useState<boolean>(() => initialExpansionForView("DESGLOSADO").costUnit);
  const [priceCalcExpanded,        setPriceCalcExpanded]        = useState<boolean>(() => initialExpansionForView("DESGLOSADO").priceCalc);
  const [costCompositionExpanded,  setCostCompositionExpanded]  = useState<boolean>(false);
  const [priceCompositionExpanded, setPriceCompositionExpanded] = useState<boolean>(false);
  const isPriceCompositionKey = (key: string) => key === "hechura" || key.startsWith("metalPrice");
  const isExpanded = (key: string): boolean => {
    if (key === "costUnit")  return costUnitExpanded;
    if (key === "priceCalc") return priceCalcExpanded;
    if (isPriceCompositionKey(key)) return priceCompositionExpanded;
    return costCompositionExpanded;
  };
  const toggleSection = (key: string) => {
    if (key === "costUnit")              { setCostUnitExpanded(p => !p);         return; }
    if (key === "priceCalc")             { setPriceCalcExpanded(p => !p);        return; }
    if (isPriceCompositionKey(key))      { setPriceCompositionExpanded(p => !p); return; }
                                           setCostCompositionExpanded(p => !p);
  };

  // Reset visual al cambiar de vista — mantiene la regla determinística
  // (UNIFICADO arranca colapsado, DESGLOSADO arranca con secciones visibles
  // pero cards internos colapsados). El usuario puede expandir/colapsar
  // libremente dentro de la sesión, pero al cambiar de vista los estados
  // vuelven al default de esa vista.
  useEffect(() => {
    const s = initialExpansionForView(simViewMode);
    setCostUnitExpanded(s.costUnit);
    setPriceCalcExpanded(s.priceCalc);
    setCostCompositionExpanded(s.costComp);
    setPriceCompositionExpanded(s.priceComp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simViewMode]);


  // ── What-if interactivo ──────────────────────────────────────────────────
  const [whatIfOpen,         setWhatIfOpen]         = useState(false);
  const [whatIfCost,         setWhatIfCost]         = useState<number | null>(null);
  const [whatIfMargin,       setWhatIfMargin]       = useState<number | null>(null);
  const [whatIfPrice,        setWhatIfPrice]        = useState<number | null>(null);
  const [whatIfDiscount,     setWhatIfDiscount]     = useState<number | null>(null);
  const [whatIfDiscountType, setWhatIfDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");

  const whatIfActive = whatIfCost != null || whatIfMargin != null || whatIfPrice != null || whatIfDiscount != null;

  // "activa" solo cuando el usuario tocó algo explícitamente (no cuando el cliente lo heredó)
  const isSimulating = !!(simPriceListId || simCurrencySource === "manual" || simViewModeSource === "manual" || whatIfActive);

  function resetSimulation() {
    setSimPriceListId("");
    // Re-aplicar valores del cliente si hay uno seleccionado; si no, volver a defaults
    if (client) {
      setSimCurrencyId(client.currencyId ?? "");
      setSimCurrencySource("client");
      setSimViewMode(client.balanceType === "UNIFIED" ? "UNIFICADO" : "DESGLOSADO");
      setSimViewModeSource("client");
    } else {
      setSimCurrencyId("");
      setSimCurrencySource("system");
      setSimViewMode("DESGLOSADO");
      setSimViewModeSource("system");
    }
    setWhatIfCost(null);
    setWhatIfMargin(null);
    setWhatIfPrice(null);
    setWhatIfDiscount(null);
    setWhatIfDiscountType("PERCENT");
  }

  function saveSimDefault(field: "viewMode" | "priceListId" | "currencyId", value: string) {
    const next = { ...simDefaults, [field]: value };
    setSimDefaults(next);
    localStorage.setItem(SIM_DEFAULTS_KEY, JSON.stringify(next));
    // Guardar un default es solo persistencia para futuras sesiones; no cambia la fuente actual
  }

  // Aplicar defaults de localStorage al montar — source "default" para que el cliente los pueda pisar
  useEffect(() => {
    const d = simDefaults;
    if (d.viewMode === "UNIFICADO" || d.viewMode === "DESGLOSADO") {
      setSimViewMode(d.viewMode);
      setSimViewModeSource("default");
    }
    if (d.priceListId && d.priceListId !== "__CLEAR__") setSimPriceListId(d.priceListId);
    if (d.currencyId && d.currencyId !== "__CLEAR__") {
      setSimCurrencyId(d.currencyId);
      setSimCurrencySource("default");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heredar configuraciones del cliente al seleccionarlo o cambiarlo
  // Prioridad: manual > cliente > favorita (default) > sistema
  useEffect(() => {
    if (!client) {
      // Cliente deseleccionado: revertir campos no-manuales a favorito guardado o sistema
      if (simCurrencySource !== "manual") { setSimCurrencyId(""); setSimCurrencySource("system"); }
      if (simViewModeSource !== "manual") {
        const defMode = simDefaults.viewMode;
        setSimViewMode(defMode === "UNIFICADO" ? "UNIFICADO" : "DESGLOSADO");
        setSimViewModeSource(defMode ? "default" : "system");
      }
      setClientMermaOverrides([]);
      return;
    }
    // El cliente siempre pisa "system" y "default"; nunca pisa "manual"
    if (simCurrencySource !== "manual") { setSimCurrencyId(client.currencyId ?? ""); setSimCurrencySource("client"); }
    if (simViewModeSource !== "manual")  { setSimViewMode(client.balanceType === "UNIFIED" ? "UNIFICADO" : "DESGLOSADO"); setSimViewModeSource("client"); }
    // Cargar merma overrides del cliente
    commercialEntitiesExtApi.merma.list(client.id)
      .then(list => setClientMermaOverrides(list.filter(o => o.isActive)))
      .catch(() => setClientMermaOverrides([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

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

  // Fase 2.1 — resultado normalizado, derivado del raw. Misma fuente, otro
  // shape. Lo usamos en los lugares donde el contrato unificado YA cubre todo
  // (composition, costo de compra, appliedPriceListName por línea).
  // Los lugares que dependen de `steps`, `metalHechuraBreakdown` completo,
  // `stackingMode` o `costOverrideContext` siguen leyendo `result` raw — el
  // contrato no los expone aún (queda para Fase 2.1.b).
  const normalized = useMemo<NormalizedPricingResult | null>(() => {
    if (!result || !article?.id) return null;
    try {
      return normalizeArticlePricingPreview({
        result,
        articleId: article.id,
        variantId,
        quantity:  quantity ?? 1,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[PricingSimulator] normalize failed — usando raw:", e);
      return null;
    }
  }, [result, article?.id, variantId, quantity]);
  /** Línea normalizada (siempre 0 en Simulador). Fuente unificada para los
   *  lugares migrados a Fase 2.1.b. Si `normalize()` falla (try/catch arriba)
   *  los aliases caen al raw para preservar la UI hasta que se diagnostique. */
  const normLine = normalized?.lines?.[0] ?? null;

  // ── Fase 2.1.b — aliases unificados con fallback al raw ────────────────
  // Cada acceso a `stepsNorm`, `metalHechuraBreakdownNorm`,
  // `stackingModeNorm`, `costOverrideContextNorm` y
  // `result.checkoutResult.steps` se reemplazó por estas variables. El
  // fallback `?? result?.X` cubre el caso degenerado en que el normalizador
  // falla; cuando se elimine ese fallback, basta con borrar el `?? result?.X`.
  // `steps` y `stackingMode` viven a nivel `NormalizedPricingResult` (1 set
  // por preview); `metalHechuraBreakdown` y `costOverrideContext` son por
  // línea. Tipado `any` deliberado: el shape del raw y del normalizado es
  // estructuralmente compatible en los call-sites, no vale la pena duplicar
  // unions en cada uso.
  const stepsNorm: any[]               = normalized?.steps               ?? result?.steps                  ?? [];
  const metalHechuraBreakdownNorm: any = normLine?.metalHechuraBreakdown  ?? result?.metalHechuraBreakdown  ?? null;
  const stackingModeNorm: string       = normalized?.stackingMode        ?? result?.stackingMode           ?? "NONE";
  const costOverrideContextNorm: any   = normLine?.costOverrideContext   ?? result?.costOverrideContext    ?? null;
  const checkoutStepsNorm: any[]       = normalized?.payment?.steps      ?? result?.checkoutResult?.steps  ?? [];
  void checkoutStepsNorm; // disponible para próximas migraciones de cr.steps.

  // Desglose de costo base + ajuste (solo modo MANUAL sin conversión de moneda)
  const costBreakdown = useMemo(() => {
    if (!result) return null;
    const baseStep = stepsNorm.find(s => s.key === "MANUAL_BASE_COST");
    if (!baseStep || baseStep.status !== "ok" || !baseStep.value || !baseStep.meta?.manualBaseCost) return null;
    // Si hay conversión de moneda no mostramos el desglose (los valores serían en distinta moneda)
    const hasCurrencyConversion = stepsNorm.some(s => s.key === "MANUAL_CURRENCY");
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
    return normLine?.unitTotalWithTax ?? null;
  }, [normLine?.unitTotalWithTax]);

  // precio unitario post-canal+cupón, pre-pago
  // Total per-unit post-canal/cupón con impuestos. Fuente única: backend.
  // El motor expone `documentTotals.totalWithTax` (per-doc, qty-aware) que
  // es subtotalAfterLineDiscounts + canal − cupón + impuestos. Para mostrarlo
  // per-unit en el simulador (1 línea), dividimos entre qty — eso es
  // ESCALADO, no derivación de pricing. Si hay forma de pago, el motor ya
  // emitió `checkoutResult.finalAmount` (per-doc post-pago).
  const grandTotal = useMemo<number | null>(() => {
    if (!result) return null;
    const qty = Math.max(quantity ?? 1, 1);
    if (result.checkoutResult?.finalAmount != null) {
      return result.checkoutResult.finalAmount / qty;
    }
    const dt = (result as any).documentTotals;
    if (dt?.totalWithTax != null) return Number(dt.totalWithTax) / qty;
    return normLine?.unitTotalWithTax ?? normLine?.unitPrice ?? null;
  }, [result, quantity, normLine?.unitTotalWithTax, normLine?.unitPrice]);

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
    // Fase 3 cleanup — leemos del normalizado en vez de parseFloat(raw).
    const precio = hasTaxes
      ? (totalFinal ?? null)
      : (normLine?.unitPrice ?? null);
    if (precio == null || precio <= 0) return null;

    // Valor de metal en precio de venta — passthrough del backend.
    // El motor popula `metalHechuraBreakdown` universalmente con `source` y
    // flags `*Estimated`. Si `metalSale` no viene (source=NONE, datos
    // incompletos), lo dejamos en 0 y el KPI se omite — NO inventamos un
    // proporcional desde el frontend.
    const metalSale = metalHechuraBreakdownNorm && metalHechuraBreakdownNorm.metalSale > 0
      ? metalHechuraBreakdownNorm.metalSale
      : 0;

    const monedaSale = precio - metalSale;
    const metalPct   = metalSale > 0 ? metalSale / precio * 100 : 0;
    const monedaPct  = 100 - metalPct;

    return { precio, metalSale, monedaSale, metalPct, monedaPct };
  }, [result, appliedTaxes, totalFinal]);

  // Alertas — fuente única: `result.alerts` del motor. Las reglas de negocio
  // (margen mínimo, precio < costo, impuestos altos) viven en backend
  // (`evaluatePricingPolicy` + `Jewelry.pricingLowMargin*`). El simulador NO
  // genera alertas locales — sólo muestra las que el motor expone.

  // ── Cálculo what-if (puramente local, no toca el backend) ───────────────
  // What-if simula precios alternativos a partir de los del backend. La
  // resta `price - cost` es propiamente del what-if (el operador modifica
  // valores hipotéticamente), no del pricing real.
  const whatIfResult = useMemo(() => {
    if (!result) return null;
    const origCost  = normLine?.unitCost     ?? null;
    const origPrice = normLine?.unitPrice    ?? null;
    const origGain  = normLine?.unitMargin   ?? (origCost != null && origPrice != null ? origPrice - origCost : null);
    const origMargin = normLine?.marginPercent ?? null;

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

    // Base de cálculo — leído del normalizado (Fase 3 cleanup).
    const unitPrice  = normLine?.unitPrice  ?? null;
    const unitCost   = normLine?.unitCost   ?? null;
    const unitMargin = normLine?.unitMargin
                    ?? (unitPrice != null && unitCost != null ? unitPrice - unitCost : null);
    const gross      = totalFinal ?? unitPrice;

    let base: number | null;
    let baseLabel: string;
    if (commissionBase === "TOTAL") {
      base = gross;
      baseLabel = "total de venta";
    } else if (commissionBase === "TOTAL_AFTER_DISCOUNTS") {
      base = grandTotal ?? gross;
      baseLabel = "total después de descuentos";
    } else if (commissionBase === "TOTAL_AFTER_PAYMENT") {
      // En el simulador usamos el total post-canal+cupón como aproximación
      base = grandTotal ?? gross;
      baseLabel = "total después de forma de pago";
    } else if (commissionBase === "METAL" || commissionBase === "HECHURA" || commissionBase === "METAL_Y_HECHURA" || commissionBase === "HECHURA_AFTER_DISCOUNTS") {
      // Desglose por componente no disponible en simulador — se calcula al confirmar la venta
      base = null;
      baseLabel = commissionBase === "METAL"
        ? "componente metal"
        : commissionBase === "HECHURA"
          ? "componente hechura"
          : commissionBase === "METAL_Y_HECHURA"
            ? "metal + hechura"
            : "hechura después de descuentos";
    } else {
      base = gross;
      baseLabel = "total de venta";
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

  // Carga canales de venta activos
  useEffect(() => {
    salesChannelsApi.list()
      .then(list => setSalesChannels(list.filter((c: SalesChannelRow) => c.isActive && !c.deletedAt)))
      .catch(() => {});
  }, []);

  // Carga métodos de entrega (carriers) activos
  useEffect(() => {
    shippingApi.list()
      .then(list => setShippingCarriers(list.filter(c => c.isActive && !c.deletedAt)))
      .catch(() => {});
  }, []);

  // Traducción método de entrega → protocolo interno del motor (shippingMode/Value/Weight).
  // - PICKUP → siempre $0 (FREE)
  // - DELIVERY: usa el primer rate activo del carrier
  //     · FIXED → mode=FIXED, value=fixedPrice
  //     · BY_WEIGHT → mode=BY_WEIGHT, value=pricePerKg, weight=peso del artículo (kg) o 1 fallback
  //     · BY_ZONE → no aplicable en simulador (sin destino) → $0
  const shippingDerived = useMemo<{
    mode: "" | "FIXED" | "BY_WEIGHT" | "FREE";
    value: number | null;
    weight: number | null;
    detail: string | null;
  }>(() => {
    if (!shippingCarrierId) return { mode: "", value: null, weight: null, detail: null };
    const c = shippingCarriers.find(x => x.id === shippingCarrierId);
    if (!c) return { mode: "", value: null, weight: null, detail: null };
    if (c.type === "PICKUP") {
      return { mode: "FREE", value: null, weight: null, detail: c.warehouse?.name ? `Retiro en ${c.warehouse.name}` : "Retiro en sucursal" };
    }
    // Selección de tarifa:
    //  · Si el usuario eligió una tarifa específica → usarla (matching por id o índice).
    //  · Si no → primera tarifa activa (compatibilidad con comportamiento previo).
    const activeRates = c.rates.filter(r => r.isActive);
    const rate = (shippingRateId
      ? (activeRates.find(r => (r.id ?? "") === shippingRateId)
        ?? activeRates[parseInt(shippingRateId, 10)]
        ?? null)
      : null) ?? activeRates[0] ?? null;
    if (!rate) return { mode: "FREE", value: null, weight: null, detail: "Sin tarifa configurada — se simula como envío gratis" };
    // Etiqueta enriquecida: nombre + zona + provincia (cuando aplica)
    const zoneDesc = [rate.zones?.[0], rate.province].filter(Boolean).join(" · ");
    const rateLabel = zoneDesc ? `${rate.name} — ${zoneDesc}` : rate.name;
    if (rate.calculationMode === "FIXED") {
      const price = rate.fixedPrice != null ? parseFloat(rate.fixedPrice) : 0;
      return { mode: "FIXED", value: price, weight: null, detail: `Tarifa fija ${rateLabel}` };
    }
    if (rate.calculationMode === "BY_WEIGHT") {
      const ppk = rate.pricePerKg != null ? parseFloat(rate.pricePerKg) : 0;
      // Peso del artículo en kg: backend devuelve gramos en variant.weightOverride o article.weight
      const grams = (article as any)?.weight != null ? parseFloat(String((article as any).weight)) : 1000;
      const kg = grams / 1000;
      return { mode: "BY_WEIGHT", value: ppk, weight: kg, detail: `${rateLabel} · ${kg.toFixed(2)} kg × ${ppk.toFixed(2)}/kg` };
    }
    // BY_ZONE no soportado en simulador
    return { mode: "FREE", value: null, weight: null, detail: `${rateLabel} (tarifa zonificada — el simulador no aplica)` };
  }, [shippingCarrierId, shippingRateId, shippingCarriers, article]);

  // Reset de la tarifa seleccionada cuando cambia el carrier (evita arrastrar una tarifa
  // que pertenecía al carrier anterior y ahora podría no existir).
  useEffect(() => { setShippingRateId(""); }, [shippingCarrierId]);

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
  // Indica que la cantidad fue provista explícitamente por URL (no precargamos desde el artículo)
  const urlQuantitySet = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    const artId = searchParams.get("articleId");
    const vid   = searchParams.get("variantId");
    const qty   = searchParams.get("quantity");
    if (!artId) return;
    initDone.current = true;
    if (vid) pendingVariantId.current = vid;
    if (qty) { setQuantity(parseFloat(qty) || 1); urlQuantitySet.current = true; }
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

  // Precarga cantidad inicial cuando cambia el artículo o la variante seleccionada
  // Prioridad: valores de variante → valores del artículo → 1
  const prevQtyKey = useRef<string | null>(null);
  useEffect(() => {
    if (!article) { prevQtyKey.current = null; return; }

    const resolveQty = (min: number | null, max: number | null, def: number | null): number => {
      if (def != null && (min == null || def >= min) && (max == null || def <= max)) return def;
      if (min != null) return min;
      return 1;
    };

    if (variantId) {
      const key = `v:${variantId}`;
      if (prevQtyKey.current === key) return;
      prevQtyKey.current = key;
      if (urlQuantitySet.current) { urlQuantitySet.current = false; return; }
      const selVar = variants.find(v => v.id === variantId);
      // Variante primero, artículo como fallback
      const min = selVar?.minSaleQuantity != null ? parseFloat(selVar.minSaleQuantity)
        : article.minSaleQuantity != null ? parseFloat(String(article.minSaleQuantity)) : null;
      const max = selVar?.maxSaleQuantity != null ? parseFloat(selVar.maxSaleQuantity)
        : article.maxSaleQuantity != null ? parseFloat(String(article.maxSaleQuantity)) : null;
      const def = selVar?.defaultQuantity != null ? parseFloat(selVar.defaultQuantity)
        : article.defaultQuantity != null ? parseFloat(String(article.defaultQuantity)) : null;
      setQuantity(resolveQty(min, max, def));
    } else {
      const key = `a:${article.id}`;
      if (prevQtyKey.current === key) return;
      prevQtyKey.current = key;
      if (urlQuantitySet.current) { urlQuantitySet.current = false; return; }
      const min = article.minSaleQuantity != null ? parseFloat(String(article.minSaleQuantity)) : null;
      const max = article.maxSaleQuantity != null ? parseFloat(String(article.maxSaleQuantity)) : null;
      const def = article.defaultQuantity != null ? parseFloat(String(article.defaultQuantity)) : null;
      setQuantity(resolveQty(min, max, def));
    }
  }, [article, variantId, variants]);

  // Medios de pago seleccionado actual
  const selectedPM = paymentMethods.find(p => p.id === paymentMethodId) ?? null;
  // Planes de cuotas activos del medio seleccionado
  const availablePlans = selectedPM?.installmentPlans?.filter(p => p.isActive) ?? [];

  // Validación de rango de cantidad: variante primero, artículo como fallback
  const selectedVariant = variants.find(v => v.id === variantId) ?? null;
  const qtyMin = selectedVariant?.minSaleQuantity != null ? parseFloat(selectedVariant.minSaleQuantity)
    : article?.minSaleQuantity != null ? parseFloat(String(article.minSaleQuantity)) : null;
  const qtyMax = selectedVariant?.maxSaleQuantity != null ? parseFloat(selectedVariant.maxSaleQuantity)
    : article?.maxSaleQuantity != null ? parseFloat(String(article.maxSaleQuantity)) : null;
  const quantityError: string | null = (() => {
    if (quantity == null) return null;
    if (qtyMin != null && qtyMax != null && (quantity < qtyMin || quantity > qtyMax))
      return `La cantidad debe estar entre ${qtyMin} y ${qtyMax}`;
    if (qtyMin != null && quantity < qtyMin) return `La cantidad mínima es ${qtyMin}`;
    if (qtyMax != null && quantity > qtyMax) return `La cantidad máxima es ${qtyMax}`;
    return null;
  })();

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
    chId?: string,
    cpCode?: string,
    shipMode?: "" | "FIXED" | "BY_WEIGHT" | "FREE",
    shipValue?: number | null,
    shipWeight?: number | null,
    /** Fase MM — si viene poblado, el backend devuelve los importes
     *  convertidos a esta moneda. El simulador NO convierte localmente. */
    currencyIdArg?: string | null,
  ) => {
    if (!art) return;
    setLoading(true);
    setError(null);
    // Debug: traza el inicio del simulate con info clave del artículo.
    // Útil para diagnosticar combos (ver si la request se dispara y con qué params).
    // eslint-disable-next-line no-console
    console.debug("[simulate] →", {
      articleId:      art.id,
      articleName:    art.name,
      articleType:    art.articleType,
      commercialMode: (art as any).commercialMode ?? "(no field)",
      variantId:      vid,
      quantity:       qty,
    });
    try {
      // Fase 2A — armado de payload vía contrato unificado.
      // El response sigue raw porque la UI usa campos que el normalizado aún no
      // expone (steps, composition, metalHechuraBreakdown, cost*). Cuando el
      // contrato se extienda (Fase 2.1) se reemplaza el consumo de `res` por el
      // normalizado y se elimina este TODO.
      const unifiedPayload: PricingPreviewPayload = {
        lines: [{
          articleId: art.id,
          variantId: vid ?? null,
          quantity:  qty ?? 1,
        }],
        clientId:        cli?.id ?? null,
        priceListId:     plOverride || null,
        channelId:       chId || null,
        couponCode:      cpCode || null,
        paymentMethodId: pmId || null,
        installmentsQty: instQty || null,
        // Fase MM — pasar la moneda elegida al backend para que convierta el
        // response en lugar de hacerlo el frontend. Cuando viene poblado, el
        // backend marca `currencyConverted=true` en el response y todos los
        // importes (documentTotals, taxBreakdown, metalHechuraBreakdown,
        // channel/coupon/payment/shipping) llegan ya convertidos. El
        // `displayRate` legacy del simulador queda en 1 → no-op.
        currencyId:      currencyIdArg || null,
        shipping: shipMode
          ? { mode: shipMode, value: shipValue ?? null, weight: shipWeight ?? null }
          : null,
      };
      const previewArgs = toArticlePricingPreviewArgs(unifiedPayload);

      // `quantityDiscountIds` es legacy del endpoint de articles y no está en el
      // contrato unificado todavía. Lo paso como passthrough hasta Fase 2.1.
      const res = await articlesApi.getPricingPreview(previewArgs.articleId, {
        ...previewArgs.opts,
        ...(qdIds?.length ? { quantityDiscountIds: qdIds } : {}),
      });
      setResult(res);
      // Debug: confirma que llegó respuesta y si tiene unitPrice resuelto.
      // eslint-disable-next-line no-console
      console.debug("[simulate] ← OK", {
        articleId:    art.id,
        unitPrice:    res?.unitPrice,
        priceSource:  (res as any)?.priceSource,
        stepsKeys:    Array.isArray(res?.steps) ? res.steps.map((s: any) => s.key) : null,
      });
      // FASE 1 — paridad Simulador ↔ Factura. Logea el snapshot normalizado
      // para que `__tptechParity.diff()` lo compare contra el de la Factura.
      try {
        const normalized = normalizeArticlePricingPreview({
          result:    res,
          articleId: art.id,
          variantId: vid ?? null,
          quantity:  qty ?? 1,
        });
        logParity("simulator", { payload: unifiedPayload, normalized });
      } catch {
        // No bloquear el simulador por un error del logger dev-only.
      }
    } catch (e: any) {
      // Log detallado en consola para diagnosticar combos: status, body, message.
      // eslint-disable-next-line no-console
      console.error("[simulate] ✕ ERROR", {
        articleId:      art.id,
        commercialMode: (art as any).commercialMode ?? null,
        message:        e?.message,
        status:         e?.status,
        body:           e?.body,
        full:           e,
      });
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
    if (quantityError) return; // Bloquear cálculo si la cantidad está fuera de rango
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      simulate(article, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId || undefined, selectedDiscountIds, channelId || undefined, couponApplied || undefined, shippingDerived.mode, shippingDerived.value, shippingDerived.weight, simCurrencyId || null);
    }, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [article, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId, selectedDiscountIds, channelId, couponApplied, shippingDerived.mode, shippingDerived.value, shippingDerived.weight, simulate, quantityError, simCurrencyId]);

  // Re-simular cuando el costo de un artículo cambia (guardado desde ArticleModal)
  const articleRef = useRef(article);
  articleRef.current = article;
  useEffect(() => {
    function onArticleCostChanged(e: Event) {
      const art = articleRef.current;
      if (!art) return;
      const detail = (e as CustomEvent<{ articleId: string }>).detail;
      if (detail?.articleId && detail.articleId !== art.id) return;
      simulate(art, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId || undefined, selectedDiscountIds, channelId || undefined, couponApplied || undefined, undefined, undefined, undefined, simCurrencyId || null);
    }
    window.addEventListener("tptech:article-cost-changed", onArticleCostChanged);
    return () => window.removeEventListener("tptech:article-cost-changed", onArticleCostChanged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulate, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId]);

  const hasVariants = variants.length > 0;

  // Simulación de moneda (solo visual)
  const baseCurrency = currencies.find(c => c.isBase) ?? null;
  const simCurrency  = currencies.find(c => c.id === simCurrencyId) ?? null;
  const simPriceList = priceLists.find(p => p.id === simPriceListId) ?? null;

  // ── Conversión visual de moneda (solo presentación) ──────────────────────
  // Conversión de moneda: SIEMPRE backend.
  // El simulador pasa `currencyId` en el payload del request; el motor de
  // pricing convierte el response completo (`documentTotals`, `taxBreakdown`,
  // `metalHechuraBreakdown`, `channel`, `coupon`, `payment`, `shipping`)
  // antes de devolverlo. El frontend NO multiplica ni divide por rate —
  // `displayRate = 1` constante hace que las divisiones por `displayRate`
  // distribuidas en el render sean no-ops. Si el backend no puede convertir
  // (sin tasa registrada), cae a moneda base y el banner del simulador
  // (sección "Multimoneda") advierte explícitamente al operador.
  const displayRate = 1;
  const displaySym  = simCurrency?.symbol ?? SYM;

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

        {/* ── Columna izquierda — Parámetros (4 bloques + What-if) ── */}
        <div className="lg:sticky lg:top-6 space-y-3">

          {/* ════════════════════════════════════════════════
              BLOQUE 1 — ARTÍCULO
          ════════════════════════════════════════════════ */}
          <TPCard title="Artículo">
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

              {/* Artículo — solo selecciona el padre/simple/servicio. Las variantes (cuando aplican)
                  se eligen en el campo "Variante" debajo. */}
              <TPField label="Artículo" required>
                <ArticleSearchSelect
                  selected={article}
                  onSelect={(row) => {
                    setArticle(row);
                    // Reset de variantId — el useEffect [article] cargará variantes y autoseleccionará
                    // la primera si el nuevo artículo tiene variantes (o quedará en null si no).
                    setVariantId(null);
                  }}
                  onClear={() => {
                    setArticle(null);
                    setVariantId(null);
                    setResult(null);
                    setError(null);
                  }}
                />
              </TPField>

              {/* Variante — solo cuando el artículo tiene variantes (artículos padres con variantes activas).
                  Para artículos simples y servicios, este campo no se renderiza. */}
              {hasVariants && (
                <TPField label="Variante">
                  <TPComboFixed
                    value={variantId ?? ""}
                    onChange={(v) => setVariantId(v || null)}
                    options={[
                      { value: "", label: "Sin variante específica" },
                      ...variants.map(v => ({
                        value: v.id,
                        label: `${v.name || v.code}${v.sku ? ` · ${v.sku}` : ""}`,
                      })),
                    ]}
                  />
                </TPField>
              )}

              {/* Cantidad */}
              <TPField
                label="Cantidad"
                error={quantityError}
                hint={
                  !quantityError && (qtyMin != null || qtyMax != null)
                    ? qtyMin != null && qtyMax != null
                      ? `Rango válido: ${qtyMin} – ${qtyMax}`
                      : qtyMin != null
                      ? `Mínimo: ${qtyMin}`
                      : `Máximo: ${qtyMax}`
                    : undefined
                }
              >
                <TPNumberInput
                  value={quantity}
                  onChange={setQuantity}
                  min={qtyMin ?? 1}
                  max={qtyMax ?? undefined}
                  step={1}
                  decimals={0}
                  placeholder="1"
                />
              </TPField>

            </div>
          </TPCard>

          {/* ════════════════════════════════════════════════
              BLOQUE 2 — CONTEXTO COMERCIAL
          ════════════════════════════════════════════════ */}
          <TPCard title="Contexto comercial">
            <div className="space-y-3">

              {/* Cliente (opcional) */}
              <TPField label="Cliente" hint="Opcional — aplica la lista de precios y el descuento/recargo configurados para ese cliente.">
                <EntitySearchSelect
                  role="client"
                  selected={client}
                  onSelect={setClient}
                  onClear={() => setClient(null)}
                />
              </TPField>

              {/* Condiciones comerciales del cliente seleccionado */}
              {client && (() => {
                const clientPL   = priceLists.find(p => p.id === client.priceListId);
                const activePL   = simPriceListId ? priceLists.find(p => p.id === simPriceListId) : clientPL;
                const plOrigin   = simPriceListId ? "simulador" : "cliente";
                const hasRule    = client.commercialRuleType != null && client.commercialValue != null;
                const isDisc     = client.commercialRuleType === "DISCOUNT" || client.commercialRuleType === "BONUS";
                const isPct      = client.commercialValueType === "PERCENTAGE";
                const ruleLabel  = isDisc ? "Descuento" : "Recargo";
                const ruleVal    = isPct
                  ? `${client.commercialValue}%`
                  : fmtMoney(parseFloat(client.commercialValue ?? "0"), displaySym);
                const applyOnMap: Record<string, string> = {
                  METAL: "sobre metal", HECHURA: "sobre hechura",
                  METAL_Y_HECHURA: "sobre metal y hechura",
                };
                const applyLbl   = client.commercialApplyOn && client.commercialApplyOn !== "TOTAL"
                  ? ` · ${applyOnMap[client.commercialApplyOn] ?? client.commercialApplyOn.toLowerCase()}`
                  : "";
                const activeCurr = currencies.find(c => c.id === simCurrencyId) ?? currencies.find(c => c.isBase);
                const srcToOrigin = (src: "system" | "default" | "client" | "manual") =>
                  src === "manual" ? "simulador" : src === "client" ? "cliente" : src === "default" ? "favorita" : "sistema";
                const currOrigin = srcToOrigin(simCurrencySource);
                const viewLabel  = simViewMode === "UNIFICADO" ? "Valor unificado" : "Valor desglosado";
                const viewOrigin = srcToOrigin(simViewModeSource);

                // Helper visual de origen
                const OriginTag = ({ src }: { src: string }) => (
                  <span className={cn(
                    "ml-auto text-[9px] font-semibold uppercase tracking-wide shrink-0",
                    src === "cliente"    && "text-primary/60",
                    src === "simulador"  && "text-amber-500/80",
                    src === "favorita"   && "text-amber-400/60",
                    src === "sistema"    && "text-muted/40",
                  )}>
                    {src}
                  </span>
                );
                const Row = ({ label, origin, children }: { label: string; origin: string; children: React.ReactNode }) => (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-muted/70 shrink-0">{label}:</span>
                    <span className="font-medium text-text/80 truncate min-w-0">{children}</span>
                    <OriginTag src={origin} />
                  </div>
                );

                return (
                  <div className="rounded-lg border border-border/40 bg-surface2/40 px-3 py-2 space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted/60 mb-1.5">
                      Condiciones activas
                    </p>

                    {/* Moneda */}
                    {activeCurr && (
                      <Row label="Moneda" origin={currOrigin}>
                        {activeCurr.code}{activeCurr.symbol && activeCurr.symbol !== activeCurr.code ? ` (${activeCurr.symbol})` : ""}
                      </Row>
                    )}

                    {/* Lista de precios */}
                    {activePL && (
                      <Row label="Lista" origin={plOrigin}>
                        {activePL.name}
                      </Row>
                    )}

                    {/* Ajuste comercial */}
                    {hasRule && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-muted/70 shrink-0">Ajuste:</span>
                        <span className={cn("font-medium truncate min-w-0", isDisc ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                          {ruleLabel} {ruleVal}{applyLbl}
                        </span>
                        <OriginTag src="cliente" />
                      </div>
                    )}

                    {/* Merma por variante */}
                    {clientMermaOverrides.map(o => (
                      <Row key={o.id} label="Merma" origin="cliente">
                        {parseFloat(o.mermaPercent)}% · {o.variant.metal.name} {o.variant.name}
                      </Row>
                    ))}

                    {/* Impuestos */}
                    {client.taxExempt && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-muted/70 shrink-0">Impuestos:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400 min-w-0">Exento</span>
                        <OriginTag src="cliente" />
                      </div>
                    )}

                    {/* Vista de cálculo */}
                    <Row label="Vista" origin={viewOrigin}>
                      {viewLabel}
                    </Row>
                  </div>
                );
              })()}

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

              {/* Canal de venta */}
              {salesChannels.length > 0 && (
                <div className="border-t border-border/60 pt-3">
                  <TPField label="Canal de venta" hint="Opcional — ajuste comercial por canal">
                    <TPSelect
                      value={channelId}
                      onChange={setChannelId}
                      options={[
                        { value: "", label: "Sin canal" },
                        ...salesChannels.map(ch => ({ value: ch.id, label: ch.name })),
                      ]}
                    />
                  </TPField>
                </div>
              )}

              {/* Cupón de descuento */}
              <div className="border-t border-border/60 pt-3">
                <TPField
                  label="Cupón de descuento"
                  hint="Código de cupón para aplicar en el cálculo"
                  error={couponError ?? undefined}
                >
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      className="tp-input flex-1 uppercase"
                      value={couponCode}
                      onChange={e => {
                        setCouponCode(e.target.value.toUpperCase());
                        if (!e.target.value.trim()) {
                          setCouponApplied("");
                          setCouponError(null);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const code = couponCode.trim();
                          if (!code) { setCouponApplied(""); setCouponError(null); return; }
                          setCouponValidating(true);
                          setCouponError(null);
                          couponsApi.validate(code)
                            .then(r => {
                              if (r.valid) {
                                setCouponApplied(code);
                                setCouponError(null);
                              } else {
                                setCouponApplied("");
                                setCouponError(r.reason ?? "Cupón inválido");
                              }
                            })
                            .catch(() => { setCouponApplied(""); setCouponError("Error al validar el cupón"); })
                            .finally(() => setCouponValidating(false));
                        }
                      }}
                      placeholder="CUPÓN20"
                    />
                    <button
                      type="button"
                      disabled={couponValidating || !couponCode.trim()}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text hover:bg-surface2 disabled:opacity-40 transition-colors shrink-0"
                      onClick={() => {
                        const code = couponCode.trim();
                        if (!code) { setCouponApplied(""); setCouponError(null); return; }
                        setCouponValidating(true);
                        setCouponError(null);
                        couponsApi.validate(code)
                          .then(r => {
                            if (r.valid) {
                              setCouponApplied(code);
                              setCouponError(null);
                            } else {
                              setCouponApplied("");
                              setCouponError(r.reason ?? "Cupón inválido");
                            }
                          })
                          .catch(() => { setCouponApplied(""); setCouponError("Error al validar el cupón"); })
                          .finally(() => setCouponValidating(false));
                      }}
                    >
                      {couponValidating ? "…" : "Aplicar"}
                    </button>
                    {couponApplied && (
                      <button
                        type="button"
                        className="px-2 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-text transition-colors shrink-0"
                        onClick={() => { setCouponCode(""); setCouponApplied(""); setCouponError(null); }}
                        title="Quitar cupón"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {couponApplied && !couponError && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                      <Check size={11} />
                      Cupón "{couponApplied}" aplicado
                    </p>
                  )}
                </TPField>
              </div>

              {/* Método de entrega — sigue el flujo natural de venta: cupón → entrega → pago */}
              <div className="border-t border-border/60 pt-3">
                <TPField
                  label="Método de entrega"
                  hint="Aplica la tarifa real configurada en Configuración → Envíos. Retiro en sucursal = $0."
                >
                  <TPComboFixed
                    value={shippingCarrierId}
                    onChange={setShippingCarrierId}
                    options={[
                      { value: "", label: "Sin método de entrega" },
                      ...shippingCarriers.map(c => ({
                        value: c.id,
                        label: c.type === "PICKUP" ? `${c.name} (Retiro)` : c.name,
                      })),
                    ]}
                  />
                  {shippingDerived.detail && (
                    <p className="text-[10px] text-muted/70 mt-1">{shippingDerived.detail}</p>
                  )}
                </TPField>

                {/* Tarifa de envío — selector manual cuando el carrier tiene >1 tarifa activa.
                    Si el carrier es PICKUP o tiene 0/1 tarifas, no aparece. */}
                {(() => {
                  const carrier = shippingCarriers.find(c => c.id === shippingCarrierId);
                  if (!carrier || carrier.type === "PICKUP") return null;
                  const activeRates = carrier.rates.filter(r => r.isActive);
                  if (activeRates.length <= 1) return null;
                  const fmtRate = (r: typeof activeRates[number]) => {
                    if (r.calculationMode === "FIXED" && r.fixedPrice != null) {
                      return fmtMoney(parseFloat(r.fixedPrice), displaySym);
                    }
                    if (r.calculationMode === "BY_WEIGHT" && r.pricePerKg != null) {
                      return `${fmtMoney(parseFloat(r.pricePerKg), displaySym)}/kg`;
                    }
                    return "—";
                  };
                  return (
                    <div className="mt-2">
                      <TPField
                        label="Tarifa de envío"
                        hint="Seleccioná la tarifa exacta a usar en esta simulación"
                      >
                        <TPComboFixed
                          value={shippingRateId}
                          onChange={setShippingRateId}
                          options={activeRates.map((r, i) => {
                            const zone = [r.zones?.[0], r.province].filter(Boolean).join(" · ");
                            const left = zone ? `${r.name} — ${zone}` : r.name;
                            return { value: r.id ?? String(i), label: `${left} — ${fmtRate(r)}` };
                          })}
                        />
                      </TPField>
                    </div>
                  );
                })()}
              </div>

              {/* Divider */}
              <div className="border-t border-border/60 pt-3">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={13} className="text-muted shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Forma de pago</span>
                </div>

                {/* Medio de pago */}
                <TPField label="Medio de pago" hint="Opcional — aplica recargo o descuento">
                  <TPComboFixed
                    value={paymentMethodId}
                    onChange={(v) => {
                      setPaymentMethodId(v);
                      setInstallmentsQty(0); // reset cuotas al cambiar medio
                    }}
                    options={[
                      { value: "", label: "Sin forma de pago" },
                      ...paymentMethods.map(pm => ({ value: pm.id, label: pm.name })),
                    ]}
                  />
                </TPField>

                {/* Cuotas — solo si el medio tiene planes */}
                {availablePlans.length > 0 && (
                  <TPField label="Cuotas" hint="Opcional">
                    <TPComboFixed
                      value={String(installmentsQty)}
                      onChange={(v) => setInstallmentsQty(parseInt(v, 10) || 0)}
                      options={[
                        { value: "0", label: "Sin cuotas" },
                        ...availablePlans.map(plan => ({
                          value: String(plan.installments),
                          label: `${plan.installments} ${plan.installments === 1 ? "cuota" : "cuotas"}${parseFloat(plan.interestRate) > 0 ? ` (+${plan.interestRate}%)` : " sin interés"}`,
                        })),
                      ]}
                    />
                  </TPField>
                )}
              </div>

            </div>
          </TPCard>

          {/* ════════════════════════════════════════════════
              BLOQUE 3 — CONFIGURACIÓN DE SIMULACIÓN
              (Mantiene su panel propio con accordion en mobile)
          ════════════════════════════════════════════════ */}
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
                  <TPField
                    label="Vista del cálculo"
                    hint="Desglosado muestra los cards por componente"
                  >
                    <TPComboFixed
                      value={simViewMode}
                      onChange={v => { setSimViewMode(v as "UNIFICADO" | "DESGLOSADO"); setSimViewModeSource("manual"); }}
                      options={[
                        { value: "UNIFICADO",  label: "Valor Unificado"  },
                        { value: "DESGLOSADO", label: "Valor Desglosado" },
                      ]}
                      favoriteValue={simDefaults.viewMode || null}
                      onSetFavorite={v => saveSimDefault("viewMode", simDefaults.viewMode === v ? "" : v)}
                    />
                  </TPField>

                  <TPField
                    label="Lista de precios"
                    hint="Define el precio de venta aplicado"
                  >
                    <TPComboFixed
                      value={simPriceListId}
                      onChange={setSimPriceListId}
                      options={[
                        { value: "", label: "Lista real del artículo" },
                        ...priceLists.map(pl => ({ value: pl.id, label: pl.name })),
                      ]}
                    />
                    {/* Indicador: lista heredada del cliente cuando no hay override */}
                    {!simPriceListId && client?.priceListId && (() => {
                      const cpl = priceLists.find(p => p.id === client.priceListId);
                      if (!cpl) return null;
                      return (
                        <p className="text-[10px] text-muted/70 mt-1">
                          Del cliente: <span className="font-medium text-text/70">{cpl.name}</span>
                        </p>
                      );
                    })()}
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

                  <TPField
                    label="Moneda de visualización"
                    hint="Solo cambia cómo se muestran los importes"
                  >
                    <TPComboFixed
                      value={simCurrencyId}
                      onChange={v => { setSimCurrencyId(v); setSimCurrencySource("manual"); }}
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
              {/* /BLOQUE 3 — Configuración de simulación */}

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
                                    <span className="font-medium text-text">Sin impuestos</span>
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
                onClick={() => simulate(article, variantId, quantity, client, paymentMethodId, installmentsQty, simPriceListId || undefined, selectedDiscountIds, channelId || undefined, couponApplied || undefined, undefined, undefined, undefined, simCurrencyId || null)}
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
        {/* /Columna izquierda — fin de los 4 bloques */}

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
                // Fase 3 cleanup — TODO valor leído del normalizado. La
                // división por `displayRate` es display de moneda extranjera
                // (defensivo: si el backend ya convirtió, displayRate=1).
                const costBase    = normLine?.costBase      != null ? normLine.costBase      / displayRate : null;
                const costTax     = normLine?.costTaxAmount != null ? normLine.costTaxAmount / displayRate : null;
                const costTotal   = normLine?.costWithTax   != null ? normLine.costWithTax   / displayRate : null;
                const netPriceD   = normLine?.unitPrice     != null ? normLine.unitPrice     / displayRate : null;
                const finalPriceD = (appliedTaxes.length > 0 && totalFinal != null && simCtx !== "EXEMPT")
                  ? totalFinal / displayRate
                  : netPriceD;
                const taxesTotalD = appliedTaxes.reduce((s, t) => s + t.amount, 0) / displayRate;
                const gainAmtD    = normLine?.unitMargin    != null ? normLine.unitMargin    / displayRate : null;
                const mVal        = normLine?.marginPercent ?? null;

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
                      const rawPriceB      = normLine?.unitPrice ?? null;
                      // Usar grandTotal (incluye canal + cupón) cuando esté disponible
                      const origFinalB     = rawPriceB != null
                        ? (grandTotal != null ? grandTotal : (appliedTaxes.length > 0 && totalFinal != null) ? totalFinal : rawPriceB)
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

                      // Ajustes de canal y cupón para el subtext
                      const hasChannel = !whatIfActive && result.channelResult != null && result.channelResult.channelAmount !== 0;
                      const hasCoupon  = !whatIfActive && result.couponResult?.applied === true && (result.couponResult?.discountAmount ?? 0) > 0;

                      const cardLabel = hasCheckoutAdj
                        ? "Total con pago"
                        : (appliedTaxes.length > 0 && simCtx !== "EXEMPT" ? "Total final" : "Sin impuestos");

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

                          {/* Checkout adj — con desglose de canal/cupón/pago */}
                          {!whatIfActive && hasCheckoutAdj && (() => {
                            const cr  = result.checkoutResult!;
                            const adj = cr.paymentAdjustment;
                            const pmStep   = cr.steps?.find((s: any) => s.code === "PAYMENT_ADJUSTMENT");
                            const rateMatch = pmStep?.formula?.match(/×\s*([\d.,]+)%/);
                            const payPct   = rateMatch ? rateMatch[1] : null;
                            return (
                              <div className="text-[10px] text-muted mt-1 space-y-0.5">
                                {/* Neto + impuestos base */}
                                {appliedTaxes.length > 0 && simCtx !== "EXEMPT" && netPriceD != null && (
                                  <p className="tabular-nums">
                                    Sin imp.: {fmtMoney(netPriceD, displaySym)}
                                    {taxesTotalD > 0 && <><span className="mx-1 opacity-40">·</span><span className="text-muted">imp.: +{fmtMoney(taxesTotalD, displaySym)}</span></>}
                                  </p>
                                )}
                                {/* Canal */}
                                {hasChannel && (() => {
                                  const ch   = result.channelResult!;
                                  const pct  = ch.baseAmount > 0 ? ch.channelAmount / ch.baseAmount * 100 : 0;
                                  const isR  = ch.channelAmount > 0;
                                  const name = salesChannels.find(c => c.id === channelId)?.name ?? ch.channelName ?? "Canal";
                                  return (
                                    <p className="tabular-nums">
                                      <span className={isR ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                                        {name}: {fmtMoney(ch.channelAmount / displayRate, displaySym)}
                                        {Math.abs(pct) >= 0.01 && <span className="opacity-75"> ({pct.toFixed(1)}%)</span>}
                                      </span>
                                    </p>
                                  );
                                })()}
                                {/* Cupón */}
                                {hasCoupon && (() => {
                                  const cp = result.couponResult!;
                                  const pctLabel = cp.discountType === "PERCENTAGE" ? ` (${cp.discountValue}%)` : "";
                                  return (
                                    <p className="tabular-nums text-emerald-600 dark:text-emerald-400">
                                      Cupón {cp.couponCode}: −{fmtMoney(cp.discountAmount / displayRate, displaySym)}{pctLabel}
                                    </p>
                                  );
                                })()}
                                {/* Pago */}
                                <p className="tabular-nums">
                                  <span className={adj > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                                    {adj > 0 ? "Recargo" : "Desc."} pago: {fmtMoney(adj / displayRate, displaySym)}
                                    {payPct && <span className="opacity-75"> ({adj > 0 ? "" : "-"}{payPct}%)</span>}
                                  </span>
                                  {cr.installments != null && cr.installmentAmount != null && (
                                    <span className="text-muted/70">
                                      {" · "}{cr.installments} cuotas de {fmtMoney(cr.installmentAmount / displayRate, displaySym)} c/u
                                    </span>
                                  )}
                                </p>
                              </div>
                            );
                          })()}

                          {/* Neto + impuestos + canal + cupón */}
                          {!whatIfActive && !hasCheckoutAdj && (
                            <div className="text-[10px] text-muted mt-1 space-y-0.5">
                              {appliedTaxes.length > 0 && simCtx !== "EXEMPT" && netPriceD != null && (
                                <p className="tabular-nums">
                                  Sin imp.: {fmtMoney(netPriceD, displaySym)}
                                  {taxesTotalD > 0 && <><span className="mx-1 opacity-40">·</span><span className="text-muted">imp.: +{fmtMoney(taxesTotalD, displaySym)}</span></>}
                                </p>
                              )}
                              {hasChannel && (() => {
                                const ch     = result.channelResult!;
                                const pct    = ch.baseAmount > 0 ? ch.channelAmount / ch.baseAmount * 100 : 0;
                                const isRecg = ch.channelAmount > 0;
                                const chName = salesChannels.find(c => c.id === channelId)?.name ?? ch.channelName ?? "Canal";
                                return (
                                  <p className="tabular-nums">
                                    <span className={isRecg ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                                      {chName}: {fmtMoney(ch.channelAmount / displayRate, displaySym)}
                                      {Math.abs(pct) >= 0.01 && <span className="opacity-75"> ({pct.toFixed(1)}%)</span>}
                                    </span>
                                  </p>
                                );
                              })()}
                              {hasCoupon && (() => {
                                const cp = result.couponResult!;
                                const pctLabel = cp.discountType === "PERCENTAGE" ? ` (${cp.discountValue}%)` : "";
                                return (
                                  <p className="tabular-nums text-emerald-600 dark:text-emerald-400">
                                    Cupón {cp.couponCode}: −{fmtMoney(cp.discountAmount / displayRate, displaySym)}{pctLabel}
                                  </p>
                                );
                              })()}
                            </div>
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

              {/* Alertas — fuente única `result.alerts` del motor. */}
              {(result.alerts ?? []).length > 0 && (
                <div className="space-y-2">
                  {(result.alerts ?? []).map((alert: PricingAlert, i: number) => (
                    <div
                      key={`be-${i}`}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] ${
                        alert.level === "error"
                          ? "bg-red-50 border-red-200/60 text-red-700 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-400"
                          : alert.level === "warning"
                          ? "bg-amber-50 border-amber-200/60 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-400"
                          : "bg-blue-50 border-blue-200/60 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-blue-400"
                      }`}
                    >
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Resumen comercial — lista aplicada */}
              {(() => {
                const priceListStep = stepsNorm.find((s: any) => s.key === "PRICE_LIST" && s.status === "ok");
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
                // Combos: ahora resuelven precio por el flujo normal (PRICE_LIST/MANUAL/FALLBACK).
                // El step COMBO_COST informa el costo derivado pero NO es fuente de precio.
                const baseStep = stepsNorm.find((s: any) =>
                  ["VARIANT_OVERRIDE", "PRICE_LIST", "MANUAL_OVERRIDE", "MANUAL_FALLBACK"].includes(s.key) && s.status === "ok"
                );
                // Step COMBO_COST: trazabilidad del costo derivado de los componentes (informativo).
                const comboCostStep = stepsNorm.find((s: any) => s.key === "COMBO_COST" && s.status !== "skipped");
                const discStep  = stepsNorm.find((s: any) => s.key === "QUANTITY_DISCOUNT" && s.status === "ok");
                const promoStep = stepsNorm.find((s: any) => s.key === "PROMOTION"         && s.status === "ok");
                const rndStep   = stepsNorm.find((s: any) => s.key === "ROUNDING"          && s.status === "ok" && s.meta?.preRounding != null);
                const ruleStep  = stepsNorm.find((s: any) => s.key === "ENTITY_COMMERCIAL_RULE" && s.status === "ok");
                const hasTaxesL = appliedTaxes.length > 0 && !result.taxExemptByEntity;

                function fm2(v: number) { return fmtMoney(v / displayRate, displaySym); }
                /** Formatea gramos con exactamente 2 decimales (visualización comercial). */
                function fmGr(v: number) { return v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

                const netP    = normLine?.unitPrice ?? null;
                // Siempre preferir totalWithTax para el precio final: cuando hay impuestos es el
                // neto+impuestos; cuando no los hay es el neto (=unitPrice) — pero si se aplicó
                // redondeo TOTAL, totalWithTax ya lo incorpora aunque unitPrice esté sin redondear.
                const finalP  = totalFinal != null ? totalFinal : netP;

                // "Total producto" (post impuestos del producto, ANTES de canal/cupón/pago/envío).
                // Misma fórmula que el bloque "Total producto" del breakdown principal:
                //   productTotal = totalFinal cuando hay impuestos efectivos, sino netP.
                // Lo usamos en el header del card "Cálculo del precio" para que coincida
                // exactamente con la línea "Total producto" mostrada al cierre.
                const taxesAddValueL = (normLine?.unitTaxAmount ?? 0) > 0.005;
                const productTotalL  = (hasTaxesL && taxesAddValueL && totalFinal != null) ? totalFinal : netP;

                const basePriceVal = baseStep?.value != null ? parseFloat(baseStep.value) : null;

                // Merma de entidad (cliente) — solo aplica en el bloque de PRECIO, no en costo.
                // El backend la devuelve en el step ENTITY_MERMA_SALE_ADJ cuando hay overrides.
                const entityMermaSaleStep = stepsNorm.find((s: any) => s.key === "ENTITY_MERMA_SALE_ADJ" && s.status === "ok");
                const saleEntityMermaMap = new Map<string, number>();
                if (entityMermaSaleStep?.meta?.variants) {
                  for (const v of (entityMermaSaleStep.meta.variants as Array<{ variantId: string; mermaPercent: number }>)) {
                    saleEntityMermaMap.set(v.variantId, v.mermaPercent);
                  }
                }
                // Costos por componente — fuente única: ViewModel normalizado.
                // `metalHechuraBreakdown` es passthrough universal del motor;
                // `line.products[]` y `line.services[]` se derivan de
                // `steps[]` en `normalizePricingPreviewResult.ts` (paso 6).
                // No usar steps[] raw acá — solo display puro más abajo.
                const metalCostRaw   = normLine?.metalHechuraBreakdown?.metalCost   ?? null;
                const hechuraCostRaw = normLine?.metalHechuraBreakdown?.hechuraCost ?? null;
                const productList    = normLine?.products ?? [];
                const serviceList    = normLine?.services ?? [];
                const productCostRaw = productList.length > 0
                  ? productList.reduce((a, p) => a + (p.value ?? 0), 0) : null;
                const serviceCostRaw = serviceList.length > 0
                  ? serviceList.reduce((a, s) => a + (s.value ?? 0), 0) : null;
                const unitCostVal    = normLine?.unitCost      ?? null;
                const costTaxAmt     = normLine?.costTaxAmount ?? null;
                const hasCostComposition = metalCostRaw != null || hechuraCostRaw != null || unitCostVal != null;

                // Pasos METAL_QUOTE para contexto de metal
                const metalQuoteSteps = stepsNorm.filter((s: any) =>
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
                  return <p className="text-[10px] mt-0.5 leading-snug text-muted/60">{text}</p>;
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
                        COST_LINES_METAL:     "Metal",
                        COST_LINES_HECHURA:   "Hechura",
                        COST_LINES_PRODUCT:   "Producto",
                        COST_LINES_SERVICE:   "Servicio",
                        COST_LINES_MANUAL:    "Manual",
                        COST_LINES_LOGISTICS: "Envío",
                      };

                      // Render del ajuste por línea — formato compacto: −10% → −$3.500 / $31.500
                      // renderLineAdj eliminado — renderOtherRow usa formato inline

                      // ── 1. Líneas individuales ────────────────────────────────────────────
                      const allLineSteps = stepsNorm.filter((s: any) =>
                        Object.keys(LINE_TYPE_NAMES).includes(s.key)
                        && s.status === "ok" && s.value != null
                      );
                      const metalOnlySteps = stepsNorm.filter((s: any) =>
                        s.key === "METAL_QUOTE" && s.status === "ok" && s.value != null
                      );
                      const hechuraMMHStep = stepsNorm.find((s: any) =>
                        s.key === "HECHURA" && s.status === "ok" && s.value != null
                      );

                      const lineRows: React.ReactNode[] = [];
                      let hechuraLineSteps: any[] = [];

                      // ── helper: fila de metal ─────────────────────────────────────────────
                      // Formato 4 líneas:
                      //   L1: nombre del metal padre        (ej: "Oro")
                      //   L2: código · nombre variante      (ej: "AU18K · Oro 18 Kilates")
                      //   L3: cálculo                       (ej: "1,00 gr × $202.500,00/gr")
                      //   L4: merma X,XXX%
                      const renderMetalRow = (key: string, variantName: string, cost: number, grams: number | null, price: number | null, mermaVal: number, _symbol?: string | null, sku?: string | null, metalParentName?: string | null) => {
                        const grStr = grams != null ? fmGr(grams) : null;
                        const priceWithMerma = price != null ? price * (1 + mermaVal / 100) : null;
                        // L1: nombre padre si existe, si no el nombre de variante
                        const headLabel = metalParentName ?? variantName;
                        // L2: "AU18K · Oro 18 Kilates" / "AU18K" / nombre variante (solo si hay metalParentName o sku)
                        const variantDesc = metalParentName
                          ? (sku && variantName ? `${sku} · ${variantName}` : sku ?? (variantName !== headLabel ? variantName : null))
                          : sku ?? null;
                        return (
                          <div key={key} className="space-y-0 pb-0.5">
                            {/* L1: nombre del metal padre (con total a la derecha) */}
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="font-medium text-text/80 leading-snug">{headLabel}</span>
                              <span className="font-bold tabular-nums shrink-0">{fm2(cost)}</span>
                            </div>
                            {/* L2: código · nombre variante */}
                            {variantDesc && (
                              <p className="text-[9px] text-muted/70 font-mono font-semibold">{variantDesc}</p>
                            )}
                            {/* L3: cálculo (gramos × precio/gr con merma incluida) */}
                            {grStr != null && priceWithMerma != null && (
                              <p className="text-[9px] text-muted/55 tabular-nums font-mono">
                                {grStr} gr × {fm2(priceWithMerma)}/gr
                              </p>
                            )}
                            {/* L4: merma */}
                            {mermaVal > 0 && grStr != null && (
                              <p className="text-[9px] text-muted/40 font-mono">
                                merma {mermaVal.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%
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
                          const rateStr  = convRate.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                          convPrefix = `${code} ${fmtMoney(origAmt, "").trim()} × ${rateStr}`;
                          convAmt    = origAmt * convRate;
                        }

                        // Monto intermedio (antes del ajuste, post-conversión)
                        const midAmt = convAmt ?? (hasAdj ? preAdj : postAdj);

                        const isBonif  = adjKind === "BONUS";
                        const adjLabel = hasAdj
                          ? adjType === "PERCENTAGE" && adjVal != null
                            ? `${isBonif ? "−" : "+"}${adjVal.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`
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
                          // Origen: customLabel si existe, sino el tipo del step (Hechura / Producto / etc.)
                          // Evita "valores huérfanos" sin contexto.
                          <span className="text-xs text-muted font-medium">
                            {customLabel ?? LINE_TYPE_NAMES[String(step.key)] ?? "Componente"}
                          </span>
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

                        // Cálculo simple: qty × unitValue = value (cuando no hay conversión ni ajuste)
                        const qtyMeta  = m.qty       != null ? parseFloat(String(m.qty))       : null;
                        const unitMeta = m.unitValue != null ? parseFloat(String(m.unitValue)) : null;
                        const showSimpleCalc = !hasAdj && !convPrefix
                          && qtyMeta != null && unitMeta != null
                          && qtyMeta > 0.0001 && unitMeta > 0.0001;

                        return (
                          <div key={key}>
                            {/* Label personalizado sobre la fila (solo cuando hay conv o adj que ya ocupa el left) */}
                            {customLabel && (hasAdj || convPrefix) && (
                              <p className="text-xs text-muted/70 font-medium mb-0.5">{customLabel}</p>
                            )}
                            <div className="flex items-baseline justify-between gap-2">
                              {leftContent}
                              {rightValue}
                            </div>
                            {/* Cálculo: cantidad × unitario = total (solo en líneas simples sin conv/adj) */}
                            {showSimpleCalc && (
                              <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                {qtyMeta!.toLocaleString("es-AR", { maximumFractionDigits: 3 })} × {fm2(unitMeta!)} = {fm2(postAdj)}
                              </p>
                            )}
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
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Metales</p>
                              {metalSteps.map((step: any, i: number) => {
                                const m  = step.meta ?? {};
                                const nm = (m.variantName as string | null | undefined) ?? "Metal";
                                const q  = m.qty        != null ? parseFloat(String(m.qty))        : null;
                                const p  = m.quotePrice != null ? parseFloat(String(m.quotePrice)) : null;
                                return renderMetalRow(`cl-m-${i}`, nm, parseFloat(step.value), q, p, m.merma ? Number(m.merma) : 0, m.metalSymbol as string | null, m.variantSku as string | null, m.metalName as string | null);
                              })}
                            </div>
                          );
                          lineRows.push(
                            <div key="group-other" className="space-y-1.5 border-t border-border/20 pt-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Hechura / Otros</p>
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
                            lineRows.push(renderMetalRow(`cl-m-${i}`, nm, parseFloat(step.value), q, p, m.merma ? Number(m.merma) : 0, m.metalSymbol as string | null, m.variantSku as string | null, m.metalName as string | null));
                          });
                          otherSteps.forEach((step: any, i: number) => lineRows.push(renderOtherRow(`cl-o-${i}`, step)));
                        }

                      } else if (metalOnlySteps.length > 0 || hechuraMMHStep) {
                        // METAL_MERMA_HECHURA mode
                        const hasBoth = metalOnlySteps.length > 0 && hechuraMMHStep != null;

                        if (hasBoth) {
                          lineRows.push(
                            <div key="group-metal-mmh" className="space-y-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Metales</p>
                              {metalOnlySteps.map((step: any, qi: number) => {
                                const qm = step.meta ?? {};
                                const nm = (qm.variantName as string | null | undefined) ?? `Variante ${qi + 1}`;
                                const gr = qm.grams != null ? parseFloat(String(qm.grams)) : qm.qty != null ? parseFloat(String(qm.qty)) : null;
                                const pr = qm.price != null ? parseFloat(String(qm.price)) : qm.quotePrice != null ? parseFloat(String(qm.quotePrice)) : null;
                                return renderMetalRow(`mq-${qi}`, nm, parseFloat(String(step.value)), gr, pr, qm.merma ? Number(qm.merma) : 0, qm.metalSymbol as string | null, qm.variantSku as string | null, qm.metalName as string | null);
                              })}
                            </div>
                          );
                        } else {
                          metalOnlySteps.forEach((step: any, qi: number) => {
                            const qm = step.meta ?? {};
                            const nm = (qm.variantName as string | null | undefined) ?? `Variante ${qi + 1}`;
                            const gr = qm.grams != null ? parseFloat(String(qm.grams)) : qm.qty != null ? parseFloat(String(qm.qty)) : null;
                            const pr = qm.price != null ? parseFloat(String(qm.price)) : qm.quotePrice != null ? parseFloat(String(qm.quotePrice)) : null;
                            lineRows.push(renderMetalRow(`mq-${qi}`, nm, parseFloat(String(step.value)), gr, pr, qm.merma ? Number(qm.merma) : 0, qm.metalSymbol as string | null, qm.variantSku as string | null, qm.metalName as string | null));
                          });
                        }

                        if (hechuraMMHStep) {
                          const hm    = (hechuraMMHStep.meta ?? {}) as any;
                          const hCost = parseFloat(String(hechuraMMHStep.value));
                          const hFmt  = hm.mode === "PER_GRAM" && hm.price && hm.gramsWithMerma
                            ? `${fm2(parseFloat(String(hm.price)))} × ${fmGr(parseFloat(String(hm.gramsWithMerma)))} gr`
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
                                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Hechura / Otros</p>
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
                        const multStep   = stepsNorm.find((s: any) => s.key === "MULTIPLIER"       && s.status === "ok");
                        const manualStep = stepsNorm.find((s: any) => s.key === "MANUAL_BASE_COST"  && s.status === "ok");
                        const currStep   = stepsNorm.find((s: any) =>
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
                            const rateStr  = convRate.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
                      const finalStep = stepsNorm.find((s: any) => s.key === "COST_LINES_FINAL" && s.status === "ok" && s.value != null);
                      if (finalStep) {
                        const sumLines = stepsNorm
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
                            ? ` ${adjValue.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`
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
                            <span className="tabular-nums text-[11px] text-muted shrink-0">+{fm2(taxAmt)}</span>
                          </div>
                        );
                      }) : [];

                      // ── 4. Total ──────────────────────────────────────────────────────────
                      // Fase 2.1 — leído del normalizado (number directo).
                      const totalCostVal = normLine?.costWithTax ?? unitCostVal;

                      // ── Equivalente por variante metálica (purity × (1−merma)) ────────────
                      // Agrupa por variante metálica final (variantId → variantName).
                      // factor = purity × (1 − merma/100)
                      // equivGr = qty × factor
                      // Se guarda quotePrice y effectiveGrams para mostrar la valorización.
                      type MetalVariantEquiv = {
                        qty: number; factor: number; equivGr: number; rawValue: number;
                        purity: number | null; merma: number | null;
                        quotePrice: number | null; sku: string | null; variantName: string | null;
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
                          const mermaMul = mermaVal != null && mermaVal !== 0 ? (1 + mermaVal / 100) : 1;
                          factor  = purityVal * mermaMul;
                          equivGr = qty * factor;
                        } else {
                          const merma = mermaVal ?? 0;
                          factor  = 1 + merma / 100;
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
                        const variantSku = (m.variantSku as string | null | undefined) ?? null;
                        const variantNm  = (m.variantName as string | null | undefined) ?? null;
                        prev.variants.push({ qty, factor, equivGr, rawValue: rawVal, purity: purityVal, merma: mermaVal, quotePrice: quotePriceVal, sku: variantSku, variantName: variantNm });
                        prev.totalEquivGr  += equivGr;
                        prev.totalRawValue += rawVal;
                        metalPadreMap.set(groupKey, prev);
                      });

                      // ── Factor de ajuste global y hechura equivalente ─────────────────────
                      let adjFactorMetal   = 1;
                      let hechuraEquiv: number | null = null;

                      if (metalHechuraBreakdownNorm && unitCostVal != null) {
                        const mhb = metalHechuraBreakdownNorm;
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
                      /* Cards de costo (Composición del costo): solo en DESGLOSADO.
                         · DESGLOSADO → cards visibles (comportamiento esperado de la vista desglosada).
                         · UNIFICADO  → ocultos: la vista unificada solo muestra header y total. */
                      const showCostEquivCards = simViewMode === "DESGLOSADO" && hasEquivBlock;

                      // ── costClosingEl — solo cierre del costo (Costo sin imp + Total costo).
                      // Va DENTRO del body de "Costo unitario" para colapsar/expandir junto al detalle.
                      const costClosingEl = (
                        <div className="pt-2 mt-1.5 border-t border-border/40 space-y-1">
                          {/* ── Cierre del costo ── */}
                          {hasCostTax && unitCostVal != null ? (
                            <>
                              {/* Subtotal solo cuando hay múltiples componentes que agregar */}
                              {(lineRows.length > 1 || globalAdjEl != null) && (
                                <div className="flex justify-between items-baseline text-muted">
                                  <span>Costo sin imp.</span>
                                  <span className="tabular-nums">{fm2(unitCostVal)}</span>
                                </div>
                              )}
                              <div className={cn(
                                "flex justify-between items-center font-bold text-sm",
                                (lineRows.length > 1 || globalAdjEl != null) && "border-t border-border/30 pt-1 mt-0.5"
                              )}>
                                <span>Total costo</span>
                                <span className="tabular-nums">{fm2(totalCostVal)}</span>
                              </div>
                            </>
                          ) : (lineRows.length > 1 || globalAdjEl != null) ? (
                            /* Mostrar "Costo total" solo cuando agrupa múltiples componentes */
                            <div className="flex justify-between items-center font-bold text-sm">
                              <span>Costo total</span>
                              <span className="tabular-nums">{fm2(totalCostVal)}</span>
                            </div>
                          ) : null}
                        </div>
                      );

                      // ── equivCardsEl — Composición del costo (cards de metales + hechura).
                      // Render INDEPENDIENTE del estado colapsado de "Costo unitario": en DESGLOSADO
                      // se muestra siempre; en UNIFICADO no aparece (showCostEquivCards = false).
                      const equivCardsEl = showCostEquivCards ? (
                            /* ── DESGLOSADO: cards de equivalentes por componente.
                                La sección siempre visible; cada card maneja su propio estado de expansión
                                (sincronizado a través del flag global). */
                            <div className="pb-1 space-y-3 border-t border-border/20 pt-3 mt-3 mb-4">
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/70">
                                Composición del costo
                              </p>

                              {/* ── Grid de cards (siempre visible) ── */}
                              <div className="grid grid-cols-2 gap-4">
                                {/* Cards por metal padre */}
                                {metalPadreEntries.map(([padreKey, padre], pi) => {
                                  const totalValue = padre.totalRawValue * adjFactorMetal;
                                  const totalGrStr = fmGr(padre.totalEquivGr);
                                  const sampleV    = padre.variants.find(v => v.quotePrice != null && v.purity != null && v.purity > 0.0001);
                                  const purePrice  = sampleV != null ? sampleV.quotePrice! / sampleV.purity! : null;

                                  const hasAdj       = Math.abs(adjFactorMetal - 1) > 0.001;
                                  const adjAmt       = totalValue - padre.totalRawValue;
                                  const adjPct       = (adjFactorMetal - 1) * 100;
                                  const isAdjBonif   = adjFactorMetal < 1;

                                  return (
                                    <div key={`equiv-padre-${pi}`}
                                      className="rounded-lg border border-border/40 bg-muted/15 px-4 py-3 space-y-2 shadow-sm">

                                      {/* ── Cabecera: clickeable, colapsa el bloque "Origen" ── */}
                                      {(() => {
                                        const cKey = `metalCost-${pi}`;
                                        const cOpen = isExpanded(cKey);
                                        const firstSku = padre.variants[0]?.sku ?? null;
                                        const collapsedSummary = padre.variants.length > 0
                                          ? `${padre.variants.length} ${padre.variants.length === 1 ? "origen" : "orígenes"}${firstSku ? ` · ${firstSku}` : ""}`
                                          : null;
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => toggleSection(cKey)}
                                            className="w-full flex items-start justify-between gap-2 cursor-pointer"
                                          >
                                            <div className="min-w-0 text-left">
                                              <p className="text-base font-bold uppercase tracking-wider text-foreground/60 leading-none mt-0.5 truncate">
                                                {padre.displayName}
                                                {padre.symbol && <span className="text-[10px] font-normal text-foreground/35 ml-1">({padre.symbol})</span>}
                                              </p>
                                              {!cOpen && collapsedSummary && (
                                                <p className="text-[11px] text-muted/70 italic leading-none pt-1 truncate">{collapsedSummary}</p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <p className="text-base tabular-nums font-bold text-foreground/90 leading-tight text-right">
                                                {padre.symbol && <span className="text-[11px] font-semibold text-muted/70 mr-1">{padre.symbol}</span>}{totalGrStr} gr
                                              </p>
                                              <ChevronDown size={14} className={cn("text-muted/60 transition-transform mt-0.5", cOpen && "rotate-180")} />
                                            </div>
                                          </button>
                                        );
                                      })()}

                                      {/* ── Origen + cálculo de gramos + cálculo monetario — colapsable ── */}
                                      {isExpanded(`metalCost-${pi}`) && (
                                      <div className="border-t border-border/20 pt-1.5">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-muted/60 mb-1">Origen</p>
                                        <div className="space-y-1">
                                          {padre.variants.map((v, vi) => {
                                            const fmtM3 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                                            const qStr  = fmGr(v.qty);
                                            const fStr  = fmtM3(v.factor);
                                            const gStr  = fmGr(v.equivGr);
                                            const originLabel = v.variantName ?? padre.displayName;

                                            // Descripción del factor (pureza × merma) para acompañar el cálculo de gramos
                                            let factorDesc = "";
                                            if (v.purity != null && v.merma != null && v.merma !== 0) {
                                              const pPct = (v.purity * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 });
                                              factorDesc = `pureza ${pPct}% × merma ${fmtM3(v.merma)}%`;
                                            } else if (v.purity != null) {
                                              const pPct = (v.purity * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 });
                                              factorDesc = `pureza ${pPct}%`;
                                            } else if (v.merma != null && v.merma !== 0) {
                                              factorDesc = `merma ${fmtM3(v.merma)}%`;
                                            }

                                            // Precio por gramo coherente con la transformación equivGr × precio/gr = rawValue:
                                            //   - con purity: precio "puro" = quotePrice / purity
                                            //   - sin purity: quotePrice ya es por gramo
                                            const purePricePerGr = v.quotePrice != null
                                              ? (v.purity != null && v.purity > 0.0001 ? v.quotePrice / v.purity : v.quotePrice)
                                              : null;

                                            const showGramsCalc = Math.abs(v.factor - 1) > 0.001 && v.qty > 0.0001;
                                            const showMoneyCalc = purePricePerGr != null && v.equivGr > 0.0001;

                                            return (
                                              <div key={vi} className="cursor-default leading-snug space-y-px">
                                                {/* L1 — Origen + gramos finales */}
                                                <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
                                                  <span className="min-w-0 truncate text-muted">
                                                    <span className="font-medium">{originLabel}</span>
                                                    {v.sku && <span className="ml-1 font-mono text-muted/70">· {v.sku}</span>}
                                                  </span>
                                                  <span className="shrink-0 text-muted/70">{gStr} gr</span>
                                                </div>
                                                {/* L2 — Cálculo de gramos: qty × factor = equivGr */}
                                                {showGramsCalc && (
                                                  <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                    {qStr} gr × {fStr} = {gStr} gr
                                                    {factorDesc && <span className="ml-1 text-muted/35">({factorDesc})</span>}
                                                  </p>
                                                )}
                                                {/* L3 — Cálculo monetario: equivGr × precio/gr = rawValue */}
                                                {showMoneyCalc && (
                                                  <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                    {gStr} gr × {fm2(purePricePerGr!)}/gr = {fm2(v.rawValue)}
                                                  </p>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      )}

                                      {/* ── Resumen: subtotal — solo cuando aporta info nueva
                                            · con ajuste: muestra Base / Ajuste / Subtotal (transformación)
                                            · varias variantes sin ajuste: muestra suma
                                            · 1 variante sin ajuste: el cálculo monetario ya muestra el total → se omite */}
                                      {(hasAdj || padre.variants.length > 1) && (
                                      <div className="border-t border-border/20 pt-1.5 space-y-0.5">
                                        {hasAdj ? (
                                          <>
                                            {purePrice != null && (
                                              <div className="flex items-baseline justify-between gap-2"
                                                title={`${totalGrStr} gr × ${fm2(purePrice)}/gr = ${fm2(padre.totalRawValue)}`}>
                                                <span className="text-xs text-muted/70">Base</span>
                                                <span className="text-xs tabular-nums text-foreground/70">{fm2(padre.totalRawValue)}</span>
                                              </div>
                                            )}
                                            <div className="flex items-baseline justify-between gap-2"
                                              title={`${isAdjBonif ? "−" : "+"}${Math.abs(adjPct).toFixed(2)}%`}>
                                              <span className="text-xs text-muted/70">
                                                Ajuste ({isAdjBonif ? "−" : "+"}{Math.abs(adjPct).toFixed(1)}%)
                                              </span>
                                              <span className={cn("text-xs tabular-nums shrink-0",
                                                isAdjBonif ? "text-emerald-600/80 dark:text-emerald-400/80"
                                                           : "text-amber-600/80 dark:text-amber-400/80"
                                              )}>
                                                {isAdjBonif ? "−" : "+"}{fm2(Math.abs(adjAmt))}
                                              </span>
                                            </div>
                                            <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded mt-1">
                                              <span className="text-xs font-bold text-muted/70">Subtotal</span>
                                              <span className="text-xs tabular-nums font-bold text-foreground/70">{fm2(totalValue)}</span>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded"
                                            title={purePrice != null ? `${totalGrStr} gr × ${fm2(purePrice)}/gr = ${fm2(totalValue)}` : undefined}>
                                            <span className="text-xs font-bold text-muted/70">Subtotal</span>
                                            <span className="text-xs tabular-nums font-bold text-foreground/70">{fm2(totalValue)}</span>
                                          </div>
                                        )}
                                      </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Card Hechura */}
                                {hechuraEquiv != null && (() => {
                                  // Costo total de metal (suma de todos los padres × adjFactor)
                                  const totalMetalCostForTax = metalPadreEntries.reduce(
                                    (acc: number, [, p]: [string, any]) => acc + (p.totalRawValue as number) * adjFactorMetal,
                                    0
                                  );
                                  const hasMetalCost = totalMetalCostForTax > 0.001;

                                  // ── Bonificación / Recargo global proporcional a hechura ──
                                  // hechuraEquiv ya viene con el ajuste aplicado. Para mostrarlo
                                  // explícito sin doble-contar, calculamos:
                                  //   hSumBruto = suma de hechuraLineSteps sin ajuste
                                  //   hechuraGlobalAdj = hechuraEquiv − hSumBruto
                                  // Si hay diferencia significativa, mostramos la línea
                                  // "Bonif./Recargo global" entre Subtotal e Impuestos.
                                  const hSumBruto = hechuraLineSteps.reduce(
                                    (acc: number, s: any) => acc + (s.value != null ? parseFloat(String(s.value)) : 0),
                                    0,
                                  );
                                  const hechuraGlobalAdj = hechuraEquiv! - hSumBruto;
                                  const hasGlobalAdj = Math.abs(hechuraGlobalAdj) > 0.005;
                                  const isHechuraBonif = hechuraGlobalAdj < 0;
                                  // Etiqueta del ajuste (% o monto) — leída del meta del COST_LINES_FINAL
                                  // si está disponible, así el usuario ve "5%" coherente con el bloque superior.
                                  const finalStep = stepsNorm.find((s: any) => s.key === "COST_LINES_FINAL" && s.status === "ok");
                                  const adjType = String(finalStep?.meta?.adjustmentType ?? "");
                                  const adjValue = finalStep?.meta?.adjustmentValue != null
                                    ? parseFloat(String(finalStep.meta.adjustmentValue)) : null;
                                  const adjSuffix = adjType === "PERCENTAGE" && adjValue != null
                                    ? ` ${adjValue.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`
                                    : "";

                                  // Desglose por impuesto: metalPart + hechuraPart = totalTax
                                  const hechuraTaxLines = taxItems
                                    .filter((t: any) => t.rate != null && parseFloat(String(t.rate)) > 0)
                                    .map((t: any) => {
                                      const rate       = parseFloat(String(t.rate));
                                      const metalPart  = hasMetalCost ? totalMetalCostForTax * rate / 100 : 0;
                                      const hechuraPart = hechuraEquiv! * rate / 100;
                                      const totalTax   = metalPart + hechuraPart;
                                      return { name: String(t.name), rate, metalPart, hechuraPart, totalTax };
                                    })
                                    .filter(t => t.totalTax > 0.001);

                                  const allTaxTotal    = hechuraTaxLines.reduce((a, t) => a + t.totalTax, 0);
                                  // El card de hechura muestra hechura + TODOS los impuestos (es el contenedor de impuestos)
                                  const displayTotal   = hechuraTaxLines.length > 0 ? hechuraEquiv! + allTaxTotal : hechuraEquiv!;

                                  return (
                                    <div className="rounded-lg border border-border/40 bg-muted/15 px-4 py-3 space-y-2 shadow-sm">

                                      {/* ── Cabecera: clickeable, colapsa Origen + impuestos.
                                          Forma parte del grupo "COSTO": sincronizada con los demás cards de costo. */}
                                      {(() => {
                                        const hcOpen = isExpanded("hechuraCost");
                                        // Resumen colapsado: cantidad de líneas + impuestos si los hay
                                        const summaryParts: string[] = [];
                                        if (hechuraLineSteps.length > 0) summaryParts.push(`${hechuraLineSteps.length} línea${hechuraLineSteps.length === 1 ? "" : "s"}`);
                                        if (hechuraTaxLines.length > 0) summaryParts.push("impuestos");
                                        const collapsedSummary = summaryParts.length > 0
                                          ? `Incluye ${summaryParts.join(" · ")}`
                                          : null;
                                        return (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => toggleSection("hechuraCost")}
                                              className="w-full flex items-start justify-between gap-2 cursor-pointer"
                                            >
                                              <p className="text-base font-bold uppercase tracking-wider text-foreground/60 leading-none mt-0.5 shrink-0">
                                                Hechura
                                              </p>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <p className="text-base tabular-nums font-bold text-foreground/90 leading-none text-right">
                                                  {fm2(displayTotal)}
                                                </p>
                                                <ChevronDown size={14} className={cn("text-muted/60 transition-transform mt-0.5", hcOpen && "rotate-180")} />
                                              </div>
                                            </button>
                                            {!hcOpen && collapsedSummary && (
                                              <p className="text-[11px] text-muted/70 italic leading-none pt-0.5">
                                                {collapsedSummary}
                                              </p>
                                            )}
                                          </>
                                        );
                                      })()}

                                      {/* ── DETALLE TÉCNICO — colapsable. Origen + impuestos. ── */}
                                      {isExpanded("hechuraCost") && (
                                      <>

                                      {/* ── Origen — cada línea muestra su componente y monto ── */}
                                      {hechuraLineSteps.length > 0 && (
                                        <div className="border-t border-border/20 pt-1.5 space-y-0">
                                          <p className="text-xs font-semibold uppercase tracking-widest text-muted/60 mb-1">Origen</p>
                                          <div className="space-y-1 text-xs">
                                            {hechuraLineSteps.map((step: any, i: number) => (
                                              <div key={`heq-${i}`}>
                                                {renderOtherRow(`heq-row-${i}`, step)}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* ── Bonificación / Recargo global proporcional a hechura ──
                                          Se muestra entre Origen e Impuestos para que el desglose de la card
                                          coincida con el resumen superior de "Costo unitario". */}
                                      {hasGlobalAdj && (
                                        <div className="space-y-0.5 border-t border-border/20 pt-1.5">
                                          <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-xs text-muted/70">Subtotal hechura</span>
                                            <span className="text-xs tabular-nums text-foreground/70">{fm2(hSumBruto)}</span>
                                          </div>
                                          <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-xs text-muted/70">
                                              {isHechuraBonif ? "Bonif. global" : "Recargo global"}{adjSuffix}
                                            </span>
                                            <span className={cn("text-xs tabular-nums",
                                              isHechuraBonif ? "text-emerald-600 dark:text-emerald-400"
                                                             : "text-amber-600 dark:text-amber-400"
                                            )}>
                                              {isHechuraBonif ? "−" : "+"}{fm2(Math.abs(hechuraGlobalAdj))}
                                            </span>
                                          </div>
                                          <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded mt-1">
                                            <span className="text-xs font-bold text-muted/70">Subtotal hechura ajustado</span>
                                            <span className="text-xs tabular-nums font-bold text-foreground/70">{fm2(hechuraEquiv!)}</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* ── Desglose de impuestos — formato unificado: nombre + contexto / Base × % = resultado ── */}
                                      {hechuraTaxLines.length > 0 && (
                                        <div className="space-y-1">
                                          {/* Subtotal — solo cuando hay >1 línea de origen Y NO hubo ajuste global
                                              (cuando hay ajuste, el "Subtotal hechura ajustado" de arriba ya cumple). */}
                                          {hechuraLineSteps.length > 1 && !hasGlobalAdj && (
                                            <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded">
                                              <span className="text-xs font-bold text-muted/70">Subtotal</span>
                                              <span className="text-xs tabular-nums font-bold text-foreground/70">{fm2(hechuraEquiv!)}</span>
                                            </div>
                                          )}
                                          {hechuraTaxLines.map((t, ti) => (
                                            <div key={`htax-sum-${ti}`} className="space-y-0.5 mt-1 pt-1 border-t border-border/30">
                                              {hasMetalCost && (
                                                <div className="space-y-px">
                                                  <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-xs font-medium text-muted">{t.name} {t.rate}% (Compra · metal)</span>
                                                    <span className="text-xs tabular-nums text-muted shrink-0">+{fm2(t.metalPart)}</span>
                                                  </div>
                                                  <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                    Base: {fm2(totalMetalCostForTax)} × {t.rate}% = +{fm2(t.metalPart)}
                                                  </p>
                                                </div>
                                              )}
                                              <div className="space-y-px">
                                                <div className="flex items-baseline justify-between gap-2">
                                                  <span className="text-xs font-medium text-muted">{t.name} {t.rate}% (Compra · hechura)</span>
                                                  <span className="text-xs tabular-nums text-muted shrink-0">+{fm2(t.hechuraPart)}</span>
                                                </div>
                                                <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                  Base: {fm2(hechuraEquiv!)} × {t.rate}% = +{fm2(t.hechuraPart)}
                                                </p>
                                              </div>
                                              {hasMetalCost && (
                                                <div className="flex items-baseline justify-between gap-2 border-t border-border/30 pt-0.5">
                                                  <span className="text-xs text-muted font-medium">Total {t.name} {t.rate}%</span>
                                                  <span className="text-xs tabular-nums text-foreground/70 font-bold shrink-0">+{fm2(t.totalTax)}</span>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      </>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                      ) : null;

                      // Total por cantidad — cálculo derivado en frontend (no toca pricing).
                      // Se muestra solo cuando hay >1 unidad para evitar redundancia visual.
                      const qtyForTotal = Math.max(quantity ?? 1, 1);
                      const showQtyTotal = qtyForTotal > 1 && totalCostVal != null;
                      const qtyTotalCost = showQtyTotal ? totalCostVal! * qtyForTotal : null;

                      const cuOpen = isExpanded("costUnit");
                      return (
                        <div className="rounded-xl border border-border bg-card px-4 py-3">
                          {/* ── Header — clickeable: total siempre visible; cuerpo colapsable ── */}
                          <button
                            type="button"
                            onClick={() => toggleSection("costUnit")}
                            className="w-full flex items-center justify-between gap-2 mb-2.5 cursor-pointer"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-wider">Costo unitario</p>
                            <div className="flex items-center gap-1.5">
                              {totalCostVal != null && (
                                <span className="text-sm tabular-nums font-bold text-text">{fm2(totalCostVal)}</span>
                              )}
                              <ChevronDown size={14} className={cn("text-muted/60 transition-transform", cuOpen && "rotate-180")} />
                            </div>
                          </button>

                          {/* ── Resumen colapsado: una línea con qty si aplica ── */}
                          {!cuOpen && showQtyTotal && (
                            <p className="text-[11px] text-muted/70 italic mb-1">
                              {qtyForTotal} {qtyForTotal === 1 ? "unidad" : "unidades"} · Total {fm2(qtyTotalCost!)}
                            </p>
                          )}

                          {/* ── Body — detalle técnico (líneas + ajuste + impuestos + qty) colapsable ── */}
                          {cuOpen && (
                          <div className="space-y-2 text-xs">
                            {lineRows}
                            {globalAdjEl}
                            {taxEls.length > 0 && (
                              <div className="border-t border-border/30 pt-2 mt-1 space-y-1.5">
                                {taxEls}
                              </div>
                            )}
                            {/* Cierre del costo (Costo sin imp + Total costo) — DENTRO del body,
                                colapsa junto al detalle. Aplica en ambas vistas cuando el bloque está expandido. */}
                            {costClosingEl}
                            {/* Total según cantidad — cálculo derivado, solo cuando qty > 1. */}
                            {showQtyTotal && (
                              <div className="flex justify-between items-baseline pt-1.5 mt-1 border-t border-border/30">
                                <span className="text-[11px] text-muted">Total ({qtyForTotal} {qtyForTotal === 1 ? "unidad" : "unidades"})</span>
                                <span className="text-xs tabular-nums font-bold text-text">{fm2(qtyTotalCost!)}</span>
                              </div>
                            )}
                          </div>
                          )}

                          {/* ── Composición del costo (cards) FUERA del body.
                              SIEMPRE visible en DESGLOSADO (aunque "Costo unitario" esté colapsado).
                              En UNIFICADO equivCardsEl es null → no aparece. */}
                          {equivCardsEl}
                        </div>
                      );
                    })()}

                    {/* ── COMBO COMERCIAL — bloque informativo "Componentes del combo" ──
                        Solo aparece cuando el step COMBO_COST está presente (= article es combo).
                        NO participa del cálculo: el precio del combo se resuelve por el flujo
                        normal (lista/manual). Este bloque transparenta de qué componentes y
                        costos sale el costo derivado del combo. */}
                    {comboCostStep && Array.isArray(comboCostStep.meta?.components) && (() => {
                      const components = (comboCostStep.meta.components as any[]);
                      const totalCost = comboCostStep.value != null
                        ? parseFloat(String(comboCostStep.value))
                        : components.reduce((s, c) => s + Number(c.lineCost ?? 0), 0);
                      const isPartial = comboCostStep.status === "partial" || comboCostStep.status === "missing";
                      return (
                        <div className="rounded-xl border border-border bg-card px-4 py-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider">
                              Componentes del combo
                            </p>
                            <span className="text-[10px] text-muted/60 italic">informativo · no afecta cálculo</span>
                          </div>
                          {components.length === 0 ? (
                            <p className="text-xs text-muted/60 italic">Sin componentes resueltos.</p>
                          ) : (
                            <div className="space-y-1 text-xs">
                              {components.map((c: any, ci: number) => {
                                const qty = Number(c.quantity ?? 0);
                                const cost = c.unitCost != null ? Number(c.unitCost) : null;
                                const lineCost = Number(c.lineCost ?? (cost != null ? cost * qty : 0));
                                return (
                                  <div key={`combo-info-${ci}`} className="leading-snug">
                                    <div className="flex items-baseline justify-between gap-2">
                                      <span className="text-xs text-muted font-medium min-w-0 truncate">
                                        {c.name ?? "Componente"}
                                        {c.code && <span className="ml-1 text-[10px] text-muted/55 font-mono">· {c.code}</span>}
                                      </span>
                                      <span className="text-[11px] tabular-nums font-bold text-foreground/80 shrink-0">
                                        {cost != null ? fm2(lineCost) : <span className="text-muted/50 italic">sin costo</span>}
                                      </span>
                                    </div>
                                    {cost != null && (
                                      <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                        {qty.toLocaleString("es-AR", { maximumFractionDigits: 4 })} × {fm2(cost)} = {fm2(lineCost)}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Subtotal del combo (suma de costos) */}
                              <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded mt-1">
                                <span className="text-xs font-bold text-muted/70">Costo total del combo</span>
                                <span className="text-xs tabular-nums font-bold text-foreground/70">{fm2(totalCost)}</span>
                              </div>
                              {isPartial && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-1">
                                  Algunos componentes no tienen costo resuelto: la suma puede ser parcial.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ─ Cálculo del precio ─────────────────────────────── */}
                    {basePriceVal != null && (() => {
                      const pcOpen = isExpanded("priceCalc");
                      return (
                      <div className="rounded-xl border border-border bg-card px-4 py-3">
                        {/* ── Header — clickeable: total siempre visible; cuerpo (Precio base) colapsable.
                            "Composición del precio" se mantiene independiente más abajo. */}
                        <button
                          type="button"
                          onClick={() => toggleSection("priceCalc")}
                          className="w-full flex items-center justify-between gap-2 mb-2.5 cursor-pointer"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wider">
                            Cálculo del precio
                          </p>
                          <div className="flex items-center gap-1.5">
                            {/* Total final del producto (coincide con la línea "Total producto"
                                del cierre). Se prefiere productTotalL al precio base intermedio
                                para que el header refleje el resultado, no un paso del cálculo. */}
                            <span className="text-sm tabular-nums font-bold text-text">{fm2(productTotalL ?? basePriceVal ?? 0)}</span>
                            <ChevronDown size={14} className={cn("text-muted/60 transition-transform", pcOpen && "rotate-180")} />
                          </div>
                        </button>
                        <div className="space-y-2.5 text-xs">

                          {/* ── DETALLE TÉCNICO COLAPSABLE — todo el flujo del cálculo del precio
                              (precio base, canal, ajustado, pago, envío + total a pagar).
                              "Composición del precio" queda fuera (controlada por su propio estado). */}
                          {pcOpen && (<>

                          {/* Precio base — desglosado por componentes */}
                          {(() => {
                            const mhb = metalHechuraBreakdownNorm;
                            // Factor global costo → precio (para metales)
                            const gSaleFactor: number | null = mhb
                              ? (metalCostRaw && metalCostRaw > 0.001 ? mhb.metalSale / metalCostRaw : 1)
                              : (unitCostVal && unitCostVal > 0.001 && basePriceVal && basePriceVal > 0.001
                                  ? basePriceVal / unitCostVal : null);
                            // @deprecated Fase 2 — `gHechuraSaleFactor` duplica la lógica del bloque
                            //  IIFE @~6245 (`gHSF`). Mantenido por ahora como fallback retrocompat
                            //  para snapshots pre v7 (sin `composition.{type}[i].lineSale`). Cuando
                            //  toda la flota esté en v7, este cálculo y sus 4 usos abajo pueden
                            //  remplazarse por lectura directa de `composition.hechuras[i].lineSale`.
                            //  Factor específico para hechura (puede diferir en METAL_HECHURA).
                            const gHechuraSaleFactor: number | null = mhb && mhb.hechuraCost > 0.001
                              ? mhb.hechuraSale / mhb.hechuraCost
                              : gSaleFactor;
                            const metalMarginPct = mhb
                              ? parseFloat(String(mhb.metalMarginPct ?? 0))
                              : (gSaleFactor != null ? (gSaleFactor - 1) * 100 : 0);
                            const hechuraMarginPct = mhb
                              ? parseFloat(String(mhb.hechuraMarginPct ?? 0))
                              : (gHechuraSaleFactor != null ? (gHechuraSaleFactor - 1) * 100 : 0);

                            const isManualSource  = baseStep?.key === "MANUAL_OVERRIDE" || baseStep?.key === "MANUAL_FALLBACK";
                            const isVariantSource = baseStep?.key === "VARIANT_OVERRIDE";
                            const isListSource    = baseStep?.key === "PRICE_LIST";

                            // Mismos pasos de metal que usa el bloque de Costo (disponible en scope externo)
                            const priceMetalSteps = metalQuoteSteps;
                            // Pasos de hechura/otros — calculados localmente (el array del Costo está en otro scope)
                            const priceHechSteps = (stepsNorm as any[]).filter((s: any) =>
                              ["COST_LINES_HECHURA", "COST_LINES_PRODUCT", "COST_LINES_SERVICE", "COST_LINES_MANUAL"].includes(s.key)
                              && s.status === "ok" && s.value != null
                            );
                            // Etiquetas genéricas para detectar líneas sin nombre custom
                            const PRICE_GENERIC_LABELS = new Set(["Metal", "Hechura", "Producto", "Servicio", "Manual"]);
                            const hasSingleHechura = priceHechSteps.length === 0 && (hechuraCostRaw ?? 0) > 0.001;

                            const hasMetals  = priceMetalSteps.length > 0;
                            const hasHechura = priceHechSteps.length > 0 || hasSingleHechura;
                            const hasBothSections = hasMetals && hasHechura;
                            const hasDiscPromo = discStep?.value != null || promoStep?.value != null;
                            // F1.5 #A+/#A++ — mapa canónico `costLineId → lineSale` desde
                            // `composition.{metals,hechuras,products,services}[]`. Es la
                            // fuente de verdad del pricing-engine (cierre POLICY R4.1).
                            // Cada step con `meta.costLineId` mapeado lee su sale-side
                            // desde acá; si no está, fallback al multiplicador global legacy.
                            const lineSaleByCostLineId = new Map<string, number>();
                            const compNormP: any = normLine?.composition ?? null;
                            for (const arr of [
                              compNormP?.metals, compNormP?.hechuras,
                              compNormP?.products, compNormP?.services,
                            ]) {
                              if (!Array.isArray(arr)) continue;
                              for (const it of arr) {
                                if (it?.costLineId && it?.lineSale != null
                                    && Number.isFinite(Number(it.lineSale))) {
                                  lineSaleByCostLineId.set(String(it.costLineId), Number(it.lineSale));
                                }
                              }
                            }

                            // Formato simple: precio manual/variante o sin composición metal/hechura.
                            // Para combos: pasa por aquí cuando tiene precio resuelto (lista o manual).
                            // El desglose informativo de componentes se muestra en el bloque
                            // "Componentes del combo" debajo de "Composición del costo" (no acá).
                            if ((isManualSource || isVariantSource) || (!hasMetals && !hasHechura)) {
                              const priceLabel = isVariantSource ? "Precio de variante"
                                : isManualSource ? "Precio fijo manual"
                                : `Precio de lista${baseStep?.meta?.priceListName ? ` · ${String(baseStep.meta.priceListName)}` : ""}`;
                              return (
                                <div>
                                  <div className="flex justify-between items-baseline">
                                    <span>{priceLabel}</span>
                                    <span className={cn("font-bold tabular-nums", hasDiscPromo && "text-muted/60")}>
                                      {fm2(basePriceVal!)}
                                    </span>
                                  </div>
                                  {isListSource && gSaleFactor != null && unitCostVal != null && sub(`costo ${fm2(unitCostVal)} × ${gSaleFactor.toFixed(2)}`)}
                                </div>
                              );
                            }

                            return (
                              <>
                                {/* Etiqueta de lista con margen — dinámica según modo de la lista */}
                                {isListSource && (() => {
                                  const mode     = String(baseStep?.meta?.mode ?? "");
                                  const listName = baseStep?.meta?.priceListName ? ` · ${String(baseStep.meta.priceListName)}` : "";

                                  // Descripción del margen según el modo de la lista
                                  let marginDesc: string | null = null;
                                  if (mode === "MARGIN_TOTAL") {
                                    const unifiedPct = gSaleFactor != null ? (gSaleFactor - 1) * 100 : 0;
                                    marginDesc = `Margen unificado: ${unifiedPct.toFixed(1)}%`;
                                  } else if (mode === "METAL_HECHURA") {
                                    marginDesc = `Metal (${metalMarginPct.toFixed(1)}%) + Hechura (${hechuraMarginPct.toFixed(1)}%)`;
                                  } else if (mode) {
                                    marginDesc = PRICE_LIST_MODE_SHORT[mode] ?? null;
                                  }

                                  const parts: string[] = [];
                                  if (marginDesc) parts.push(marginDesc);
                                  if (listName) parts.push(`lista${listName}`);
                                  if (parts.length === 0) return null;
                                  return (
                                    <p className="text-xs text-muted font-medium leading-snug">
                                      {parts.join(" · ")}
                                    </p>
                                  );
                                })()}

                                {/* ── Metales ── */}
                                {hasMetals && (
                                  <div className="space-y-1.5">
                                    {hasBothSections && (
                                      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Metales</p>
                                    )}
                                    {priceMetalSteps.map((step: any, qi: number) => {
                                      const m        = step.meta ?? {};
                                      const qCost    = step.value != null ? parseFloat(String(step.value)) : 0;
                                      // qty = gramos base originales (sin merma, sin margen)
                                      const qty      = step.key !== "COST_LINES_METAL"
                                        ? (m.grams != null ? parseFloat(String(m.grams)) : m.qty   != null ? parseFloat(String(m.qty))   : 0)
                                        : (m.qty   != null ? parseFloat(String(m.qty))   : m.grams != null ? parseFloat(String(m.grams)) : 0);
                                      // En el bloque de PRECIO: usar merma de entidad si hay override
                                      const variantId = String(m.variantId ?? "");
                                      const entityMerma = saleEntityMermaMap.get(variantId);
                                      const mer      = entityMerma != null ? entityMerma
                                        : (m.merma != null ? parseFloat(String(m.merma)) : 0);
                                      // F1.5 #A++ — fuente primaria del sale-side por línea METAL:
                                      // `composition.metals[i].lineSale` emitido por el pricing-engine.
                                      // Fallback retrocompat al multiplicador global legacy
                                      // `qCost × gSaleFactor` para snapshots pre v7 sin lineSale.
                                      const cliMS = m.costLineId != null ? String(m.costLineId) : null;
                                      const canonicalSaleMS = cliMS ? lineSaleByCostLineId.get(cliMS) : undefined;
                                      if (canonicalSaleMS == null) {
                                        trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_METAL", {
                                          context: "PricingSimulator: Cálculo del precio → Metales",
                                        });
                                      }
                                      const saleLine = canonicalSaleMS != null
                                        ? canonicalSaleMS
                                        : qCost * (gSaleFactor ?? 1);
                                      const metalParentNm   = (m.metalName    as string | null) ?? null;
                                      const variantFullNm   = (m.variantName  as string | null) ?? null;
                                      const variantSkuSale  = (m.variantSku   as string | null) ?? null;
                                      // L1: nombre del metal padre ("Oro"), fallback a variante o "Metal"
                                      const headLabel       = metalParentNm ?? variantFullNm ?? "Metal";
                                      // L2: "AU18K · Oro 18 Kilates" / "AU18K" / nombre variante
                                      const variantDesc     = variantSkuSale && variantFullNm
                                        ? `${variantSkuSale} · ${variantFullNm}`
                                        : variantSkuSale ?? (variantFullNm !== headLabel ? variantFullNm : null);
                                      // L3: precio/gr = saleLine / qty (gramos base originales, merma + margen incluidos)
                                      const pricePerGrSale = qty > 0.0001 ? saleLine / qty : null;
                                      return (
                                        <div key={`sale-m-${qi}`} className="space-y-0 pb-0.5">
                                          {/* L1: nombre del metal padre (con total a la derecha) */}
                                          <div className="flex justify-between items-baseline">
                                            <span className="font-medium text-text/80">{headLabel}</span>
                                            <span className="font-bold tabular-nums">{fm2(saleLine)}</span>
                                          </div>
                                          {/* L2: código · nombre variante */}
                                          {variantDesc && (
                                            <p className="text-[9px] text-muted/70 font-mono font-semibold">{variantDesc}</p>
                                          )}
                                          {/* L3: cálculo (gramos base × precio/gr con merma + margen) */}
                                          {pricePerGrSale != null && (
                                            <p className="text-[9px] text-muted/55 tabular-nums font-mono">
                                              {fmGr(qty)} gr × {fm2(pricePerGrSale)}/gr
                                            </p>
                                          )}
                                          {/* L4: merma [· margen] */}
                                          {(mer > 0 || metalMarginPct > 0.01) && pricePerGrSale != null && (
                                            <p className="text-[9px] text-muted/40 font-mono">
                                              {mer > 0 ? `merma ${mer.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%` : ""}
                                              {mer > 0 && metalMarginPct > 0.01 ? " · " : ""}
                                              {metalMarginPct > 0.01 ? `margen ${metalMarginPct.toFixed(1)}%` : ""}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* ── Hechura / Otros ── */}
                                {hasHechura && (
                                  <div className={cn("space-y-1.5", hasBothSections && "border-t border-border/20 pt-1.5")}>
                                    {hasBothSections && (
                                      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Hechura / Otros</p>
                                    )}
                                    <div className="space-y-1">
                                      {/* Render normal: líneas COST_LINES con costo × factor de margen.
                                          Combos ya no tienen render especial acá; sus componentes se muestran
                                          en el bloque informativo "Componentes del combo" (debajo del costo). */}
                                      {(
                                      /* Render normal: líneas COST_LINES con costo × factor de margen */
                                      priceHechSteps.map((step: any, hi: number) => {
                                        const m         = step.meta ?? {};
                                        const lineCost  = parseFloat(String(step.value));
                                        // F1.5 #A+ — fuente primaria: `composition.{hechuras,products,services}[i].lineSale`
                                        // (passthrough motor). Fallback retrocompat al multiplicador global
                                        // `gHechuraSaleFactor` para snapshots pre v7.
                                        const cliHS = m.costLineId != null ? String(m.costLineId) : null;
                                        const canonicalSaleHS = cliHS ? lineSaleByCostLineId.get(cliHS) : undefined;
                                        if (canonicalSaleHS == null) {
                                          trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_HECHURA", {
                                            context: "PricingSimulator: Cálculo del precio → Hechura/Otros",
                                          });
                                        }
                                        const lineSale = canonicalSaleHS != null
                                          ? canonicalSaleHS
                                          : lineCost * (gHechuraSaleFactor ?? 1);
                                        // Factor visible en la fórmula: ratio exacto cuando hay canonical,
                                        // sino el factor global. Mantiene "lineCost × factor = lineSale" cierto.
                                        const factor = canonicalSaleHS != null && lineCost > 0.0001
                                          ? canonicalSaleHS / lineCost
                                          : (gHechuraSaleFactor ?? 1);
                                        const rawLabel  = String(m.lineLabel ?? m.lineCode ?? "");
                                        const customLabel = rawLabel && !PRICE_GENERIC_LABELS.has(rawLabel) ? rawLabel : null;
                                        const showTransform = Math.abs(factor - 1) > 0.005;
                                        // Fase 2 — breakdown visual unificado (lista bruta · ajuste · efectivo).
                                        // Reemplaza la lógica de hint manual previa; misma UX, lógica
                                        // centralizada en `buildFactorBreakdown`. POLICY R4.1: cero matemática.
                                        const fbH = buildFactorBreakdown({
                                          grossMarginPct: hechuraMarginPct,
                                          effectiveFactor: factor,
                                          costAdjustment: extractCostAdjustmentFromSteps(stepsNorm),
                                        });
                                        return (
                                          <div key={`sale-h-${hi}`}>
                                            {customLabel && (
                                              <p className="text-xs text-muted/70 font-medium mb-0.5">{customLabel}</p>
                                            )}
                                            <div className="flex items-baseline justify-between gap-2">
                                              {showTransform ? (
                                                <span className="text-[11px] tabular-nums text-muted/60 leading-snug flex flex-wrap items-baseline gap-x-0.5"
                                                  title={fbH.hasDivergence && fbH.compactLine
                                                    ? `Factor efectivo: ${fbH.compactLine}`
                                                    : undefined}>
                                                  <span>{fm2(lineCost)}</span>
                                                  <span className="text-muted/35"> ×</span>
                                                  <span>{fbH.hasDivergence ? "factor efectivo " : "× "}{factor.toFixed(2)}</span>
                                                  <span className="text-muted/35"> =</span>
                                                </span>
                                              ) : <span />}
                                              <span className="text-[11px] tabular-nums font-bold text-foreground/80 shrink-0">{fm2(lineSale)}</span>
                                            </div>
                                            <FactorBreakdownHint
                                              hasDivergence={fbH.hasDivergence}
                                              compactLine={fbH.compactLine}
                                              className="leading-tight mt-0.5"
                                            />
                                          </div>
                                        );
                                      })
                                      )}
                                      {/* Resumen de hechura (METAL_MERMA_HECHURA mode: un solo total) */}
                                      {hasSingleHechura && (() => {
                                        // Fase 4.1 quick win — extraer cálculo repetido (`hechuraCostRaw × gHechuraSaleFactor`)
                                        // que aparecía 2 veces (cierre del card + fórmula visible debajo).
                                        const hechSaleVal = (hechuraCostRaw ?? 0) * (gHechuraSaleFactor ?? 1);
                                        return (
                                        <div className="space-y-0.5">
                                          <div className="flex justify-between items-baseline">
                                            <span className="font-medium text-text/80">
                                              Hechura / Mano de obra
                                              {hechuraMarginPct > 0.01 && (
                                                <span className="ml-1.5 text-[9px] text-muted/55 font-mono font-normal">
                                                  (+{hechuraMarginPct.toFixed(1)}% margen)
                                                </span>
                                              )}
                                            </span>
                                            <span className="font-bold tabular-nums">
                                              {fm2(hechSaleVal)}
                                            </span>
                                          </div>
                                          {gHechuraSaleFactor != null && Math.abs(gHechuraSaleFactor - 1) > 0.005 && (
                                            <p className="text-[9px] text-muted/55 tabular-nums mt-0.5">
                                              {fm2(hechuraCostRaw!)} × {gHechuraSaleFactor.toFixed(2)}
                                            </p>
                                          )}
                                        </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {/* Subtotal antes de descuentos/promos.
                                    Solo se muestra si AGRUPA múltiples líneas visibles (metales + hechuras).
                                    Si solo hay 1 línea, su valor ya = basePriceVal → omitir para evitar duplicación. */}
                                {hasDiscPromo && basePriceVal != null && (() => {
                                  const firstReductionVal = discStep?.value != null ? parseFloat(discStep.value)
                                    : promoStep?.value != null ? parseFloat(promoStep.value) : null;
                                  // Si el primer descuento no cambia el valor, no aporta info.
                                  if (firstReductionVal == null || Math.abs(firstReductionVal - basePriceVal) < 0.005) return null;
                                  // Cantidad de líneas visibles arriba (cada una ya muestra su propio total).
                                  const visibleLines = priceMetalSteps.length
                                    + (priceHechSteps.length > 0 ? priceHechSteps.length : (hasSingleHechura ? 1 : 0));
                                  // Con 1 sola línea, basePriceVal = ese único monto → repetiría el valor visible.
                                  if (visibleLines <= 1) return null;
                                  return (
                                    <div className="flex justify-between items-baseline">
                                      <span className="text-muted text-[10px]">Subtotal</span>
                                      <span className="font-bold tabular-nums text-muted/60">{fm2(basePriceVal)}</span>
                                    </div>
                                  );
                                })()}
                              </>
                            );
                          })()}

                          {/* ── AJUSTES COMERCIALES ──────────────────────────────────────
                              Sin subtotales intermedios. Cada ajuste muestra:
                                · label + porcentaje
                                · monto descontado/agregado a la derecha
                                · fórmula "Base: $X × Y% = ±$Z" debajo (origen del valor)
                              Al final, un único "Subtotal ajustado" antes de impuestos. */}
                          {(() => {
                            // Helper visual: fórmula de origen (mismo estilo en todos los ajustes)
                            const formulaCls = "text-[10px] text-muted/70 font-mono tabular-nums leading-tight mt-0.5";
                            return (
                              <>
                                {/* Descuento por cantidad */}
                                {discStep?.value != null && (() => {
                                  const m       = (discStep as any).meta ?? {};
                                  const priceAfter = parseFloat(discStep.value);
                                  const discAmt = m.discountAmount != null ? parseFloat(String(m.discountAmount)) : (basePriceVal != null ? basePriceVal - priceAfter : 0);
                                  const base    = m.discountBase != null ? parseFloat(String(m.discountBase)) : basePriceVal;
                                  const scopeSuffix = (() => {
                                    if (!m.scopeType || m.scopeType === "ARTICLE" || m.scopeType === "VARIANT") return "";
                                    const SL: Record<string, string> = { CATEGORY: "cat.", BRAND: "marca", GROUP: "grupo", GENERAL: "general" };
                                    const prefix = SL[String(m.scopeType)] ?? String(m.scopeType).toLowerCase();
                                    return m.scopeLabel ? ` · ${prefix}: ${m.scopeLabel}` : ` · ${prefix}`;
                                  })();
                                  const pctLabel = m.type === "PERCENTAGE" && m.value != null ? ` (−${m.value}%)` : "";
                                  const formula  = m.type === "PERCENTAGE" && m.value != null && base != null
                                    ? `Base: ${fm2(base)} × ${m.value}% = −${fm2(discAmt)}`
                                    : `−${fm2(discAmt)}`;
                                  return (
                                    <div>
                                      <div className="flex justify-between items-baseline">
                                        <span className="text-red-500 dark:text-red-400">Desc. por cantidad{scopeSuffix}{pctLabel}</span>
                                        <span className="font-bold tabular-nums shrink-0 ml-2 text-red-500 dark:text-red-400">−{fm2(discAmt)}</span>
                                      </div>
                                      <p className={formulaCls}>{formula}</p>
                                    </div>
                                  );
                                })()}

                                {/* Promoción */}
                                {promoStep?.value != null && (() => {
                                  const m       = (promoStep as any).meta ?? {};
                                  const priceAfter = parseFloat(promoStep.value);
                                  const discAmt = m.discountAmount != null ? parseFloat(String(m.discountAmount)) : null;
                                  const qdPrice = discStep?.value != null ? parseFloat(discStep.value) : null;
                                  const priceBefore = qdPrice ?? basePriceVal;
                                  const amtOff  = discAmt ?? (priceBefore != null ? priceBefore - priceAfter : 0);
                                  const base    = m.discountBase != null ? parseFloat(String(m.discountBase)) : priceBefore;
                                  const scopeSuffix = (() => {
                                    if (!m.scope || m.scope === "ALL" || m.scope === "ARTICLE" || m.scope === "VARIANT") return "";
                                    const SL: Record<string, string> = { CATEGORY: "categoría", BRAND: "marca", GROUP: "grupo" };
                                    return ` · ${SL[String(m.scope)] ?? String(m.scope).toLowerCase()}`;
                                  })();
                                  const pctLabel = m.type === "PERCENTAGE" && m.value != null ? ` (−${m.value}%)` : "";
                                  const formula  = m.type === "PERCENTAGE" && m.value != null && base != null
                                    ? `Base: ${fm2(base)} × ${m.value}% = −${fm2(amtOff)}`
                                    : `−${fm2(amtOff)}`;
                                  return (
                                    <div>
                                      <div className="flex justify-between items-baseline">
                                        <span className="text-red-500 dark:text-red-400">Promoción{scopeSuffix}{pctLabel}</span>
                                        <span className="font-bold tabular-nums shrink-0 ml-2 text-red-500 dark:text-red-400">−{fm2(amtOff)}</span>
                                      </div>
                                      <p className={formulaCls}>{formula}</p>
                                    </div>
                                  );
                                })()}

                                {/* Ajuste comercial del cliente — formato compacto, mismo patrón */}
                                {ruleStep?.value != null && (() => {
                                  const m          = (ruleStep as any).meta ?? {};
                                  const ruleType   = String(m.ruleType ?? "");
                                  const isDiscount = ruleType === "DISCOUNT" || ruleType === "BONUS";
                                  const amt        = parseFloat(ruleStep.value);
                                  const vt         = String(m.valueType ?? "");
                                  const ruleLabel  = isDiscount ? "Descuento cliente" : "Recargo cliente";
                                  const priceBeforeRule = promoStep?.value != null ? parseFloat(promoStep.value)
                                    : discStep?.value != null ? parseFloat(discStep.value)
                                    : basePriceVal;
                                  const base = m.discountBase != null ? parseFloat(String(m.discountBase))
                                             : m.surchargeBase != null ? parseFloat(String(m.surchargeBase))
                                             : priceBeforeRule;
                                  const sign = isDiscount ? "−" : "+";
                                  const colorCls = isDiscount ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
                                  const pctLabel = vt === "PERCENTAGE" && m.value != null ? ` (${sign}${m.value}%)` : "";
                                  const formula  = vt === "PERCENTAGE" && m.value != null && base != null
                                    ? `Base: ${fm2(base)} × ${m.value}% = ${sign}${fm2(amt)}`
                                    : `${sign}${fm2(amt)}`;
                                  return (
                                    <div>
                                      <div className="flex justify-between items-baseline">
                                        <span className={colorCls}>{ruleLabel}{pctLabel}</span>
                                        <span className={cn("font-bold tabular-nums shrink-0 ml-2", colorCls)}>{sign}{fm2(amt)}</span>
                                      </div>
                                      <p className={formulaCls}>{formula}</p>
                                    </div>
                                  );
                                })()}

                                {/* Subtotal ajustado — único, después del último ajuste comercial.
                                    Usa el último valor disponible: rule > promo > qty > base. */}
                                {(discStep?.value != null || promoStep?.value != null || ruleStep?.value != null) && (() => {
                                  const lastVal = ruleStep?.value != null ? (() => {
                                    const m = (ruleStep as any).meta ?? {};
                                    const isDisc = String(m.ruleType ?? "") === "DISCOUNT" || String(m.ruleType ?? "") === "BONUS";
                                    const amt = parseFloat(ruleStep.value);
                                    const before = promoStep?.value != null ? parseFloat(promoStep.value)
                                                 : discStep?.value != null ? parseFloat(discStep.value)
                                                 : basePriceVal ?? 0;
                                    return isDisc ? before - amt : before + amt;
                                  })()
                                    : promoStep?.value != null ? parseFloat(promoStep.value)
                                    : discStep?.value != null ? parseFloat(discStep.value)
                                    : basePriceVal;
                                  if (lastVal == null) return null;
                                  return (
                                    <div className="flex justify-between items-baseline border-t border-border/30 pt-1 mt-0.5">
                                      <span className="text-xs font-bold text-text">Subtotal ajustado</span>
                                      <span className="text-xs tabular-nums font-bold text-text">{fm2(lastVal)}</span>
                                    </div>
                                  );
                                })()}
                              </>
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
                            const applyOnLbl  = applyOnMeta === "NET" ? "sobre precio sin impuestos" : "sobre precio de lista";
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

                          {/* Bloque informativo "Redondeo por artículo / lista".
                              Tres ramas:
                                1) `appliedRounding` populado → el motor aplicó el
                                   redondeo y se muestran los 4 datos.
                                2) `appliedRoundingSuppressedByDocPolicy=true` →
                                   la lista tenía NET/TOTAL configurado pero la
                                   política doc lo suprimió (anti doble redondeo).
                                   Se muestra nota explícita.
                                3) Ninguno de los dos → la lista no tiene redondeo
                                   activo, no se muestra nada.
                              NO refleja el redondeo por comprobante (TENANT_POLICY).
                              Pasa-through puro del backend; cero matemática. */}
                          {(result.appliedRounding || result.appliedRoundingSuppressedByDocPolicy) && (() => {
                            // Rama 2: redondeo de lista omitido por política doc.
                            if (result.appliedRoundingSuppressedByDocPolicy && !result.appliedRounding) {
                              const meta = result.listRoundingMeta;
                              return (
                                <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 space-y-1 mt-1">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                    Redondeo por artículo / lista
                                  </div>
                                  <p className="text-[11px] italic text-muted/85">
                                    Omitido por redondeo de comprobante activo.
                                  </p>
                                  {meta && (
                                    <p className="text-[10px] text-muted/65">
                                      Configuración de la lista: {APPLIED_ROUNDING_MODE_LABEL[meta.mode] ?? meta.mode}
                                      {" · "}{APPLIED_ROUNDING_DIRECTION_LABEL[meta.direction] ?? meta.direction}
                                      {" · sobre "}{(APPLIED_ROUNDING_APPLY_ON_LABEL[meta.applyOn] ?? meta.applyOn).toLowerCase()}.
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            // Rama 1: redondeo aplicado.
                            const ar  = result.appliedRounding!;
                            const adj = Number(ar.unitAdjustment ?? 0);
                            const adjAbs = Math.abs(adj);
                            const noAdjustment = adjAbs < 0.005;
                            return (
                              <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 space-y-1 mt-1">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                  Redondeo por artículo / lista
                                </div>
                                <div className="space-y-0.5 text-[11px]">
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted">Aplicado sobre</span>
                                    <span className="font-medium text-text">
                                      {APPLIED_ROUNDING_APPLY_ON_LABEL[ar.applyOn] ?? ar.applyOn}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted">Modo</span>
                                    <span className="font-medium text-text">
                                      {APPLIED_ROUNDING_MODE_LABEL[ar.mode] ?? ar.mode}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted">Dirección</span>
                                    <span className="font-medium text-text">
                                      {APPLIED_ROUNDING_DIRECTION_LABEL[ar.direction] ?? ar.direction}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted">Ajuste unitario</span>
                                    <span className={cn(
                                      "tabular-nums font-medium",
                                      noAdjustment
                                        ? "italic text-muted/70"
                                        : adj > 0
                                          ? "text-emerald-500"
                                          : "text-amber-500",
                                    )}>
                                      {noAdjustment
                                        ? "Sin ajuste por redondeo"
                                        : (adj > 0 ? "+" : "") + fm2(adj)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Impuestos — uno por impuesto con fórmula */}
                          {hasTaxesL && (
                            <div className="border-t border-border/30 pt-2 mt-0.5 space-y-1.5">
                              {(result.taxBreakdown ?? []).map((t: any, i: number) => {
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
                                      {formulaLeft && <span className="ml-1 text-[9px] text-muted/45 tabular-nums">{formulaLeft}</span>}
                                    </span>
                                    <span className="font-bold tabular-nums text-muted shrink-0">+{fm2(t.taxAmount)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

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
                            const hasCommercialAdj = !whatIfActive && (
                              (result.channelResult != null && result.channelResult.channelAmount !== 0) ||
                              (result.couponResult?.applied === true && (result.couponResult?.discountAmount ?? 0) > 0)
                            );
                            // Etiqueta unificada: "Total producto" cuando hay impuestos; mantener "Sin impuestos" en exento.
                            const finalLabel = hasTaxesL ? "Total producto" : "Sin impuestos";
                            // Ocultar fila final cuando no agrega info: mismo valor que el precio base,
                            // sin transformación (sin impuestos, sin ajustes de pago/canal/cupón).
                            const showFinalRow =
                              hasTaxesL || hasAdj || hasCommercialAdj ||
                              basePriceVal == null || Math.abs(finalP - basePriceVal) > 0.005;
                            return (
                              <>
                                {/* Costo sin imp. — mismo estilo que en el card "Costo" (label + valor en text-xs muted) */}
                                {hasTaxesL && netP != null && Math.abs(finalP - netP) > 0.005 && (
                                  <div className="flex justify-between items-baseline text-muted">
                                    <span>Costo sin imp.</span>
                                    <span className="tabular-nums">{fm2(netP)}</span>
                                  </div>
                                )}

                                {/* Total final del producto (sin envío) — el envío se agrega al final del flujo,
                                    después de canal/cupón/pago. Esto preserva la regla: cupón solo afecta producto. */}
                                {showFinalRow && (
                                <div className={cn(
                                  "flex justify-between items-center font-bold text-sm",
                                  hasTaxesL && netP != null && Math.abs(finalP - netP) > 0.005 && "border-t border-border/30 pt-1 mt-0.5"
                                )}>
                                  <span>{finalLabel}</span>
                                  <span className="tabular-nums">{fm2(finalP)}</span>
                                </div>
                                )}

                                {/* Cupón — orden unificado: ANTES del canal (1. producto, 2. cupón, 3. canal, 4. pago, 5. envío, 6. total) */}
                                {!whatIfActive && result.couponResult != null && result.couponResult.applied && result.couponResult.discountAmount > 0 && (() => {
                                  const cp = result.couponResult!;
                                  const pctLabel = cp.discountType === "PERCENTAGE" ? ` (${cp.discountValue}%)` : "";
                                  return (
                                    <div className="pt-1.5 mt-0.5 border-t border-border/40">
                                      <div className="flex justify-between items-baseline">
                                        <span className="text-red-500 dark:text-red-400">
                                          Cupón {cp.couponCode}{pctLabel}
                                        </span>
                                        <span className="tabular-nums font-bold text-red-500 dark:text-red-400">
                                          −{fm2(cp.discountAmount)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Canal de venta — orden unificado: DESPUÉS del cupón, antes de la forma de pago */}
                                {!whatIfActive && result.channelResult != null && result.channelResult.channelAmount !== 0 && (() => {
                                  const ch       = result.channelResult!;
                                  const adjUnit  = ch.channelAmount;
                                  const isRecarg = adjUnit > 0;
                                  const selectedCh = salesChannels.find(c => c.id === channelId);
                                  const chName = selectedCh?.name ?? ch.channelName ?? "Canal";
                                  const pct = ch.baseAmount > 0 ? ch.channelAmount / ch.baseAmount * 100 : 0;
                                  return (
                                    <div className="pt-1.5 mt-0.5 border-t border-border/40">
                                      <div className="flex justify-between items-baseline">
                                        <span className={isRecarg ? "" : "text-red-500 dark:text-red-400"}>
                                          {chName}{isRecarg ? " (recargo)" : " (descuento)"}
                                          {Math.abs(pct) >= 0.01 && (
                                            <span className="opacity-60 ml-1 font-mono text-[10px]">
                                              ({pct.toFixed(1)}%)
                                            </span>
                                          )}
                                        </span>
                                        <span className={cn("tabular-nums font-bold", isRecarg ? "" : "text-red-500 dark:text-red-400")}>
                                          {fm2(adjUnit)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Precio ajustado — solo cuando hay canal/cupón y NO hay ajuste de pago */}
                                {!whatIfActive && !hasAdj && hasCommercialAdj && grandTotal != null && (
                                  <div className="pt-1.5 mt-0.5 border-t border-border/40">
                                    <div className="flex justify-between items-center font-bold text-[15px]">
                                      <span>Precio ajustado</span>
                                      <span className="tabular-nums">{fm2(grandTotal)}</span>
                                    </div>
                                  </div>
                                )}

                                {/* Subtotal antes de pago (solo cuando hay canal/cupón + ajuste de pago) */}
                                {!whatIfActive && hasAdj && cr != null && grandTotal != null &&
                                  (result.channelResult?.channelAmount !== 0 || result.couponResult?.applied) && (
                                  <div className="pt-1.5 mt-0.5 border-t border-border/40">
                                    <div className="flex justify-between items-center font-semibold text-[13px]">
                                      <span className="text-muted">Subtotal antes de pago</span>
                                      <span className="tabular-nums">{fm2(grandTotal)}</span>
                                    </div>
                                  </div>
                                )}

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
                                            {fm2(adjUnit)}
                                          </span>
                                        </div>
                                        {unitFormula && sub(unitFormula)}
                                      </div>
                                      <div>
                                        <div className="flex justify-between items-center font-bold text-[15px]">
                                          <span>Total con pago</span>
                                          <span className="tabular-nums">{fm2(finalUnit)}</span>
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

                          {/* ── Envío (step final independiente, después de cupón/canal/pago) + Total a pagar ──
                              Mismas clases que la vista UNIFICADA para consistencia visual total. */}
                          {result.shippingResult && (() => {
                            const ship = result.shippingResult;
                            // SSOT: grandTotal del scope superior ya combina canal+cupón+pago.
                            const productWithAdj = (grandTotal != null) ? grandTotal : finalP;
                            const totalAPagar = (productWithAdj ?? 0) + (ship?.amount ?? 0);
                            return (
                              <>
                                {/* Envío — text-sm text-muted, border-top tenue */}
                                <div className="flex justify-between items-center text-sm text-muted border-t border-border/30 pt-1 mt-1">
                                  <span>{ship.label}</span>
                                  <span className="tabular-nums">+{fm2(ship.amount)}</span>
                                </div>
                                {/* Total a pagar — font-extrabold text-base, fondo primary */}
                                <div className="flex justify-between items-center px-2 py-1 rounded bg-primary/5 border-t-2 border-primary/20 mt-1">
                                  <span className="text-base font-extrabold text-text">Total a pagar</span>
                                  <span className="tabular-nums text-base font-extrabold text-primary">{fm2(totalAPagar)}</span>
                                </div>
                              </>
                            );
                          })()}

                          </>)}
                          {/* ── Fin del DETALLE COLAPSABLE — lo que sigue es independiente ── */}

                          {/* ── Composición del precio (cards) — solo en Valor Desglosado ──
                              FASE 3 — sin derivación frontend. Los factores de venta
                              por componente (gSF / gHSF) salen DIRECTOS del backend
                              vía `metalSale / metalCost` y `hechuraSale / hechuraCost`.
                              Si el motor no expone los valores (caso `source = "NONE"`
                              o componente con costo 0), el factor cae a null y las
                              fórmulas que dependen de él se ocultan. */}
                          {simViewMode === "DESGLOSADO" && basePriceVal != null && (() => {
                            const mhbC = metalHechuraBreakdownNorm;
                            // Factor metal: ratio exacto backend metalSale/metalCost.
                            // F1.5 #A++ — el factor sigue acá como FALLBACK retrocompat;
                            // la fuente primaria de sale-side per línea es `composition.metals[i].lineSale`
                            // (emitido por el motor backend). Snapshots viejos pre v7 caen al factor.
                            const gSF: number | null = mhbC
                              && mhbC.metalCost != null && mhbC.metalCost > 0.001
                              && mhbC.metalSale != null
                              ? mhbC.metalSale / mhbC.metalCost
                              : null;
                            // Factor hechura: ratio exacto backend hechuraSale/hechuraCost.
                            // F1.5 #A+ — idem: fuente primaria es `composition.hechuras[i].lineSale`
                            // (+ products[].lineSale + services[].lineSale). Factor como fallback.
                            const gHSF: number | null = mhbC
                              && mhbC.hechuraCost != null && mhbC.hechuraCost > 0.001
                              && mhbC.hechuraSale != null
                              ? mhbC.hechuraSale / mhbC.hechuraCost
                              : null;
                            // F1.5 #A+/#A++ — mapa canónico `costLineId → lineSale` desde
                            // `composition.{metals,hechuras,products,services}[]`. Es la
                            // fuente de verdad emitida por el pricing-engine (cierre POLICY R4.1).
                            // Cuando un step tiene `meta.costLineId`, buscamos su lineSale acá
                            // antes de caer al cálculo `qCost × factor`.
                            const lineSaleByCostLineId = new Map<string, number>();
                            const compNorm: any = normLine?.composition ?? null;
                            for (const arr of [
                              compNorm?.metals, compNorm?.hechuras,
                              compNorm?.products, compNorm?.services,
                            ]) {
                              if (!Array.isArray(arr)) continue;
                              for (const it of arr) {
                                if (it?.costLineId && it?.lineSale != null
                                    && Number.isFinite(Number(it.lineSale))) {
                                  lineSaleByCostLineId.set(String(it.costLineId), Number(it.lineSale));
                                }
                              }
                            }
                            const mMarginPct = mhbC
                              ? parseFloat(String(mhbC.metalMarginPct ?? 0))
                              : 0;
                            const hMarginPct = mhbC
                              ? parseFloat(String(mhbC.hechuraMarginPct ?? 0))
                              : 0;
                            const pMetalSteps = metalQuoteSteps;
                            const pHechSteps = (stepsNorm as any[]).filter((s: any) =>
                              ["COST_LINES_HECHURA", "COST_LINES_PRODUCT", "COST_LINES_SERVICE", "COST_LINES_MANUAL"].includes(s.key)
                              && s.status === "ok" && s.value != null
                            );
                            const PGENLABELS = new Set(["Metal", "Hechura", "Producto", "Servicio", "Manual"]);
                            const hasSingleH = pHechSteps.length === 0 && (hechuraCostRaw ?? 0) > 0.001;
                            const hasMet = pMetalSteps.length > 0;
                            const hasHech = pHechSteps.length > 0 || hasSingleH;
                            if (!hasMet && !hasHech) return null;

                            type PPV = { qty: number; factor: number; equivGr: number; purity: number | null; merma: number | null; saleFactor: number | null; sku: string | null; variantName: string | null; quotePrice: number | null; saleLine: number };
                            type PPA = { displayName: string; symbol: string | null; totalCost: number; totalEquivGr: number; variants: PPV[] };
                            const ppMap = new Map<string, PPA>();
                            for (const step of pMetalSteps) {
                              const m     = (step as any).meta ?? {};
                              const qCost = (step as any).value != null ? parseFloat(String((step as any).value)) : 0;
                              const isMMHP = (step as any).key !== "COST_LINES_METAL";
                              const qty   = isMMHP
                                ? (m.grams != null ? parseFloat(String(m.grams)) : m.qty != null ? parseFloat(String(m.qty)) : 0)
                                : (m.qty   != null ? parseFloat(String(m.qty))   : m.grams != null ? parseFloat(String(m.grams)) : 0);
                              const pur   = m.purity != null ? parseFloat(String(m.purity)) : null;
                              // En el bloque de PRECIO: usar merma de entidad si hay override
                              const vidP  = String(m.variantId ?? "");
                              const entMerP = saleEntityMermaMap.get(vidP);
                              const mer   = entMerP != null ? entMerP : (m.merma != null ? parseFloat(String(m.merma)) : 0);
                              const mermaMulP = mer !== 0 ? (1 + mer / 100) : 1;
                              // Para METAL_QUOTE (METAL_MERMA_HECHURA): quotePrice incluye saleFactor,
                              // gramos_venta = qty × purity × saleFactor × mermaFactor.
                              // Para COST_LINES_METAL: saleFactor excluido del costo → no aplicar aquí.
                              const sfValP = isMMHP && m.saleFactor != null ? parseFloat(String(m.saleFactor)) : 1;
                              const equivGr = pur != null ? qty * pur * sfValP * mermaMulP : qty * sfValP * mermaMulP;
                              const factor = qty > 0.0001 ? equivGr / qty : (pur != null ? pur * sfValP * mermaMulP : sfValP * mermaMulP);
                              // F1.5 #A++ — fuente primaria: `composition.metals[i].lineSale`
                              // (passthrough exacto del motor: lineCost × metalSale/metalCost).
                              // Fallback retrocompat: `qCost × gSF` (cálculo legacy para
                              // snapshots pre v7). Numéricamente equivalentes mientras
                              // el factor sea uniforme — el motor lo garantiza hoy.
                              const cliId = m.costLineId != null ? String(m.costLineId) : null;
                              const canonicalSale = cliId ? lineSaleByCostLineId.get(cliId) : undefined;
                              if (canonicalSale == null) {
                                trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_METAL", {
                                  context: "PricingSimulator: Composición del precio (desglosado) → Metales",
                                });
                              }
                              const saleLine = canonicalSale != null
                                ? canonicalSale
                                : qCost * (gSF ?? 1);
                              const gKey = (m.metalId as string | null) ?? (m.metalName as string | null) ?? "Metal";
                              const prev = ppMap.get(gKey) ?? {
                                displayName: String(m.metalName ?? "Metal"),
                                symbol: (m.metalSymbol ?? null) as string | null,
                                totalCost: 0, totalEquivGr: 0, variants: [],
                              };
                              prev.totalCost    += saleLine;
                              prev.totalEquivGr += equivGr;
                              const quotePr = m.quotePrice != null ? parseFloat(String(m.quotePrice))
                                            : m.price      != null ? parseFloat(String(m.price))
                                            : null;
                              prev.variants.push({ qty, factor, equivGr, purity: pur, merma: mer > 0 ? mer : null, saleFactor: sfValP !== 1 ? sfValP : null, sku: (m.variantSku as string | null | undefined) ?? null, variantName: (m.variantName as string | null | undefined) ?? null, quotePrice: quotePr, saleLine });
                              ppMap.set(gKey, prev);
                            }
                            const ppEntries = Array.from(ppMap.values());
                            // F1.5 #A+ — preferimos `lineSale` per step (canónico del motor)
                            // sobre el prorrateo `step.value × gHSF`. Cae al fallback solo
                            // cuando el step no tiene `costLineId` mapeado (snapshot legacy).
                            const hechSaleTotal = pHechSteps.length > 0
                              ? pHechSteps.reduce((s: number, step: any) => {
                                  const cli = step?.meta?.costLineId != null ? String(step.meta.costLineId) : null;
                                  const ls = cli ? lineSaleByCostLineId.get(cli) : undefined;
                                  const stepVal = parseFloat(String(step.value));
                                  return s + (ls != null ? ls : stepVal * (gHSF ?? 1));
                                }, 0)
                              : hasSingleH ? (hechuraCostRaw ?? 0) * (gHSF ?? 1) : null;
                            if (ppEntries.length === 0 && hechSaleTotal == null) return null;

                            return (
                              <div className="pb-1 space-y-3 border-t border-border/20 pt-3 mt-3 mb-4">
                                {/* La sección siempre visible; cada card maneja su propio estado
                                    de expansión (sincronizado a través del flag global). */}
                                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/70">
                                  Composición del precio
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                  {ppEntries.map((padre, pi) => {
                                    // saleGrams = gramos base × factor de margen (el margen se ve como gramos extras)
                                    const saleGramsTotal = gSF != null && padre.totalEquivGr > 0.0001 ? padre.totalEquivGr * gSF : null;
                                    // basePricePerGr = precio real por gramo (sin inflar por margen)
                                    const basePricePerGr = saleGramsTotal != null && saleGramsTotal > 0.0001 ? padre.totalCost / saleGramsTotal : null;
                                    const saleGrStr = saleGramsTotal != null ? fmGr(saleGramsTotal) : null;
                                    // Fallback: formato antiguo (precio/gr inflado)
                                    const totalGrStr = fmGr(padre.totalEquivGr);
                                    const spg = padre.totalEquivGr > 0.0001 ? padre.totalCost / padre.totalEquivGr : null;
                                    // El número grande del card: mostrar gramos de venta (con margen)
                                    const displayGrStr = saleGrStr ?? totalGrStr;
                                    return (
                                      <div key={`pc-metal-${pi}`} className="rounded-lg border border-border/40 bg-muted/15 px-4 py-3 space-y-2 shadow-sm">
                                        {(() => {
                                          const mKey = `metalPrice-${pi}`;
                                          const mOpen = isExpanded(mKey);
                                          // Resumen colapsado: cantidad de variantes + primer SKU si existe
                                          const firstSku = padre.variants[0]?.sku ?? null;
                                          const collapsedSummary = padre.variants.length > 0
                                            ? `${padre.variants.length} ${padre.variants.length === 1 ? "origen" : "orígenes"}${firstSku ? ` · ${firstSku}` : ""}`
                                            : null;
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => toggleSection(mKey)}
                                              className="w-full flex items-start justify-between gap-2 cursor-pointer"
                                            >
                                              <div className="min-w-0 text-left">
                                                <p className="text-base font-bold uppercase tracking-wider text-foreground/60 leading-none mt-0.5 truncate">
                                                  {padre.displayName}
                                                  {padre.symbol && <span className="text-[10px] font-normal text-foreground/35 ml-1">({padre.symbol})</span>}
                                                </p>
                                                {!mOpen && collapsedSummary && (
                                                  <p className="text-[11px] text-muted/70 italic leading-none pt-1 truncate">{collapsedSummary}</p>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <p className="text-base tabular-nums font-bold text-foreground/90 leading-tight text-right">
                                                  {padre.symbol && <span className="text-[11px] font-semibold text-muted/70 mr-1">{padre.symbol}</span>}{displayGrStr} gr
                                                </p>
                                                <ChevronDown size={14} className={cn("text-muted/60 transition-transform mt-0.5", mOpen && "rotate-180")} />
                                              </div>
                                            </button>
                                          );
                                        })()}
                                        {isExpanded(`metalPrice-${pi}`) && padre.variants.length > 0 && (
                                          <div className="border-t border-border/20 pt-1.5">
                                            <p className="text-xs font-semibold uppercase tracking-widest text-muted/60 mb-1">Origen</p>
                                            <div className="space-y-1">
                                              {padre.variants.map((v, vi) => {
                                                const fmtM3v = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                                                const qStr = fmGr(v.qty);
                                                const fStr = fmtM3v(v.factor);
                                                const gStr = fmGr(v.equivGr);
                                                const originLabel = v.variantName ?? padre.displayName;

                                                // Descripción del factor — mismo formato que en COSTO
                                                let factorDesc = "";
                                                if (v.purity != null) {
                                                  const pPct    = (v.purity * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 });
                                                  const sfPct   = v.saleFactor != null ? ((v.saleFactor - 1) * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 }) : null;
                                                  const hasSF   = sfPct != null && parseFloat(sfPct) > 0.01;
                                                  const hasMerma = v.merma != null && v.merma > 0;
                                                  if (hasSF && hasMerma)       factorDesc = `pureza ${pPct}% × merma venta ${sfPct}% × merma artículo ${fmtM3v(v.merma!)}%`;
                                                  else if (hasSF)              factorDesc = `pureza ${pPct}% × merma venta ${sfPct}%`;
                                                  else if (hasMerma)           factorDesc = `pureza ${pPct}% × merma ${fmtM3v(v.merma!)}%`;
                                                  else                         factorDesc = `pureza ${pPct}%`;
                                                } else if (v.merma != null && v.merma > 0) {
                                                  factorDesc = `merma ${fmtM3v(v.merma)}%`;
                                                }

                                                // Cálculo monetario: equivGr × precio/gr = saleLine (mismo patrón que COSTO)
                                                const pricePerGrSale = v.equivGr > 0.0001 ? v.saleLine / v.equivGr : null;
                                                const showGramsCalc = Math.abs(v.factor - 1) > 0.001 && v.qty > 0.0001;
                                                const showMoneyCalc = pricePerGrSale != null && v.equivGr > 0.0001;

                                                // Gramos de venta por variante = base × factor de margen (visual derecho)
                                                const vSaleGr  = gSF != null && mMarginPct > 0.01 ? v.equivGr * gSF : null;
                                                const vSaleStr = vSaleGr != null ? fmGr(vSaleGr) : null;

                                                return (
                                                  <div key={vi} className="cursor-default leading-snug space-y-px">
                                                    {/* L1 — Origen + gramos finales */}
                                                    <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
                                                      <span className="min-w-0 truncate text-muted">
                                                        <span className="font-medium">{originLabel}</span>
                                                        {v.sku && <span className="ml-1 font-mono text-muted/70">· {v.sku}</span>}
                                                      </span>
                                                      <span className="shrink-0 text-muted/70">{vSaleStr ?? gStr} gr</span>
                                                    </div>
                                                    {/* L2 — Cálculo de gramos: qty × factor = equivGr */}
                                                    {showGramsCalc && (
                                                      <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                        {qStr} gr × {fStr} = {gStr} gr
                                                        {factorDesc && <span className="ml-1 text-muted/35">({factorDesc})</span>}
                                                      </p>
                                                    )}
                                                    {/* L3 — Cálculo monetario: equivGr × precio/gr = saleLine */}
                                                    {showMoneyCalc && (
                                                      <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                        {gStr} gr × {fm2(pricePerGrSale!)}/gr = {fm2(v.saleLine)}
                                                      </p>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                        {/* ── Subtotal — mismas reglas que COSTO: solo cuando aporta info ── */}
                                        {padre.variants.length > 1 && (
                                          <div className="border-t border-border/20 pt-1.5">
                                            <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded"
                                              title={
                                                saleGrStr != null && basePricePerGr != null
                                                  ? `${saleGrStr} gr${mMarginPct > 0.01 ? ` (incl. +${mMarginPct.toFixed(1)}%)` : ""} × ${fm2(basePricePerGr)}/gr = ${fm2(padre.totalCost)}`
                                                  : spg != null
                                                    ? `${totalGrStr} gr × ${fm2(spg)}/gr = ${fm2(padre.totalCost)}`
                                                    : undefined
                                              }>
                                              <span className="text-xs font-bold text-muted/70">Subtotal</span>
                                              <span className="text-xs tabular-nums font-bold text-foreground/70">{fm2(padre.totalCost)}</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {hechSaleTotal != null && (() => {
                                    // Total metal de venta (suma de todos los padres)
                                    const totalMetalSaleForTax = ppEntries.reduce((acc: number, p: any) => acc + p.totalCost, 0);
                                    const hasMetalSale = totalMetalSaleForTax > 0.001;

                                    // ── Ajustes que se muestran sobre HECHURA ─────────────────────────
                                    // Combina dos fuentes:
                                    //   1) `componentSaleBreakdown.hechura.adjustments` — ajustes que el
                                    //      motor IMPUTÓ al componente HECHURA (applyOn=HECHURA: entity
                                    //      rule, qty/promo cuando aplican al componente). Passthrough
                                    //      puro: NO reconstruimos el objeto para no perder campos
                                    //      adicionales que el backend agregue en el futuro.
                                    //   2) `result.quantityDiscountAmount` / `result.promotionDiscountAmount`
                                    //      — descuentos qty/promo aplicados a nivel TOTAL. Se enriquecen
                                    //      con `base` + `percentage` desde `discStep.meta` / `promoStep.meta`
                                    //      para poder mostrar la fórmula (Base × % = −monto).
                                    //
                                    // Dedupe por `kind`: si el mismo kind ya viene en csb (porque el
                                    // motor lo imputó al componente), no lo duplicamos desde meta.
                                    type Adj = {
                                      kind:        string;
                                      label:       string;
                                      amount:      number;
                                      base?:       number | null;
                                      percentage?: number | null;
                                      valueType?:  string | null;
                                      [key: string]: any;
                                    };
                                    const csbHechura = (result as any).componentSaleBreakdown?.hechura ?? null;
                                    // Passthrough: preservamos todos los campos del backend, solo
                                    // sobrescribimos el `label` con el resolver y aseguramos `amount`
                                    // como Number.
                                    const csbAdjustments: Adj[] = Array.isArray(csbHechura?.adjustments)
                                      ? csbHechura.adjustments.map((a: any) => ({
                                          ...a,
                                          label:  resolveAdjustmentLabel(a),
                                          amount: Number(a.amount ?? 0),
                                        }))
                                      : [];
                                    const csbKinds = new Set(csbAdjustments.map(a => a.kind));
                                    const metaAdjustments: Adj[] = [];
                                    const qtyDiscAmt = (result as any).quantityDiscountAmount != null
                                      ? parseFloat(String((result as any).quantityDiscountAmount)) : 0;
                                    if (Number.isFinite(qtyDiscAmt) && qtyDiscAmt > 0
                                        && !csbKinds.has("QUANTITY_DISCOUNT")) {
                                      const dm = (discStep as any)?.meta ?? {};
                                      const dBase = dm.discountBase != null ? parseFloat(String(dm.discountBase)) : null;
                                      const dPct  = dm.type === "PERCENTAGE" && dm.value != null
                                        ? parseFloat(String(dm.value)) : null;
                                      metaAdjustments.push({
                                        kind:       "QUANTITY_DISCOUNT",
                                        label:      resolveAdjustmentLabel({ kind: "QUANTITY_DISCOUNT" }),
                                        amount:     qtyDiscAmt,
                                        base:       Number.isFinite(dBase as number) ? dBase : null,
                                        percentage: Number.isFinite(dPct  as number) ? dPct  : null,
                                        valueType:  typeof dm.type === "string" ? dm.type : null,
                                      });
                                    }
                                    const promoAmt = (result as any).promotionDiscountAmount != null
                                      ? parseFloat(String((result as any).promotionDiscountAmount)) : 0;
                                    if (Number.isFinite(promoAmt) && promoAmt > 0
                                        && !csbKinds.has("PROMOTION")) {
                                      const pm = (promoStep as any)?.meta ?? {};
                                      const promoName = (result as any).appliedPromotionName;
                                      const pBase = pm.discountBase != null ? parseFloat(String(pm.discountBase)) : null;
                                      const pPct  = pm.type === "PERCENTAGE" && pm.value != null
                                        ? parseFloat(String(pm.value)) : null;
                                      metaAdjustments.push({
                                        kind:       "PROMOTION",
                                        label:      promoName ? `Promoción: ${promoName}` : resolveAdjustmentLabel({ kind: "PROMOTION" }),
                                        amount:     promoAmt,
                                        base:       Number.isFinite(pBase as number) ? pBase : null,
                                        percentage: Number.isFinite(pPct  as number) ? pPct  : null,
                                        valueType:  typeof pm.type === "string" ? pm.type : null,
                                      });
                                    }
                                    // Orden final: meta primero (qty + promo), luego csb (entity rule, etc.).
                                    const adjustments: Adj[] = [...metaAdjustments, ...csbAdjustments]
                                      .filter(a => Math.abs(a.amount) > 0.005);
                                    const totalAdjustments = adjustments.reduce((s, a) => s + a.amount, 0);
                                    const hasAdjustments = adjustments.length > 0;
                                    // Subtotal ajustado de hechura = base − descuentos visibles. Mantiene
                                    // consistencia con el render: lo que muestra el card cuadra con la
                                    // suma. El IVA de hechura abajo se calcula sobre esto.
                                    const hechSaleAdjusted = hechSaleTotal! - totalAdjustments;

                                    // Desglose por impuesto: IVA sobre subtotal ajustado (no sobre la base original).
                                    // Esto sincroniza el IVA visual con el del bloque "Cálculo del precio".
                                    const saleTaxLines = (result.taxBreakdown as any[])
                                      .filter((t: any) => t.rate != null && parseFloat(String(t.rate)) > 0)
                                      .map((t: any) => {
                                        const rate       = parseFloat(String(t.rate));
                                        const metalPart  = hasMetalSale ? totalMetalSaleForTax * rate / 100 : 0;
                                        const hechuraPart = hechSaleAdjusted * rate / 100;
                                        const totalTax   = metalPart + hechuraPart;
                                        return { name: String(t.name), rate, metalPart, hechuraPart, totalTax };
                                      })
                                      .filter((t: any) => t.totalTax > 0.001);
                                    const allSaleTaxTotal  = saleTaxLines.reduce((a: number, t: any) => a + t.totalTax, 0);
                                    // Redondeo: no es metálico → pertenece al card de Hechura
                                    const rndDiff = rndStep?.value != null && rndStep.meta?.preRounding != null
                                      ? parseFloat(rndStep.value) - parseFloat(String(rndStep.meta.preRounding))
                                      : 0;
                                    const hasRounding = Math.abs(rndDiff) > 0.001;

                                    // SSOT: el header del card Hechura = Total producto − Σ Metales.
                                    // Garantiza por construcción que: Σ Metales + Hechura = Total producto.
                                    // El desglose interno (origen + ajustes + impuestos + redondeo) sigue siendo
                                    // informativo, pero el cierre del card NO se recalcula desde sus partes.
                                    const productTotalRawAll = result.totalWithTax != null
                                      ? parseFloat(String(result.totalWithTax))
                                      : null;
                                    const displaySaleTotal = productTotalRawAll != null
                                      ? productTotalRawAll - totalMetalSaleForTax
                                      : hechSaleAdjusted + allSaleTaxTotal + rndDiff;

                                    // ── Pre-cómputo del cierre — usado tanto en el header como en el bloque inferior.
                                    //    El header muestra el valor FINAL del card (Hechura ± ajustes post-producto).
                                    //    Esto evita dos números grandes compitiendo en el mismo card.
                                    const couponDiscRaw = !whatIfActive && result.couponResult?.applied
                                      ? (result.couponResult.discountAmount ?? 0)
                                      : 0;
                                    const channelRaw    = !whatIfActive ? (result.channelResult?.channelAmount ?? 0) : 0;
                                    const qtyHC         = Math.max(quantity ?? 1, 1);
                                    const crHC          = result.checkoutResult;
                                    const hasPayHC      = !whatIfActive && crHC != null && crHC.paymentAdjustment != null && crHC.paymentAdjustment !== 0;
                                    const paymentRaw    = hasPayHC ? crHC!.paymentAdjustment / qtyHC : 0;
                                    const shippingRaw   = result.shippingResult?.amount ?? 0;
                                    const hasAnyFinalAdj = couponDiscRaw > 0.005
                                                          || Math.abs(channelRaw) > 0.005
                                                          || Math.abs(paymentRaw) > 0.005
                                                          || result.shippingResult != null;
                                    const finalCardTotal = displaySaleTotal + channelRaw - couponDiscRaw + paymentRaw + shippingRaw;

                                    return (
                                      <div className="rounded-lg border border-border/40 bg-muted/15 px-4 py-3 space-y-2 shadow-sm">

                                        {/* ── Cabecera — clickeable para colapsar/expandir el detalle técnico.
                                            Único valor protagonista del card (cierre final). */}
                                        {(() => {
                                          const open = isExpanded("hechura");
                                          // Resumen para estado colapsado (qué se está ocultando, en una línea)
                                          const summaryParts: string[] = [];
                                          if (pHechSteps.length > 0)    summaryParts.push(`${pHechSteps.length} línea${pHechSteps.length === 1 ? "" : "s"}`);
                                          if (hasAdjustments)           summaryParts.push("ajustes");
                                          if (saleTaxLines.length > 0)  summaryParts.push("impuestos");
                                          if (hasRounding)              summaryParts.push("redondeo");
                                          const collapsedSummary = summaryParts.length > 0
                                            ? `Incluye ${summaryParts.join(" · ")}`
                                            : null;
                                          return (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => toggleSection("hechura")}
                                                className="w-full flex items-start justify-between gap-2 group cursor-pointer"
                                              >
                                                <p className="text-base font-bold uppercase tracking-wider text-foreground/60 leading-none mt-0.5 shrink-0">
                                                  Hechura
                                                </p>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  <p className="text-base tabular-nums font-bold text-foreground/90 leading-none text-right">
                                                    {fm2(finalCardTotal)}
                                                  </p>
                                                  <ChevronDown size={14} className={cn("text-muted/60 transition-transform mt-0.5", open && "rotate-180")} />
                                                </div>
                                              </button>
                                              {!open && collapsedSummary && (
                                                <p className="text-[11px] text-muted/70 italic leading-none pt-0.5">
                                                  {collapsedSummary}
                                                </p>
                                              )}
                                            </>
                                          );
                                        })()}

                                        {/* ── DETALLE TÉCNICO — colapsable. NO afecta cálculo.
                                            Incluye: Origen + Ajustes motor + Impuestos + Redondeo + Total componente. */}
                                        {isExpanded("hechura") && (
                                        <>

                                        {/* ── Origen — alineado con renderOtherRow de COSTO: text-[10px]/[11px] ──
                                            Para combos: render directo desde baseStep.meta.components (sin factor),
                                            cada componente trae unitPrice + quantity ya resueltos por el motor. */}
                                        {(baseStep?.key === "COMBO_BASE" && Array.isArray(baseStep?.meta?.components) && (baseStep.meta.components as any[]).length > 0) ? (
                                          <div className="border-t border-border/20 pt-1.5 space-y-0">
                                            <p className="text-xs font-semibold uppercase tracking-widest text-muted/60 mb-1">
                                              Componentes del combo
                                            </p>
                                            <div className="space-y-1 text-xs">
                                              {(baseStep.meta.components as any[]).map((c, ci) => {
                                                const hasDiscount = c.unitPriceGross != null && c.discountAmount > 0;
                                                return (
                                                  <div key={`combo-card-c-${ci}`} className="leading-snug">
                                                    <div className="flex items-baseline justify-between gap-2">
                                                      <span className="text-xs text-muted font-medium min-w-0 truncate">
                                                        {c.name ?? "Componente"}
                                                        {c.code && <span className="ml-1 text-[10px] text-muted/55 font-mono">· {c.code}</span>}
                                                      </span>
                                                      <span className="text-[11px] tabular-nums font-bold text-foreground/80 shrink-0">
                                                        {fm2(Number(c.lineTotal ?? 0))}
                                                      </span>
                                                    </div>
                                                    {/* Desglose con descuento del componente cuando aplica */}
                                                    {hasDiscount ? (
                                                      <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                        {Number(c.quantity).toLocaleString("es-AR", { maximumFractionDigits: 4 })} ×{" "}
                                                        <span className="line-through text-muted/50">{fm2(Number(c.unitPriceGross))}</span>{" "}
                                                        →{" "}
                                                        <span className="text-emerald-600 dark:text-emerald-400">
                                                          −{c.discountPercent != null ? `${Number(c.discountPercent).toFixed(c.discountPercent % 1 === 0 ? 0 : 2)}%` : fm2(Number(c.discountAmount))}
                                                        </span>{" "}
                                                        = {fm2(Number(c.unitPrice))}
                                                      </p>
                                                    ) : c.unitPrice != null && (
                                                      <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                        {Number(c.quantity).toLocaleString("es-AR", { maximumFractionDigits: 4 })} × {fm2(Number(c.unitPrice))} = {fm2(Number(c.lineTotal ?? 0))}
                                                      </p>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ) : pHechSteps.length > 0 && (
                                          <div className="border-t border-border/20 pt-1.5 space-y-0">
                                            <p className="text-xs font-semibold uppercase tracking-widest text-muted/60 mb-1">Origen</p>
                                            <div className="space-y-1 text-xs">
                                              {pHechSteps.map((step: any, hi: number) => {
                                                const m = step.meta ?? {};
                                                const lineCost = parseFloat(String(step.value));
                                                // F1.5 #A+ — fuente primaria: `composition.{hechuras,products,services}[i].lineSale`
                                                // (passthrough motor). Fallback retrocompat al multiplicador global
                                                // `gHSF` cuando el step no tiene `costLineId` mapeado (snapshot pre v7).
                                                // El "factor visible" en la fórmula se deriva del lineSale canónico
                                                // (`lineSale/lineCost`) cuando éste está disponible — esto refleja el
                                                // ratio exacto que aplicó el motor a la línea, no el promedio
                                                // agregado del bucket.
                                                const cli = m.costLineId != null ? String(m.costLineId) : null;
                                                const canonicalSale = cli ? lineSaleByCostLineId.get(cli) : undefined;
                                                if (canonicalSale == null) {
                                                  trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_HECHURA", {
                                                    context: "PricingSimulator: Card Hechura expandido → Origen",
                                                  });
                                                }
                                                const lineSale = canonicalSale != null
                                                  ? canonicalSale
                                                  : lineCost * (gHSF ?? 1);
                                                const factor = canonicalSale != null && lineCost > 0.0001
                                                  ? canonicalSale / lineCost
                                                  : (gHSF ?? 1);
                                                const rawLabel = String(m.lineLabel ?? m.lineCode ?? "");
                                                const customLabel = rawLabel && !PGENLABELS.has(rawLabel) ? rawLabel : null;
                                                // Fallback al tipo del step → nunca dejar el origen vacío
                                                const STEP_TYPE_LABEL: Record<string, string> = {
                                                  COST_LINES_HECHURA:   "Hechura",
                                                  COST_LINES_PRODUCT:   "Producto",
                                                  COST_LINES_SERVICE:   "Servicio",
                                                  COST_LINES_MANUAL:    "Manual",
                                                  COST_LINES_LOGISTICS: "Envío",
                                                };
                                                const originLabel = customLabel ?? STEP_TYPE_LABEL[String(step.key)] ?? "Componente";
                                                // Cálculo del precio: costo × factor margen = venta
                                                const showFactorCalc = Math.abs(factor - 1) > 0.005 && lineCost > 0.0001;
                                                // Fase 2 — breakdown visual unificado (lista bruta · ajuste · efectivo).
                                                const fbH2 = buildFactorBreakdown({
                                                  grossMarginPct: hMarginPct,
                                                  effectiveFactor: factor,
                                                  costAdjustment: extractCostAdjustmentFromSteps(stepsNorm),
                                                });
                                                return (
                                                  <div key={`hcard-d-${hi}`} className="leading-snug">
                                                    {/* Origen + resultado venta — mismas clases que COSTO renderOtherRow */}
                                                    <div className="flex items-baseline justify-between gap-2">
                                                      <span className="text-xs text-muted font-medium min-w-0 truncate">{originLabel}</span>
                                                      <span className="text-[11px] tabular-nums font-bold text-foreground/80 shrink-0">{fm2(lineSale)}</span>
                                                    </div>
                                                    {/* Cálculo: costo × factor efectivo = venta (cuando hay margen) */}
                                                    {showFactorCalc && (
                                                      <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5"
                                                        title={fbH2.hasDivergence && fbH2.compactLine
                                                          ? `Factor efectivo: ${fbH2.compactLine}`
                                                          : undefined}>
                                                        {fm2(lineCost)} × {fbH2.hasDivergence ? "factor efectivo " : ""}{factor.toFixed(2)} = {fm2(lineSale)}
                                                      </p>
                                                    )}
                                                    <FactorBreakdownHint
                                                      hasDivergence={fbH2.hasDivergence}
                                                      compactLine={fbH2.compactLine}
                                                      className="leading-tight mt-0.5"
                                                    />
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                        {/* ── Ajustes del motor que aplican al producto: PROMO + DESC. CANTIDAD ──
                                            Cupón / canal / regla cliente NO se renderizan acá (son globales/capa-2). */}
                                        {hasAdjustments && (
                                          <div className="space-y-1">
                                            {/* Subtotal hechura (base antes de ajustes) */}
                                            <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded">
                                              <span className="text-xs font-bold text-muted/70">Subtotal hechura</span>
                                              <span className="text-xs tabular-nums font-bold text-foreground/70">{fm2(hechSaleTotal!)}</span>
                                            </div>
                                            {adjustments.map((adj, ai) => {
                                              // Convención: amount > 0 reduce el precio (descuento /
                                              // bonificación) → render en rojo con signo "−".
                                              // amount < 0 lo aumenta (recargo) → render en ámbar con "+".
                                              const reduces = adj.amount > 0;
                                              const sign     = reduces ? "−" : "+";
                                              const colorCls = reduces
                                                ? "text-red-500 dark:text-red-400"
                                                : "text-amber-600 dark:text-amber-400";
                                              // Línea secundaria: "Base: $X × Y% = −$Z" cuando el ajuste
                                              // tiene base y porcentaje (qty/promo PERCENTAGE). Para
                                              // ENTITY_RULE / MANUAL_DISCOUNT el backend no expone base
                                              // todavía → se omite la línea secundaria.
                                              const showFormula = adj.base != null
                                                              && adj.percentage != null
                                                              && adj.base > 0;
                                              const showPctTag  = !showFormula
                                                              && adj.percentage != null;
                                              return (
                                                <div key={`hadj-${ai}-${adj.kind}`} className="space-y-px">
                                                  <div className="flex items-baseline justify-between gap-2">
                                                    <span className={cn("text-xs font-medium", colorCls)}>
                                                      {adj.label}
                                                      {showPctTag && (
                                                        <span className="ml-1 text-[10px] text-muted/70 font-mono">
                                                          ({sign}{adj.percentage}%)
                                                        </span>
                                                      )}
                                                    </span>
                                                    <span className={cn("text-xs tabular-nums font-bold shrink-0", colorCls)}>
                                                      {sign}{fm2(Math.abs(adj.amount))}
                                                    </span>
                                                  </div>
                                                  {showFormula && (
                                                    <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                      Base: {fm2(adj.base!)} × {adj.percentage}% = {sign}{fm2(Math.abs(adj.amount))}
                                                    </p>
                                                  )}
                                                </div>
                                              );
                                            })}
                                            {/* Subtotal ajustado — cierre del bloque de ajustes */}
                                            <div className="flex items-baseline justify-between gap-2 border-t border-border/30 pt-1 mt-0.5">
                                              <span className="text-xs font-bold text-text">Subtotal ajustado</span>
                                              <span className="text-xs tabular-nums font-bold text-text">{fm2(hechSaleAdjusted)}</span>
                                            </div>
                                          </div>
                                        )}

                                        {/* ── Desglose de impuestos — formato unificado ── */}
                                        {saleTaxLines.length > 0 && (
                                          <div className="space-y-1">
                                            {/* Subtotal hechura — cuando hay >1 línea Y NO hubo ajustes (sino el "Subtotal ajustado" ya cumple) */}
                                            {pHechSteps.length > 1 && !hasAdjustments && (
                                              <div className="flex items-baseline justify-between gap-2 bg-muted/20 px-2 py-1 rounded">
                                                <span className="text-xs font-bold text-muted/70">Subtotal</span>
                                                <span className="text-xs tabular-nums font-bold text-foreground/70">{fm2(hechSaleTotal!)}</span>
                                              </div>
                                            )}
                                            {saleTaxLines.map((t: any, ti: number) => (
                                              <div key={`stax-${ti}`} className="space-y-0.5 mt-1 pt-1 border-t border-border/30">
                                                {hasMetalSale && (
                                                  <div className="space-y-px">
                                                    <div className="flex items-baseline justify-between gap-2">
                                                      <span className="text-xs font-medium text-muted">{t.name} {t.rate}% (Venta · metal)</span>
                                                      <span className="text-xs tabular-nums text-muted shrink-0">+{fm2(t.metalPart)}</span>
                                                    </div>
                                                    <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                      Base: {fm2(totalMetalSaleForTax)} × {t.rate}% = +{fm2(t.metalPart)}
                                                    </p>
                                                  </div>
                                                )}
                                                <div className="space-y-px">
                                                  <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-xs font-medium text-muted">{t.name} {t.rate}% (Venta · hechura)</span>
                                                    <span className="text-xs tabular-nums text-muted shrink-0">+{fm2(t.hechuraPart)}</span>
                                                  </div>
                                                  <p className="text-[11px] text-muted tabular-nums font-mono leading-tight mt-0.5">
                                                    Base: {fm2(hechSaleAdjusted)} × {t.rate}% = +{fm2(t.hechuraPart)}
                                                  </p>
                                                </div>
                                                {hasMetalSale && (
                                                  <div className="flex items-baseline justify-between gap-2 border-t border-border/30 pt-0.5">
                                                    <span className="text-xs text-muted font-medium">Total {t.name} {t.rate}%</span>
                                                    <span className="text-xs tabular-nums text-foreground/70 font-bold shrink-0">+{fm2(t.totalTax)}</span>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* ── Redondeo — componente no metálico ── */}
                                        {hasRounding && (
                                          <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-xs text-muted/70">
                                              Redondeo
                                              {rndStep?.meta?.direction
                                                ? ` ${ROUNDING_DIR_SYMBOLS[String(rndStep.meta.direction)] ?? ""}`.trimEnd()
                                                : ""}
                                            </span>
                                            <span className="text-xs tabular-nums text-foreground/70 shrink-0">
                                              {rndDiff > 0 ? "+" : ""}{fm2(rndDiff)}
                                            </span>
                                          </div>
                                        )}

                                        {/* ── Total componente — línea INFORMATIVA (no protagonista).
                                            El valor protagonista del card vive en el header.
                                            Esta línea solo cierra el flujo intermedio: hechura − ajustes motor + impuestos + redondeo. */}
                                        {(saleTaxLines.length > 0 || hasRounding || hasAdjustments) && (
                                          <div className="flex items-baseline justify-between gap-2 border-t border-border/20 pt-1">
                                            <span className="text-xs text-muted/70">Total componente</span>
                                            <span className="text-xs tabular-nums text-muted/70 shrink-0">{fm2(displaySaleTotal)}</span>
                                          </div>
                                        )}

                                        </>
                                        )}

                                        {/* ── Cierre del producto — desglose de los ajustes post-producto.
                                            SSOT: usa las mismas variables pre-computadas que el header.
                                            "Total a cobrar" se mantiene como línea de cierre pero discreta:
                                            el número grande ya está en el header del card. */}
                                        {hasAnyFinalAdj && (() => {
                                          const channelName = result.channelResult?.channelName
                                            ? (salesChannels.find(c => c.id === channelId)?.name ?? result.channelResult.channelName)
                                            : "Canal";
                                          const payLabel  = selectedPM?.name ?? "Pago";
                                          const shipLabel = result.shippingResult?.label ?? "Envío";

                                          // ── Trazabilidad: base + % derivado de los amounts del backend (no recalcula pricing) ──
                                          // Cupón: discountType/discountValue del backend dan el %, baseAmount es el monto sobre el que se aplica.
                                          const cR = result.couponResult;
                                          const couponBase  = cR?.baseAmount ?? null;
                                          const couponPct   = cR?.discountType === "PERCENTAGE" && cR?.discountValue != null
                                            ? cR.discountValue
                                            : (cR && couponBase != null && couponBase > 0.005 ? (cR.discountAmount / couponBase) * 100 : null);
                                          const couponIsFixed = cR?.discountType === "FIXED";

                                          // Canal: % derivado del backend (channelAmount / baseAmount).
                                          const chR        = result.channelResult;
                                          const channelBase = chR?.baseAmount ?? null;
                                          const channelPct  = chR && channelBase != null && channelBase > 0.005
                                            ? (chR.channelAmount / channelBase) * 100
                                            : null;

                                          // Pago: % derivado (paymentAdjustment total / baseAmount total).
                                          //       Mostramos la base por-unidad para que cierre con el resto del card.
                                          const ckR        = result.checkoutResult;
                                          const paymentBaseUnit = ckR?.baseAmount != null ? ckR.baseAmount / qtyHC : null;
                                          const paymentPct      = ckR && ckR.baseAmount > 0.005
                                            ? (ckR.paymentAdjustment / ckR.baseAmount) * 100
                                            : null;

                                          // Envío: descripción del modo, sin %.
                                          const shipModeDesc = result.shippingResult?.mode === "FIXED"     ? "Tarifa fija configurada"
                                                              : result.shippingResult?.mode === "BY_WEIGHT" ? "Calculado por peso"
                                                              : result.shippingResult?.mode === "FREE"      ? "Sin cargo"
                                                              : null;

                                          // Helper: formato breve de %
                                          const pctStr = (p: number) => `${p > 0 ? "+" : ""}${p.toFixed(p % 1 === 0 ? 0 : 2)}%`;

                                          return (
                                            <div className="pt-1.5 mt-0.5 border-t border-border/30 space-y-1">
                                              <p className="text-[8px] font-semibold uppercase tracking-widest text-muted/40 mb-0.5">
                                                Cierre del producto
                                              </p>

                                              {/* Total producto (= base Hechura, mismo valor que header sin ajustes) */}
                                              <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-[11px] text-muted">Total producto</span>
                                                <span className="text-[11px] tabular-nums font-semibold text-text">{fm2(displaySaleTotal)}</span>
                                              </div>

                                              {/* Cupón — con código, % y base */}
                                              {couponDiscRaw > 0.005 && cR && (
                                                <div className="space-y-px">
                                                  <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-[11px] text-red-500 dark:text-red-400">
                                                      Cupón {cR.couponCode}
                                                      {couponPct != null && !couponIsFixed && (
                                                        <span className="ml-1 text-[10px] text-muted/70 font-mono">(−{couponPct.toFixed(couponPct % 1 === 0 ? 0 : 2)}%)</span>
                                                      )}
                                                      {couponIsFixed && cR.discountValue != null && (
                                                        <span className="ml-1 text-[10px] text-muted/70 font-mono">(monto fijo)</span>
                                                      )}
                                                    </span>
                                                    <span className="text-[11px] tabular-nums font-semibold text-red-500 dark:text-red-400">−{fm2(couponDiscRaw)}</span>
                                                  </div>
                                                  {couponBase != null && couponBase > 0.005 && (
                                                    <p className="text-[10px] text-muted/60 tabular-nums font-mono leading-tight ml-2">
                                                      Base: {fm2(couponBase)}
                                                      {couponPct != null && !couponIsFixed
                                                        ? ` × ${couponPct.toFixed(couponPct % 1 === 0 ? 0 : 2)}% = −${fm2(couponDiscRaw)}`
                                                        : ` − ${fm2(couponDiscRaw)} (fijo)`}
                                                    </p>
                                                  )}
                                                </div>
                                              )}

                                              {/* Canal — con % y base (signo según recargo/descuento) */}
                                              {Math.abs(channelRaw) > 0.005 && (
                                                <div className="space-y-px">
                                                  <div className="flex items-baseline justify-between gap-2">
                                                    <span className={cn("text-[11px]", channelRaw > 0 ? "text-emerald-600/80 dark:text-emerald-400/70" : "text-red-500 dark:text-red-400")}>
                                                      {channelName}
                                                      {channelPct != null && Math.abs(channelPct) > 0.01 && (
                                                        <span className="ml-1 text-[10px] text-muted/70 font-mono">({pctStr(channelPct)})</span>
                                                      )}
                                                    </span>
                                                    <span className={cn("text-[11px] tabular-nums font-semibold", channelRaw > 0 ? "text-emerald-600/80 dark:text-emerald-400/70" : "text-red-500 dark:text-red-400")}>
                                                      {channelRaw > 0 ? "+" : "−"}{fm2(Math.abs(channelRaw))}
                                                    </span>
                                                  </div>
                                                  {channelBase != null && channelBase > 0.005 && channelPct != null && (
                                                    <p className="text-[10px] text-muted/60 tabular-nums font-mono leading-tight ml-2">
                                                      Base: {fm2(channelBase)} × {pctStr(channelPct)} = {channelRaw > 0 ? "+" : "−"}{fm2(Math.abs(channelRaw))}
                                                    </p>
                                                  )}
                                                </div>
                                              )}

                                              {/* Forma de pago — con % y base (por unidad para coincidir con el card) */}
                                              {Math.abs(paymentRaw) > 0.005 && (
                                                <div className="space-y-px">
                                                  <div className="flex items-baseline justify-between gap-2">
                                                    <span className={cn("text-[11px]", paymentRaw > 0 ? "text-emerald-600/80 dark:text-emerald-400/70" : "text-red-500 dark:text-red-400")}>
                                                      {payLabel}
                                                      {paymentPct != null && Math.abs(paymentPct) > 0.01 && (
                                                        <span className="ml-1 text-[10px] text-muted/70 font-mono">({pctStr(paymentPct)})</span>
                                                      )}
                                                    </span>
                                                    <span className={cn("text-[11px] tabular-nums font-semibold", paymentRaw > 0 ? "text-emerald-600/80 dark:text-emerald-400/70" : "text-red-500 dark:text-red-400")}>
                                                      {paymentRaw > 0 ? "+" : "−"}{fm2(Math.abs(paymentRaw))}
                                                    </span>
                                                  </div>
                                                  {paymentBaseUnit != null && paymentBaseUnit > 0.005 && paymentPct != null && (
                                                    <p className="text-[10px] text-muted/60 tabular-nums font-mono leading-tight ml-2">
                                                      Base: {fm2(paymentBaseUnit)} × {pctStr(paymentPct)} = {paymentRaw > 0 ? "+" : "−"}{fm2(Math.abs(paymentRaw))}
                                                    </p>
                                                  )}
                                                </div>
                                              )}

                                              {/* Envío — con descripción del modo */}
                                              {result.shippingResult != null && (
                                                <div className="space-y-px">
                                                  <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-[11px] text-muted">{shipLabel}</span>
                                                    <span className="text-[11px] tabular-nums font-semibold text-text">+{fm2(shippingRaw)}</span>
                                                  </div>
                                                  {shipModeDesc && (
                                                    <p className="text-[10px] text-muted/60 italic leading-tight ml-2">{shipModeDesc}</p>
                                                  )}
                                                </div>
                                              )}

                                              {/* Total a cobrar — línea informativa (el header del card ya tiene el valor protagonista) */}
                                              <div className="flex items-baseline justify-between gap-2 border-t border-border/30 pt-1 mt-0.5">
                                                <span className="text-[11px] text-muted/70">Total a cobrar</span>
                                                <span className="text-[11px] tabular-nums text-muted/70 shrink-0">{fm2(finalCardTotal)}</span>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    );
                                  })()}
                                </div>

                              </div>
                            );
                          })()}

                        </div>
                      </div>
                      );
                    })()}

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
