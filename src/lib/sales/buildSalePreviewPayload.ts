// src/lib/sales/buildSalePreviewPayload.ts
// ============================================================================
// Construye el payload para `salesApi.preview` a partir del draft del frontend.
//
// Extraído de `src/pages/VentasFacturas.tsx` durante FASE 5. Función PURA —
// no calcula valores económicos: solo mapea el draft a la forma esperada por
// el endpoint.
//
// Respeta `manualOverrides`: si una línea tiene flag manual activo (price /
// discount / tax), envía el override correspondiente para que el motor lo
// respete. El motor backend decide cómo aplicarlos.
// ============================================================================

import { salesApi } from "../../services/sales";
import { isPreviewableLine } from "./matchPreviewLines";
import type { SalesInvoice } from "./types";

export function buildSalePreviewPayload(
  draft: SalesInvoice,
  /**
   * Id (UUID) de la moneda del documento. El backend acepta `currencyId`
   * (Fase MM) y devuelve el preview convertido a esa moneda. El caller lo
   * resuelve contra el catálogo porque `draft.currency` puede ser code
   * (ARS) o id; el backend solo acepta id. Sin esto, el preview vuelve en
   * moneda base.
   */
  currencyId?: string | null,
): {
  hasRealLines: boolean;
  payload:      Parameters<typeof salesApi.preview>[0];
} {
  // Líneas que entran al preview — predicado canónico en `isPreviewableLine`.
  // ARTICLE: con `articleId` (catálogo). MANUAL: `isManual=true` + descripción
  // no vacía. Cualquier cambio del filtro debe hacerse en una sola fuente
  // (`matchPreviewLines.ts`) — ver el comentario allí sobre la invariante.
  const realLines = draft.lines.filter(isPreviewableLine);
  const out = {
    hasRealLines: realLines.length > 0,
    payload: {
      lines: realLines.map((l) => {
        const ov   = l.manualOverrides;
        const meta = l.pricingMeta;

        type Mode = "PERCENT" | "AMOUNT";
        type AppliesTo = "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE";
        type LineOverride = { mode: Mode; value: number; appliesTo?: AppliesTo } | null;

        // Override de precio: si flag activo → mandamos la INTENCIÓN del
        // operador, que vive en `pricingMeta.manualPrice`. NO `l.unitPrice`:
        // ese campo se hidrata desde el response del backend tras cada
        // preview y puede tener un delta de redondeo mínimo (ej. moneda
        // convertida, lista con `applyOn=PRICE`). Si el payload se
        // construye desde `l.unitPrice`, el delta hace que la firma del
        // siguiente preview sea distinta → se dispara otro fetch → la
        // hidratación cambia `unitPrice` otra vez → LOOP INFINITO.
        // Bonificación e impuestos ya leían de `meta.X` por la misma razón.
        const manualPriceOverride: number | null =
          ov?.price === true
            ? (meta?.manualPrice != null ? meta.manualPrice : l.unitPrice)
            : null;

        // Override de bonificación: si flag → reconstruimos {mode,value,appliesTo}
        // a partir de la última config en pricingMeta.manualDiscount, o del
        // discountAmount unitario como AMOUNT/TOTAL fallback.
        let manualDiscountOverride: LineOverride = null;
        if (ov?.discount === true) {
          if (meta?.manualDiscount) {
            manualDiscountOverride = meta.manualDiscount;
          } else {
            const qty = Number.isFinite(l.quantity) ? l.quantity : 0;
            const discUnit = qty > 0 ? (l.discountAmount ?? 0) / qty : 0;
            manualDiscountOverride = discUnit > 0
              ? { mode: "AMOUNT", value: discUnit, appliesTo: "TOTAL" }
              : null;
          }
        }

        // Override de impuesto: análogo. pricingMeta.taxOverride es la
        // forma canónica; si no está, derivamos de taxAmount unitario.
        let taxOverride: LineOverride = null;
        if (ov?.tax === true) {
          if (meta?.taxOverride) {
            taxOverride = meta.taxOverride;
          } else {
            const qty = Number.isFinite(l.quantity) ? l.quantity : 0;
            const taxUnit = qty > 0 ? (l.taxAmount ?? 0) / qty : 0;
            taxOverride = { mode: "AMOUNT", value: taxUnit, appliesTo: "TOTAL" };
          }
        }

        // Línea MANUAL: payload mínimo, sin overrides de catálogo. El
        // precio del operador viaja como `manualPriceOverride` (el backend
        // lo usa como base; sin él, lineTotal = 0 hasta que se ingrese).
        if (l.isManual === true) {
          return {
            type: "MANUAL" as const,
            description: l.manualDescription ?? "",
            quantity: l.quantity,
            // Para línea manual: si el operador editó el unitPrice (siempre
            // local, sin flag `price`), lo mandamos como manualPriceOverride.
            // Si el flag explícito está, prioriza meta.manualPrice.
            manualPriceOverride:
              meta?.manualPrice != null ? meta.manualPrice
              : (l.unitPrice ?? null),
            manualDiscountOverride,
            taxOverride,
          };
        }

        return {
          articleId: l.articleId!,
          variantId: l.variantId ?? null,
          quantity:  l.quantity,
          manualPriceOverride,
          manualDiscountOverride,
          taxOverride,
          // Override de SOLO la base ("Aplica a"), INDEPENDIENTE del valor.
          // Viaja aunque NO haya override de %/monto → el motor recalcula
          // el descuento/impuesto HEREDADO sobre esa base. El frontend solo
          // reenvía la elección (cero cálculo). Si hay override de valor,
          // su `appliesTo` ya viaja embebido y el backend le da precedencia.
          manualDiscountAppliesToOverride:
            (meta as any)?.manualDiscountAppliesTo ?? null,
          manualTaxAppliesToOverride:
            (meta as any)?.manualTaxAppliesTo ?? null,
          // Override de lista por línea — toma precedencia sobre la lista
          // global del documento.
          priceListIdOverride: l.priceListIdOverride ?? null,
          // Fase 3B — overrides de composición. Viven en `pricingMeta` (los
          // setea `applyLineOverrides` desde el panel avanzado o el editor
          // PRE editable). Se mandan al backend para que el motor recalcule
          // costo/margen/precio con la composición ajustada por línea sin
          // tocar el artículo maestro.
          gramsOverride:          meta?.gramsOverride         ?? null,
          mermaPercentOverride:   meta?.mermaPercentOverride  ?? null,
          metalVariantIdOverride: meta?.metalVariantIdOverride ?? null,
          hechuraOverrideAmount:  meta?.hechuraOverrideAmount ?? null,
          // F1.4 G5 #11-D — overrides per costLineId (pisa los legacy cuando
          // match por id). El motor backend (commit 11-A) los resuelve y
          // devuelve `costLineOverridesApplied` en el preview.
          costLineOverrides:      meta?.costLineOverrides     ?? undefined,
        };
      }),
      clientId:       draft.clientId      ?? null,
      channelId:      draft.channelId     ?? null,
      couponCode:     draft.couponCode || null,
      shippingAmount: draft.shipping?.cost ?? 0,
      // Lista global del documento. Sin esto, cambiar la lista en el header
      // no afectaría el preview: el backend caería a la jerarquía por
      // cliente/favorita y los precios no se moverían.
      priceListId:    draft.priceListId   ?? null,
      // Fase MM — moneda del response.
      currencyId:     currencyId ?? null,
      // Fase MM ext — cotización manual del documento.
      currencyRate:
        currencyId && Number.isFinite(draft.fxRate) && draft.fxRate > 0
          ? draft.fxRate
          : null,
      // Fase 5: descuento global como objeto.
      globalDiscount: draft.discountGlobal && draft.discountGlobal.value > 0
        ? { type: draft.discountGlobal.type, value: draft.discountGlobal.value }
        : null,
    },
  };

  // [BONIF_DEBUG] instrumentación temporal — remover tras diagnóstico.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.groupCollapsed(
      `[BONIF_DEBUG] buildSalePreviewPayload — clientId=${draft.clientId ?? "(SIN CLIENTE)"} · ${out.payload.lines.length} línea(s)`,
    );
    out.payload.lines.forEach((pl: any, i: number) => {
      const src = realLines[i];
      // eslint-disable-next-line no-console
      console.log(`[BONIF_DEBUG] línea[${i}]`, {
        lineId:                          src?.id,
        articleId:                       pl.articleId ?? "(MANUAL)",
        manualOverrides:                 src?.manualOverrides ?? null,
        manualDiscountOverride:          pl.manualDiscountOverride ?? null,
        manualDiscountOverride_appliesTo: pl.manualDiscountOverride?.appliesTo ?? null,
        manualDiscountAppliesToOverride: pl.manualDiscountAppliesToOverride ?? null,
        meta_manualDiscount:             src?.pricingMeta?.manualDiscount ?? null,
        meta_manualDiscountAppliesTo:    (src?.pricingMeta as any)?.manualDiscountAppliesTo ?? null,
      });
    });
    // eslint-disable-next-line no-console
    console.log("[BONIF_DEBUG] payload.lines (JSON):", JSON.stringify(out.payload.lines));
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  return out;
}
