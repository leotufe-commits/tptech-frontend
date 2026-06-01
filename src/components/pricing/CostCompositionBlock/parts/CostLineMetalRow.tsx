// src/components/pricing/CostCompositionBlock/parts/CostLineMetalRow.tsx
// ============================================================================
// Fila de metal en el cuerpo de "Costo unitario" — estructura UNIFICADA de
// 3 segmentos (idéntica a CostLineOtherRow y a SaleCompositionEditableGrid):
//
//   L1: nombre del metal padre            ............  Costo total (motor)
//   L2: código · nombre variante
//   ── Costo unit.   → gr × precio/gr EFECTIVO (con merma) = Costo total
//   ── Merma/Ajuste  → "Merma X,XX %"  (solo el valor ingresado, contexto)
//
// LECTURA (decisión de producto 2026-06): el "Costo unit." muestra el costo
// por gramo EFECTIVO (`total / gr`, el mismo "Valor unitario" de la tabla
// inferior, que YA incluye la merma) y el `= Costo total`, de modo que la
// fórmula multiplique EXACTO al total mostrado. La merma queda como contexto
// (solo el %), sin volver a sumar su impacto monetario (ya está dentro del
// valor unitario efectivo). Antes se mostraba el precio/gr BASE pre-merma + el
// impacto aparte, lo que daba una fórmula que no cerraba contra el total.
//
// REGLA CRÍTICA (POLICY R6 / R4.5): read-only. `unitEffective = total / gr` es
// el total del motor EXPRESADO COMO TASA — NO recalcula el costo. El total
// sigue siendo el del motor; el frontend NO inventa ni revierte nada.
// ============================================================================

import React from "react";
import { cn } from "../../../ui/tp";
import { formatGrams, formatMoneyDisplay } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import { buildCostLineTriView } from "../../../../lib/pricing/display/saleCompositionDisplay";
import type { CostCompositionDisplay } from "../types";

export type CostLineMetalRowProps = {
  variantName:     string;
  cost:            number;
  grams:           number | null;
  pricePerGram:    number | null;
  mermaPercent:    number;
  variantSku?:     string | null;
  metalParentName?: string | null;
  /** Impacto monetario de la merma emitido por el motor (passthrough). null
   *  cuando el motor no lo emite → no se muestra nivel B. */
  mermaAmount?:    number | null;
  display:         CostCompositionDisplay;
};

export function CostLineMetalRow(props: CostLineMetalRowProps): React.ReactElement {
  const { variantName, cost, grams, pricePerGram, mermaPercent, variantSku, metalParentName, mermaAmount, display } = props;
  const fm = (v: number) => formatMoneyDisplay(v, display.rate, display.symbol);

  // Vista unificada — labels centralizados (mismo texto en Simulador/Factura).
  const tri = buildCostLineTriView({
    kind:      "METAL",
    unitBase:  pricePerGram,
    qty:       grams,
    mermaPct:  mermaPercent,
    adjAmount: mermaAmount ?? null,
    total:     cost,
  });

  const grStr   = grams != null ? formatGrams(grams) : null;
  const headLabel = metalParentName ?? variantName;
  const variantDesc = metalParentName
    ? (variantSku && variantName ? `${variantSku} · ${variantName}` : variantSku ?? (variantName !== headLabel ? variantName : null))
    : variantSku ?? null;

  return (
    <div className="space-y-0.5 pb-0.5">
      {/* L1 — nombre + Costo total (motor) */}
      <div className={vt.row.flexBetween}>
        <span className="font-medium text-text/80 leading-snug">{headLabel}</span>
        <span className={cn(vt.text.totalCard, vt.colors.text, "shrink-0")}>{fm(tri.total)}</span>
      </div>
      {variantDesc && (
        <p className={cn(vt.text.hint, "font-semibold", vt.colors.labelSoft)}>{variantDesc}</p>
      )}

      {/* Costo unit. — precio/gr EFECTIVO (con merma) = Costo total.
          unitEffective = total / gr (passthrough del total como tasa); cae al
          base solo si no hay qty para dividir (legacy). La fórmula cierra exacto
          contra el Costo total mostrado en L1.
          JERARQUÍA — explica el ORIGEN del valor → alineado a la IZQUIERDA, gris
          suave secundario, un solo color (no naranja), sin competir con el total
          principal (L1, que sigue a la derecha). */}
      {(tri.base.unitEffective ?? tri.base.unit) != null && grStr != null && (
        <p className={cn(vt.text.formulaCompact, vt.colors.label, "tabular-nums text-left")}>
          {grStr} gr × {fm((tri.base.unitEffective ?? tri.base.unit) as number)}/gr = {fm(tri.total)}
        </p>
      )}

      {/* Merma / Ajuste — SOLO el valor ingresado (contexto). El impacto
          monetario NO se muestra aparte: ya está incluido en el valor unitario
          efectivo de arriba (evita el doble conteo visual). Color gris
          secundario (no naranja): es contexto informativo, no un ajuste que
          deba destacarse. */}
      {tri.adjust && (
        <div className={cn(vt.row.flexBetween)}>
          <span className={cn(vt.text.label, vt.colors.label)}>Merma / Ajuste</span>
          <span className={cn(vt.text.adjInput, vt.colors.labelSoft, "leading-tight")}>
            {tri.adjust.inputLabel}
          </span>
        </div>
      )}
    </div>
  );
}
