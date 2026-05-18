// src/lib/sales/buildReceiptDraftPayload.ts
// ============================================================================
// Helper PURO para construir el payload de `POST /receipts` (DRAFT).
//
// Extraído de `saveDraftToBackend` (VentasFacturas.tsx) durante FASE 8.2.5c.
//
// Responsabilidad única: dado un `SalesInvoice` (draft del modal) +
// catálogo de monedas, devuelve el `CreateReceiptDraftPayload` listo para
// enviar al backend.
//
// Cero lógica comercial: solo mapeo de shapes + assembly del snapshot
// versionado. Las matemáticas (subtotales, taxes, totales) ya vinieron
// resueltas por el motor — acá solo se redondean con `round2` para evitar
// floating-point garbage en el payload.
// ============================================================================

import { round2 } from "../document-helpers";
import type { CreateReceiptDraftPayload } from "../../services/receipts";
import type { CurrencyRow } from "../../services/valuation";
import type { DocumentLine } from "../document-types";
import type { SalesInvoice } from "./types";

// ─── Predicados de líneas reales ───────────────────────────────────────────
//
// Los predicados oficiales viven en VentasFacturas.tsx (`isEmptyLine`,
// `isHeaderLine`). Acá los duplicamos como interfaz mínima para que el
// helper sea puro y autocontenido. El caller pasa los predicados que ya
// usa en el resto del modal — coherencia garantizada.
export type LinePredicates = {
  isEmptyLine:  (line: DocumentLine) => boolean;
  isHeaderLine: (line: DocumentLine) => boolean;
};

// ─── buildReceiptDraftLine ─────────────────────────────────────────────────

/** Mapea una línea del modal al shape esperado por el backend en el array
 *  `lines[]` del payload de receipts. Pure. */
function buildReceiptDraftLine(
  l: DocumentLine,
  idx: number,
): CreateReceiptDraftPayload["lines"][number] {
  const qty            = Number(l.quantity ?? 0);
  const unit           = Number(l.unitPrice ?? 0);
  const disc           = round2(l.discountAmount ?? 0);
  const lineSubtotal   = round2(Math.max(0, qty * unit - disc));
  const taxAmount      = round2(l.taxAmount ?? 0);
  return {
    articleId:      l.articleId,
    variantId:      l.variantId,
    itemKind:       l.itemKind ?? (l.variantId ? "ARTICLE_VARIANT" : "ARTICLE_SIMPLE"),
    name:           l.article || "",
    code:           l.sku || "",
    sku:            l.sku || "",
    barcode:        "",
    quantity:       qty,
    unitPrice:      unit,
    subtotal:       round2(qty * unit),
    discountAmount: disc,
    lineTotal:      lineSubtotal,
    taxAmount,
    totalWithTax:   round2(lineSubtotal + taxAmount),
    totalCost:      l.pricingMeta?.unitCost != null
      ? round2(Number(l.pricingMeta.unitCost) * qty)
      : null,
    totalMargin:    l.pricingMeta?.unitMargin != null
      ? round2(Number(l.pricingMeta.unitMargin) * qty)
      : null,
    sortOrder:      idx,
    pricingSnapshot: l.pricingMeta ?? {},
  };
}

// ─── buildReceiptDraftPayload (entry point) ────────────────────────────────

export type BuildReceiptDraftPayloadResult =
  | { ok: true;  payload: CreateReceiptDraftPayload }
  | { ok: false; error: "NO_REAL_LINES" };

/**
 * Construye el payload completo de `POST /receipts` para un draft de Factura.
 *
 * Returns:
 *   - `{ ok: true, payload }` cuando el draft tiene al menos una línea real
 *     (no header / no empty).
 *   - `{ ok: false, error: "NO_REAL_LINES" }` cuando no hay líneas reales.
 *     El caller decide cómo señalar el error (toast, banner, etc.).
 *
 * Pure. El caller hace el POST y maneja loading/UI.
 */
export function buildReceiptDraftPayload(args: {
  draft:        SalesInvoice;
  currencies:   CurrencyRow[];
  predicates:   LinePredicates;
}): BuildReceiptDraftPayloadResult {
  const { draft, currencies, predicates } = args;
  const realLines = draft.lines.filter(
    (l) => !predicates.isEmptyLine(l) && !predicates.isHeaderLine(l),
  );
  if (realLines.length === 0) {
    return { ok: false, error: "NO_REAL_LINES" };
  }

  const cur     = currencies.find((c) => c.code === draft.currency || c.id === draft.currency);
  const baseCur = currencies.find((c) => c.isBase);
  const symbol  = (cur?.symbol ?? "").trim();

  // FASE 9 — C1: defensa en profundidad. El guard primario vive en `applyFx`
  // (VentasFacturas) que bloquea con toast antes de mutar el draft. Acá
  // protegemos contra drafts heredados (factura vieja con `fxRate=0` guardada
  // antes del guard) y contra cualquier path que muta `draft.fxRate` sin
  // pasar por `applyFx`. Sin esto, `totalBase = total × 0 = 0`.
  const rawFx   = Number(draft.fxRate ?? 1);
  const fxValid = Number.isFinite(rawFx) && rawFx > 0;
  const fxRate  = cur?.isBase ? 1 : (fxValid ? rawFx : 1);

  const payload: CreateReceiptDraftPayload = {
    type:           "INVOICE",
    direction:      "OUTBOUND",
    counterpartyId: draft.clientId || undefined,
    currencyCode:   cur?.code ?? draft.currency ?? "",
    currencyRate:   fxRate,
    subtotal:       round2(draft.subtotal ?? 0),
    discountAmount: round2(draft.discountAmount ?? 0),
    taxAmount:      round2(draft.taxAmount ?? 0),
    total:          round2(draft.total ?? 0),
    totalBase:      round2((draft.total ?? 0) * fxRate),
    issueDate:      draft.date || undefined,
    dueDate:        draft.dueDate || undefined,
    notes:          [draft.notes, draft.terms].filter(Boolean).join("\n\n").trim(),

    pricingSnapshot: {
      version:        1,
      resolvedAt:     new Date().toISOString(),
      currency:       { code: cur?.code ?? draft.currency, rate: fxRate, symbol },
      client:         draft.clientSnapshot ?? null,
      priceListId:    draft.priceListId ?? null,
      sellerId:       draft.seller || null,
      warehouseId:    draft.warehouse || null,
      paymentTerm:    draft.paymentTerm || null,
      discountGlobal: draft.discountGlobal ?? null,
      shipping:       draft.shipping ?? null,
      totals: {
        subtotal:       round2(draft.subtotal ?? 0),
        discountAmount: round2(draft.discountAmount ?? 0),
        taxAmount:      round2(draft.taxAmount ?? 0),
        total:          round2(draft.total ?? 0),
      },
      lineCount: realLines.length,
    },
    currencySnapshot: {
      currencyCode:     cur?.code ?? draft.currency ?? "",
      symbol,
      currencyRate:     fxRate,
      baseCurrencyCode: baseCur?.code ?? "ARS",
    },

    lines: realLines.map(buildReceiptDraftLine),
  };

  return { ok: true, payload };
}
