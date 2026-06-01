// src/components/sales/SaleCompositionEditableGrid/parts/_deprecated/RentabilidadBlock.tsx
// =============================================================================
// RentabilidadBlock — costo / ganancia / margen con jerarquía visual.
//
// @deprecated Fase 6 — reemplazado por `<PriceFlowCards>` (card "Resumen de
// rentabilidad"). Mantenido por compatibilidad. Ningún caller actual lo
// invoca.
//
// Fase 2.1 — extraído del cuerpo principal para:
//   · Aplicar `useFlashOnChange` al margen y la ganancia (highlight sutil
//     cuando el preview backend devuelve un nuevo valor).
//   · Tipografía más jerarquizada: label muy chico arriba, valor grande
//     debajo. Mantiene paddings TPTech.
//   · Tone semántico del margen: emerald (≥40) / text (≥15) / amber (>0) /
//     red (≤0). Mantiene la regla del panel legacy.
// =============================================================================

import { cn } from "../../../../ui/tp";
import {
  formatByType,
  formatMoneyDoc as fmtMoney,
} from "../../../../../lib/pricing/format";
import { useFlashOnChange } from "../../hooks/useFlashOnChange";

function Stat({
  label, value, valueClass, flashClass,
}: {
  label:       string;
  value:       string;
  valueClass?: string;
  flashClass?: string;
}) {
  return (
    <div className={cn(
      "flex flex-col rounded px-1 transition-colors duration-500",
      flashClass,
    )}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.04em] text-muted/65">
        {label}
      </span>
      <span className={cn("text-[13px] tabular-nums leading-tight", valueClass)}>
        {value}
      </span>
    </div>
  );
}

/** @deprecated Fase 6 — reemplazado por `<PriceFlowCards>`. */
export function RentabilidadBlock({
  unitCost, unitMargin, marginPercent, saleUnitPrice, quantity, currency,
}: {
  unitCost:      number | null;
  unitMargin:    number | null;
  marginPercent: number | null;
  /**
   * Fase 2.6.1 — PRECIO UNITARIO DE LISTA pre-descuento (= `pricingMeta.basePrice`).
   * El bloque multiplica × quantity para totalizar (mismo patrón que
   * cost/gain). Cero recálculo nuevo. Cuando `basePrice` no está disponible,
   * el caller cae a `line.unitPrice` (post-descuento) como fallback —
   * ambos coinciden cuando no hay descuentos.
   */
  saleUnitPrice: number | null;
  quantity:      number;
  currency:      string;
}) {
  const totalSale = saleUnitPrice != null ? saleUnitPrice * quantity : null;
  if (unitCost == null && unitMargin == null && marginPercent == null && totalSale == null) {
    return null;
  }

  const totalCost   = unitCost   != null ? unitCost   * quantity : null;
  const totalMargin = unitMargin != null ? unitMargin * quantity : null;
  const flashMargin = useFlashOnChange(marginPercent ?? null);
  const flashGain   = useFlashOnChange(totalMargin   ?? null);
  const flashSale   = useFlashOnChange(totalSale     ?? null);

  const marginToneClass =
    marginPercent == null
      ? "text-muted/60"
      : marginPercent >= 40
        ? "text-emerald-600 dark:text-emerald-400"
        : marginPercent >= 15
          ? "text-text"
          : marginPercent > 0
            ? "text-amber-600 dark:text-amber-400"
            : "text-red-500";
  const gainToneClass =
    totalMargin == null
      ? "text-muted/60"
      : totalMargin < 0
        ? "text-red-500"
        : "text-text";

  return (
    <div className="grid grid-cols-4 gap-3 border-t border-border/30 pt-2">
      {/* Fase 2.6.3 — orden: COSTO · MARGEN · GANANCIA · VALOR DE VENTA NETO. */}
      <Stat
        label="Costo"
        value={totalCost != null ? fmtMoney(totalCost, currency) : "—"}
        valueClass="text-text/85"
      />
      <Stat
        label="Margen"
        value={marginPercent != null ? `${formatByType(marginPercent, "MARGIN_PERCENT", { bare: true })}%` : "—"}
        valueClass={cn(marginToneClass, "font-semibold")}
        flashClass={flashMargin}
      />
      <Stat
        label="Ganancia"
        value={totalMargin != null ? fmtMoney(totalMargin, currency) : "—"}
        valueClass={gainToneClass}
        flashClass={flashGain}
      />
      {/* Fase 2.6.1 — KPI destacado, total = saleUnitPrice × quantity.
          Pre-descuentos (basePrice), pre-impuestos. Fase 2.6.3 — label
          clarificado a "Valor de venta neto" (NO incluye IVA). */}
      <Stat
        label="Valor de venta neto"
        value={totalSale != null ? fmtMoney(totalSale, currency) : "—"}
        valueClass={cn(
          "font-semibold !text-[14px]",
          totalSale == null
            ? "text-muted/60"
            : "text-emerald-700 dark:text-emerald-300",
        )}
        flashClass={flashSale}
      />
    </div>
  );
}
