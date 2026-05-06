// src/components/ui/TPDocumentTotalsCard.tsx
// ============================================================================
// TPDocumentTotalsCard — card "Totales" de documentos comerciales.
//
// Extracción del bloque de totales duplicado en:
//   · VentasPresupuestos  (mode="quote",   4 celdas)
//   · VentasOrdenes       (mode="quote",   4 celdas)
//   · VentasFacturas      (mode="invoice", 6 celdas — incluye Cobrado + Saldo)
//   · ComprasFacturasProveedor (mode="invoice", 6 celdas — incluye Pagado + Saldo)
//
// Diferencias reales entre las 4 pantallas que se resuelven con props:
//   · Label del total:           "Total" | "Total final"       → `totalLabel?`
//   · Singular vs plural:        "Descuentos" | "Descuento"    → `discountLabel?`
//   · Cobrado vs Pagado:         "Cobrado" | "Pagado"          → `paidLabel?`
//   · Impuestos con %:           "Impuestos" | "Impuestos (X%)" → derivado de `taxPercent`
//   · Grid:
//       quote   → grid-cols-2 sm:grid-cols-4
//       invoice → grid-cols-2 sm:grid-cols-3 lg:grid-cols-6
//
// Alcance intencional:
//   · Incluye el wrapper `TPCard` — el nombre "Card" lo indica.
//   · El parent calcula `balance` con la misma fórmula de siempre y lo pasa
//     por prop. Se podría derivar acá pero se prefirió no duplicar la lógica
//     (behavior preservation: los dos parents ya la tienen afuera).
// ============================================================================

import React from "react";

import { TPCard } from "./TPCard";
import { TPTotalCell } from "./TPTotalCell";
import { fmtMoney } from "../../lib/document-helpers";

export type TPDocumentTotalsMode = "quote" | "invoice";

export type TPDocumentTotalsCardProps = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  /** Solo en mode="invoice". Si es 0 y no se pasa, se muestra "—". */
  paidAmount?: number;
  /** Solo en mode="invoice". Saldo pendiente = max(0, total − paidAmount). */
  balance?: number;
  /** Si está definido y > 0, se añade " (X%)" al label "Impuestos". */
  taxPercent?: number;
  /**
   * Ajuste de redondeo aplicado al documento (positivo o negativo). Si es
   * distinto de 0, se renderea una celda extra entre Impuestos y Total.
   * El label se decide con `roundingSource`.
   */
  roundingAdjustment?: number;
  /**
   * Origen del redondeo aplicado:
   *   · "PRICE_LIST"     → label "Redondeo lista de precios" (default).
   *   · "TENANT_POLICY"  → label "Redondeo comprobante" (política del tenant).
   */
  roundingSource?: "PRICE_LIST" | "TENANT_POLICY";
  currency: string;
  mode: TPDocumentTotalsMode;

  /** Override: "Total" (default) | "Total final" (VentasPresupuestos). */
  totalLabel?: string;
  /** Override: "Descuentos" (default) | "Descuento" (ComprasFacturasProveedor). */
  discountLabel?: string;
  /** Override: "Cobrado" (default) | "Pagado" (ComprasFacturasProveedor). */
  paidLabel?: string;
};

export function TPDocumentTotalsCard({
  subtotal,
  discountAmount,
  taxAmount,
  total,
  paidAmount,
  balance,
  taxPercent,
  roundingAdjustment,
  roundingSource = "PRICE_LIST",
  currency,
  mode,
  totalLabel = "Total",
  discountLabel = "Descuentos",
  paidLabel = "Cobrado",
}: TPDocumentTotalsCardProps) {
  const taxLabel = `Impuestos${
    taxPercent !== undefined && taxPercent > 0 ? ` (${taxPercent}%)` : ""
  }`;

  const hasRounding =
    typeof roundingAdjustment === "number" &&
    Number.isFinite(roundingAdjustment) &&
    Math.abs(roundingAdjustment) >= 0.01;

  const roundingLabel =
    roundingSource === "TENANT_POLICY"
      ? "Redondeo comprobante"
      : "Redondeo lista de precios";

  const gridClass =
    mode === "invoice"
      ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm"
      : "grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm";

  return (
    <TPCard title="Totales">
      <div className={gridClass}>
        <TPTotalCell label="Subtotal"  value={fmtMoney(subtotal, currency)} />
        <TPTotalCell label={discountLabel} value={fmtMoney(discountAmount, currency)} tone="warning" />
        <TPTotalCell label={taxLabel} value={fmtMoney(taxAmount, currency)} />
        {hasRounding && (
          <TPTotalCell
            label={roundingLabel}
            value={
              (roundingAdjustment! < 0 ? "−" : "+") +
              fmtMoney(Math.abs(roundingAdjustment!), currency)
            }
            tone="warning"
          />
        )}
        <TPTotalCell label={totalLabel} value={fmtMoney(total, currency)} tone="primary" bold />

        {mode === "invoice" && (
          <>
            <TPTotalCell
              label={paidLabel}
              value={paidAmount !== undefined && paidAmount > 0 ? fmtMoney(paidAmount, currency) : "—"}
            />
            <TPTotalCell
              label="Saldo"
              value={balance !== undefined && balance > 0 ? fmtMoney(balance, currency) : "—"}
              tone={balance !== undefined && balance > 0 ? "danger" : "success"}
              bold
            />
          </>
        )}
      </div>
    </TPCard>
  );
}

export default TPDocumentTotalsCard;
