// src/components/pricing/CostCompositionBlock/CostCompositionBlock.tsx
// ============================================================================
// CostCompositionBlock — Composición del costo del artículo.
//
// Compartido entre Simulador (PricingSimulator), Factura (VentasFacturas) y
// Comparador (PricingCompare). Read-only (POLICY R6 — frontend lector puro).
// Recibe datos ya calculados por el motor backend y los renderiza.
//
// Origen: extraído del IIFE en PricingSimulator.tsx:4401-5445 (sesión FASE 1.2).
// Decomposición en sub-componentes (parts/) para evitar archivo monolítico
// y permitir tests unitarios por bloque.
// ============================================================================

import React, { useState, useCallback, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../ui/tp";
import { formatMoneyDisplay, formatGrams, formatDecimalUpTo } from "../../../lib/pricing/format";
import { vt } from "../../../lib/pricing/visualTokens";
import {
  selectAllLineSteps,
  selectMetalQuoteSteps,
  selectHechuraMMHStep,
  selectCostLinesFinalStep,
  buildMetalPadreMap,
  computeAdjFactorMetal,
  computeHechuraEquiv,
  buildHechuraTaxLines,
} from "./helpers";
import type { CostCompositionBlockProps } from "./types";
import { CostLineMetalRow }     from "./parts/CostLineMetalRow";
import { CostLineOtherRow }     from "./parts/CostLineOtherRow";
import { ManualCostFallback }   from "./parts/ManualCostFallback";
import { GlobalAdjustmentRow }  from "./parts/GlobalAdjustmentRow";
import { CostTaxesPanel }       from "./parts/CostTaxesPanel";
import { CostClosingRow }       from "./parts/CostClosingRow";
import { MetalEquivCard }       from "./parts/MetalEquivCard";
import { HechuraEquivCard }     from "./parts/HechuraEquivCard";

const DEFAULT_DISPLAY = { rate: 1, symbol: "$" } as const;

export function CostCompositionBlock(props: CostCompositionBlockProps): React.ReactElement | null {
  const {
    steps,
    line,
    result = null,
    display = DEFAULT_DISPLAY,
    variant = "full",
    detailMode = "DESGLOSADO",
    expanded: expandedProp,
    onToggle,
  } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  // ── Estado de expansión (controlado o local) ────────────────────────────
  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>({
    // Default abierto en `compact` para que la Factura muestre todo de entrada.
    costUnit: variant === "compact",
  });
  const expanded = expandedProp ?? localExpanded;
  const isExpanded = useCallback((key: string) => Boolean(expanded[key]), [expanded]);
  const toggleSection = useCallback((key: string) => {
    if (onToggle) { onToggle(key); return; }
    setLocalExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }, [onToggle]);

  // ── Derivaciones de la línea ────────────────────────────────────────────
  const unitCost      = line?.unitCost      ?? null;
  const costTaxAmount = (line as any)?.costTaxAmount ?? null;
  const totalCostWithTax = (line as any)?.costWithTax ?? unitCost;
  const metalCost     = line?.metalHechuraBreakdown?.metalCost   ?? null;
  const hechuraCost   = line?.metalHechuraBreakdown?.hechuraCost ?? null;
  const hasComposition = metalCost != null || hechuraCost != null || unitCost != null;

  // ── Derivaciones por steps ──────────────────────────────────────────────
  const allLineSteps   = useMemo(() => selectAllLineSteps(steps),   [steps]);
  const metalOnlySteps = useMemo(() => selectMetalQuoteSteps(steps), [steps]);
  const hechuraMMHStep = useMemo(() => selectHechuraMMHStep(steps),  [steps]);

  // ── Agregaciones (centralizadas en helpers — no recreadas) ──────────────
  const metalPadreMap = useMemo(() => buildMetalPadreMap(steps), [steps]);
  const adjFactorMetal = useMemo(
    () => computeAdjFactorMetal({
      metalHechuraBreakdown: line?.metalHechuraBreakdown ?? null,
      metalPadreMap,
      allLineSteps,
      unitCost,
    }),
    [line?.metalHechuraBreakdown, metalPadreMap, allLineSteps, unitCost],
  );
  const hechuraEquiv = useMemo(
    () => computeHechuraEquiv({
      metalHechuraBreakdown: line?.metalHechuraBreakdown ?? null,
      allLineSteps,
      hechuraMMHStep,
      adjFactorMetal,
      unitCost,
    }),
    [line?.metalHechuraBreakdown, allLineSteps, hechuraMMHStep, adjFactorMetal, unitCost],
  );

  // ── Símbolos de cada metal padre (para passthrough a MetalEquivCard) ────
  const metalSymbolByGroup = useMemo(() => {
    const m = new Map<string, string | null>();
    const sourceSteps = allLineSteps.length > 0
      ? allLineSteps.filter((s: any) => s.key === "COST_LINES_METAL")
      : metalOnlySteps;
    for (const s of sourceSteps) {
      const meta = (s as any).meta ?? {};
      const key = String((meta.metalId ?? meta.metalName ?? meta.variantName ?? "Metal"));
      if (!m.has(key)) m.set(key, (meta.metalSymbol as string | null | undefined) ?? null);
    }
    return m;
  }, [allLineSteps, metalOnlySteps]);

  // ── Hechura line steps (no metal) — para HechuraEquivCard ───────────────
  const hechuraLineSteps = useMemo(
    () => allLineSteps.filter((s: any) => s.key !== "COST_LINES_METAL"),
    [allLineSteps],
  );

  // ── Impuestos de costo (taxItems del response) ──────────────────────────
  const taxItems = (result as any)?.costTaxBreakdown as any[] | undefined ?? [];
  const hasCostTax = taxItems.length > 0 && costTaxAmount != null && costTaxAmount > 0.001;

  // ── Hechura tax lines — agregación pura ─────────────────────────────────
  const totalMetalCostForTax = useMemo(
    () => Array.from(metalPadreMap.values()).reduce((acc, p) => acc + p.totalCost * adjFactorMetal, 0),
    [metalPadreMap, adjFactorMetal],
  );
  const hechuraTaxLines = useMemo(
    () => hechuraEquiv != null
      ? buildHechuraTaxLines({ taxItems, totalMetalCostForTax, hechuraEquiv })
      : [],
    [hechuraEquiv, taxItems, totalMetalCostForTax],
  );

  // ── Suffix de ajuste global para HechuraEquivCard ───────────────────────
  const adjSuffix = useMemo(() => {
    const finalStep = selectCostLinesFinalStep(steps);
    if (!finalStep) return "";
    const fm = (finalStep as any).meta ?? {};
    if (String(fm.adjustmentType) !== "PERCENTAGE") return "";
    const v = fm.adjustmentValue != null ? parseFloat(String(fm.adjustmentValue)) : null;
    return v != null ? ` ${formatDecimalUpTo(v, 2)}%` : "";
  }, [steps]);

  // ── Guardia: sin costo, no renderizar (consistente con IIFE original) ───
  if (!line || !hasComposition || unitCost == null) return null;

  // ── Build line rows del cuerpo (3 modes) ────────────────────────────────
  const lineRows: React.ReactNode[] = [];
  let usedMode: "COST_LINES" | "METAL_MERMA_HECHURA" | "MANUAL" = "MANUAL";

  if (allLineSteps.length > 0) {
    usedMode = "COST_LINES";
    const metalSteps = allLineSteps.filter((s: any) => s.key === "COST_LINES_METAL");
    const otherSteps = allLineSteps.filter((s: any) => s.key !== "COST_LINES_METAL");
    const hasBoth    = metalSteps.length > 0 && otherSteps.length > 0;

    if (hasBoth) {
      lineRows.push(
        <div key="group-metal" className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Metales</p>
          {metalSteps.map((step: any, i) => {
            const m = step.meta ?? {};
            return (
              <CostLineMetalRow
                key={`cl-m-${i}`}
                variantName={(m.variantName as string | null | undefined) ?? "Metal"}
                cost={parseFloat(step.value)}
                grams={m.qty != null ? parseFloat(String(m.qty)) : null}
                pricePerGram={m.quotePrice != null ? parseFloat(String(m.quotePrice)) : null}
                mermaPercent={m.merma ? Number(m.merma) : 0}
                variantSku={m.variantSku as string | null}
                metalParentName={m.metalName as string | null}
                display={display}
              />
            );
          })}
        </div>,
        <div key="group-other" className="space-y-1.5 border-t border-border/20 pt-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Hechura / Otros</p>
          <div className="space-y-1">
            {otherSteps.map((step: any, i) => {
              const isArticle = step.key === "COST_LINES_PRODUCT" || step.key === "COST_LINES_SERVICE";
              const prevIsHechura = i > 0 && (otherSteps[i - 1].key === "COST_LINES_HECHURA");
              const showDivider = isArticle && prevIsHechura;
              return (
                <React.Fragment key={`cl-o-wrap-${i}`}>
                  {showDivider && <div className="border-t border-border/30 my-0.5" />}
                  <CostLineOtherRow step={step} display={display} />
                </React.Fragment>
              );
            })}
          </div>
        </div>,
      );
    } else {
      metalSteps.forEach((step: any, i) => {
        const m = step.meta ?? {};
        lineRows.push(
          <CostLineMetalRow
            key={`cl-m-${i}`}
            variantName={(m.variantName as string | null | undefined) ?? "Metal"}
            cost={parseFloat(step.value)}
            grams={m.qty != null ? parseFloat(String(m.qty)) : null}
            pricePerGram={m.quotePrice != null ? parseFloat(String(m.quotePrice)) : null}
            mermaPercent={m.merma ? Number(m.merma) : 0}
            variantSku={m.variantSku as string | null}
            metalParentName={m.metalName as string | null}
            display={display}
          />,
        );
      });
      otherSteps.forEach((step: any, i) => lineRows.push(
        <CostLineOtherRow key={`cl-o-${i}`} step={step} display={display} />,
      ));
    }
  } else if (metalOnlySteps.length > 0 || hechuraMMHStep) {
    usedMode = "METAL_MERMA_HECHURA";
    const hasBoth = metalOnlySteps.length > 0 && hechuraMMHStep != null;

    const metalRows = metalOnlySteps.map((step: any, qi) => {
      const qm = step.meta ?? {};
      const nm = (qm.variantName as string | null | undefined) ?? `Variante ${qi + 1}`;
      const gr = qm.grams != null ? parseFloat(String(qm.grams)) : qm.qty != null ? parseFloat(String(qm.qty)) : null;
      const pr = qm.price != null ? parseFloat(String(qm.price)) : qm.quotePrice != null ? parseFloat(String(qm.quotePrice)) : null;
      return (
        <CostLineMetalRow
          key={`mq-${qi}`}
          variantName={nm}
          cost={parseFloat(String(step.value))}
          grams={gr}
          pricePerGram={pr}
          mermaPercent={qm.merma ? Number(qm.merma) : 0}
          variantSku={qm.variantSku as string | null}
          metalParentName={qm.metalName as string | null}
          display={display}
        />
      );
    });
    if (hasBoth) {
      lineRows.push(
        <div key="group-metal-mmh" className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Metales</p>
          {metalRows}
        </div>,
      );
    } else {
      metalRows.forEach(r => lineRows.push(r));
    }

    if (hechuraMMHStep) {
      const hm    = ((hechuraMMHStep as any).meta ?? {}) as any;
      const hCost = parseFloat(String(hechuraMMHStep.value));
      const hFmt  = hm.mode === "PER_GRAM" && hm.price && hm.gramsWithMerma
        ? `${fm(parseFloat(String(hm.price)))} × ${formatGrams(parseFloat(String(hm.gramsWithMerma)), 2)} gr`
        : hm.price ? `Fijo: ${fm(parseFloat(String(hm.price)))}` : null;
      const hNode = (
        <div key="hechura-mmh" className="space-y-0.5">
          <div className="flex justify-between items-baseline">
            <span className="font-medium text-text/80">Hechura / Mano de obra</span>
            <span className="font-bold tabular-nums">{fm(hCost)}</span>
          </div>
          {hFmt && <p className="text-[9px] text-muted/55 tabular-nums mt-0.5">{hFmt}</p>}
        </div>
      );
      if (hasBoth) {
        lineRows.push(
          <div key="group-other-mmh" className="space-y-1.5 border-t border-border/20 pt-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Hechura / Otros</p>
            <div className="space-y-1">{hNode}</div>
          </div>,
        );
      } else {
        lineRows.push(hNode);
      }
    }
  } else {
    usedMode = "MANUAL";
    lineRows.push(
      <ManualCostFallback
        key="manual-base"
        steps={steps}
        unitCost={unitCost}
        result={result}
        display={display}
      />,
    );
  }

  // ── Cierre y cards de equivalencia ──────────────────────────────────────
  const hasMultipleSources = lineRows.length > 1 || selectCostLinesFinalStep(steps) != null;
  const metalPadreEntries = Array.from(metalPadreMap.entries());
  const hasEquivBlock = metalPadreEntries.length > 0 || hechuraEquiv != null;
  // Solo en variant="full" + DESGLOSADO mostramos los cards de equivalencia.
  // En "compact" (Factura) los ocultamos para no saturar el modal.
  const showCostEquivCards = variant === "full" && detailMode === "DESGLOSADO" && hasEquivBlock;

  // ── Cantidad y total ────────────────────────────────────────────────────
  const qtyForTotal  = Math.max((line as any)?.quantity ?? 1, 1);
  const showQtyTotal = qtyForTotal > 1 && totalCostWithTax != null;
  const qtyTotalCost = showQtyTotal ? totalCostWithTax * qtyForTotal : null;

  const cuOpen = isExpanded("costUnit");
  void usedMode; // keep for debugging / future telemetry

  return (
    <div className={vt.card.outer}>
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => toggleSection("costUnit")}
        className="w-full flex items-center justify-between gap-2 mb-2.5 cursor-pointer"
      >
        <p className={vt.text.cardTitle}>Costo unitario</p>
        <div className="flex items-center gap-1.5">
          {totalCostWithTax != null && (
            <span className={cn(vt.text.totalCard, vt.colors.text)}>{fm(totalCostWithTax)}</span>
          )}
          <ChevronDown size={14} className={cn(vt.colors.formula, "transition-transform", cuOpen && "rotate-180")} />
        </div>
      </button>

      {/* ── Resumen colapsado ── */}
      {!cuOpen && showQtyTotal && (
        <p className={cn(vt.text.subLabel, vt.colors.labelSoft, "italic mb-1")}>
          {qtyForTotal} {qtyForTotal === 1 ? "unidad" : "unidades"} · Total {fm(qtyTotalCost!)}
        </p>
      )}

      {/* ── Body ── */}
      {cuOpen && (
        <div className="space-y-2 text-xs">
          {lineRows}
          <GlobalAdjustmentRow steps={steps} display={display} />
          {hasCostTax && (
            <CostTaxesPanel taxItems={taxItems} unitCost={unitCost} display={display} />
          )}
          <CostClosingRow
            unitCost={unitCost}
            totalCostWithTax={totalCostWithTax}
            hasCostTax={hasCostTax}
            hasMultipleSources={hasMultipleSources}
            display={display}
          />
          {showQtyTotal && (
            <div className="flex justify-between items-baseline pt-1.5 mt-1 border-t border-border/30">
              <span className="text-[11px] text-muted">Total ({qtyForTotal} {qtyForTotal === 1 ? "unidad" : "unidades"})</span>
              <span className="text-xs tabular-nums font-bold text-text">{fm(qtyTotalCost!)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Cards de equivalencia (DESGLOSADO + variant=full) ── */}
      {showCostEquivCards && (
        <div className="pb-1 space-y-3 border-t border-border/20 pt-3 mt-3 mb-4">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/70">
            Composición del costo
          </p>
          <div className="grid grid-cols-2 gap-4">
            {metalPadreEntries.map(([padreKey, padre], pi) => {
              const cKey = `metalCost-${pi}`;
              return (
                <MetalEquivCard
                  key={`equiv-padre-${pi}`}
                  padre={padre}
                  metalSymbol={metalSymbolByGroup.get(padreKey) ?? null}
                  adjFactor={adjFactorMetal}
                  expanded={isExpanded(cKey)}
                  onToggle={() => toggleSection(cKey)}
                  display={display}
                />
              );
            })}
            {hechuraEquiv != null && (() => {
              const hcKey = "hechuraCost";
              const hSumBruto = hechuraLineSteps.reduce(
                (acc, s) => acc + ((s as any).value != null ? parseFloat(String((s as any).value)) : 0),
                0,
              );
              const hechuraGlobalAdj = hechuraEquiv - hSumBruto;
              return (
                <HechuraEquivCard
                  hechuraEquiv={hechuraEquiv}
                  hechuraLineSteps={hechuraLineSteps}
                  hechuraTaxLines={hechuraTaxLines}
                  totalMetalCostForTax={totalMetalCostForTax}
                  hasMetalCost={totalMetalCostForTax > 0.001}
                  hechuraGlobalAdj={hechuraGlobalAdj}
                  adjSuffix={adjSuffix}
                  expanded={isExpanded(hcKey)}
                  onToggle={() => toggleSection(hcKey)}
                  display={display}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default CostCompositionBlock;
