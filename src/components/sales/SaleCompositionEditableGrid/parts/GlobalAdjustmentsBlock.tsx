// src/components/sales/SaleCompositionEditableGrid/parts/GlobalAdjustmentsBlock.tsx
// =============================================================================
// Bloque inferior — ajustes globales del documento.
//
// Fase 2.2 — el bloque ahora SOLO muestra la bonificación / recargo
// global de la línea (`lineManualDiscount` con appliesTo=TOTAL, viene
// del modal/línea de artículos). Canal de venta / cupón / forma de
// pago / envío y descuento global del documento se ocultan acá:
// viven en el resumen del documento, no per-línea.
//
// Los campos `channel/coupon/payment/shipping/globalDiscount` siguen
// existiendo en `SaleGlobalAdjustments` por retrocompat — quedan
// ignorados en el render. Cualquier consumidor futuro puede volver a
// mostrarlos sin cambiar el contrato.
//
// Exporta también `fmtSignedAmount` (helper visual) usado tanto por este
// bloque como por `CostAdjustmentBlock` (deprecated). Mantener el export
// para no romper esa dependencia.
// =============================================================================

import { cn } from "../../../ui/tp";
import { formatByType, formatMoneyDoc as fmtMoney } from "../../../../lib/pricing/format";
import type { SaleGlobalAdjustments } from "../types";

export function fmtSignedAmount(amount: number, isReducing: boolean, currency: string) {
  const sign = isReducing ? "−" : "+";
  const cls  = isReducing
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";
  return (
    <span className={cn("tabular-nums font-semibold", cls)}>
      {sign}{fmtMoney(Math.abs(amount), currency)}
    </span>
  );
}

export function GlobalAdjustmentsBlock({
  data, currency,
}: {
  data:     SaleGlobalAdjustments;
  currency: string;
}) {
  const lineMd = data.lineManualDiscount ?? null;
  if (!lineMd || lineMd.amount === 0) return null;

  const isBonus = lineMd.kind === "BONUS";
  const labelKind = isBonus ? "Bonificación" : "Recargo";

  return (
    <div className="space-y-0.5 text-[11px]">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/80">
        Ajustes globales
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted">
          {labelKind} de línea
          {lineMd.valuePct != null && (
            <span className="ml-1 text-text/90">{formatByType(lineMd.valuePct, "PERCENT", { bare: true })}%</span>
          )}
        </span>
        {fmtSignedAmount(lineMd.amount, isBonus, currency)}
      </div>
    </div>
  );
}
