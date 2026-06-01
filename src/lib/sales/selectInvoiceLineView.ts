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
//   - ANTI-FLICKER (fix): cuando la firma NO coincide PERO existe un
//     `normalizedLine` cacheado del MISMO artículo, igual reusamos sus
//     campos visuales como "último valor válido". El draft sólo reemplaza
//     la `quantity` (que el operador acaba de tipear) — los importes
//     derivados (unitPrice/discountAmount/taxAmount/lineTotal/subtotal)
//     quedan ANCLADOS al snapshot anterior del motor en lugar de mezclar
//     la nueva quantity local con un `subtotal`/`discountAmount` stale del
//     draft. Sin esto, la celda de Bonificación parpadeaba a valores
//     intermedios incorrectos (qty nuevo × precio viejo − descuento viejo)
//     hasta que llegaba el nuevo preview ~200-500 ms después.
//   - Si el `articleId` del normalizado NO coincide con el del draft (línea
//     reemplazada por otro artículo) o no hay `normalizedLine`, devolvemos
//     el `draftLine` tal cual — el cache anterior es inválido.
//   - El resto del shape `DocumentLine` (id, articleId, quantity, pricingMeta,
//     overrides, etc.) NUNCA se toca. Persistencia lo lee directo del draft.
//   - CERO matemática comercial. Es un selector, no un calculador.
// ============================================================================

import type { DocumentLine } from "../document-types";
import type { NormalizedPricingLine } from "../pricing/contract";

/** Devuelve la línea con los campos visuales (`unitPrice`, `lineTotal`,
 *  `discountAmount`, `taxAmount`, `lineTotalWithTax`, `subtotal`) tomados del
 *  ViewModel normalizado cuando hay match por slot — sea con firma vigente o
 *  como último valor válido cacheado del mismo artículo. Si no hay
 *  `normalizedLine` o el artículo cambió, devuelve el `draftLine` tal cual.
 *
 *  NO modifica el `draftLine` original (clona). El draft sigue siendo la
 *  fuente para persistencia (`saveDraftToBackend`) y para el cálculo del
 *  payload del próximo preview (`buildSalePreviewPayload`). */
export function selectInvoiceLineView(
  draftLine: DocumentLine,
  normalizedLine: NormalizedPricingLine | null | undefined,
  signatureMatches: boolean,
): DocumentLine {
  if (!normalizedLine) {
    return draftLine;
  }

  // Anti-flicker (firma stale): si la línea reemplazó su artículo, el
  // normalizado cacheado pertenece al artículo viejo → inválido. Sólo
  // anclamos al cache cuando la identidad del slot es la misma. Cuando
  // la firma SÍ coincide, el match ya está garantizado por la firma; el
  // chequeo extra es no-op.
  if (!signatureMatches && draftLine.articleId !== normalizedLine.articleId) {
    return draftLine;
  }

  // `lineTotal` y `taxAmount` son opcionales en `DocumentLine` (algunas líneas
  // legacy no los traen). Si el normalizado no provee uno, mantenemos el del
  // draft como fallback puntual de ese campo.
  // `lineTotalWithTax` se expone para que la celda "Total línea c/ imp." de
  // la Factura lo lea directo del backend sin recomputar.
  const lineTotal = normalizedLine.lineTotal ?? draftLine.lineTotal;

  // Exención por entidad (per-línea, fuente única real del motor). Acá la
  // firma puede o no coincidir; el normalizado refleja el cliente CON EL QUE
  // se calculó esta línea (último válido). Es AUTORITATIVO para el slot.
  // NO se hace OR con `draftLine.pricingMeta?.taxExemptByEntity`: ese valor
  // podía ser del cliente anterior (exento) y, al cambiar a un cliente NO
  // exento, dejaba el impuesto pegado en 0. El backend del cliente vigente
  // —o el último válido para el slot— es la verdad.
  const exempt = normalizedLine.taxExemptByEntity === true;

  // Override manual de impuesto: cuando existe, GANA sobre la exención del
  // cliente. La exención del cliente es un default automático (se aplica al
  // tax calculado por reglas del artículo), no un candado: el operador
  // puede ingresar un impuesto manual explícito sobre un cliente exento y
  // el motor lo respeta — `pricing-engine` devuelve `lineTaxAmount > 0`
  // cuando recibe `taxOverride` aunque el cliente sea exento.
  //
  // SIN este guard, este adapter aplastaba `taxAmount` a 0 cuando
  // `exempt === true`, ignorando el override del motor. Resultado: el
  // operador veía "Impuesto manual 30%" en el input pero el footer y los
  // totales mostraban impuesto $0 — flujo inconsistente reportado.
  //
  // POLICY R6 — passthrough estricto: cuando hay override, leemos lo que
  // el motor devolvió (`normalizedLine.lineTaxAmount`); no recalculamos
  // ningún porcentaje aquí.
  const hasManualTaxOverride = draftLine.pricingMeta?.taxOverride != null;

  // Subtotal: con firma vigente, el normalizado manda. Con firma stale, el
  // `subtotal` del draft también es del último preview (lo escribe
  // `applySalePreviewToDraft`), así que mantenerlo es equivalente; aún así
  // preferimos el normalizado como fuente única para no depender del orden
  // de hidratación.
  //
  // Nota: `NormalizedPricingLine` no expone `subtotal` per se (el motor lo
  // emite como `lineTotal`, que es el NETO sin impuestos). Para alinear con
  // `applySalePreviewToDraft` (donde `subtotal = pl.lineTotal`), reusamos
  // `lineTotal` como subtotal de línea.
  const subtotal = normalizedLine.lineTotal ?? draftLine.subtotal;

  return {
    ...draftLine,
    unitPrice:        normalizedLine.unitPrice         ?? draftLine.unitPrice,
    discountAmount:   normalizedLine.lineDiscount      ?? draftLine.discountAmount,
    subtotal,
    lineTotal,
    taxAmount:        (exempt && !hasManualTaxOverride)
      ? 0
      : (normalizedLine.lineTaxAmount     ?? draftLine.taxAmount),
    lineTotalWithTax: (exempt && !hasManualTaxOverride)
      ? (lineTotal ?? normalizedLine.lineTotalWithTax ?? draftLine.lineTotalWithTax)
      : (normalizedLine.lineTotalWithTax  ?? draftLine.lineTotalWithTax),
    pricingMeta: {
      ...draftLine.pricingMeta,
      // Propagamos el flag per-línea para que la celda "Total línea c/ imp."
      // y el input/badge usen LA MISMA fuente de exención (fix desalineación).
      // El override manual NO anula la condición del cliente exento (sigue
      // siendo exento conceptualmente); solo "le gana" al valor del tax. El
      // editor consume esto para distinguir "exento + manual 30%" del caso
      // "no exento + manual 30%" en el sub-label.
      taxExemptByEntity: exempt,
      // Cantidad ANCLA del snapshot del motor (passthrough). El draft puede
      // tener `quantity` distinto (el operador la cambió pero el preview no
      // volvió); los displays derivados deben usar ESTE valor para no
      // mezclar nueva qty con importes viejos. Si la firma coincide,
      // `previewQuantity` ya vino del normalizado del preview vigente; si
      // no, mantiene el valor del último preview cacheado para este slot.
      previewQuantity:
        normalizedLine.quantity ?? draftLine.pricingMeta?.previewQuantity ?? null,
    },
  };
}
