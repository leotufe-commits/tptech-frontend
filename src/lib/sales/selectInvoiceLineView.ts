// src/lib/sales/selectInvoiceLineView.ts
// ============================================================================
// selectInvoiceLineView — adapter de LECTURA visual entre el draft de Factura
// y el ViewModel normalizado del backend.
//
// Objetivo (Fase 9):
// que el render de la tabla de líneas en `VentasFacturas.tsx` muestre lo que
// el motor (`sales/preview` → `normalizeSalesPreview`) emite, en lugar de leer
// el draft hidratado por `applySalePreviewToDraft`. Disocia visualmente la
// fuente de display de la fuente de persistencia sin tocar ninguna de las dos.
//
// Reglas:
//   - Cuando la firma del backend coincide con la del draft (mismo input
//     comercial), devolvemos un `DocumentLine` con los 4 campos visuales
//     reemplazados por los del normalizado: `unitPrice`, `lineTotal`,
//     `discountAmount` (= line discount × qty) y `taxAmount` (= line tax × qty).
//   - Cuando la firma NO coincide o no hay preview, devolvemos el `draftLine`
//     tal cual (fallback offline + carrera de debounce). Esto es lo que pasa
//     hoy y mantiene compatibilidad.
//   - El resto del shape `DocumentLine` (id, articleId, quantity, pricingMeta,
//     overrides, etc.) NUNCA se toca. Persistencia lo lee directo del draft.
//   - CERO matemática comercial. Es un selector, no un calculador.
// ============================================================================

import type { DocumentLine } from "../document-types";
import type { NormalizedPricingLine } from "../pricing/contract";

/** Devuelve la línea con los 4 campos visuales (`unitPrice`, `lineTotal`,
 *  `discountAmount`, `taxAmount`) tomados del ViewModel normalizado cuando la
 *  firma coincide. Si no, devuelve el draft tal cual.
 *
 *  NO modifica el `draftLine` original (clona). El draft sigue siendo la
 *  fuente para persistencia (`saveDraftToBackend`) y para el cálculo del
 *  payload del próximo preview (`buildSalePreviewPayload`). */
export function selectInvoiceLineView(
  draftLine: DocumentLine,
  normalizedLine: NormalizedPricingLine | null | undefined,
  signatureMatches: boolean,
): DocumentLine {
  if (!signatureMatches || !normalizedLine) {
    return draftLine;
  }

  // `lineTotal` y `taxAmount` son opcionales en `DocumentLine` (algunas líneas
  // legacy no los traen). Si el normalizado no provee uno, mantenemos el del
  // draft como fallback puntual de ese campo.
  // `lineTotalWithTax` se expone para que la celda "Total línea c/ imp." de
  // la Factura lo lea directo del backend sin recomputar.
  const lineTotal = normalizedLine.lineTotal ?? draftLine.lineTotal;

  // Exención por entidad (per-línea, fuente única real del motor — más
  // confiable que la metadata doc-level que mapea `applySalePreviewToDraft`).
  // Si la línea es exenta, el impuesto efectivo es 0 y el total c/imp. = neto:
  // NO arrastramos `draftLine.taxAmount/lineTotalWithTax` (pueden venir stale
  // del estado PRE-cliente con 21%). Display passthrough, sin recálculo.
  const exempt =
    normalizedLine.taxExemptByEntity === true ||
    draftLine.pricingMeta?.taxExemptByEntity === true;

  return {
    ...draftLine,
    unitPrice:        normalizedLine.unitPrice         ?? draftLine.unitPrice,
    discountAmount:   normalizedLine.lineDiscount      ?? draftLine.discountAmount,
    lineTotal,
    taxAmount:        exempt ? 0 : (normalizedLine.lineTaxAmount     ?? draftLine.taxAmount),
    lineTotalWithTax: exempt
      ? (lineTotal ?? normalizedLine.lineTotalWithTax ?? draftLine.lineTotalWithTax)
      : (normalizedLine.lineTotalWithTax  ?? draftLine.lineTotalWithTax),
    pricingMeta: {
      ...draftLine.pricingMeta,
      // Propagamos el flag per-línea para que la celda "Total línea c/ imp."
      // y el input/badge usen LA MISMA fuente de exención (fix desalineación).
      taxExemptByEntity: exempt,
    },
  };
}
