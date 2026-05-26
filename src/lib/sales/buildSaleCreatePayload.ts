// src/lib/sales/buildSaleCreatePayload.ts
// =============================================================================
// Construye el payload para `salesApi.create()` a partir del draft del
// frontend. Funcion PURA — no calcula valores economicos, solo mapea el
// shape del draft al shape esperado por el endpoint.
//
// Uso tipico: cuando el operador toca "Descargar PDF" o "Enviar por mail"
// sobre una factura nueva NO persistida, el frontend debe primero crear
// el Sale en backend (para que `GET /sales/:id/pdf` no responda 404).
// `ensurePersistedSaleDraft` (en VentasFacturas) usa este builder.
//
// Reglas:
//   · Filtra placeholders y headers (mismo predicado que
//     `buildSalePreviewPayload` via `isPreviewableLine`).
//   · Mapea solo campos que viajan a `CreateSalePayload`. NO incluye
//     overrides per-line (esos viven en preview-only por ahora).
//   · NO recalcula precios — pasa unitPrice tal cual viene del draft (el
//     backend recalcula con pricing-engine al crear el Sale).
// =============================================================================

import { isPreviewableLine } from "./matchPreviewLines";
import type { SalesInvoice } from "./types";
import type { CreateSalePayload, SaleLineInput } from "../../services/sales";

export interface BuildSaleCreatePayloadResult {
  /** false = el draft no tiene lineas reales; no llamar al backend. */
  hasRealLines: boolean;
  payload:      CreateSalePayload;
}

export function buildSaleCreatePayload(draft: SalesInvoice): BuildSaleCreatePayloadResult {
  // Mismo predicado que `buildSalePreviewPayload`: ARTICLE con articleId
  // o MANUAL con descripcion no vacia. Headers/empty placeholders fuera.
  const realLines = draft.lines.filter(isPreviewableLine);

  const lines: SaleLineInput[] = realLines.map((l) => ({
    // ARTICLE: articleId real. MANUAL: el backend acepta articleId vacio
    // siempre que `description` viaje — pero `CreateSalePayload.SaleLineInput`
    // no tiene `description` ni `type`. Para v1 del fix, filtramos manuales
    // si no tienen articleId (el preview los soporta, el create historico no).
    articleId: l.articleId ?? "",
    variantId: l.variantId ?? null,
    quantity:  Number(l.quantity) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    // NOTA: `DocumentLine` no tiene `discountPct` (tiene `discountAmount`
    // — un monto absoluto). `CreateSalePayload.SaleLineInput.discountPct`
    // es opcional; lo omitimos y el backend recalcula con su pricing-engine
    // a partir de la lista/promociones/cliente. Cuando se persista
    // discount overrides desde la grilla editable, se mapearan acá.
  })).filter((row) => row.articleId);  // descarta manuales sin articulo (limitacion v1)

  return {
    hasRealLines: lines.length > 0,
    payload: {
      // Strings vacios → null (el backend acepta null pero rechaza string vacio
      // en algunos casos de FK opcional).
      clientId:    draft.clientId   ?? null,
      sellerId:    nullIfEmpty(draft.seller),
      warehouseId: nullIfEmpty(draft.warehouse),
      channelId:   draft.channelId  ?? null,
      couponCode:  draft.couponCode ?? null,
      notes:       draft.notes ?? "",
      lines,
      // Balance mode override pasa solo si el draft lo definio explicitamente.
      balanceModeOverride: draft.balanceModeOverride ?? null,
    },
  };
}

function nullIfEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}
