// src/components/sales/SaleCompositionEditableGrid/parts/MetalGlobalAdjustmentBadge.tsx
// =============================================================================
// MetalGlobalAdjustmentBadge — indicador READ-ONLY del Ajuste Global del
// artículo (bonificación/recargo) en la fila METAL de "Composición del costo".
//
// Por qué existe: HECHURA/PRODUCT/SERVICE muestran un control de ajuste en la
// columna "Merma/Ajuste" (AdjustmentLabelEditor, ajuste PER-LÍNEA editable).
// El METAL solo muestra la merma → visualmente parecía no recibir ajuste,
// aunque el Ajuste Global del artículo SÍ se le aplica en los cálculos. Los
// cost-lines de METAL no llevan ajuste por-línea propio, así que el dato
// aplicable y disponible es el Ajuste Global (`composition.costAdjustment`),
// el MISMO que el resumen inferior "AJUSTE GLOBAL" ya consume.
//
// Display-only · passthrough · CERO matemática: lee `kind/type/value` del motor
// y los formatea. NO prorratea el monto al metal (eso sería cálculo nuevo); por
// eso muestra el % / monto del ajuste + la palabra "global", no un importe
// por-metal. Para combos `composition.costAdjustment` es null (usan
// comboAdjustment sobre el precio) → no renderea, sin mezclar dominios.
// =============================================================================

import { cn } from "../../../ui/tp";
import {
  formatByType,
  formatMoneyDoc as fmtMoney,
} from "../../../../lib/pricing/format";

export function MetalGlobalAdjustmentBadge({
  data, currency,
}: {
  data: {
    kind:  "BONUS" | "SURCHARGE" | null;
    type:  "PERCENTAGE" | "FIXED_AMOUNT" | null;
    value: number | null;
  } | null | undefined;
  currency: string;
}) {
  if (!data || data.kind == null) return null;
  const isBonus   = data.kind === "BONUS";
  const isPercent = data.type === "PERCENTAGE";
  const sign      = isBonus ? "−" : "+";
  const cls       = isBonus
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";

  const valueText = (() => {
    if (data.value == null || !Number.isFinite(data.value)) return null;
    if (isPercent) {
      return `${formatByType(Number(data.value), "PERCENT", { bare: true })}%`;
    }
    return `${currency} ${fmtMoney(Math.abs(Number(data.value)))}`;
  })();
  if (valueText == null) return null;

  return (
    <span
      data-tp-metal-global-adjustment
      className={cn("text-[9px] leading-tight tabular-nums whitespace-nowrap", cls)}
      title={`Ajuste global del artículo (${isBonus ? "bonificación" : "recargo"}) aplicado a este metal`}
    >
      {sign}{valueText}{" "}
      <span className="uppercase tracking-wide text-muted/60">global</span>
    </span>
  );
}
