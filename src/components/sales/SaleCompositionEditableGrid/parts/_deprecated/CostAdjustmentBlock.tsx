// src/components/sales/SaleCompositionEditableGrid/parts/_deprecated/CostAdjustmentBlock.tsx
// =============================================================================
// Fase 2.5 — Bloque "Ajuste global de costo".
//
// @deprecated Fase 6 — reemplazado por `<PriceFlowCards>` (card "Ajustes
// globales aplicados"). Mantenido por compatibilidad; ningún caller actual
// lo invoca.
//
// Renderiza el ajuste configurado en el modal del artículo (Bonificación /
// Recargo del campo `Article.manualAdjustment*`). Se aplica sobre el total
// post-cost-lines y NO se confunde con:
//   · canal / cupón / forma de pago / envío / desc. global doc-level
//   · `lineAdj*` per cost line (PRODUCT/SERVICE/HECHURA Fase 2.2)
//   · `manualDiscount` con appliesTo=TOTAL per línea de venta
// Si `data` es null/undefined o `kind === null`, el bloque se oculta.
// =============================================================================

import { formatMoneyDoc as fmtMoney } from "../../../../../lib/pricing/format";
import { fmtSignedAmount } from "../GlobalAdjustmentsBlock";

/** @deprecated Fase 6 — reemplazado por `<PriceFlowCards>`. */
export function CostAdjustmentBlock({
  data, currency,
}: {
  data: {
    kind:   "BONUS" | "SURCHARGE" | null;
    type:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
    value:  number | null;
    amount: number | null;
  } | null | undefined;
  currency: string;
}) {
  if (!data || !data.kind) return null;

  const isBonus = data.kind === "BONUS";
  const labelKind = isBonus ? "Bonificación" : "Recargo";
  // valuePart: "25%" o monto fijo formateado.
  const valuePart = (() => {
    if (data.value == null || !Number.isFinite(data.value)) return null;
    if (data.type === "PERCENTAGE")  return `${data.value}%`;
    if (data.type === "FIXED_AMOUNT") return fmtMoney(data.value, currency);
    return String(data.value);
  })();

  return (
    <div className="space-y-0.5 text-[11px]">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted/80">
        Ajuste global de costo
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted">
          {labelKind}
          {valuePart && <span className="ml-1 text-text/90">{valuePart}</span>}
        </span>
        {data.amount != null && Number.isFinite(data.amount) && data.amount !== 0
          ? fmtSignedAmount(Math.abs(data.amount), isBonus, currency)
          : <span className="tabular-nums text-muted/60">—</span>}
      </div>
    </div>
  );
}
