// src/components/pricing/PricingStepsBreakdown/parts/PriceBaseSection.tsx
// ============================================================================
// Sección de precio base: precio de lista / variante / manual / fallback,
// con desglose por componente metal/hechura cuando aplica.
//
// Origen: PricingSimulator.tsx:4525-4838.
//
// Tres modos de display:
//   1. Simple: precio único (manual / variante / lista sin composición).
//   2. Desglosado metal+hechura: cards de cada metal + líneas de hechura,
//      con factor de margen explícito por componente.
//   3. Subtotal pre-descuento: cuando hay >1 línea visible y existen
//      descuentos/promos posteriores.
//
// Read-only — todos los `lineSale` vienen del motor (composition.{type}[i].lineSale).
// Fallback legacy `lineCost × factor` solo para snapshots pre-v7.
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import {
  formatGrams,
  formatMoneyDisplay,
  formatDecimal,
} from "../../../../lib/pricing/format";
import {
  buildFactorBreakdown,
  extractCostAdjustmentFromSteps,
} from "../../../../lib/pricing-factor-display";
import FactorBreakdownHint from "../../../ui/FactorBreakdownHint";
import { trackLegacyPricingPath } from "../../../../lib/pricing-legacy-telemetry";
import {
  PRICE_GENERIC_LABELS,
  PRICE_LIST_MODE_SHORT,
  selectMetalQuoteSteps,
  selectPriceHechuraSteps,
} from "../helpers";
import type {
  PricingStepsDisplay,
  LineSaleByCostLineId,
  NormalizedPricingLine,
} from "../types";
import type { PricingStepResult } from "../../../../services/articles";

export type PriceBaseSectionProps = {
  baseStep:               PricingStepResult | undefined;
  basePriceVal:           number | null;
  steps:                  PricingStepResult[];
  line:                   NormalizedPricingLine | null;
  metalCostRaw:           number | null;
  hechuraCostRaw:         number | null;
  unitCostVal:            number | null;
  metalHechuraBreakdown:  { metalCost: number; hechuraCost: number; metalSale: number; hechuraSale: number; metalMarginPct?: number | string; hechuraMarginPct?: number | string } | null;
  saleEntityMermaMap:     Map<string, number>;
  lineSaleByCostLineId:   LineSaleByCostLineId;
  hasDiscPromo:           boolean;
  display:                PricingStepsDisplay;
};

function SubLine({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] mt-0.5 leading-snug text-muted/60">{children}</p>;
}

export function PriceBaseSection(props: PriceBaseSectionProps): React.ReactElement | null {
  const {
    baseStep, basePriceVal, steps, line,
    metalCostRaw, hechuraCostRaw, unitCostVal,
    metalHechuraBreakdown: mhb,
    saleEntityMermaMap, lineSaleByCostLineId,
    hasDiscPromo, display,
  } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  if (basePriceVal == null) return null;

  // Factor global costo → precio (para metales). Pure derivation: ratio del response.
  const gSaleFactor: number | null = mhb
    ? (metalCostRaw && metalCostRaw > 0.001 ? mhb.metalSale / metalCostRaw : 1)
    : (unitCostVal && unitCostVal > 0.001 && basePriceVal > 0.001
        ? basePriceVal / unitCostVal : null);
  // Factor específico para hechura (puede diferir en METAL_HECHURA).
  const gHechuraSaleFactor: number | null = mhb && mhb.hechuraCost > 0.001
    ? mhb.hechuraSale / mhb.hechuraCost
    : gSaleFactor;
  const metalMarginPct = mhb
    ? parseFloat(String(mhb.metalMarginPct ?? 0))
    : (gSaleFactor != null ? (gSaleFactor - 1) * 100 : 0);
  const hechuraMarginPct = mhb
    ? parseFloat(String(mhb.hechuraMarginPct ?? 0))
    : (gHechuraSaleFactor != null ? (gHechuraSaleFactor - 1) * 100 : 0);

  // ── Modo derivado / valor unificado (HECHURA) — display puro ─────────────
  // En modos derivados (MARGIN_TOTAL / PROPORTIONAL_COST / SERVICE_AS_HECHURA
  // / MANUAL_AS_HECHURA / COMBO_COMPONENTS) el motor emite `hechuraMarginPct
  // = 0` a propósito y `composition.hechuras[i].lineSale` colapsa al
  // `lineCost`. Sin contexto, el monto a la derecha de cada fila se confunde
  // con precio. Para que la fila se vea igual que en modo desglosado (mismo
  // patrón `cost × factor = venta`), cuando detectamos el caso reusamos el
  // factor global ya derivado (`basePrice / unitCost`).
  // Σ(lineCost × unifiedFactor) === basePrice por construcción del motor en
  // PROPORTIONAL_COST/SERVICE_AS_HECHURA (paridad agregada).
  //
  // Es display puro: el unifiedFactor sale de dividir dos campos passthrough
  // del motor (no calcula precios nuevos). Mismo criterio de detección que
  // `SaleCompositionEditableGrid` / `PriceCompositionCards`.
  const isHechuraMarginUnattributable = (() => {
    if (!mhb) return false;
    const mpct = Number(mhb.hechuraMarginPct ?? 0);
    const hc   = Number(mhb.hechuraCost ?? 0);
    const hs   = Number(mhb.hechuraSale ?? 0);
    return Number.isFinite(mpct) && Math.abs(mpct) < 0.001
        && Number.isFinite(hc) && hc > 0.001
        && Number.isFinite(hs) && Math.abs(hs - hc) > 0.005;
  })();
  // Factor unificado para reutilizar en filas colapsadas. Mismo número que
  // ya muestra el subtítulo "Margen unificado: X,X%" del card padre.
  const unifiedFactor: number | null = (unitCostVal != null && unitCostVal > 0.001
      && basePriceVal != null && basePriceVal > 0.001)
    ? basePriceVal / unitCostVal
    : null;

  const isManualSource  = baseStep?.key === "MANUAL_OVERRIDE" || baseStep?.key === "MANUAL_FALLBACK";
  const isVariantSource = baseStep?.key === "VARIANT_OVERRIDE";
  const isListSource    = baseStep?.key === "PRICE_LIST";

  const priceMetalSteps = selectMetalQuoteSteps(steps);
  const priceHechSteps  = selectPriceHechuraSteps(steps);
  const hasSingleHechura = priceHechSteps.length === 0 && (hechuraCostRaw ?? 0) > 0.001;
  const hasMetals  = priceMetalSteps.length > 0;
  const hasHechura = priceHechSteps.length > 0 || hasSingleHechura;
  const hasBothSections = hasMetals && hasHechura;

  // ── Modo simple: manual / variante / sin composición ─────────────────────
  if ((isManualSource || isVariantSource) || (!hasMetals && !hasHechura)) {
    const meta: any = (baseStep as any)?.meta ?? {};
    const priceLabel = isVariantSource ? "Precio de variante"
      : isManualSource ? "Precio fijo manual"
      : `Precio de lista${meta.priceListName ? ` · ${String(meta.priceListName)}` : ""}`;
    return (
      <div>
        <div className="flex justify-between items-baseline">
          <span>{priceLabel}</span>
          <span className={cn("font-bold tabular-nums", hasDiscPromo && "text-muted/60")}>
            {fm(basePriceVal)}
          </span>
        </div>
        {isListSource && gSaleFactor != null && unitCostVal != null && (
          <SubLine>costo {fm(unitCostVal)} × {formatDecimal(gSaleFactor, 2)}</SubLine>
        )}
      </div>
    );
  }

  // ── Modo desglosado: metal+hechura ───────────────────────────────────────
  void line; // consumido a través de lineSaleByCostLineId
  return (
    <>
      {/* Etiqueta de lista con margen — dinámica según modo */}
      {isListSource && (() => {
        const meta: any = (baseStep as any)?.meta ?? {};
        const mode     = String(meta.mode ?? "");
        const listName = meta.priceListName ? ` · ${String(meta.priceListName)}` : "";
        let marginDesc: string | null = null;
        if (mode === "MARGIN_TOTAL") {
          // El motor aplica UN margen al COSTO TOTAL del artículo
          // (unitCost → basePrice). El ratio basePriceVal/unitCostVal es el
          // factor unificado real y funciona aunque metalCost sea 0 (artículo
          // de sólo hechura). Fallback a gSaleFactor preserva el comportamiento
          // previo cuando esos campos no estén disponibles.
          const unifiedFactor = (unitCostVal != null && unitCostVal > 0.001
              && basePriceVal != null && basePriceVal > 0.001)
            ? basePriceVal / unitCostVal
            : gSaleFactor;
          const unifiedPct = unifiedFactor != null ? (unifiedFactor - 1) * 100 : null;
          // 0.0% es engañoso: suele significar "dato faltante", no margen real
          // de cero. Si no hay margen efectivo, se oculta la fila.
          if (unifiedPct != null && Math.abs(unifiedPct) > 0.01) {
            marginDesc = `Margen unificado: ${formatDecimal(unifiedPct, 1)}%`;
          }
        } else if (mode === "METAL_HECHURA") {
          marginDesc = `Metal (${formatDecimal(metalMarginPct, 1)}%) + Hechura (${formatDecimal(hechuraMarginPct, 1)}%)`;
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
            const m: any = step.meta ?? {};
            const qCost  = step.value != null ? parseFloat(String(step.value)) : 0;
            const qty = step.key !== "COST_LINES_METAL"
              ? (m.grams != null ? parseFloat(String(m.grams)) : m.qty != null ? parseFloat(String(m.qty)) : 0)
              : (m.qty   != null ? parseFloat(String(m.qty))   : m.grams != null ? parseFloat(String(m.grams)) : 0);
            const variantId = String(m.variantId ?? "");
            const entityMerma = saleEntityMermaMap.get(variantId);
            const mer = entityMerma != null ? entityMerma : (m.merma != null ? parseFloat(String(m.merma)) : 0);
            const cliMS = m.costLineId != null ? String(m.costLineId) : null;
            const canonicalSaleMS = cliMS ? lineSaleByCostLineId.get(cliMS) : undefined;
            if (canonicalSaleMS == null) {
              trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_METAL", {
                context: "PricingStepsBreakdown: PriceBase → Metales",
              });
            }
            const saleLine = canonicalSaleMS != null ? canonicalSaleMS : qCost * (gSaleFactor ?? 1);
            const metalParentNm  = (m.metalName    as string | null) ?? null;
            const variantFullNm  = (m.variantName  as string | null) ?? null;
            const variantSkuSale = (m.variantSku   as string | null) ?? null;
            const headLabel = metalParentNm ?? variantFullNm ?? "Metal";
            const variantDesc = variantSkuSale && variantFullNm
              ? `${variantSkuSale} · ${variantFullNm}`
              : variantSkuSale ?? (variantFullNm !== headLabel ? variantFullNm : null);
            const pricePerGrSale = qty > 0.0001 ? saleLine / qty : null;
            return (
              <div key={`sale-m-${qi}`} className="space-y-0 pb-0.5">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium text-text/80">{headLabel}</span>
                  <span className="font-bold tabular-nums">{fm(saleLine)}</span>
                </div>
                {variantDesc && (
                  <p className="text-[9px] text-muted/70 font-mono font-semibold">{variantDesc}</p>
                )}
                {pricePerGrSale != null && (
                  <p className="text-[9px] text-muted/55 tabular-nums font-mono">
                    {formatGrams(qty)} gr × {fm(pricePerGrSale)}/gr
                  </p>
                )}
                {(mer > 0 || metalMarginPct > 0.01) && pricePerGrSale != null && (
                  <p className="text-[9px] text-muted/40 font-mono">
                    {mer > 0 ? `merma ${formatGrams(mer, 3)}%` : ""}
                    {mer > 0 && metalMarginPct > 0.01 ? " · " : ""}
                    {metalMarginPct > 0.01 ? `margen ${formatDecimal(metalMarginPct, 1)}%` : ""}
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
            {priceHechSteps.map((step: any, hi: number) => {
              const m: any = step.meta ?? {};
              const lineCost = parseFloat(String(step.value));
              const cliHS = m.costLineId != null ? String(m.costLineId) : null;
              const canonicalSaleHS = cliHS ? lineSaleByCostLineId.get(cliHS) : undefined;
              if (canonicalSaleHS == null) {
                trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_HECHURA", {
                  context: "PricingStepsBreakdown: PriceBase → Hechura/Otros",
                });
              }
              // Cuando el motor colapsa la fila (`canonicalSaleHS === lineCost`)
              // y estamos en modo derivado, reusamos el factor unificado del
              // artículo para mostrar la misma transformación visual `cost ×
              // factor = venta` que el modo desglosado. Σ(lineCost × unified)
              // === basePrice por construcción del motor.
              const useUnifiedFactorH =
                isHechuraMarginUnattributable
                && canonicalSaleHS != null
                && lineCost > 0.0001
                && Math.abs(canonicalSaleHS - lineCost) < 0.005
                && unifiedFactor != null
                && Math.abs(unifiedFactor - 1) > 0.005;
              const lineSale = useUnifiedFactorH
                ? lineCost * (unifiedFactor as number)
                : (canonicalSaleHS != null ? canonicalSaleHS : lineCost * (gHechuraSaleFactor ?? 1));
              const factor = useUnifiedFactorH
                ? (unifiedFactor as number)
                : (canonicalSaleHS != null && lineCost > 0.0001
                    ? canonicalSaleHS / lineCost
                    : (gHechuraSaleFactor ?? 1));
              const rawLabel = String(m.lineLabel ?? m.lineCode ?? "");
              const customLabel = rawLabel && !PRICE_GENERIC_LABELS.has(rawLabel) ? rawLabel : null;
              const showTransform = Math.abs(factor - 1) > 0.005;
              const fbH = buildFactorBreakdown({
                grossMarginPct: hechuraMarginPct,
                effectiveFactor: factor,
                costAdjustment: extractCostAdjustmentFromSteps(steps),
              });
              return (
                <div key={`sale-h-${hi}`}>
                  {customLabel && (
                    <p className="text-xs text-muted/70 font-medium mb-0.5">{customLabel}</p>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    {showTransform ? (
                      <span
                        className="text-[11px] tabular-nums text-muted/60 leading-snug flex flex-wrap items-baseline gap-x-0.5"
                        title={fbH.hasDivergence && fbH.compactLine
                          ? `Factor efectivo: ${fbH.compactLine}`
                          : undefined}
                      >
                        <span>{fm(lineCost)}</span>
                        <span className="text-muted/35"> ×</span>
                        <span>{fbH.hasDivergence ? "factor efectivo " : "× "}{formatDecimal(factor, 2)}</span>
                        <span className="text-muted/35"> =</span>
                      </span>
                    ) : <span />}
                    <span className="text-[11px] tabular-nums font-bold text-foreground/80 shrink-0">{fm(lineSale)}</span>
                  </div>
                  <FactorBreakdownHint
                    hasDivergence={fbH.hasDivergence}
                    compactLine={fbH.compactLine}
                    className="leading-tight mt-0.5"
                  />
                </div>
              );
            })}
            {/* Resumen de hechura (METAL_MERMA_HECHURA mode: un solo total) */}
            {hasSingleHechura && (() => {
              // En modos derivados, `gHechuraSaleFactor` ya da el ratio
              // correcto (`hechuraSale / hechuraCost` → factor unificado).
              // Si por algún motivo viniera colapsado (factor ≈ 1) pero el
              // detector indica modo derivado, caemos al `unifiedFactor`.
              const hechFactorEffective: number =
                gHechuraSaleFactor != null && Math.abs(gHechuraSaleFactor - 1) > 0.005
                  ? gHechuraSaleFactor
                  : (isHechuraMarginUnattributable && unifiedFactor != null
                      ? unifiedFactor
                      : (gHechuraSaleFactor ?? 1));
              const hechSaleVal = (hechuraCostRaw ?? 0) * hechFactorEffective;
              return (
                <div className="space-y-0.5">
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium text-text/80">
                      Hechura / Mano de obra
                      {hechuraMarginPct > 0.01 && (
                        <span className="ml-1.5 text-[9px] text-muted/55 font-mono font-normal">
                          (+{formatDecimal(hechuraMarginPct, 1)}% margen)
                        </span>
                      )}
                    </span>
                    <span className="font-bold tabular-nums">{fm(hechSaleVal)}</span>
                  </div>
                  {Math.abs(hechFactorEffective - 1) > 0.005 && (
                    <p className="text-[9px] text-muted/55 tabular-nums mt-0.5">
                      {fm(hechuraCostRaw!)} × {formatDecimal(hechFactorEffective, 2)}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Subtotal antes de descuentos/promos — solo cuando agrupa >1 línea */}
      {hasDiscPromo && (() => {
        const visibleLines = priceMetalSteps.length
          + (priceHechSteps.length > 0 ? priceHechSteps.length : (hasSingleHechura ? 1 : 0));
        if (visibleLines <= 1) return null;
        return (
          <div className="flex justify-between items-baseline">
            <span className="text-muted text-[10px]">Subtotal</span>
            <span className="font-bold tabular-nums text-muted/60">{fm(basePriceVal)}</span>
          </div>
        );
      })()}
    </>
  );
}
