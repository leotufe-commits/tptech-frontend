// src/components/sales/SaleLineCompositionDetail.tsx
// ============================================================================
// SaleLineCompositionDetail — detalle de composición Metal/Hechura por línea.
//
// Reutiliza `TPPriceCompositionKpis` (passthrough puro del backend) para
// mostrar la misma información que el Simulador, pero a nivel línea de una
// factura/presupuesto/orden.
//
// Recibe el `NormalizedPricingLine` correspondiente a la línea (ya producido
// por `normalizeSalesPreview` en el caller) y se la pasa directo a
// `TPPriceCompositionKpis`. CERO matemática comercial acá.
//
// Cuando `pricingLineView` es null (preview todavía no llegó / firma no
// coincide / línea sin preview equivalente) muestra un placeholder discreto.
// ============================================================================

import React from "react";
import type { NormalizedPricingLine } from "../../lib/pricing/contract";
import TPPriceCompositionKpis from "../ui/TPPriceCompositionKpis";

export type SaleLineCompositionDetailProps = {
  /** Línea ya normalizada por `normalizeSalesPreview`. */
  pricingLineView?: NormalizedPricingLine | null;
  /** Símbolo de moneda (ya convertida por backend). */
  currencySymbol?: string;
  /** Modo de la lista aplicada — articulado al renderizado de
   *  `TPPriceCompositionKpis` (METAL_HECHURA vs MARGIN_TOTAL vs etc.). */
  priceListMode?: string | null;
  /** Texto cuando no hay preview disponible para la línea. */
  emptyText?: string;
};

export default function SaleLineCompositionDetail(props: SaleLineCompositionDetailProps) {
  const {
    pricingLineView,
    currencySymbol,
    priceListMode,
    emptyText = "Esperando preview del backend para esta línea…",
  } = props;

  if (!pricingLineView) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-card/40 p-3 text-xs italic text-muted/70">
        {emptyText}
      </div>
    );
  }

  return (
    <TPPriceCompositionKpis
      composition={pricingLineView.composition ?? undefined}
      metalHechuraBreakdown={pricingLineView.metalHechuraBreakdown ?? undefined}
      componentSaleBreakdown={pricingLineView.componentSaleBreakdown ?? undefined}
      total={pricingLineView.lineTotalWithTax ?? null}
      subtotal={pricingLineView.lineTotal ?? null}
      taxAmount={pricingLineView.lineTaxAmount ?? null}
      costBase={pricingLineView.costBase ?? null}
      costTaxAmount={pricingLineView.costTaxAmount ?? null}
      costWithTax={pricingLineView.costWithTax ?? null}
      costTaxBreakdown={pricingLineView.costTaxBreakdown ?? undefined}
      marginPercent={pricingLineView.marginPercent ?? null}
      priceListMode={priceListMode ?? pricingLineView.appliedPriceListMode ?? undefined}
      currencySymbol={currencySymbol}
      mode="invoice"
      view="sale"
      title="Composición del precio"
      emptyText="Sin desglose disponible para esta línea."
    />
  );
}
