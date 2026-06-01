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

  // ── Etapa 3A-fix — Defensa contra race scope/mode ─────────────────────────
  // POLICY §R-Rounding-1 capa 17 + sales.service:5122-5129:
  //   El motor RECHAZA con 400 cualquier preview/confirm con
  //   `manualAdjustment.scope === "BREAKDOWN"` y `balanceMode` resuelto
  //   distinto de BREAKDOWN.
  //
  // Bug observado: el operador ve "Desglosado" en el card (porque la UI
  // muestra el modo EFECTIVO `hasMetals ? "BREAKDOWN" : ...`), pero
  // `draft.balanceModeOverride` puede estar en `null` (auto-resolución por
  // tenant UNIFIED) o en `"UNIFIED"` (override previo del operador). El
  // promote del estado puede no haber actualizado todavía cuando llega el
  // próximo preview. Resultado: payload `{override: UNIFIED, scope:
  // BREAKDOWN}` → 400.
  //
  // Fix: si el `manualAdjustment` ya armado tiene scope BREAKDOWN, el
  // override del PAYLOAD se fuerza a "BREAKDOWN" sin importar lo que diga el
  // draft. Defensa final, independiente del estado de la UI.
  const manualAdjustmentPayload = buildManualAdjustmentPayload(draft.manualAdjustment);
  const manualAdjustmentScopeForPayload = manualAdjustmentPayload?.scope ?? null;
  const balanceModeOverrideForPayload: "UNIFIED" | "BREAKDOWN" | null =
    manualAdjustmentScopeForPayload === "BREAKDOWN"
      ? "BREAKDOWN"
      : draft.balanceModeOverride === "UNIFIED" || draft.balanceModeOverride === "BREAKDOWN"
        ? draft.balanceModeOverride
        : null;

  const out = {
    hasRealLines: realLines.length > 0,
    payload: {
      lines: realLines.map((l) => {
        const ov   = l.manualOverrides;
        const meta = l.pricingMeta;

        type Mode = "PERCENT" | "AMOUNT";
        type AppliesTo = "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA" | "SUBTOTAL_AFTER_DISCOUNT" | "SUBTOTAL_BEFORE_DISCOUNT" | "PRODUCT" | "SERVICE";
        type AdjKind = "BONUS" | "SURCHARGE";
        // El override de descuento opcionalmente lleva `kind` (BONUS/SURCHARGE);
        // el override de impuesto no (no aplica el concepto recargo allí).
        type LineOverride = { mode: Mode; value: number; appliesTo?: AppliesTo; kind?: AdjKind } | null;

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

        // Override de ajuste manual (bonif/recargo): si flag → reconstruimos
        // {mode,value,appliesTo,kind} desde la última config en
        // pricingMeta.manualDiscount. `kind` viaja al backend tal cual lo
        // setea el editor; ausente = BONUS (el motor aplica back-compat).
        //
        // Defensa en profundidad: si el flag `ov.discount` quedó pegado sin
        // `meta.manualDiscount` (estado inconsistente — no debería ocurrir si
        // todos los paths usan `applyLineOverrides`, que sincroniza ambos),
        // NO derivar un override desde `l.discountAmount`: ese valor puede
        // venir de un descuento HEREDADO del cliente (origin=CLIENT), y
        // promoverlo a override manual lo reenvía al motor → doble
        // aplicación / "override fantasma". En ese caso ignoramos el flag y
        // devolvemos `null` para que el motor recalcule el automático.
        let manualDiscountOverride: LineOverride = null;
        if (ov?.discount === true && meta?.manualDiscount) {
          manualDiscountOverride = {
            mode:      meta.manualDiscount.mode,
            value:     meta.manualDiscount.value,
            appliesTo: meta.manualDiscount.appliesTo,
            kind:      meta.manualDiscount.kind,
          };
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
      // CONTRATO shipping (rectificado 2026-05-28):
      //   `draft.shipping.cost` esta SIEMPRE en moneda DOC (la del
      //   comprobante). El operador edita y ve este valor directamente
      //   en el TPNumberInput de la ShippingCard, sin conversiones.
      //   La conversion BASE→DOC ocurre UNA SOLA VEZ al derivar del
      //   carrier (`derivedCost = baseCost / fxRate` en ShippingCard).
      //
      //   Aca enviamos `cost` tal cual: el backend espera el valor
      //   en moneda DOC y aplica `toB = n * rate` internamente para
      //   volver a BASE en el snapshot.
      //
      //   Bug histórico cerrado: el contrato anterior decía "cost en
      //   BASE" y dividía por fxRate aca. Cualquier desincronizacion
      //   entre cost almacenado y fxRate vigente producia valores
      //   absurdos (12000 × 1798 = 21.6M observado). El nuevo contrato
      //   elimina las multiplicaciones estructuralmente.
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
      // Fase A — anti doble aplicación: si el descuento fue HEREDADO del
      // cliente (`origin==="CLIENT"`), NO se reenvía: el `pricing-engine` ya
      // lo aplica por `clientId`. Solo viaja cuando es manual del comprobante
      // (origin MANUAL/NONE/undefined) y tiene valor.
      globalDiscount:
        draft.discountGlobal &&
        draft.discountGlobal.value > 0 &&
        draft.discountGlobal.origin !== "CLIENT"
          ? { type: draft.discountGlobal.type, value: draft.discountGlobal.value }
          : null,
      // Fase 4.2 — Balance Mode override del documento. Solo viaja cuando
      // el operador lo seteó manualmente (UNIFIED/BREAKDOWN). Si es null,
      // omitido del payload (`undefined` por destructuring del backend) y
      // el backend resuelve por jerarquía R11.4.
      //
      // Etapa 3A-fix: la resolución incluye la defensa "scope BREAKDOWN
      // fuerza override BREAKDOWN" — ver `balanceModeOverrideForPayload`
      // calculado arriba.
      balanceModeOverride: balanceModeOverrideForPayload,
      // Ajuste manual (POLICY §R-Rounding-1 capa 17).
      //   · UNIFIED (Etapa A) — un único monto humano sobre `engineTotal`.
      //   · BREAKDOWN (Etapa C) — metals[] (gramos) + monetaryAmount.
      // El frontend NO calcula: solo envía la INTENCIÓN. El backend valida
      // y arma el snapshot. Si nada significativo → null.
      manualAdjustment: manualAdjustmentPayload,
    },
  };

  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Manual Adjustment — builder de payload (UNIFIED + BREAKDOWN).
// ────────────────────────────────────────────────────────────────────────────
const MA_EPS_MONEY = 0.005;
const MA_EPS_GRAMS = 0.0001;

function trimOrNull(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/** Construye el payload del ajuste manual a partir del draft.
 *  Devuelve `null` cuando no hay intención significativa. */
export function buildManualAdjustmentPayload(
  draft: SalesInvoice["manualAdjustment"],
): import("../../services/sales").ManualAdjustmentApiInput | null {
  if (!draft) return null;

  // BREAKDOWN
  if ((draft as any).scope === "BREAKDOWN") {
    const b = draft as Extract<NonNullable<SalesInvoice["manualAdjustment"]>, { scope: "BREAKDOWN" }>;
    const metals = Array.isArray(b.metals) ? b.metals : [];
    const cleanedMetals = metals
      .map((m) => {
        const hasTarget =
          typeof m.targetGrams === "number" && Number.isFinite(m.targetGrams);
        const hasDelta =
          typeof m.deltaGrams === "number" &&
          Number.isFinite(m.deltaGrams) &&
          Math.abs(m.deltaGrams as number) > MA_EPS_GRAMS;
        if (!hasTarget && !hasDelta) return null;
        return {
          metalParentId:   m.metalParentId ?? null,
          ...(m.metalParentName ? { metalParentName: m.metalParentName } : {}),
          ...(hasTarget ? { targetGrams: m.targetGrams as number } : {}),
          ...(hasDelta  ? { deltaGrams:  m.deltaGrams  as number } : {}),
          reason: trimOrNull(m.reason ?? null),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const monetary =
      typeof b.monetaryAmount === "number" &&
      Number.isFinite(b.monetaryAmount) &&
      Math.abs(b.monetaryAmount) > MA_EPS_MONEY
        ? b.monetaryAmount
        : undefined;

    if (cleanedMetals.length === 0 && monetary === undefined) return null;

    return {
      scope:  "BREAKDOWN",
      metals: cleanedMetals,
      ...(monetary !== undefined ? { monetaryAmount: monetary } : {}),
      reason: trimOrNull(b.reason ?? null),
    };
  }

  // UNIFIED (scope explícito o omitido).
  const u = draft as Extract<NonNullable<SalesInvoice["manualAdjustment"]>, { amount: number }>;
  if (
    typeof u.amount !== "number" ||
    !Number.isFinite(u.amount) ||
    Math.abs(u.amount) <= MA_EPS_MONEY
  ) {
    return null;
  }
  return {
    scope:  "UNIFIED",
    amount: u.amount,
    reason: trimOrNull(u.reason ?? null),
  };
}
