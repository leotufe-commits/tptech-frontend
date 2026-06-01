// src/lib/sales/buildSaleCreatePayload.ts
// =============================================================================
// Construye el payload para `salesApi.create()` y `salesApi.update()` desde
// el draft del frontend. Función PURA — no calcula valores económicos: solo
// mapea el shape del draft al shape esperado por el endpoint.
//
// Etapa 3: pasa a ser el builder canónico para PERSISTIR el DRAFT entero
// (antes solo armaba un payload mínimo para `ensurePersistedSaleDraft`).
// Aplica el mismo principio que `buildSalePreviewPayload`: el frontend manda
// INTENCIÓN del operador (overrides, ajustes documento, líneas con sus
// overrides de composición) y el backend recalcula con `pricing-engine`.
//
// Reglas:
//   · Filtra placeholders y headers (mismo predicado que `isPreviewableLine`).
//   · NO envía subtotal/discountAmount/taxAmount/total — el backend los ignora
//     y los recalcula con `pricing-engine` (CLAUDE.md frontend §1).
//   · Persiste los 5 campos Etapa 1.1 (shipping, globalDiscount, paymentMethod
//     + installments) para garantizar paridad preview ↔ confirm.
//   · Anti doble aplicación: si `discountGlobal.origin === "CLIENT"`, NO
//     reenvía el globalDiscount — el motor ya lo aplica vía `clientId`.
//
// Limitaciones conocidas (sprint posterior):
//   · Overrides per-line de price / discount / tax todavía NO viajan a
//     create/update porque `CreateSaleLineInput` del backend no los acepta
//     hoy. Sí persisten los overrides de composición (grams, merma,
//     metalVariant, hechura, costLines) y los `manual*AppliesTo`.
// =============================================================================

import { isPreviewableLine } from "./matchPreviewLines";
import { buildManualAdjustmentPayload } from "./buildSalePreviewPayload";
import type { SalesInvoice } from "./types";
import type { CreateSalePayload, SaleLineInput } from "../../services/sales";

export interface BuildSaleCreatePayloadOpts {
  /** Forma de pago seleccionada (vive fuera del draft, en state separado
   *  de pagos del modal). Si no se pasa, no se persiste payment adjustment. */
  paymentMethodId?: string | null;
  /** Cuotas elegidas. Default 1 si hay paymentMethodId. */
  paymentInstallments?: number | null;
}

export interface BuildSaleCreatePayloadResult {
  /** false = el draft no tiene líneas reales; no llamar al backend. */
  hasRealLines: boolean;
  payload:      CreateSalePayload;
}

export function buildSaleCreatePayload(
  draft: SalesInvoice,
  opts: BuildSaleCreatePayloadOpts = {},
): BuildSaleCreatePayloadResult {
  // Mismo predicado que `buildSalePreviewPayload`: ARTICLE con articleId
  // o MANUAL con descripción no vacía. Headers / empty placeholders fuera.
  const realLines = draft.lines.filter(isPreviewableLine);

  const lines: SaleLineInput[] = realLines
    .map((l): SaleLineInput | null => {
      // MANUAL sin articleId no se persiste en v1 (limitación heredada).
      if (!l.articleId) return null;
      const meta = l.pricingMeta;
      const ov   = l.manualOverrides;

      // ── Etapa 4 — overrides comerciales per-line ────────────────────────
      // Mismo criterio que `buildSalePreviewPayload`: el override viaja al
      // backend solo si el toggle "Editar X" del operador está ON. La fuente
      // canónica del valor es `pricingMeta.X` (sobrevive al loop de preview;
      // ver comentario en `buildSalePreviewPayload`).
      const manualPriceOverride =
        ov?.price === true
          ? (meta?.manualPrice != null ? meta.manualPrice : (l.unitPrice ?? null))
          : null;

      const manualDiscountOverride =
        ov?.discount === true && meta?.manualDiscount
          ? {
              mode:      meta.manualDiscount.mode,
              value:     meta.manualDiscount.value,
              appliesTo: meta.manualDiscount.appliesTo,
              kind:      meta.manualDiscount.kind,
            }
          : null;

      const taxOverride =
        ov?.tax === true && meta?.taxOverride
          ? {
              mode:      meta.taxOverride.mode,
              value:     meta.taxOverride.value,
              appliesTo: meta.taxOverride.appliesTo,
            }
          : null;

      return {
        articleId: l.articleId,
        variantId: l.variantId ?? null,
        quantity:  Number(l.quantity) || 0,
        // unitPrice legacy: el backend lo recibe pero recalcula. Lo mandamos
        // como fallback para artículos sin lista/manual configurados.
        unitPrice: Number(l.unitPrice) || 0,
        // Overrides de composición — el motor los recibe vía
        // `resolveDraftSaleLinesPricing` y los persiste en `pricingSnapshot`
        // de la línea (paridad preview ↔ DRAFT ↔ confirm).
        gramsOverride:          meta?.gramsOverride          ?? null,
        mermaPercentOverride:   meta?.mermaPercentOverride   ?? null,
        metalVariantIdOverride: meta?.metalVariantIdOverride ?? null,
        hechuraOverrideAmount:  meta?.hechuraOverrideAmount  ?? null,
        costLineOverrides:      meta?.costLineOverrides      ?? undefined,
        // Etapa 4 — overrides comerciales del operador.
        manualPriceOverride,
        manualDiscountOverride,
        taxOverride,
        // Override de SOLO la base — independiente del valor.
        manualDiscountAppliesToOverride: meta?.manualDiscountAppliesTo ?? null,
        manualTaxAppliesToOverride:      meta?.manualTaxAppliesTo      ?? null,
        // Override de lista por línea — precedencia sobre la lista global.
        priceListIdOverride: l.priceListIdOverride ?? null,
      };
    })
    .filter((row): row is SaleLineInput => row != null);

  // ── Descuento global — anti doble aplicación ────────────────────────────
  // Si el descuento viene HEREDADO del cliente (`origin === "CLIENT"`), NO
  // se reenvía: el `pricing-engine` ya lo aplica por `clientId` al recibir
  // el create. Solo viaja cuando es manual del comprobante (MANUAL/NONE/
  // undefined) y tiene valor > 0.
  const dg = draft.discountGlobal;
  const globalDiscount: CreateSalePayload["globalDiscount"] =
    dg && dg.value > 0 && dg.origin !== "CLIENT"
      ? { type: dg.type, value: dg.value }
      : null;

  // ── Shipping — monto resuelto plano ─────────────────────────────────────
  // `DocumentShipping` del frontend mantiene el monto ya resuelto en
  // `cost` (igual contrato que `buildSalePreviewPayload`). El backend lo
  // persiste en `Sale.shippingAmount`. Si `cost == 0` o ausente, no se
  // persiste shipping.
  const shippingAmount =
    draft.shipping?.cost != null && draft.shipping.cost > 0
      ? draft.shipping.cost
      : null;

  // ── Payment method + installments ───────────────────────────────────────
  // El draft de SalesInvoice no tiene esos campos (viven en un state aparte
  // del modal). El caller los pasa como opts cuando hay forma de pago activa.
  const paymentMethodId =
    opts.paymentMethodId && opts.paymentMethodId.trim().length > 0
      ? opts.paymentMethodId
      : null;
  const paymentInstallments = paymentMethodId
    ? (opts.paymentInstallments != null && opts.paymentInstallments >= 1
        ? Math.trunc(opts.paymentInstallments)
        : 1)
    : null;

  // ── Ajuste manual (UNIFIED Etapa A + BREAKDOWN Etapa C) ────────────────
  // Reutilizamos el mismo builder que el preview para garantizar paridad
  // byte a byte entre preview ↔ create/update. POLICY §R-Rounding-1 capa 17.
  const manualAdjustment = buildManualAdjustmentPayload(draft.manualAdjustment);

  // ── Etapa 3A-fix — Defensa idéntica a buildSalePreviewPayload ──────────
  // Mantenemos paridad PREVIEW ↔ CREATE: si el ajuste manual quedó con scope
  // BREAKDOWN, el override del payload se fuerza a BREAKDOWN. Sin esto, al
  // guardar el draft el backend persiste `balanceModeOverride=UNIFIED` y al
  // reabrir + correr preview vuelve el 400.
  const balanceModeOverrideForPayload: "UNIFIED" | "BREAKDOWN" | null =
    manualAdjustment?.scope === "BREAKDOWN"
      ? "BREAKDOWN"
      : draft.balanceModeOverride ?? null;

  return {
    hasRealLines: lines.length > 0,
    payload: {
      clientId:    draft.clientId   ?? null,
      sellerId:    nullIfEmpty(draft.seller),
      warehouseId: nullIfEmpty(draft.warehouse),
      channelId:   draft.channelId  ?? null,
      couponCode:  draft.couponCode ?? null,
      notes:       draft.notes ?? "",
      // ── Etapa C16 — paridad preview ↔ persist (fix drift C15) ───────
      // Lista del documento. Mismo contrato que `buildSalePreviewPayload`
      // (línea 177). Sin esto, al guardar el DRAFT el backend cae a la
      // jerarquía cliente → favorita y pierde la lista global que el
      // operador eligió en el combo.
      priceListId: draft.priceListId ?? null,
      lines,
      // Balance mode override — con defensa scope=BREAKDOWN aplicada arriba.
      balanceModeOverride: balanceModeOverrideForPayload,
      // ── Etapa 1.1 — ajustes a nivel documento ───────────────────────────
      shippingAmount,
      globalDiscount,
      paymentMethodId,
      paymentInstallments,
      // ── Etapa A — Ajuste manual UNIFIED ─────────────────────────────────
      manualAdjustment,
    },
  };
}

function nullIfEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}
