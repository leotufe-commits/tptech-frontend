// src/components/pricing/PriceCompositionCards/PriceCompositionCards.tsx
// ============================================================================
// PriceCompositionCards — Cards de composición del precio (modo DESGLOSADO).
//
// Compartido entre Simulador, Factura (futuro) y Comparador. Read-only
// (POLICY R6).
//
// Decomposición (parts/):
//   - MetalSaleCard   — card por metal padre con variants + subtotal
//   - HechuraSaleCard — card hechura con detalle técnico + cierre del producto
//
// Origen: PricingSimulator.tsx, IIFE en líneas 4549-5393 (FASE 7).
// ============================================================================

import React, { useState, useCallback, useMemo } from "react";
import { cn } from "../../ui/tp";
import { vt } from "../../../lib/pricing/visualTokens";
import {
  selectBaseStep,
  selectQuantityDiscountStep,
  selectPromotionStep,
  selectRoundingStep,
  selectPriceHechuraSteps,
  buildLineSaleByCostLineIdMap,
  buildSaleEntityMermaMap,
} from "../PricingStepsBreakdown/helpers";
import {
  computeMetalSaleFactor,
  computeHechuraSaleFactor,
  buildMetalSaleMap,
  computeHechuraSaleTotal,
  buildHechuraAdjustments,
  buildSaleTaxLines,
} from "./helpers";
import type { PriceCompositionCardsProps } from "./types";
import { MetalSaleCard }   from "./parts/MetalSaleCard";
import { HechuraSaleCard } from "./parts/HechuraSaleCard";

const DEFAULT_DISPLAY = { rate: 1, symbol: "$" } as const;

export function PriceCompositionCards(props: PriceCompositionCardsProps): React.ReactElement | null {
  const {
    steps,
    line,
    result,
    quantity = 1,
    channel = null,
    payment = null,
    whatIfActive = false,
    hechuraCostRaw: hechuraCostRawProp = null,
    display = DEFAULT_DISPLAY,
    variant = "full",
    expanded: expandedProp,
    onToggle,
  } = props;

  // ── Estado de expansión (controlado o local) ────────────────────────────
  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>({});
  const expanded = expandedProp ?? localExpanded;
  const isExpanded = useCallback((key: string) => Boolean(expanded[key]), [expanded]);
  const toggleSection = useCallback((key: string) => {
    if (onToggle) { onToggle(key); return; }
    setLocalExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }, [onToggle]);

  // ── Steps clave (selectores memoizados) ──────────────────────────────────
  const baseStep  = useMemo(() => selectBaseStep(steps),               [steps]);
  const discStep  = useMemo(() => selectQuantityDiscountStep(steps),   [steps]);
  const promoStep = useMemo(() => selectPromotionStep(steps),          [steps]);
  const rndStep   = useMemo(() => selectRoundingStep(steps),           [steps]);
  const pHechSteps = useMemo(() => selectPriceHechuraSteps(steps),     [steps]);

  // ── Mapas / agregaciones puras ───────────────────────────────────────────
  const lineSaleByCostLineId = useMemo(() => buildLineSaleByCostLineIdMap(line), [line]);
  const saleEntityMermaMap   = useMemo(() => buildSaleEntityMermaMap(steps),     [steps]);

  // ── Factores de venta (ratios del motor) ─────────────────────────────────
  const mhb = line?.metalHechuraBreakdown ?? null;
  const metalSaleFactor   = useMemo(() => computeMetalSaleFactor(mhb as any),   [mhb]);
  const hechuraSaleFactor = useMemo(() => computeHechuraSaleFactor(mhb as any), [mhb]);
  const mMarginPct = mhb ? parseFloat(String((mhb as any).metalMarginPct   ?? 0)) : 0;
  const hMarginPct = mhb ? parseFloat(String((mhb as any).hechuraMarginPct ?? 0)) : 0;
  const hechuraCostRaw = hechuraCostRawProp ?? (mhb as any)?.hechuraCost ?? null;

  // ── Modo derivado / valor unificado (HECHURA) — display puro ─────────────
  // En modos derivados (MARGIN_TOTAL / PROPORTIONAL_COST / SERVICE_AS_HECHURA /
  // MANUAL_AS_HECHURA / COMBO_COMPONENTS) el motor emite `hechuraMarginPct = 0`
  // a propósito y los `composition.hechuras[i].lineSale` colapsan al `lineCost`
  // (factor backend = 1). El subtotal/header del card sigue mostrando precio
  // venta (= `result.totalWithTax − Σmetales`), pero el detalle por línea
  // queda sin la fórmula `cost × factor = venta` y se confunde con precio.
  //
  // En esos casos reusamos el factor global del artículo (basePrice/unitCost)
  // como ratio display para que la fila se vea como en modo desglosado.
  // Σ(lineCost × unifiedFactor) === basePrice por construcción del motor en
  // PROPORTIONAL_COST/SERVICE_AS_HECHURA (paridad agregada).
  //
  // Misma heurística que `SaleCompositionEditableGrid.tsx` y `PriceBaseSection`.
  const isHechuraMarginUnattributable = (() => {
    if (!mhb) return false;
    const mpct = Number((mhb as any).hechuraMarginPct);
    const hc   = Number((mhb as any).hechuraCost);
    const hs   = Number((mhb as any).hechuraSale);
    return Number.isFinite(mpct) && Math.abs(mpct) < 0.001
        && Number.isFinite(hc) && hc > 0.001
        && Number.isFinite(hs) && Math.abs(hs - hc) > 0.005;
  })();
  // Factor unificado para reutilizar en filas colapsadas. Mismo dato que el
  // subtítulo "Margen unificado: X,X%" del PriceBaseSection.
  const unifiedFactor: number | null = (() => {
    const uc = Number(line?.unitCost ?? 0);
    const bp = Number(line?.basePrice ?? 0);
    if (!Number.isFinite(uc) || uc <= 0.001) return null;
    if (!Number.isFinite(bp) || bp <= 0.001) return null;
    return bp / uc;
  })();

  // ── Agregaciones de metal y hechura ──────────────────────────────────────
  const ppMap = useMemo(
    () => buildMetalSaleMap({ steps, lineSaleByCostLineId, saleEntityMermaMap, metalSaleFactor }),
    [steps, lineSaleByCostLineId, saleEntityMermaMap, metalSaleFactor],
  );
  const ppEntries = useMemo(() => Array.from(ppMap.values()), [ppMap]);
  const hechSaleTotal = useMemo(
    () => computeHechuraSaleTotal({ steps, lineSaleByCostLineId, hechuraSaleFactor, hechuraCostRaw }),
    [steps, lineSaleByCostLineId, hechuraSaleFactor, hechuraCostRaw],
  );

  // ── Ajustes que se imputan a hechura ─────────────────────────────────────
  const adjustments = useMemo(
    () => buildHechuraAdjustments({ result, discStep, promoStep }),
    [result, discStep, promoStep],
  );

  // ── Desglose impuestos venta (metal + hechura) ───────────────────────────
  const saleTaxLines = useMemo(() => {
    if (hechSaleTotal == null) return [];
    const totalAdj = adjustments.reduce((s, a) => s + a.amount, 0);
    const hechSaleAdjusted = hechSaleTotal - totalAdj;
    const totalMetalSaleForTax = ppEntries.reduce((acc, p) => acc + p.totalCost, 0);
    return buildSaleTaxLines({
      taxBreakdown:           (result?.taxBreakdown ?? []) as any,
      totalMetalSaleForTax,
      hechuraSaleAdjusted:    hechSaleAdjusted,
    });
  }, [result, adjustments, hechSaleTotal, ppEntries]);

  // ── Guardia: sin metal ni hechura → no renderizar ────────────────────────
  if (ppEntries.length === 0 && hechSaleTotal == null) return null;

  // En compact (Factura) usamos grid 1-col y separator más sutil para no
  // saturar el modal estrecho. En full (Simulador/Comparador) mantenemos
  // el grid 2-col del diseño original.
  const gridCls   = variant === "compact" ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-4";
  const outerCls  = variant === "compact"
    ? "pb-1 space-y-2 pt-2 mt-2"
    : "pb-1 space-y-3 border-t border-border/20 pt-3 mt-3 mb-4";

  return (
    <div className={outerCls}>
      <p className={cn(vt.text.groupLabel, vt.colors.labelSoft)}>
        Composición del precio
      </p>
      <div className={gridCls}>
        {ppEntries.map((padre, pi) => {
          const mKey = `metalPrice-${pi}`;
          return (
            <MetalSaleCard
              key={`pc-metal-${pi}`}
              padre={padre}
              metalSaleFactor={metalSaleFactor}
              marginPct={mMarginPct}
              expanded={isExpanded(mKey)}
              onToggle={() => toggleSection(mKey)}
              display={display}
            />
          );
        })}
        {hechSaleTotal != null && (
          <HechuraSaleCard
            pHechSteps={pHechSteps}
            hechuraSaleTotal={hechSaleTotal}
            lineSaleByCostLineId={lineSaleByCostLineId}
            hechuraSaleFactor={hechuraSaleFactor}
            hechuraMarginPct={hMarginPct}
            isMarginUnattributable={isHechuraMarginUnattributable}
            unifiedFactor={unifiedFactor}
            steps={steps}
            adjustments={adjustments}
            metalSaleEntries={ppEntries}
            saleTaxLines={saleTaxLines}
            rndStep={rndStep}
            baseStep={baseStep}
            result={result}
            whatIfActive={whatIfActive}
            quantity={quantity}
            display={display}
            channel={channel}
            payment={payment}
            expanded={isExpanded("hechura")}
            onToggle={() => toggleSection("hechura")}
          />
        )}
      </div>
    </div>
  );
}

export default PriceCompositionCards;
