// src/lib/sales/buildClientSnapshot.ts
// ============================================================================
// Construye el snapshot del cliente para guardar en el comprobante.
//
// Extraído de `src/pages/VentasFacturas.tsx` durante FASE 5. Función PURA —
// sin side effects, sin React, sin lógica comercial nueva.
// ============================================================================

import type { TPEntityLite } from "../../components/ui/TPEntitySearchSelect";
import type { EntityDetail } from "../../services/commercial-entities";
import type { ClientSnapshot } from "./types";

/**
 * Construye el snapshot completo del cliente para guardar en el documento.
 * Acepta opcionalmente el `detail` (con direcciones / documentación completa);
 * si no vino, completa con lo que ya hay en el `lite`.
 */
export function buildClientSnapshot(
  lite: TPEntityLite,
  detail?: EntityDetail | null,
): ClientSnapshot {
  const composed = detail?.entityType === "COMPANY"
    ? (detail.tradeName || detail.companyName || "").trim()
    : detail
      ? `${detail.firstName ?? ""} ${detail.lastName ?? ""}`.trim()
      : "";
  const displayName = (detail?.displayName ?? "").trim() || composed || lite.name;

  return {
    name:           lite.name,
    displayName,
    entityType:     detail?.entityType ?? lite.entityType,
    firstName:      detail?.firstName  || lite.firstName,
    lastName:       detail?.lastName   || lite.lastName,
    companyName:    detail?.companyName || lite.companyName,
    tradeName:      detail?.tradeName  || lite.tradeName,
    documentType:   detail?.documentType    || lite.documentType,
    documentNumber: detail?.documentNumber  || lite.documentNumber,
    taxCondition:   detail?.ivaCondition    || lite.ivaCondition,
    email:          detail?.email           || lite.email,
    phone:          detail?.phone           || lite.phone,
    currency:       detail?.currencyId      || lite.currency,
    priceList:      detail?.priceListId     || lite.priceListId,
    paymentTerm:    detail?.paymentTerm     || lite.paymentTerm,
    seller:         lite.sellerId,
  };
}
