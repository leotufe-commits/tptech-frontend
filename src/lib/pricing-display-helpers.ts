// src/lib/pricing-display-helpers.ts
// ============================================================================
// pricing-display-helpers — mapeo VISUAL del resultado del pricing-engine.
//
// Toma `SalePreviewResult` + el `draft` ya hidratado y devuelve una estructura
// plana, lista para que la UI muestre la "composición del total" sin volver
// a calcular nada. Solo agrega:
//   · suma de descuentos por cantidad / promo a partir de las líneas (per-unit
//     × qty), porque `documentTotals` los entrega plegados en `lineDiscount`.
//   · agregación de `taxBreakdown` por (name, rate) para listar IVA / Percep
//     en el card. Los montos vienen tal cual del backend.
//
// El frontend NO hace cálculos comerciales: si un campo no está disponible
// (preview ausente o el backend no lo expuso), el helper devuelve `null` y
// la UI lo dibuja como "No aplicado" en estado tenue.
// ============================================================================

import type {
  SalePreviewResult,
  SalePreviewLine,
} from "../services/sales";
import { round2 as legacyRound2 } from "./document-helpers";
import { isPricingStrictV1Enabled } from "./featureFlags";

// =============================================================================
// FASE 1.2 paso 1 — round2 condicional por feature flag.
//
// Política:
//   · Flag OFF (default): comportamiento legacy idéntico — `round2` redondea
//     a 2 decimales con Math.round(n*100)/100 (compat 100%, rollback inmediato).
//   · Flag ON:            passthrough puro — el motor backend ya emite los
//     montos redondeados. Las agregaciones per-línea (qty × qtyDiscUnit, Σ
//     taxBreakdown items) pueden tener drift de float micro, pero `fmtMoney`
//     redondea a 2 decimales en display → cero regresión visual.
//
// Justificación POLICY:
//   · POLICY.md §1 R1.4 — frontend no calcula plata; el backend es fuente.
//   · POLICY.md §4 R4.5 — los normalizadores transforman shape, no valores.
//
// Frontend desbloqueado:
//   · Priority 6 — composeDocumentPricingDetail elimina round2 sobre campos
//     del backend (subtotalBeforeDiscounts, couponDiscountAmount, taxableBase,
//     total, etc.) que ya vienen redondeados.
//
// GAP CONOCIDO (no bloqueante para este paso):
//   G8 — el backend debería emitir per-doc:
//        - quantityDiscountTotal
//        - promotionDiscountTotal
//        - customerDiscountTotal
//        - manualDiscountAmount
//   Cuando G8 se cierre (Fase 1.3), las 7 agregaciones locales que hoy hacen
//   `round2(qtyDiscTotal)` / etc. (líneas 229, 230, 311-313, 366, 433) se
//   reemplazan por passthrough directo de campos del backend. Mientras tanto,
//   con flag ON, fmtMoney absorbe el drift en display.
// =============================================================================
function round2(n: number): number {
  return isPricingStrictV1Enabled() ? n : legacyRound2(n);
}

/** Concepto individual del desglose. Si `amount === null` la UI lo trata como
 *  "no aplicado" y lo muestra tenue. */
export type PricingComposition = {
  /** Subtotal bruto (precio de lista × cantidad, antes de cualquier ajuste). */
  subtotalGross: number | null;
  /** Nombre consolidado de la lista a mostrar:
   *   · null      → ninguna línea reportó lista efectivamente aplicada.
   *   · "<nombre>" → todas las líneas usaron esa misma lista.
   *   · "Mixta"   → al menos dos líneas usaron listas distintas.
   *  Para mostrar las listas distintas en un tooltip, usar
   *  `priceListNamesUnique`. */
  priceListName: string | null;
  /** Lista de nombres únicos de listas aplicadas en el documento. Vacía
   *  cuando ninguna línea reportó lista. La UI la usa para armar tooltip
   *  cuando `priceListName === "Mixta"`. */
  priceListNamesUnique: string[];

  /** Descuento aplicado por la lista o por configuración del cliente.
   *  Se calcula como `lineDiscount − promo − qtyDiscount`. */
  customerDiscount: number | null;
  /**
   * Sobre qué componente del precio aplica el descuento del cliente. Lo
   * informa el motor (`componentSaleBreakdown.{metal,hechura}.adjustments[]`
   * con `kind=ENTITY_RULE`); si la rule del cliente es `applyOn=TOTAL`, el
   * motor no emite adjustments por componente y el helper devuelve
   * "TOTAL" como fallback. `null` cuando no hay descuento.
   *
   * Si las líneas reportan adjustments con applyOn distintos (ej. una
   * con METAL, otra con HECHURA), el helper devuelve "MIXED" para que
   * la UI muestre un subtítulo genérico.
   */
  customerDiscountApplyOn: "METAL" | "HECHURA" | "TOTAL" | "MIXED" | null;
  /** % de la rule del cliente, si la rule es PERCENTAGE. `null` si es
   *  FIXED_AMOUNT o no hay rule activa. */
  customerDiscountPercent: number | null;

  /** Recargo / descuento del canal de venta. Signo positivo = recargo. */
  channelAdjustment: number | null;
  channelName: string | null;

  /** Total de descuento por cantidad (Σ qty × quantityDiscountAmountPerUnit). */
  quantityDiscount: number | null;

  /**
   * Total de bonificación manual aplicada por línea (Σ por las líneas con
   * `manualDiscountOverride` activo). El motor en esas líneas reemplaza
   * promoción y descuento por cantidad — acá lo exponemos en una fila propia
   * para que el Hero no etiquete los importes como "Desc. por cantidad". */
  manualDiscount: number | null;

  /** Total descontado por promociones activas. */
  promotion: number | null;
  promotionName: string | null;

  /** Descuento del cupón aplicado (a nivel documento). */
  coupon: number | null;
  couponName: string | null;
  couponCode: string | null;

  /** Descuento global manual del documento. */
  globalDiscount: number | null;

  /** Subtotal neto antes de impuestos (`taxableBase`). */
  subtotalNet: number | null;

  /** Costo de envío (no es impuesto pero suma al total). */
  shipping: number | null;

  /**
   * Recargo / descuento por forma de pago a nivel documento.
   * `> 0` = recargo. `< 0` = descuento. `null` cuando el motor no expone el
   * dato o el valor es 0.
   */
  paymentAdjustment: number | null;

  /** Desglose por impuesto agregado: `{ name, rate, amount }`. */
  taxes: Array<{ name: string; rate: number | null; amount: number }>;
  /** Suma simple de todos los `taxes[i].amount` — alias para mostrar "Impuestos". */
  taxTotal: number;

  /**
   * Ajuste de redondeo aplicado al documento. Signo:
   *   · positivo → redondeo hacia arriba (suma).
   *   · negativo → redondeo hacia abajo (resta).
   * Origen indicado en `roundingInfo.source`.
   */
  rounding: number;
  /**
   * Metadata del redondeo. Dos fuentes posibles según `source`:
   *   · `PRICE_LIST`     → la lista de precios redondeó (display delta; el
   *     motor ya lo absorbió en cada línea, el `total` no cambia).
   *   · `TENANT_POLICY`  → la joyería tiene política de redondeo a nivel
   *     comprobante (modo UNIFIED) y el `total` ya viene redondeado.
   * Si no hubo redondeo, este campo es `null`.
   */
  roundingInfo: {
    /** "PRICE_LIST" o "TENANT_POLICY". Default histórico: "PRICE_LIST". */
    source:        "PRICE_LIST" | "TENANT_POLICY";
    priceListName: string | null;
    applyOn:       string;
    mode:          string;
    direction:     string;
  } | null;

  /** Total final (con impuestos y redondeo). */
  total: number;

  /** True si los datos vienen del backend; false si es fallback local. */
  fromBackend: boolean;
};

/** Acepta líneas con la forma del preview del backend O la del DocumentLine
 *  hidratado (que copia los campos relevantes en `pricingMeta`). */
type LineLike =
  | SalePreviewLine
  | {
      quantity: number;
      pricingMeta?: {
        appliedPriceListName?: string | null;
        appliedPromotionName?: string | null;
        quantityDiscountAmount?: number | null;
        promotionDiscountAmount?: number | null;
        basePrice?: number | null;
        taxBreakdown?: Array<{ name?: string | null; rate?: number | null; taxAmount?: number | null }>;
      };
    };

function readLineMeta(l: LineLike): {
  qty:           number;
  basePrice:     number | null;
  qtyDiscUnit:   number;
  promoDiscUnit: number;
  priceListName: string | null;
  promotionName: string | null;
  taxBreakdown:  Array<{ name: string; rate: number | null; taxAmount: number }>;
  /**
   * `true` cuando esta línea tiene una bonificación manual activa. El motor
   * (`pricing-engine.sale.ts`, paso "OVERRIDE MANUAL DE DESCUENTO") sobrescribe
   * `qtyDiscountAmount = manualDiscountValue` y deja `promoDiscountAmount = null`
   * — el frontend NO puede distinguir el manual del qty/promo automático sin
   * este flag, y sumarlo al "Desc. por cantidad" del Hero sería engañoso.
   *
   * Detección:
   *   - DocumentLine: `manualOverrides.discount === true` o
   *     `pricingMeta.manualDiscount != null`.
   *   - SalePreviewLine (caso sin draft): `priceSource === "MANUAL_OVERRIDE"`
   *     con `qtyDiscUnit > 0`. Heurística: cuando el motor aplica manualPrice,
   *     basePrice == unitPrice y qtyDiscUnit queda en 0; cuando aplica
   *     manualDiscount, qtyDiscUnit > 0. Ambigua si el operador combina
   *     ambos overrides — caso raro y sin impacto numérico (qtyDiscUnit no
   *     se duplica de todos modos).
   */
  hasManualDiscount: boolean;
} {
  // SalePreviewLine: campos al nivel raíz
  if ("basePrice" in l && (l as SalePreviewLine).basePrice !== undefined) {
    const pl = l as SalePreviewLine;
    const qtyDU   = pl.quantityDiscountAmount ?? 0;
    const promoDU = pl.promotionDiscountAmount ?? 0;
    return {
      qty:           Number.isFinite(pl.quantity) ? pl.quantity : 0,
      basePrice:     pl.basePrice ?? null,
      qtyDiscUnit:   qtyDU,
      promoDiscUnit: promoDU,
      priceListName: pl.appliedPriceListName ?? null,
      promotionName: pl.appliedPromotionName ?? null,
      taxBreakdown:  (pl.taxBreakdown ?? []).map((tb: any) => ({
        name:      tb?.name ?? "",
        rate:      tb?.rate ?? null,
        taxAmount: Number(tb?.taxAmount ?? 0),
      })),
      hasManualDiscount: pl.priceSource === "MANUAL_OVERRIDE" && qtyDU > 0,
    };
  }
  // DocumentLine: campos en pricingMeta
  const meta = (l as any).pricingMeta ?? {};
  const overrides = (l as any).manualOverrides ?? {};
  return {
    qty:           Number.isFinite((l as any).quantity) ? (l as any).quantity : 0,
    basePrice:     meta.basePrice ?? null,
    qtyDiscUnit:   meta.quantityDiscountAmount ?? 0,
    promoDiscUnit: meta.promotionDiscountAmount ?? 0,
    priceListName: meta.appliedPriceListName ?? null,
    promotionName: meta.appliedPromotionName ?? null,
    taxBreakdown:  (meta.taxBreakdown ?? []).map((tb: any) => ({
      name:      tb?.name ?? "",
      rate:      tb?.rate ?? null,
      taxAmount: Number(tb?.taxAmount ?? 0),
    })),
    hasManualDiscount: overrides.discount === true || meta.manualDiscount != null,
  };
}

/** Suma `taxBreakdown` de varias líneas en un único array agrupado por
 *  (name + rate). Útil para listar "IVA 21% — ARS 18.500" en el card. */
function aggregateTaxBreakdown(
  lines: LineLike[],
): Array<{ name: string; rate: number | null; amount: number }> {
  const map = new Map<string, { name: string; rate: number | null; amount: number }>();
  for (const l of lines) {
    const { taxBreakdown } = readLineMeta(l);
    for (const tb of taxBreakdown) {
      if (!tb || (!tb.name && tb.rate == null)) continue;
      const key = `${tb.name}|${tb.rate ?? ""}`;
      const prev = map.get(key);
      if (prev) prev.amount = round2(prev.amount + (tb.taxAmount ?? 0));
      else map.set(key, { name: tb.name || "Impuesto", rate: tb.rate ?? null, amount: round2(tb.taxAmount ?? 0) });
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}

/** Toma el preview del backend (cuando hay) o devuelve un detail vacío con
 *  los valores que ya estén en el draft. La UI distingue "no aplicado" por
 *  `null`; los campos numéricos solo se llenan cuando el motor los expuso. */
export function composeDocumentPricingDetail(args: {
  preview: SalePreviewResult | null;
  /** Líneas hidratadas del draft. Se usan SOLO cuando hay preview activo
   *  (para agregar tax breakdown y descuentos por línea). */
  lines: LineLike[];
  /** Total final que la UI ya muestra. Si preview falló, este valor sigue
   *  siendo válido (viene del último preview o del fallback local). */
  fallbackTotal: number;
  /** Costo de envío del draft — el motor ya lo absorbe en `shippingAmount`,
   *  pero pasamos el draft.shipping.cost para que la UI lo refleje incluso
   *  cuando el preview todavía no respondió. */
  fallbackShipping?: number;
}): PricingComposition {
  const { preview, lines, fallbackTotal, fallbackShipping = 0 } = args;

  if (!preview) {
    return {
      subtotalGross:    null,
      priceListName:    null,
      priceListNamesUnique: [],
      customerDiscount: null,
      customerDiscountApplyOn: null,
      customerDiscountPercent: null,
      manualDiscount:    null,
      channelAdjustment:null,
      channelName:      null,
      quantityDiscount: null,
      promotion:        null,
      promotionName:    null,
      coupon:           null,
      couponName:       null,
      couponCode:       null,
      globalDiscount:   null,
      subtotalNet:      null,
      shipping:         fallbackShipping > 0 ? fallbackShipping : null,
      paymentAdjustment: null,
      taxes:            [],
      taxTotal:         0,
      rounding:         0,
      roundingInfo:     null,
      total:            fallbackTotal,
      fromBackend:      false,
    };
  }

  const dt = preview.documentTotals;

  // Sumas por línea (los campos están al unitario en el motor).
  // Si la línea tiene `hasManualDiscount`, el `qtyDiscUnit` reportado por el
  // motor es en realidad el monto del manual override (ver readLineMeta).
  // Lo movemos a `manualDiscTotal` para que las filas "Desc. por cantidad" y
  // "Promoción" del Hero NO incluyan importes manuales.
  let qtyDiscTotal     = 0;
  let promoDiscTotal   = 0;
  let manualDiscTotal  = 0;
  let firstPromotion: string | null = null;
  // Listas únicas efectivamente aplicadas por línea. Si todas las líneas
  // usaron la misma → mostramos ese nombre. Si difieren → "Mixta".
  // (Ignoramos null/empty: líneas sin lista no rompen el "homogéneo".)
  const priceListNamesUsed = new Set<string>();
  for (const l of lines) {
    const m = readLineMeta(l);
    if (m.hasManualDiscount) {
      manualDiscTotal += m.qty * (m.qtyDiscUnit ?? 0);
      // promoDiscUnit ya viene null/0 cuando hay manual; no acumulamos.
    } else {
      qtyDiscTotal   += m.qty * (m.qtyDiscUnit   ?? 0);
      promoDiscTotal += m.qty * (m.promoDiscUnit ?? 0);
    }
    if (m.priceListName) priceListNamesUsed.add(m.priceListName);
    if (!firstPromotion && m.promotionName) firstPromotion = m.promotionName;
  }
  qtyDiscTotal    = round2(qtyDiscTotal);
  promoDiscTotal  = round2(promoDiscTotal);
  manualDiscTotal = round2(manualDiscTotal);

  // Resolver el nombre a mostrar:
  //   0 listas      → null (línea muestra subtotal sin "Lista: …")
  //   1 lista única → ese nombre
  //   ≥2 listas     → "Mixta"
  // El array `priceListNamesUnique` se expone para que la UI pueda armar
  // un tooltip listando las listas distintas.
  const priceListNamesUnique = Array.from(priceListNamesUsed);
  const firstPriceList: string | null =
    priceListNamesUnique.length === 0 ? null
    : priceListNamesUnique.length === 1 ? priceListNamesUnique[0]
    : "Mixta";

  // ── Descuento del cliente (entity rule) ──────────────────────────────────
  // El motor expone el monto exacto como `componentSaleBreakdown.metal.
  // adjustments[]` y `.hechura.adjustments[]` con `kind === "ENTITY_RULE"` y
  // `source === "CLIENT"` cuando la rule aplica a METAL/HECHURA. Lo leemos
  // directo del response (per-unit, escalado por qty).
  //
  // Cuando la rule aplica a TOTAL, el motor NO emite adjustments por
  // componente, sino que absorbe el descuento en `unitPrice`. En ese caso
  // caemos a la derivación: `lineDiscountAmount − qty − promo`.
  //
  // Si `clientCommercialRules.ruleType` viene en {DISCOUNT, BONUS}, sabemos
  // que el motor SÍ aplicó algo — entonces el monto se expone aunque el
  // cálculo dé 0,00 (caso edge: redondeo ó valor configurado en cero).
  let customerDiscountFromAdjustments = 0;
  let hasCustomerAdjustment = false;
  // Metadata adicional: applyOn y % observados en los adjustments. Si las
  // líneas reportan applyOn distintos (raro pero posible si una rule por
  // categoría conviviera), guardamos "MIXED".
  const observedApplyOns = new Set<"METAL" | "HECHURA">();
  let observedPercent: number | null = null;
  for (const pl of preview.lines ?? []) {
    const csb = (pl as any).componentSaleBreakdown;
    if (!csb) continue;
    const qty = Number.isFinite(pl.quantity) ? pl.quantity : 0;
    for (const side of ["metal", "hechura"] as const) {
      const adjs = csb[side]?.adjustments;
      if (!Array.isArray(adjs)) continue;
      for (const adj of adjs) {
        if (adj?.kind === "ENTITY_RULE" && adj?.source === "CLIENT") {
          customerDiscountFromAdjustments += Number(adj.amount ?? 0) * qty;
          hasCustomerAdjustment = true;
          observedApplyOns.add(side === "metal" ? "METAL" : "HECHURA");
          if (observedPercent == null && typeof adj.percentage === "number") {
            observedPercent = adj.percentage;
          }
        }
      }
    }
  }
  customerDiscountFromAdjustments = round2(customerDiscountFromAdjustments);

  // Sprint 2 / POLICY.md §4 R4.3 — el frontend NO deriva customerDiscount
  // localmente. Antes acá había un fallback:
  //    customerDiscountDerived = lineDiscountAmount − qty − promo − manual
  // Eso era recálculo, no display: violaba la regla "lector puro".
  //
  // Ahora:
  //   · Si el backend emite adjustments por componente (rule applyOn=METAL
  //     /HECHURA), `customerDiscountFromAdjustments` los suma (agregación
  //     honesta de campos del backend).
  //   · Si la rule aplica a TOTAL, el motor hoy absorbe el descuento en
  //     `unitPrice` y NO emite el monto separado. En ese caso devolvemos
  //     `null` y la UI muestra "—" (POLICY.md R4.4) hasta que la capa 5
  //     del motor exponga `customerDiscountAmount` per-línea (Sprint 1
  //     ya agregó el campo nullable al snapshot).
  const customerDiscount = hasCustomerAdjustment
    ? customerDiscountFromAdjustments
    : null;

  // ¿El motor reporta una rule activa de descuento/bonificación? Si sí,
  // exponemos el monto siempre (incluso si dio 0) — ocultarlo como "No
  // aplicado" sería mentirle al operador, que YA seleccionó un cliente con
  // rule. SURCHARGE no entra acá: para "Descuento" mostramos solo descuentos.
  const rules = (preview as any).clientCommercialRules ?? null;
  const ruleType = rules?.ruleType ?? null;
  const clientHasActiveDiscountRule = ruleType === "DISCOUNT" || ruleType === "BONUS";

  // Resolver "Aplica sobre": si los adjustments lo dicen, pasthrough; si no,
  // caemos al `applyOn` que el cliente tiene configurado en su rule (que
  // típicamente es TOTAL cuando el motor no emite adjustments por componente).
  let customerDiscountApplyOn: PricingComposition["customerDiscountApplyOn"] = null;
  if (clientHasActiveDiscountRule || hasCustomerAdjustment) {
    if (observedApplyOns.size === 1) {
      customerDiscountApplyOn = observedApplyOns.has("METAL") ? "METAL" : "HECHURA";
    } else if (observedApplyOns.size > 1) {
      customerDiscountApplyOn = "MIXED";
    } else {
      // Sin adjustments por componente → la rule aplica a TOTAL (o el motor
      // no expuso desglose). Tomamos applyOn de la rule del cliente con
      // fallback a "TOTAL".
      const ruleApplyOn = rules?.applyOn;
      customerDiscountApplyOn =
        ruleApplyOn === "METAL" || ruleApplyOn === "HECHURA"
          ? ruleApplyOn
          : "TOTAL";
    }
  }

  // % de la rule (si es PERCENTAGE). Preferimos el % observado en el
  // adjustment (más fiel a lo aplicado) y caemos al `value` configurado.
  const customerDiscountPercent =
    observedPercent != null
      ? observedPercent
      : (rules?.valueType === "PERCENTAGE" && typeof rules?.value === "number")
        ? rules.value
        : null;

  // Canal: signo positivo si suma, negativo si resta.
  const channelAmount =
    typeof dt.channelAdjustmentAmount === "number" ? dt.channelAdjustmentAmount : 0;
  const channelName   = preview.channelResult?.channelName ?? null;

  const couponName = preview.couponResult?.couponName ?? null;
  const couponCode = preview.couponResult?.couponCode ?? null;

  const taxes    = aggregateTaxBreakdown(lines);
  const taxTotal = round2(taxes.reduce((s, t) => s + t.amount, 0));

  return {
    subtotalGross:    round2(dt.subtotalBeforeDiscounts ?? 0),
    priceListName:    firstPriceList,
    priceListNamesUnique,
    // Sprint 2 — `customerDiscount` puede ser null (POLICY.md R4.4) cuando
    // el motor no emite adjustments por componente y no derivamos. Cuando
    // hay rule activa o el monto agregado es ≥ 0,01, lo exponemos; si no,
    // queda null y la UI muestra "—".
    customerDiscount:
      customerDiscount != null && (clientHasActiveDiscountRule || customerDiscount >= 0.01)
        ? customerDiscount
        : null,
    customerDiscountApplyOn,
    customerDiscountPercent,
    channelAdjustment: Math.abs(channelAmount) >= 0.01 ? channelAmount : null,
    channelName,
    quantityDiscount: qtyDiscTotal   > 0 ? qtyDiscTotal   : null,
    promotion:        promoDiscTotal > 0 ? promoDiscTotal : null,
    promotionName:    firstPromotion,
    manualDiscount:   manualDiscTotal > 0 ? manualDiscTotal : null,
    coupon:           (dt.couponDiscountAmount ?? 0) > 0 ? round2(dt.couponDiscountAmount) : null,
    couponName,
    couponCode,
    globalDiscount:   (dt.globalDiscountAmount ?? 0) > 0 ? round2(dt.globalDiscountAmount) : null,
    subtotalNet:      round2(dt.taxableBase ?? 0),
    shipping:         (dt.shippingAmount ?? 0) > 0
      ? round2(dt.shippingAmount)
      : (fallbackShipping > 0 ? fallbackShipping : null),
    paymentAdjustment: Math.abs(dt.paymentAdjustmentAmount ?? 0) >= 0.01
      ? round2(dt.paymentAdjustmentAmount)
      : null,
    taxes,
    taxTotal,
    rounding:         dt.roundingAdjustment ?? 0,
    roundingInfo:     dt.roundingInfo
      ? {
          // Backend devuelve "PRICE_LIST" | "TENANT_POLICY". Default histórico
          // por seguridad si llega un valor inesperado: PRICE_LIST.
          source:        ((dt.roundingInfo as any).source === "TENANT_POLICY"
            ? "TENANT_POLICY"
            : "PRICE_LIST") as "PRICE_LIST" | "TENANT_POLICY",
          priceListName: dt.roundingInfo.priceListName,
          applyOn:       dt.roundingInfo.applyOn,
          mode:          dt.roundingInfo.mode,
          direction:     dt.roundingInfo.direction,
        }
      : null,
    total:            round2(dt.total ?? fallbackTotal),
    fromBackend:      true,
  };
}
