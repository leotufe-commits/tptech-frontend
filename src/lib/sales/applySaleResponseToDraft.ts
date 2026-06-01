// src/lib/sales/applySaleResponseToDraft.ts
// =============================================================================
// Hidrata un `SalesInvoice` (draft del frontend) con la respuesta de
// `salesApi.create()` / `update()` / `confirm()` / `cancel()`.
//
// Etapa 3 — passthrough puro: NO calcula nada. Solo copia campos del Sale
// persistido al draft para que el modal muestre el id real, el código
// interno (`number`), el número oficial (`officialNumber`) tras confirmar,
// el `status` actualizado, fecha de confirmación/anulación, etc.
//
// Lo que NO se reemplaza:
//   · `lines` — el preview flow mantiene las líneas sincronizadas con el
//     backend (los `pricingMeta` viven en el frontend y los preserva el
//     mismo preview). Tocarlos acá rompería overrides locales pendientes.
//   · `shipping` / `discountGlobal` — solo se refresca el monto, no la
//     estructura. La intención (origen, método) sigue en el draft.
//
// El helper es **defensivo**: campos undefined del response no pisan al
// draft. Esto permite usarlo tras cualquier endpoint (create/update/
// confirm/cancel) sin perder estado local.
// =============================================================================

import type { SalesInvoice, SalesInvoiceStatus } from "./types";
import type { SaleDetail, SaleStatus } from "../../services/sales";

/**
 * Mapea el `SaleStatus` del backend al `SalesInvoiceStatus` del frontend.
 * El frontend usa `PENDING/PARTIAL/PAID/DRAFT/CANCELLED` (legacy del UI);
 * el backend usa `DRAFT/CONFIRMED/PAID/PARTIALLY_PAID/CANCELLED`.
 *
 * Convención:
 *   · DRAFT      → DRAFT
 *   · CONFIRMED  → PENDING  (confirmada, sin cobros)
 *   · PARTIALLY_PAID → PARTIAL
 *   · PAID       → PAID
 *   · CANCELLED  → CANCELLED
 */
function mapBackendStatus(s: SaleStatus): SalesInvoiceStatus {
  switch (s) {
    case "DRAFT":          return "DRAFT";
    case "CONFIRMED":      return "PENDING";
    case "PARTIALLY_PAID": return "PARTIAL";
    case "PAID":           return "PAID";
    case "CANCELLED":      return "CANCELLED";
  }
}

/** Extrae el número oficial (Receipt.code) del primer INVOICE emitido.
 *  Una sale CONFIRMED debería tener exactamente uno; las NC suman a
 *  `receipts` pero NO son la factura oficial. */
function extractOfficialNumber(sale: SaleDetail): string | undefined {
  if (!sale.receipts || sale.receipts.length === 0) return undefined;
  const invoice = sale.receipts.find(
    (r) => r.type === "INVOICE" && r.direction === "OUTBOUND" && r.status === "ISSUED",
  );
  return invoice?.code;
}

function parseNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function applySaleResponseToDraft(
  draft: SalesInvoice,
  sale:  SaleDetail,
): SalesInvoice {
  const officialNumber = extractOfficialNumber(sale);
  const status = mapBackendStatus(sale.status);

  // ── Shipping persistido en el backend (Etapa 1.1). Si el draft tenía un
  //    shape rico (carrier, address, etc.), lo preservamos y solo
  //    refrescamos el `cost`. Si no había shipping y el backend persistió
  //    un monto, lo creamos como `{ cost }` plano.
  const persistedShippingAmount = parseNum(sale.shippingAmount ?? null);
  const shipping = (() => {
    if (persistedShippingAmount == null || persistedShippingAmount === 0) {
      return draft.shipping;
    }
    return {
      ...(draft.shipping ?? {}),
      cost: persistedShippingAmount,
    };
  })();

  // ── Descuento global persistido. Idem shipping: preservamos `origin`,
  //    `reason` del draft y refrescamos type+value.
  const gdValue = parseNum(sale.globalDiscountValue ?? null);
  const gdType  = sale.globalDiscountType;
  const discountGlobal = (() => {
    if (!gdType || gdValue == null || gdValue <= 0) return draft.discountGlobal;
    return {
      ...(draft.discountGlobal ?? {}),
      type:  gdType,
      value: gdValue,
    };
  })();

  return {
    ...draft,
    // ── Identidad
    id:             sale.id,
    number:         sale.code,
    officialNumber: officialNumber ?? draft.officialNumber,
    status,
    // ── Totales — los hidrata el preview tras un round-trip de overrides,
    //    pero los emitidos por el backend al confirmar son los autoritativos.
    subtotal:       parseNum(sale.subtotal)       ?? draft.subtotal,
    discountAmount: parseNum(sale.discountAmount) ?? draft.discountAmount,
    taxAmount:      parseNum(sale.taxAmount)      ?? draft.taxAmount,
    total:          parseNum(sale.total)          ?? draft.total,
    paidAmount:     parseNum(sale.paidAmount)     ?? draft.paidAmount,
    // ── Ajustes documento Etapa 1.1
    shipping,
    discountGlobal,
    // ── Balance mode (si el backend lo resolvió en confirm)
    balanceModeOverride: (sale.balanceModeOverride as any) ?? draft.balanceModeOverride,
    // ── Notas / fechas (refresh defensivo)
    notes:          sale.notes ?? draft.notes,
    // ── Manual Adjustment (Etapas A + C) — rehidratación del DRAFT.
    //    Si la sale está en DRAFT y tenía un `manualAdjustmentInput`
    //    persistido, lo proyectamos al draft del modal para que el
    //    operador no pierda lo tipeado al cerrar/reabrir el borrador.
    //    Después del CONFIRM, `manualAdjustmentInput` queda en `null` y
    //    el snapshot inmutable vive en `manualAdjustmentSnapshot`; en ese
    //    caso preservamos lo que tenga el draft (display-only).
    manualAdjustment: rehydrateManualAdjustment(draft, sale),
  };
}

/** Etapa A/C — adapter del campo persistido `Sale.manualAdjustmentInput` al
 *  shape del draft. El backend guarda `{ scope, amount?, metals?,
 *  monetaryAmount?, reason? }` y el frontend lo consume tal cual.
 *  Devuelve `undefined` cuando no hay input persistido (preserva lo que
 *  tenga el draft actual). */
function rehydrateManualAdjustment(
  draft: SalesInvoice,
  sale:  SaleDetail,
): SalesInvoice["manualAdjustment"] {
  const persisted = sale.manualAdjustmentInput ?? null;
  if (persisted == null) {
    // En DRAFT sin input persistido → conservamos el draft local (puede
    // tener lo que el operador acaba de tipear pero aún no se guardó).
    return draft.manualAdjustment;
  }
  if (persisted.scope === "BREAKDOWN") {
    return {
      scope: "BREAKDOWN" as const,
      metals: (persisted.metals ?? []).map((m: any) => ({
        metalParentId:    m.metalParentId ?? null,
        metalParentName:  m.metalParentName,
        ...(typeof m.targetGrams === "number" ? { targetGrams: m.targetGrams } : {}),
        ...(typeof m.deltaGrams  === "number" ? { deltaGrams:  m.deltaGrams  } : {}),
        reason: m.reason ?? null,
      })),
      ...(typeof persisted.monetaryAmount === "number"
        ? { monetaryAmount: persisted.monetaryAmount }
        : {}),
      reason: persisted.reason ?? null,
    };
  }
  // UNIFIED.
  return {
    scope:  "UNIFIED" as const,
    amount: typeof (persisted as any).amount === "number" ? (persisted as any).amount : 0,
    reason: persisted.reason ?? null,
  };
}
