// src/lib/pricing/display/saleDiscountSourcesDisplay.ts
// ============================================================================
// Helper display-only que agrupa los ajustes (descuentos y recargos) del
// documento por ORIGEN COMERCIAL, para que la UI de Factura explique al
// operador "qué viene de dónde" sin inducir interpretaciones erróneas.
//
// REGLAS (POLICY R6 / R4.5) — refuerzo tras feedback del usuario:
//
//  1. NO se calculan porcentajes en frontend. Los descuentos pueden aplicar
//     sobre distintas bases (METAL / HECHURA / TOTAL), ser secuenciales,
//     acumulativos o no lineales. Un % "por línea" NO equivale al % sobre
//     el subtotal del documento.
//  2. El label primario de cada fila muestra SOLO el origen ("Promo: Verano",
//     "Descuento por cantidad", "Cliente"). No se concatena % al label.
//  3. El % aparece SOLO si el motor lo expone explícito Y con base
//     inequívoca, y vive en la `subline` con contexto:
//       · CUSTOMER_RULE → "rule del cliente: 3% sobre Metal".
//       · COUPON         → "rule del cupón: 10% del subtotal" (cuando el
//                          motor configuró el cupón como porcentual).
//     Para PROMOTION / QUANTITY_DISCOUNT / MANUAL / CHANNEL / GLOBAL no se
//     muestra %, solo origen + monto.
//  4. Los totales del grupo (`bonificationTotal`, `surchargeTotal`) son
//     Σ |amount_i| — agregación trivial de montos que el motor ya calculó,
//     NO un cálculo nuevo.
//
// AGRUPACIÓN DE NIVEL SUPERIOR:
//
//   · `automatic` — ajustes que el motor aplica sin intervención del
//     operador: PROMOTION, QUANTITY_DISCOUNT, CUSTOMER_RULE, COUPON, CHANNEL.
//   · `manual`    — ajustes editables por el operador: MANUAL (bonificación
//     manual por línea, override del motor) y GLOBAL_DISCOUNT (descuento
//     manual a nivel documento).
//
// Dentro de cada grupo se separa Bonificaciones (signo negativo: descuentos)
// de Recargos (signo positivo) — el canal puede caer en cualquiera de los
// dos según el signo de `channelAdjustment`.
// ============================================================================

import type { PricingComposition } from "../../pricing-display-helpers";

/** Origen comercial de cada ajuste. Estable para React keys y guards. */
export type DiscountSourceKey =
  | "PROMOTION"
  | "QUANTITY_DISCOUNT"
  | "CUSTOMER_RULE"
  | "MANUAL"
  | "COUPON"
  | "GLOBAL_DISCOUNT"
  | "CHANNEL";

/** Un ítem del desglose. NO incluye `percent` — el % vive sólo en la subline
 *  cuando el motor lo expuso con base inequívoca. `amount` siempre positivo;
 *  el signo lo dicta el grupo (`bonifications` vs `surcharges`). */
export type DiscountSourceItem = {
  key:     DiscountSourceKey;
  /** Etiqueta visible. Solo origen + nombre del recurso (promoción, cupón).
   *  NUNCA incluye `%`. */
  label:   string;
  /** Magnitud del ajuste en moneda BASE — exactamente como la emitió el
   *  motor en `PricingComposition`. La UI lo formatea con `displayRate`. */
  amount:  number;
  /** Contexto adicional: applyOn, código del cupón, %-base del cupón/rule
   *  cuando el motor lo expone, etc. `null` cuando no hay nada útil. */
  subline: string | null;
  /** Tooltip largo con descripción del origen — replicado del Hero original. */
  hint:    string;
};

export type DiscountItemGroup = {
  bonifications:     DiscountSourceItem[];
  bonificationTotal: number;
  surcharges:        DiscountSourceItem[];
  surchargeTotal:    number;
};

export type SaleDiscountGroups = {
  /** Ajustes aplicados por el motor sin intervención del operador. */
  automatic: DiscountItemGroup;
  /** Ajustes editables por el operador (bonif. manual por línea + desc. global). */
  manual:    DiscountItemGroup;
};

/** Umbral para considerar un monto ≠ 0 — mismo umbral que usa el Hero hoy. */
const EPSILON = 0.005;

/** Sub-label "Aplica sobre: …" del descuento del cliente. Texto histórico
 *  del Hero (mantiene paridad léxica). */
function customerApplyOnText(
  applyOn: PricingComposition["customerDiscountApplyOn"],
): string | null {
  switch (applyOn) {
    case "METAL":   return "Metal";
    case "HECHURA": return "Hechura";
    case "MIXED":   return "Metal + Hechura";
    case "TOTAL":   return "Precio ajustado (lista + canal + promociones)";
    default:        return null;
  }
}

/** Subline del cliente — incluye el % de la rule SOLO si el motor lo
 *  expuso explícito Y con la base sabida. Si el % es null, mostramos solo
 *  el "aplica sobre". Si no hay aplica-sobre tampoco, devolvemos null. */
function customerRuleSubline(c: PricingComposition): string | null {
  const applyText = customerApplyOnText(c.customerDiscountApplyOn);
  const pct = c.customerDiscountPercent;
  if (pct == null && applyText == null) return null;
  if (pct == null)                       return `rule del cliente — aplica sobre: ${applyText}`;
  if (applyText == null)                 return `rule del cliente: ${pct}%`;
  return `rule del cliente: ${pct}% sobre ${applyText}`;
}

/** Subline del cupón — incluye código y, si el motor lo configuró como
 *  porcentual, el % con base inequívoca ("del subtotal"). No es el % efectivo
 *  sobre el documento, es la rule del cupón. */
function couponSubline(c: PricingComposition): string | null {
  const head = c.couponName
    ? `${c.couponName}${c.couponCode ? ` · ${c.couponCode}` : ""}`
    : null;
  const pct = c.couponPercent;
  if (head == null && pct == null) return null;
  if (pct == null)                  return head;
  const pctText = `rule del cupón: ${pct}% del subtotal`;
  return head ? `${head} — ${pctText}` : pctText;
}

/** Empuja un ítem al sub-grupo correcto según signo. */
function pushItem(
  group: DiscountItemGroup,
  item: DiscountSourceItem,
  signed: "negative" | "positive",
): void {
  if (signed === "negative") group.bonifications.push(item);
  else                       group.surcharges.push(item);
}

function emptyGroup(): DiscountItemGroup {
  return { bonifications: [], bonificationTotal: 0, surcharges: [], surchargeTotal: 0 };
}

/** Construye los grupos AUTOMÁTICO / MANUAL × BONIF / RECARGO. Pure function. */
export function buildSaleDiscountGroups(c: PricingComposition): SaleDiscountGroups {
  const automatic = emptyGroup();
  const manual    = emptyGroup();

  // ── AUTOMÁTICOS ───────────────────────────────────────────────────────────

  // Promoción: solo origen + nombre + monto. Sin %.
  if (c.promotion != null && c.promotion > EPSILON) {
    pushItem(automatic, {
      key:     "PROMOTION",
      label:   c.promotionName ? `Promo: ${c.promotionName}` : "Promoción",
      amount:  c.promotion,
      subline: null,
      hint:    "Descuento aplicado por una promoción activa para alguna de las líneas.",
    }, "negative");
  }

  // Descuento por cantidad: solo origen + monto.
  if (c.quantityDiscount != null && c.quantityDiscount > EPSILON) {
    pushItem(automatic, {
      key:     "QUANTITY_DISCOUNT",
      label:   "Descuento por cantidad",
      amount:  c.quantityDiscount,
      subline: null,
      hint:    "Descuento por escalas de cantidad aplicado por el motor a las líneas.",
    }, "negative");
  }

  // Cliente (entity rule). El % de la rule (cuando el motor lo expone)
  // vive en la subline con contexto inequívoco ("rule del cliente: 3% sobre Metal"),
  // NO en el label.
  if (c.customerDiscount != null && c.customerDiscount > EPSILON) {
    pushItem(automatic, {
      key:     "CUSTOMER_RULE",
      label:   "Cliente",
      amount:  c.customerDiscount,
      subline: customerRuleSubline(c),
      hint:    "Descuento que aplica la lista de precios o el rol del cliente sobre el precio bruto.",
    }, "negative");
  }

  // Cupón: el % del cupón (si es porcentual) vive en la subline con base
  // inequívoca. NO se anuncia como % efectivo del documento.
  if (c.coupon != null && c.coupon > EPSILON) {
    pushItem(automatic, {
      key:     "COUPON",
      label:   "Cupón de venta",
      amount:  c.coupon,
      subline: couponSubline(c),
      hint:    "Descuento del cupón aplicado al documento. Lo valida el motor.",
    }, "negative");
  }

  // Canal: bonificación o recargo según signo. Sin %.
  if (c.channelAdjustment != null && Math.abs(c.channelAdjustment) > EPSILON) {
    const isDiscount = c.channelAdjustment < 0;
    pushItem(automatic, {
      key:     "CHANNEL",
      label:   isDiscount ? "Canal de venta (descuento)" : "Recargo de canal",
      amount:  Math.abs(c.channelAdjustment),
      subline: c.channelName,
      hint:    "Ajuste positivo (recargo) o negativo (descuento) configurado en el canal de venta del documento.",
    }, isDiscount ? "negative" : "positive");
  }

  // ── MANUALES (editables por el operador) ──────────────────────────────────

  // Bonificación manual por línea. El motor en esas líneas REEMPLAZA promo
  // y qty, por eso pertenece al bloque manual aunque el monto venga del motor.
  if (c.manualDiscount != null && c.manualDiscount > EPSILON) {
    pushItem(manual, {
      key:     "MANUAL",
      label:   "Bonificación manual",
      amount:  c.manualDiscount,
      subline: "Reemplaza promoción y desc. por cantidad en las líneas afectadas.",
      hint:    "Total de los manualDiscountOverride aplicados en líneas individuales.",
    }, "negative");
  }

  // Descuento global del documento.
  if (c.globalDiscount != null && c.globalDiscount > EPSILON) {
    pushItem(manual, {
      key:     "GLOBAL_DISCOUNT",
      label:   "Descuento global",
      amount:  c.globalDiscount,
      subline: null,
      hint:    "Descuento manual cargado a nivel documento.",
    }, "negative");
  }

  // Totales = Σ |amount_i| dentro de cada sub-grupo. NO es un cálculo
  // comercial: es agregación trivial de montos que ya emitió el motor.
  automatic.bonificationTotal = automatic.bonifications.reduce((s, it) => s + it.amount, 0);
  automatic.surchargeTotal    = automatic.surcharges   .reduce((s, it) => s + it.amount, 0);
  manual   .bonificationTotal = manual   .bonifications.reduce((s, it) => s + it.amount, 0);
  manual   .surchargeTotal    = manual   .surcharges   .reduce((s, it) => s + it.amount, 0);

  return { automatic, manual };
}

/** True si el grupo no tiene ningún ítem (ni bonif ni recargo). */
export function isEmptyGroup(g: DiscountItemGroup): boolean {
  return g.bonifications.length === 0 && g.surcharges.length === 0;
}
