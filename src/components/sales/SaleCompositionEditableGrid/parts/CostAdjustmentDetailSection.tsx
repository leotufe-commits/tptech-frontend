// src/components/sales/SaleCompositionEditableGrid/parts/CostAdjustmentDetailSection.tsx
// =============================================================================
// CostAdjustmentDetailSection — F20
// Sección compacta al final del card con el detalle del ajuste global:
//
//   AJUSTE GLOBAL
//   Costo antes del ajuste: AR$ X   (= Σ Componentes PRE-ajuste)
//   Bonificación 5%: −AR$ Y         (verde)
//   Costo total: AR$ Z              (= Costo Ajustado POST = Valor de costo)
//
// Display only. Passthrough del motor (cero matemática comercial):
//   · `data`          = `composition.costAdjustment` (kind/type/value/amount).
//   · `costBefore`    = Σ Componentes PRE-ajuste (`totalComponents`).
//   · `costTotalFinal`= Costo Ajustado POST (`unitCost × qty`).
//   · `quantity`      = cantidad de la línea — escala el `amount` (por unidad)
//                       a nivel línea para que cierre: antes − ajuste = total.
// Contrato: costBefore ± (amount×qty) = costTotalFinal (BONUS resta, SURCHARGE
// suma). Los tres provienen del motor; sólo se formatean y se escalan × qty.
// Si `data?.kind == null` → no renderea (silencio).
// =============================================================================

import { cn } from "../../../ui/tp";
import {
  formatByType,
  formatDecimal,
  formatMoneyDoc as fmtMoney,
} from "../../../../lib/pricing/format";

export function CostAdjustmentDetailSection({
  data, costBefore, costTotalFinal, quantity = 1, currency,
}: {
  data: {
    kind:   "BONUS" | "SURCHARGE" | null;
    type:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
    value:  number | null;
    amount: number | null;
  } | null | undefined;
  /** Σ Componentes PRE-ajuste (Costo Base), nivel línea. */
  costBefore: number | null;
  /** Costo Ajustado POST (mismo valor que el header "Costo total línea"). */
  costTotalFinal: number | null;
  /** Cantidad de la línea — escala el `amount` (por unidad) a nivel línea. */
  quantity?: number;
  currency: string;
}) {
  if (!data || data.kind == null) return null;
  const isBonus   = data.kind === "BONUS";
  const isPercent = data.type === "PERCENTAGE";
  const sign      = isBonus ? "−" : "+";
  const cls       = isBonus
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";
  const kindWord  = isBonus ? "Bonificación" : "Recargo";

  // Monto del ajuste (motor, POR UNIDAD) escalado a nivel línea (× qty).
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const amount = data.amount != null && Number.isFinite(data.amount)
    ? Math.abs(Number(data.amount)) * qty
    : null;
  // "Costo antes del ajuste" = Σ Componentes PRE (passthrough del motor). Si no
  // viene, se deriva desde el total POST y el monto (back-compat defensivo).
  const costoAntes = (() => {
    if (costBefore != null && Number.isFinite(costBefore)) return costBefore;
    if (costTotalFinal == null || !Number.isFinite(costTotalFinal)) return null;
    if (amount == null) return null;
    return isBonus ? costTotalFinal + amount : costTotalFinal - amount;
  })();

  // Texto del label del ajuste: "Bonificación 5%" / "Recargo $1.000".
  const adjLabel = (() => {
    if (isPercent && data.value != null && Number.isFinite(data.value)) {
      const pct = formatByType(Number(data.value), "PERCENT", { bare: true });
      return `${kindWord} ${pct}%`;
    }
    if (data.value != null && Number.isFinite(data.value)) {
      return `${kindWord} ${currency} ${fmtMoney(Math.abs(Number(data.value)))}`;
    }
    return kindWord;
  })();

  const amountText = amount != null
    ? `${sign}${currency} ${fmtMoney(amount)}`
    : null;

  const fmt = (v: number) => `${currency} ${formatDecimal(v, 2)}`;

  return (
    <div
      data-cost-adjustment-detail
      className="mt-2 flex flex-col gap-0.5 px-2 py-1.5 text-[11px] rounded-sm bg-slate-500/[0.04] dark:bg-slate-500/[0.06]"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/70">
        Ajuste global
      </span>
      {costoAntes != null && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted/70">Costo antes del ajuste:</span>
          <span className="tabular-nums text-text/85">{fmt(costoAntes)}</span>
        </div>
      )}
      {/* Etiqueta del ajuste (Bonificación/Recargo). Se muestra el monto en pesos
          cuando está disponible (artículos normales). Para COMBO el monto no
          llega al frontend → solo la etiqueta "Bonificación 10%", sin el `−$Y`. */}
      {data.value != null && Number.isFinite(data.value) && (
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("font-medium", cls)}>{adjLabel}{amountText ? ":" : ""}</span>
          {amountText && <span className={cn("tabular-nums font-semibold", cls)}>{amountText}</span>}
        </div>
      )}
      {costTotalFinal != null && Number.isFinite(costTotalFinal) && (
        <div className="flex items-baseline justify-between gap-2 border-t border-border/20 pt-0.5">
          <span className="font-semibold text-text/85">Costo total:</span>
          <span className="tabular-nums font-semibold text-text/90">{fmt(costTotalFinal)}</span>
        </div>
      )}
    </div>
  );
}
