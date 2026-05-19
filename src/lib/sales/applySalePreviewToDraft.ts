// src/lib/sales/applySalePreviewToDraft.ts
// ============================================================================
// Hidrata un draft de Factura con la respuesta del backend.
//
// Extraído de `src/pages/VentasFacturas.tsx` durante FASE 5. Función PURA —
// no calcula valores económicos: solo MAPEA el response a la estructura del
// draft. Lo que ya viene calculado del motor se preserva tal cual.
//
// Reemplaza por línea: `unitPrice`, `discountAmount`, `subtotal`, `taxAmount`,
// `lineTotal` y todos los campos de `pricingMeta`. En la cabecera reemplaza
// `subtotal / discountAmount / taxAmount / total`.
//
// Fase 6.5 — respeta `manualOverrides`: si la línea tiene un flag manual
// activo (price/discount/tax/quantity), NO se pisa ese campo. Como el payload
// ya envió esos valores como overrides, la respuesta del backend es coherente
// con ellos; el guard adicional protege de races.
// ============================================================================

import { round2 } from "../document-helpers";
import type { DocumentLine } from "../document-types";
import type { SalePreviewLine, SalePreviewResult } from "../../services/sales";
import { isPreviewableLine } from "./matchPreviewLines";
import type { SalesInvoice } from "./types";

export function applySalePreviewToDraft(
  draft: SalesInvoice,
  preview: SalePreviewResult,
): SalesInvoice {
  // F1.4 #11-E.1 — Ajustes globales del documento. Mismo valor en todas las
  // líneas (passthrough del preview response). Cero matemática frontend.
  const docChannel: NonNullable<NonNullable<DocumentLine["pricingMeta"]>["documentAdjustments"]>["channel"] | null =
    preview.channelResult && Number.isFinite(preview.channelResult.channelAmount)
      && preview.channelResult.channelAmount !== 0
      ? { name: preview.channelResult.channelName, amount: preview.channelResult.channelAmount }
      : null;
  const docCoupon: NonNullable<NonNullable<DocumentLine["pricingMeta"]>["documentAdjustments"]>["coupon"] | null =
    preview.couponResult && preview.couponResult.applied
      && Number.isFinite(preview.couponResult.discountAmount)
      && preview.couponResult.discountAmount > 0
      ? {
          code:   preview.couponResult.couponCode,
          name:   preview.couponResult.couponName,
          amount: preview.couponResult.discountAmount,
        }
      : null;

  // "Aplica a" heredado de la regla comercial del cliente (passthrough del
  // preview backend). Mismo valor para todas las líneas (es config del
  // cliente, no por línea). Display-only: el combo de Bonificación lo usa
  // como default cuando la línea no tiene override manual. Aceptamos los
  // 4 valores del enum backend `CommercialApplyOn` (TOTAL/METAL/HECHURA/
  // METAL_Y_HECHURA). El cliente NUNCA emite SUBTOTAL_* (son fiscales);
  // cualquier valor desconocido cae a null → el combo muestra "Total".
  const VALID_SCOPES = ["TOTAL", "METAL", "HECHURA", "METAL_Y_HECHURA"] as const;
  const rawClientApplyOn = (preview as any)?.clientCommercialRules?.applyOn ?? null;
  const inheritedDiscountAppliesTo: "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE" | null =
    (VALID_SCOPES as readonly string[]).includes(rawClientApplyOn)
      ? rawClientApplyOn
      : null;

  // Bonificación heredada del cliente (passthrough doc-level → mismo valor
  // en todas las líneas). Display-only `origin:"CLIENT"`: el motor ya la
  // aplicó por clientId; NO se reenvía. Solo se setea si el preview la trae.
  const ccr = (preview as any)?.clientCommercialRules ?? null;
  const inheritedDiscount =
    ccr && (ccr.ruleType != null || ccr.value != null)
      ? {
          ruleType:  ccr.ruleType  ?? null,
          valueType: ccr.valueType ?? null,
          value:     typeof ccr.value === "number" ? ccr.value : null,
          // El motor trata `applyOn` ausente como TOTAL
          // (pricing-engine.sale.ts: `?? "TOTAL"`). Reflejamos esa MISMA
          // semántica para que el render de la bonificación heredada coincida
          // con lo que el motor efectivamente aplicó (sin esto, applyOn=null
          // hacía que el TPNumber no mostrara el % heredado).
          applyOn:   ccr.applyOn   ?? "TOTAL",
          origin:    "CLIENT" as const,
        }
      : null;

  // Exención fiscal por cliente (metadata read-only del preview). El editor
  // ya consume `pricingMeta.taxExemptByEntity` (badge "Exento" + deshabilita).
  const clientTaxExempt = (preview as any)?.clientTaxExempt === true;

  // [BONIF_DEBUG] instrumentación temporal — remover tras diagnóstico.
  const BDBG = import.meta.env.DEV;
  if (BDBG) {
    // eslint-disable-next-line no-console
    console.groupCollapsed(
      `[BONIF_DEBUG] applySalePreviewToDraft — preview trae ${preview.lines.length} línea(s)`,
    );
  }
  let realIdx = 0;
  const previewLines = preview.lines;
  const updatedLines: DocumentLine[] = draft.lines.map((line) => {
    // Coherente con `buildSalePreviewPayload` y `linesForView`: el filtro
    // canónico vive en `isPreviewableLine`.
    if (!isPreviewableLine(line)) return line;
    const pl: SalePreviewLine | undefined = previewLines[realIdx++];
    if (!pl) return line;
    if (BDBG) {
      // eslint-disable-next-line no-console
      console.log("[BONIF_DEBUG] hidratando", {
        lineId:                 line.id,
        articleId:              line.articleId,
        manualDiscountAppliesTo: (line.pricingMeta as any)?.manualDiscountAppliesTo ?? null,
        meta_manualDiscount:    line.pricingMeta?.manualDiscount ?? null,
        pl_basePrice:           pl.basePrice,
        pl_unitPrice:           pl.unitPrice,
        pl_lineDiscount:        (pl as any).lineDiscount,
        pl_lineTotal:           pl.lineTotal,
        pl_lineTaxAmount:       (pl as any).lineTaxAmount,
        pl_lineTotalWithTax:    pl.lineTotalWithTax,
        pl_manualOverridesApplied: (pl as any).manualOverridesApplied ?? null,
      });
    }

    // `pl.lineTotal` es el NETO sin tax YA REDONDEADO por el motor (es
    // `lineTotalWithTax − lineTaxAmount`, preservando el redondeo de
    // `applyOn=TOTAL` de la lista). Usar esto como subtotal de línea.
    const subtotal         = pl.lineTotal       ?? pl.lineSubtotal ?? 0;
    const lineTaxAmount    = pl.lineTaxAmount;
    const lineTotalWithTax = pl.lineTotalWithTax ?? round2(subtotal + lineTaxAmount);
    // Sprint 4 — POLICY.md §4 R4.1: el backend v3 emite `unitTotalWithTax`
    // por línea. El frontend lo lee tal cual; no lo deriva.
    const unitTotalWithTax = pl.unitTotalWithTax ?? null;

    return {
      ...line,
      // Bug fix: la respuesta del backend YA respeta los overrides manuales
      // (`buildSalePreviewPayload` los mandó como manualPriceOverride /
      // manualDiscountOverride / taxOverride). Por eso `pl.X` es el valor
      // correcto incluso cuando hay override activo. La protección
      // anti-stale se hace por `reqId` arriba en el hook (las respuestas
      // viejas se descartan antes de aplicar).
      quantity:       line.quantity,
      unitPrice:      pl.unitPrice ?? line.unitPrice,
      discountAmount: pl.lineDiscount,
      taxAmount:      lineTaxAmount,
      // subtotal y lineTotal se recalculan a partir de los datos del backend
      // SIEMPRE — son derivados, no campos editables. Si el override está
      // activo, el backend ya consideró el override al calcular estos valores.
      subtotal,
      lineTotal:      lineTotalWithTax,
      // Top-level `lineTotalWithTax` también se hidrata: la celda "Total
      // línea c/ imp." lo lee directamente para evitar caer a un fallback
      // (`subtotalNet + lineTax`) que en líneas manuales daba un monto
      // inflado (porque `subtotalNet` lee `l.lineTotal` que ya incluye
      // impuestos en este shape legacy).
      lineTotalWithTax,
      pricingMeta: {
        ...line.pricingMeta,
        priceSource:             pl.priceSource,
        baseSource:              pl.pricingSnapshot?.baseSource,
        appliedPriceListId:      pl.appliedPriceListId,
        appliedPriceListName:    pl.appliedPriceListName,
        appliedPromotionId:      pl.appliedPromotionId,
        appliedPromotionName:    pl.appliedPromotionName,
        basePrice:               pl.basePrice,
        quantityDiscountAmount:  pl.quantityDiscountAmount,
        promotionDiscountAmount: pl.promotionDiscountAmount,
        unitCost:                pl.unitCost,
        unitMargin:              pl.unitMargin,
        marginPercent:           pl.marginPercent,
        metalCost:               pl.metalHechuraBreakdown?.metalCost   ?? null,
        metalSale:               pl.metalHechuraBreakdown?.metalSale   ?? null,
        hechuraCost:             pl.metalHechuraBreakdown?.hechuraCost ?? null,
        hechuraSale:             pl.metalHechuraBreakdown?.hechuraSale ?? null,
        // Fase 2.7.b — márgenes agregados por tipo (passthrough).
        metalMarginPct:          pl.metalHechuraBreakdown?.metalMarginPct   ?? null,
        hechuraMarginPct:        pl.metalHechuraBreakdown?.hechuraMarginPct ?? null,
        // Desglose por componente con adjustments. Permite que la UI muestre
        // el monto absoluto de la bonificación junto al porcentaje configurado,
        // leyendo backend sin recalcular (POLICY.md §4 R4.5).
        componentSaleBreakdown:  (pl as any).componentSaleBreakdown ?? null,
        // Composition (metal/hechura/taxes) — fuente única.
        composition:             (pl as any).composition ?? null,
        // F1.4 G5 #11-C — overrides per costLineId aplicados al preview
        // y warnings internos.
        costLineOverridesApplied: (pl as any).costLineOverridesApplied ?? undefined,
        debugWarnings:            (pl as any).debugWarnings            ?? undefined,
        // F1.4 #11-E.1 — ajustes globales del documento (passthrough).
        documentAdjustments:     {
          // lineManualDiscount: per línea.
          lineManualDiscount: (() => {
            const md = line.pricingMeta?.manualDiscount;
            if (!md || (md.appliesTo ?? "TOTAL") !== "TOTAL") return null;
            const lineDisc = Number.isFinite(pl.lineDiscount) ? pl.lineDiscount : 0;
            if (lineDisc <= 0) return null;
            return {
              kind:     "BONUS" as const,
              valuePct: md.mode === "PERCENT" ? md.value : null,
              amount:   lineDisc,
            };
          })(),
          channel: docChannel,
          coupon:  docCoupon,
        },
        partial:                 false,
        taxBreakdown:            (pl.taxBreakdown ?? []).map((tb: any) => ({
          name:      tb?.name      ?? "",
          rate:      tb?.rate      ?? null,
          taxAmount: tb?.taxAmount ?? 0,
        })),
        unitTotalWithTax,
        // "Aplica a" heredado del cliente (passthrough; display-only). El
        // combo de Bonificación lo usa como default si no hay override.
        inheritedDiscountAppliesTo,
        // Bonificación heredada del cliente (passthrough; display-only,
        // origin=CLIENT; NO se reenvía como override).
        inheritedDiscount,
        // Exención fiscal por cliente. Prioridad: flag PER-LÍNEA del motor
        // (fuente única real) → metadata doc-level → valor previo. El editor
        // muestra "Exento cliente" y fuerza Impuestos 0,00 / total = neto.
        taxExemptByEntity:
          (pl as any)?.taxExemptByEntity === true ||
          clientTaxExempt ||
          line.pricingMeta?.taxExemptByEntity === true,
      },
    };
  });

  // [BONIF_DEBUG] instrumentación temporal — remover tras diagnóstico.
  if (BDBG) {
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  const dt = preview.documentTotals;
  return {
    ...draft,
    lines:          updatedLines,
    subtotal:       dt.subtotalAfterLineDiscounts,
    // Suma honesta de TODOS los descuentos del documento.
    discountAmount: round2(
      dt.lineDiscountAmount +
      dt.couponDiscountAmount +
      dt.globalDiscountAmount,
    ),
    taxAmount:      dt.taxAmount,
    total:          dt.total,
  };
}
