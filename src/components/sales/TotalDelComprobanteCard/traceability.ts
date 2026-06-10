// src/components/sales/TotalDelComprobanteCard/traceability.ts
// =============================================================================
// ComponentTrace — Trazabilidad reutilizable de los componentes monetarios del
// comprobante (footer, auditorías, PDFs, cuenta corriente, reportes).
//
// OBJETIVO (regla funcional definitiva): cada componente monetario debe permitir
// RECONSTRUIR LA CUENTA que produjo el resultado. No alcanza con "Origen: CUPON";
// el operador debe ver:
//   1. De dónde salió      → `origin` (sourceType + sourceName)
//   2. Sobre qué base       → `base`
//   3. Qué regla se aplicó  → `rule`  (× % / monto / redondeo)
//   4. Qué resultado produjo→ `impact`  (o `preValue → postValue`)
//
// CONTRATO ARQUITECTÓNICO (CLAUDE.md): el frontend es LECTOR PURO. Este builder
// solo PROYECTA datos ya emitidos por el backend/preview a la estructura
// `ComponentTrace`. Las únicas operaciones admitidas son de DISPLAY y ya tenían
// precedente en los tooltips previos (división `monto ÷ base = % efectivo` para
// IVA y Descuento global). Cuando un dato literal no existe todavía en backend,
// el trace queda `completeness: "PARTIAL"` y declara `missingField` — NUNCA se
// inventa el valor.
//
// Función pura — sin React, sin side effects.
// =============================================================================

/** Origen institucional del componente. */
export type TraceSourceType =
  | "CLIENT"
  | "PRICE_LIST"
  | "COUPON"
  | "CHANNEL"
  | "TENANT"
  | "MANUAL";

/** Regla aplicada para llegar del `base` al `impact`. */
export interface TraceRule {
  /** PERCENT → `× value%`; FIXED → monto configurado; ROUNDING → pre→post;
   *  MANUAL → intervención humana (sin fórmula declarativa). */
  kind:   "PERCENT" | "FIXED" | "ROUNDING" | "MANUAL";
  /** Valor de la regla (15 para 15%, 12000 para tarifa fija). Passthrough. */
  value?: number | null;
  /** Etiqueta humana opcional ("Ajuste", "Tarifa fija", "HUNDRED NEAREST"). */
  label?: string | null;
}

/** Trazabilidad unificada de un componente monetario del comprobante. */
export interface ComponentTrace {
  /** Concepto del componente. */
  kind:
    | "PROMOTIONS"
    | "COUPON"
    | "CHANNEL"
    | "TAXES"
    | "SHIPPING"
    | "GLOBAL_ADJUSTMENT"
    | "FINANCIAL_ROUNDING"
    | "MANUAL_ADJUSTMENT"
    // Patrimonios del modo DESGLOSADO (cuenta autocontenida por patrimonio).
    | "METAL"
    | "MONETARY";

  /** Título del tooltip (ej. "Cupón", "Canal de venta", "IVA 21%"). */
  title: string;

  /** (1) De dónde salió. */
  origin: { sourceType: TraceSourceType; sourceName: string };

  /** Nota de contexto opcional (ej. "Gramos finales: 6,90 g"). Display puro —
   *  línea muted bajo el origen. */
  note?: string | null;

  // ── Cuenta — dos formas posibles (passthrough puro) ───────────────────────
  /** (2) Base sobre la que se calculó (en moneda del documento). */
  base?:  number | null;
  /** (3) Regla aplicada. */
  rule?:  TraceRule | null;
  /** Forma alternativa para redondeo / ajuste manual: valor previo → posterior. */
  preValue?:  number | null;
  postValue?: number | null;

  /** (4) Impacto monetario final, con signo (+ suma / − resta). */
  impact: number;

  /** Sub-componentes cuando el concepto agrupa varios (IVA + IIBB; Promo A+B).
   *  Cada uno trae su propia mini-cuenta. */
  items?: ComponentTrace[] | null;

  /** COMPLETE = toda la cuenta proviene del backend/preview.
   *  PARTIAL = falta un dato literal en backend → se muestra lo mejor posible. */
  completeness: "COMPLETE" | "PARTIAL";
  /** Qué campo habría que exponer en backend para llegar a COMPLETE. */
  missingField?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inputs del builder — shapes mínimos (loose) para no acoplar a tipos estrictos.
// ─────────────────────────────────────────────────────────────────────────────

interface CouponLike {
  applied?:        boolean;
  couponCode?:     string | null;
  couponName?:     string | null;
  discountType?:   string | null;   // "PERCENTAGE" | "FIXED_AMOUNT"
  discountValue?:  number | null;
  baseAmount?:     number | null;
  discountAmount?: number | null;
}

interface ChannelLike {
  channelName?:  string | null;
  baseAmount?:   number | null;
  channelAmount?: number | null;
}

interface ClientRulesLike {
  ruleType?:  string | null;        // "DISCOUNT" | "BONUS"
  valueType?: string | null;        // "PERCENTAGE" | "FIXED_AMOUNT"
  value?:     number | null;
  applyOn?:   string | null;
}

interface DraftDiscountGlobalLike {
  type?:  string | null;            // "PERCENT" | "AMOUNT"
  value?: number | null;
  reason?: string | null;
}

interface DraftShippingLike {
  mode?:       string | null;       // "FIXED" | "BY_WEIGHT" | "FREE"
  value?:      number | null;
  methodName?: string | null;
}

interface LineLike {
  quantity?:                number | null;
  appliedPromotionName?:    string | null;
  promotionDiscountAmount?: number | null;
  quantityDiscountAmount?:  number | null;
  taxBreakdown?:            unknown[];
}

interface DocRoundingLike {
  scope?: string;
  totalAdjustment?: number;
  unified?: { mode?: string; direction?: string; preRounding?: number; postRounding?: number; adjustment?: number } | null;
  breakdown?: {
    metalDomain?: string | null;
    hechura?: { mode?: string; direction?: string; preAmount?: number; postAmount?: number; amount?: number } | null;
  } | null;
}

interface ManualLike {
  scope?: string;
  unified?: { preAmount?: number; postAmount?: number; amount?: number } | null;
  totals?: { totalMonetaryAdjustment?: number } | null;
  audit?: { reason?: string | null } | null;
}

export interface BuildComponentTracesInput {
  couponResult?:        CouponLike | null;
  channelResult?:       ChannelLike | null;
  taxAmount?:           number | null;
  taxableBase?:         number | null;
  subtotalCommercial?:  number | null;
  lines?:               ReadonlyArray<LineLike | null | undefined>;
  shippingAmount?:      number | null;
  shippingDraft?:       DraftShippingLike | null;
  globalDiscountAmount?: number | null;
  draftDiscountGlobal?: DraftDiscountGlobalLike | null;
  clientCommercialRules?: ClientRulesLike | null;
  documentRounding?:    DocRoundingLike | null;
  manualAdjustment?:    ManualLike | null;
  manualAdjustmentMonetaryImpact?: number | null;
}

const EPS = 0.005;

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function num(v: unknown): number {
  return isFiniteNum(v) ? v : 0;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agregadores per-línea (puros) — impuestos y promociones a nivel documento.
// ─────────────────────────────────────────────────────────────────────────────

interface TaxAggItem {
  key:    string;
  name:   string;
  rate:   number | null;
  base:   number;
  amount: number;
}

/** Agrega `lines[].taxBreakdown[]` por impuesto. Reconciliación robusta:
 *  el motor puede emitir `taxAmount`/`base` por unidad o por línea — se prueban
 *  ambas escalas (con y sin `quantity`) y se elige la que reconcilia con el
 *  total agregado del documento (`targetTotal`). Devuelve `reconciled=false`
 *  cuando ninguna escala cuadra (→ el caller degrada a PARTIAL). */
export function aggregateTaxItemsFromLines(
  lines: ReadonlyArray<LineLike | null | undefined> | undefined,
  targetTotal: number | null | undefined,
): { items: TaxAggItem[]; reconciled: boolean } {
  if (!Array.isArray(lines)) return { items: [], reconciled: false };

  const noQty = new Map<string, TaxAggItem>();
  const wiQty = new Map<string, TaxAggItem>();

  const add = (
    map: Map<string, TaxAggItem>,
    key: string,
    name: string,
    rate: number | null,
    base: number,
    amount: number,
  ) => {
    const prev = map.get(key);
    if (prev) {
      prev.base += base;
      prev.amount += amount;
      if (prev.rate == null && rate != null) prev.rate = rate;
    } else {
      map.set(key, { key, name, rate, base, amount });
    }
  };

  for (const line of lines) {
    if (!line) continue;
    const breakdown = Array.isArray(line.taxBreakdown) ? line.taxBreakdown : [];
    const qty = isFiniteNum(line.quantity) && line.quantity > 0 ? line.quantity : 1;
    for (const raw of breakdown) {
      if (!raw || typeof raw !== "object") continue;
      const t = raw as {
        taxId?: string | null; name?: string | null; code?: string | null;
        rate?: number | null; base?: number | null; taxAmount?: number | null;
      };
      const amount = num(t.taxAmount);
      if (Math.abs(amount) <= EPS) continue;
      const name = (t.name ?? t.code ?? "Impuesto").toString();
      const key  = (t.taxId ?? t.code ?? name).toString();
      const rate = isFiniteNum(t.rate) ? t.rate : null;
      const base = num(t.base);
      add(noQty, key, name, rate, base, amount);
      add(wiQty, key, name, rate, base * qty, amount * qty);
    }
  }

  const sum = (m: Map<string, TaxAggItem>) =>
    Array.from(m.values()).reduce((a, it) => a + it.amount, 0);
  const target = isFiniteNum(targetTotal) ? targetTotal : null;
  const sNo = round2(sum(noQty));
  const sWi = round2(sum(wiQty));

  let chosen = noQty;
  let chosenSum = sNo;
  if (target != null) {
    const dNo = Math.abs(sNo - target);
    const dWi = Math.abs(sWi - target);
    if (dWi < dNo) { chosen = wiQty; chosenSum = sWi; }
  }
  const tol = Math.max(0.5, target != null ? Math.abs(target) * 0.001 : 0.5);
  const reconciled = target != null ? Math.abs(chosenSum - target) <= tol : chosen.size > 0;

  const items = Array.from(chosen.values())
    .map((it) => ({ ...it, base: round2(it.base), amount: round2(it.amount) }))
    .sort((a, b) => b.amount - a.amount);
  return { items, reconciled };
}

interface PromoAggItem {
  name:   string;
  amount: number;   // siempre positivo (magnitud del descuento)
}

/** Agrega promociones y descuentos por cantidad a nivel documento desde las
 *  líneas. Cada `promotionDiscountAmount`/`quantityDiscountAmount` es por unidad
 *  → se multiplica por `quantity`. Las promociones nombradas se agrupan por
 *  nombre; los descuentos por cantidad se consolidan bajo un ítem genérico. */
export function aggregatePromotionsFromLines(
  lines: ReadonlyArray<LineLike | null | undefined> | undefined,
): PromoAggItem[] {
  if (!Array.isArray(lines)) return [];
  const byName = new Map<string, number>();
  let qtyDiscount = 0;
  for (const line of lines) {
    if (!line) continue;
    const qty = isFiniteNum(line.quantity) && line.quantity > 0 ? line.quantity : 1;
    const promo = num(line.promotionDiscountAmount) * qty;
    if (Math.abs(promo) > EPS) {
      const name = (line.appliedPromotionName ?? "Promoción").toString();
      byName.set(name, round2((byName.get(name) ?? 0) + promo));
    }
    const qd = num(line.quantityDiscountAmount) * qty;
    if (Math.abs(qd) > EPS) qtyDiscount = round2(qtyDiscount + qd);
  }
  const items: PromoAggItem[] = Array.from(byName.entries()).map(([name, amount]) => ({ name, amount }));
  if (Math.abs(qtyDiscount) > EPS) items.push({ name: "Descuento por cantidad", amount: qtyDiscount });
  return items.sort((a, b) => b.amount - a.amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder principal.
// ─────────────────────────────────────────────────────────────────────────────

/** Construye el mapa `componentType → ComponentTrace` para el footer.
 *  Cada entrada solo se agrega cuando el dato subyacente está presente y es
 *  significativo. PURO — passthrough + agregación de display. */
export function buildComponentTraces(
  input: BuildComponentTracesInput,
): Record<string, ComponentTrace> {
  const out: Record<string, ComponentTrace> = {};

  // ── COUPON ────────────────────────────────────────────────────────────────
  const cp = input.couponResult;
  if (cp && cp.applied && Math.abs(num(cp.discountAmount)) > EPS) {
    const isPercent = (cp.discountType ?? "").toUpperCase().includes("PERCENT");
    out.COUPON = {
      kind:  "COUPON",
      title: cp.couponName || cp.couponCode || "Cupón",
      origin: {
        sourceType: "COUPON",
        sourceName: cp.couponCode ? `${cp.couponCode}` : (cp.couponName || "Cupón manual"),
      },
      base: isFiniteNum(cp.baseAmount) ? cp.baseAmount : null,
      rule: {
        kind:  isPercent ? "PERCENT" : "FIXED",
        value: isFiniteNum(cp.discountValue) ? cp.discountValue : null,
      },
      impact: -Math.abs(num(cp.discountAmount)),
      completeness: "COMPLETE",
    };
  }

  // ── CHANNEL ─────────────────────────────────────────────────────────────────
  const ch = input.channelResult;
  if (ch && Math.abs(num(ch.channelAmount)) > EPS) {
    const base = isFiniteNum(ch.baseAmount) ? ch.baseAmount : null;
    // % efectivo derivado (display, mismo precedente que IVA). El tipo literal
    // (porcentaje vs comisión fija) NO viaja en el snapshot → PARTIAL.
    const pct =
      base != null && Math.abs(base) > EPS ? round2((num(ch.channelAmount) / base) * 100) : null;
    out.CHANNEL = {
      kind:  "CHANNEL",
      title: ch.channelName || "Canal de venta",
      origin: { sourceType: "CHANNEL", sourceName: ch.channelName || "Canal de venta" },
      base,
      rule: { kind: "PERCENT", value: pct, label: "Ajuste (estimado)" },
      impact: num(ch.channelAmount),
      completeness: "PARTIAL",
      missingField: "channelResult.adjustmentType + adjustmentValue (tipo/valor literal del canal)",
    };
  }

  // ── TAXES ───────────────────────────────────────────────────────────────────
  const taxAmount = num(input.taxAmount);
  if (taxAmount > EPS) {
    const { items, reconciled } = aggregateTaxItemsFromLines(input.lines, taxAmount);
    const taxableBase = isFiniteNum(input.taxableBase) ? input.taxableBase : null;
    if (items.length === 1 && reconciled) {
      const it = items[0];
      out.TAX = {
        kind:  "TAXES",
        title: it.rate != null ? `${it.name} ${round2(it.rate)}%` : it.name,
        origin: { sourceType: "TENANT", sourceName: "Impuesto sobre base imponible" },
        base: taxableBase ?? (it.base || null),
        rule: { kind: "PERCENT", value: it.rate },
        impact: taxAmount,
        completeness: "COMPLETE",
      };
    } else if (items.length > 1 && reconciled) {
      out.TAX = {
        kind:  "TAXES",
        title: "Impuestos",
        origin: { sourceType: "TENANT", sourceName: "Impuestos sobre base imponible" },
        base: taxableBase,
        impact: taxAmount,
        items: items.map((it) => ({
          kind:  "TAXES",
          title: it.rate != null ? `${it.name} ${round2(it.rate)}%` : it.name,
          origin: { sourceType: "TENANT", sourceName: it.name },
          base: it.base || null,
          rule: { kind: "PERCENT", value: it.rate },
          impact: it.amount,
          completeness: "COMPLETE",
        })),
        completeness: "COMPLETE",
      };
    } else {
      // Sin breakdown reconciliable → alícuota efectiva derivada (legacy).
      const pct = taxableBase != null && Math.abs(taxableBase) > EPS
        ? round2((taxAmount / taxableBase) * 100)
        : null;
      out.TAX = {
        kind:  "TAXES",
        title: pct != null ? `Impuestos ${pct}%` : "Impuestos",
        origin: { sourceType: "TENANT", sourceName: "Impuesto sobre base imponible" },
        base: taxableBase,
        rule: { kind: "PERCENT", value: pct, label: pct != null ? "Alícuota efectiva" : null },
        impact: taxAmount,
        completeness: taxableBase != null ? "COMPLETE" : "PARTIAL",
        ...(taxableBase == null ? { missingField: "documentTotals.taxableBase / taxBreakdown por impuesto" } : {}),
      };
    }
  }

  // ── SHIPPING ────────────────────────────────────────────────────────────────
  const shipping = num(input.shippingAmount);
  if (shipping > EPS) {
    const sd = input.shippingDraft;
    const hasMode = !!(sd && (sd.mode || sd.methodName));
    out.SHIPPING = {
      kind:  "SHIPPING",
      title: (sd && sd.methodName) || "Envío",
      origin: { sourceType: "TENANT", sourceName: (sd && sd.methodName) || "Envío del comprobante" },
      base: null,
      rule: hasMode
        ? { kind: "FIXED", value: isFiniteNum(sd!.value) ? sd!.value : null, label: shippingModeLabel(sd!.mode) }
        : null,
      impact: shipping,
      completeness: hasMode ? "COMPLETE" : "PARTIAL",
      ...(hasMode ? {} : { missingField: "shippingResult { mode, value, methodName } (snapshot de envío en el preview)" }),
    };
  }

  // ── GLOBAL_ADJUSTMENT (descuento/bonificación global) ────────────────────────
  const globalDisc = num(input.globalDiscountAmount);
  if (globalDisc > EPS) {
    const dg = input.draftDiscountGlobal;
    const cr = input.clientCommercialRules;
    const fromClient = !!(cr && cr.ruleType);
    let rule: TraceRule | null = null;
    if (dg && (dg.type || isFiniteNum(dg.value))) {
      rule = {
        kind:  (dg.type ?? "").toUpperCase() === "AMOUNT" ? "FIXED" : "PERCENT",
        value: isFiniteNum(dg.value) ? dg.value : null,
      };
    } else if (cr && (cr.valueType || isFiniteNum(cr.value))) {
      rule = {
        kind:  (cr.valueType ?? "").toUpperCase().includes("PERCENT") ? "PERCENT" : "FIXED",
        value: isFiniteNum(cr.value) ? cr.value : null,
      };
    }
    out.DISCOUNT_MANUAL = {
      kind:  "GLOBAL_ADJUSTMENT",
      title: fromClient ? "Bonificación / descuento del cliente" : "Descuento global",
      origin: fromClient
        ? { sourceType: "CLIENT", sourceName: "Regla comercial del cliente" }
        : { sourceType: "MANUAL", sourceName: "Manual del comprobante" },
      base: isFiniteNum(input.subtotalCommercial) ? input.subtotalCommercial : null,
      rule,
      impact: -Math.abs(globalDisc),
      completeness: rule ? "COMPLETE" : "PARTIAL",
      ...(rule ? {} : { missingField: "globalDiscountResult { type, value, origin } (snapshot persistido)" }),
    };
  }

  // ── PROMOTIONS (descuentos de línea / promociones) ───────────────────────────
  const promoItems = aggregatePromotionsFromLines(input.lines);
  if (promoItems.length > 0) {
    const total = round2(promoItems.reduce((a, p) => a + p.amount, 0));
    out.DISCOUNT_QTY = {
      kind:  "PROMOTIONS",
      title: "Promociones y descuentos",
      origin: { sourceType: "PRICE_LIST", sourceName: "Promociones / descuentos por línea" },
      impact: -Math.abs(total),
      items: promoItems.map((p) => ({
        kind:  "PROMOTIONS",
        title: p.name,
        origin: { sourceType: "PRICE_LIST", sourceName: p.name },
        impact: -Math.abs(p.amount),
        completeness: "COMPLETE",
      })),
      completeness: "COMPLETE",
    };
  }

  // ── FINANCIAL_ROUNDING ───────────────────────────────────────────────────────
  const dr = input.documentRounding;
  if (dr && Math.abs(num(dr.totalAdjustment)) > EPS) {
    const uni = dr.unified;
    const hech = dr.breakdown?.hechura;
    const mode = uni?.mode ?? hech?.mode ?? null;
    const direction = uni?.direction ?? hech?.direction ?? null;
    const pre  = isFiniteNum(uni?.preRounding) ? uni!.preRounding
      : isFiniteNum(hech?.preAmount) ? hech!.preAmount : null;
    const post = isFiniteNum(uni?.postRounding) ? uni!.postRounding
      : isFiniteNum(hech?.postAmount) ? hech!.postAmount : null;
    out.ROUNDING_MONETARY = {
      kind:  "FINANCIAL_ROUNDING",
      title: "Redondeo financiero",
      origin: { sourceType: "TENANT", sourceName: "Política del tenant" },
      rule: { kind: "ROUNDING", label: roundingModeLabel(mode, direction) },
      preValue:  pre,
      postValue: post,
      impact: round2(num(dr.totalAdjustment)),
      completeness: "COMPLETE",
    };
  }

  // ── MANUAL_ADJUSTMENT ────────────────────────────────────────────────────────
  const ma = input.manualAdjustment;
  const maImpact = isFiniteNum(input.manualAdjustmentMonetaryImpact)
    ? input.manualAdjustmentMonetaryImpact
    : num(ma?.totals?.totalMonetaryAdjustment);
  if (ma && Math.abs(maImpact) > EPS) {
    const pre  = isFiniteNum(ma.unified?.preAmount) ? ma.unified!.preAmount : null;
    const post = isFiniteNum(ma.unified?.postAmount) ? ma.unified!.postAmount : null;
    out.MANUAL_ADJUSTMENT = {
      kind:  "MANUAL_ADJUSTMENT",
      title: "Ajuste manual",
      origin: { sourceType: "MANUAL", sourceName: ma.audit?.reason || "Intervención humana" },
      rule: { kind: "MANUAL" },
      preValue:  pre,
      postValue: post,
      impact: round2(maImpact),
      completeness: "COMPLETE",
    };
  }

  return out;
}

/** Etiqueta humana del modo de envío. */
function shippingModeLabel(mode: string | null | undefined): string {
  switch ((mode ?? "").toUpperCase()) {
    case "FIXED":     return "Tarifa fija";
    case "BY_WEIGHT": return "Por peso";
    case "FREE":      return "Sin cargo";
    default:          return "Envío";
  }
}

/** Etiqueta humana del modo/dirección de redondeo. */
function roundingModeLabel(
  mode: string | null | undefined,
  direction: string | null | undefined,
): string {
  const m = (mode ?? "").toUpperCase();
  const d = (direction ?? "").toUpperCase();
  if (!m || m === "NONE") return "Redondeo del comprobante";
  return d && d !== "NONE" ? `${m} ${d}` : m;
}
