// src/components/sales/SaleCompositionEditableGrid/parts/CostAdjustmentDetailSection.tsx
// =============================================================================
// CostAdjustmentDetailSection — F20
// Sección compacta al final del card con el detalle del ajuste global:
//
//   AJUSTE GLOBAL
//   Costo antes del ajuste: AR$ X
//   Bonificación 5%: −AR$ Y     (verde)
//   Costo total: AR$ Z          (= Valor de costo del header)
//
// Display only. Pasa por:
//   · `data` = `composition.costAdjustment` (kind/type/value/amount).
//   · `costTotalFinal` = `totalComponents` (suma post-ajuste = Valor de costo).
// "Costo antes del ajuste" se deriva visualmente cuando el motor no emite el
// dato explícito:
//   · BONUS:     antes = total + amount  (la bonif redujo, antes era mayor)
//   · SURCHARGE: antes = total − amount  (el recargo sumó, antes era menor)
// Cero matemática comercial — solo formato.
// Si `data?.kind == null` → no renderea (silencio).
// =============================================================================

import { cn } from "../../../ui/tp";
import {
  formatByType,
  formatDecimal,
  formatMoneyDoc as fmtMoney,
} from "../../../../lib/pricing/format";

export function CostAdjustmentDetailSection({
  data, costTotalFinal, currency,
}: {
  data: {
    kind:   "BONUS" | "SURCHARGE" | null;
    type:   "PERCENTAGE" | "FIXED_AMOUNT" | null;
    value:  number | null;
    amount: number | null;
  } | null | undefined;
  /** Costo final post-ajuste (mismo valor que el header "Valor de costo"). */
  costTotalFinal: number | null;
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

  // Monto del ajuste (motor) y costo antes del ajuste (derivación visual).
  const amount = data.amount != null && Number.isFinite(data.amount)
    ? Math.abs(Number(data.amount))
    : null;
  const costoAntes = (() => {
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
      {amountText && (
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("font-medium", cls)}>{adjLabel}:</span>
          <span className={cn("tabular-nums font-semibold", cls)}>{amountText}</span>
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
