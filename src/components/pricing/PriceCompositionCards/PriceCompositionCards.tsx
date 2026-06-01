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
import { CommercialPhysicalRoundingBlock } from "../CommercialPhysicalRoundingBlock";

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
  // Key del map (gKey en buildMetalSaleMap = metalId ?? metalName ?? "Metal").
  // La preservamos como tupla aparte para no inflar el shape de MetalSaleParent.
  const ppKeys    = useMemo(() => Array.from(ppMap.keys()),   [ppMap]);
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

  // ── Etapa C-comercial / C6 (POLICY §R-Rounding-14) ─────────────────────
  // Snapshot del redondeo COMERCIAL PHYSICAL — passthrough estricto del
  // breakdown que el motor ya generó. Si la lista operó MONETARY (legacy)
  // o no hubo delta, el bloque interno (`CommercialPhysicalRoundingBlock`)
  // se auto-oculta. Cero cálculo nuevo: el componente lee `metalSale` y
  // `hechuraSale` post-rounding directos del backend.
  const mhbAny: any = mhb;
  const commercialPhysical = mhbAny?.physical ?? null;
  const metalSalePreRounding    = mhbAny?.metalSalePreRounding    ?? null;
  const metalSaleRoundingDelta  = mhbAny?.metalSaleRoundingDelta  ?? null;
  const hechuraSalePreRounding  = mhbAny?.hechuraSalePreRounding  ?? null;
  const hechuraSaleRoundingDelta= mhbAny?.hechuraSaleRoundingDelta?? null;

  // Override post-redondeo de HECHURA — passthrough del campo canónico del
  // motor (`metalHechuraBreakdown.hechuraSale`). Paridad con aside "Total
  // del comprobante" que también lee este campo para el subtotal de hechura.
  // null/undefined del backend → sin override (el card cae al agregado
  // legacy `hechuraSaleTotal`).
  const hechuraSalePostOverride: number | null = (() => {
    if (!mhb) return null;
    const raw = (mhb as any).hechuraSale;
    if (raw == null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  })();

  // Map para lookup de postGrams por metal padre. Keyeado por `metalParentId`
  // (primario) y `metalParentName` (fallback). Mismo snapshot que ya consume
  // `CommercialPhysicalRoundingBlock` — cero matemática nueva.
  const postGramsByParentKey: Map<string, number> = useMemo(() => {
    const m = new Map<string, number>();
    const list = (commercialPhysical?.metals ?? []) as Array<{
      metalParentId:   string | null;
      metalParentName: string;
      postGrams:       number;
    }>;
    for (const entry of list) {
      const v = Number(entry?.postGrams);
      if (!Number.isFinite(v)) continue;
      if (entry.metalParentId)   m.set(entry.metalParentId, v);
      if (entry.metalParentName) m.set(entry.metalParentName, v);
    }
    return m;
  }, [commercialPhysical]);

  // ── Paridad Factura — Redondeo Comercial PER_DOCUMENT (OVERRIDES) ─────────
  // El Simulador conserva sus cards HISTÓRICOS (MetalSaleCard / HechuraSaleCard);
  // cuando el backend emite el contrato PER_DOCUMENT, solo se ACTUALIZAN los
  // valores vía los overrides ya existentes (sin cambiar el layout):
  //   · MetalSaleCard.postGramsOverride         ← postGrams del snapshot comercial
  //   · HechuraSaleCard.displaySaleTotalOverride ← saldo comercial post (MONETARIO)
  // Passthrough estricto — cero matemática FE. `null` ⇒ PER_LINE_LEGACY (fallback).
  const perDocOverrides = useMemo(() => {
    const r = result as any;
    const monetario = r?.lineMonetarySaldoPostCommercialRounding;
    if (typeof monetario !== "number" || !Number.isFinite(monetario)) return null;
    // Indexamos postGrams por id Y por nombre del metal padre (igual que el
    // lookup PER_LINE) para que el match con `padre` sea robusto.
    // Opción PURE — fuente: `breakdown.metalsPostGrams` (TODOS los metales,
    // incluso deltaGrams=0) para que CADA metal muestre SIEMPRE postGrams y
    // no alterne con los gramos de venta (con margen). Fallback a
    // `breakdown.metals` (solo delta≠0) para snapshots viejos sin el campo.
    const bd = r?.commercialRoundingContext?.breakdown;
    const metalsAll = Array.isArray(bd?.metalsPostGrams) && bd.metalsPostGrams.length > 0
      ? bd.metalsPostGrams
      : (bd?.metals ?? []);
    const postGramsByKey = new Map<string, number>();
    if (Array.isArray(metalsAll)) {
      for (const m of metalsAll) {
        if (typeof m?.postGrams !== "number") continue;
        if (m?.metalParentId)   postGramsByKey.set(String(m.metalParentId), m.postGrams);
        if (m?.metalParentName) postGramsByKey.set(String(m.metalParentName), m.postGrams);
      }
    }
    return { postGramsByKey, monetarioSaldo: monetario };
  }, [result]);

  // ── Resumen Comercial — Redondeo del metal por padre (pre/post/delta/impacto)
  // Passthrough estricto de `result.lineCommercialRoundingMetals[]` (line-autonomous).
  // Indexado por id Y nombre del padre (igual que postGramsByKey). Solo entradas
  // con delta real. Cero matemática FE.
  const commercialRoundingByKey = useMemo(() => {
    const r = result as any;
    const list = r?.lineCommercialRoundingMetals;
    if (!Array.isArray(list) || list.length === 0) return null;
    const map = new Map<string, {
      preGrams: number; postGrams: number; deltaGrams: number; monetaryImpact: number;
    }>();
    for (const m of list) {
      if (typeof m?.deltaGrams !== "number") continue;
      const entry = {
        preGrams:       Number(m.preGrams ?? 0),
        postGrams:      Number(m.postGrams ?? 0),
        deltaGrams:     Number(m.deltaGrams ?? 0),
        monetaryImpact: Number(m.monetaryImpact ?? 0),
      };
      if (m?.metalParentId)   map.set(String(m.metalParentId), entry);
      if (m?.metalParentName) map.set(String(m.metalParentName), entry);
    }
    return map.size > 0 ? map : null;
  }, [result]);

  // Saldo monetario PRE/impacto del Resumen Comercial (para HechuraSaleCard).
  const commercialSaldoPre: number | null = useMemo(() => {
    const v = (result as any)?.lineMonetarySaldoPreCommercialRounding;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }, [result]);
  const commercialSaldoImpact: number | null = useMemo(() => {
    const v = (result as any)?.hechuraRoundingMonetaryImpact;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }, [result]);

  return (
    <div className={outerCls}>
      <p className={vt.text.cardTitle}>
        Composición del precio
      </p>
      <div className={gridCls}>
        {ppEntries.map((padre, pi) => {
          const mKey = `metalPrice-${pi}`;
          const parentKey = ppKeys[pi];
          const postGramsOverride =
            // PER_DOCUMENT (paridad Factura) tiene prioridad: postGrams del
            // snapshot comercial del documento (por id o nombre del padre).
            // Si no, el snapshot PER_LINE.
            (parentKey != null ? perDocOverrides?.postGramsByKey.get(parentKey) : undefined)
            ?? perDocOverrides?.postGramsByKey.get(padre.displayName)
            ?? (parentKey != null ? postGramsByParentKey.get(parentKey) : undefined)
            ?? postGramsByParentKey.get(padre.displayName)
            ?? null;
          const commercialRounding =
            (parentKey != null ? commercialRoundingByKey?.get(parentKey) : undefined)
            ?? commercialRoundingByKey?.get(padre.displayName)
            ?? null;
          return (
            <MetalSaleCard
              key={`pc-metal-${pi}`}
              padre={padre}
              metalSaleFactor={metalSaleFactor}
              marginPct={mMarginPct}
              expanded={isExpanded(mKey)}
              onToggle={() => toggleSection(mKey)}
              display={display}
              postGramsOverride={postGramsOverride}
              commercialRounding={commercialRounding}
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
            hechuraSalePostOverride={hechuraSalePostOverride}
            displaySaleTotalOverride={perDocOverrides?.monetarioSaldo ?? null}
            commercialSaldoPre={commercialSaldoPre}
            commercialSaldoImpact={commercialSaldoImpact}
          />
        )}
      </div>

      {/* Etapa C-comercial / C6 — Bloque "Redondeo comercial del metal".
          Read-only, passthrough estricto del snapshot del motor.
          FACTURA (`variant="compact"`): NO se renderiza — la auditoría comercial
          se consolidó en el "Resumen Comercial del Artículo" del lateral derecho
          (`TPDocumentLineAdvancedEditor`), así que este card quedaba duplicado.
          SIMULADOR (`variant="full"`): se mantiene (no tiene ese lateral). */}
      {variant !== "compact" && (
        <CommercialPhysicalRoundingBlock
          commercialPhysical={commercialPhysical}
          metalSalePreRounding={metalSalePreRounding}
          metalSalePostRounding={mhb ? Number((mhb as any).metalSale) : null}
          metalSaleRoundingDelta={metalSaleRoundingDelta}
          hechuraSalePreRounding={hechuraSalePreRounding}
          hechuraSalePostRounding={mhb ? Number((mhb as any).hechuraSale) : null}
          hechuraSaleRoundingDelta={hechuraSaleRoundingDelta}
          currencyCode={(display as any)?.symbol === "$" ? undefined : (display as any)?.symbol}
          variant="full"
        />
      )}
    </div>
  );
}

export default PriceCompositionCards;
