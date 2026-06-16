// src/lib/pricing/display/saleLineDiscountSourcesDisplay.ts
// ============================================================================
// Helper display-only por LÍNEA — agrupa los ajustes (descuentos y recargos)
// aplicados por el motor a una línea, separados por origen comercial:
//
//   · Automáticos: PROMOTION / QUANTITY_DISCOUNT / CUSTOMER_RULE.
//   · Manuales:    MANUAL_DISCOUNT (override del operador por línea).
//
// REGLAS (POLICY R6 / R4.5):
//   1. NO se calculan porcentajes en frontend. El label primario es solo el
//      origen; el % aparece SOLO si el motor lo expone explícito y con base
//      inequívoca, en la subline "regla".
//   2. Los montos son passthrough. Las fuentes prioritarias por origen:
//        · PROMOTION         → meta.promotionDiscountAmount × qty
//        · QUANTITY_DISCOUNT → meta.quantityDiscountAmount  × qty
//        · CUSTOMER_RULE     → meta.customerDiscountAmount  (TOTAL POR LÍNEA,
//                              ya viene multiplicado por qty del motor).
//        · MANUAL            → adjustments[kind=MANUAL_DISCOUNT] × qty con
//                              fallback a meta.quantityDiscountAmount × qty
//                              cuando priceSource === "MANUAL_OVERRIDE".
//   3. NUNCA mostrar "Cliente — $0,00" engañoso. Si hay rule activa pero el
//      motor no expuso `customerDiscountAmount` y tampoco hay adjustments
//      desagregados (caso degradado raro), se devuelve `status: "UNDETAILED"`
//      para que la UI muestre "Cliente aplicado por el motor — detalle no
//      disponible". Si NO hay rule activa, ni siquiera aparece el ítem.
//   4. El descuento de cliente NO se deriva como residuo de `discountAmount`.
//   5. Cada ítem expone `originName` (nombre/regla) y `baseLabel`
//      (Total/Metal/Hechura) cuando el motor los provee.
// ============================================================================

/** Origen comercial. */
export type LineDiscountSourceKey =
  | "PROMOTION"
  | "QUANTITY_DISCOUNT"
  | "CUSTOMER_RULE"
  | "MANUAL";

/** Estado del ítem — `OK` cuando el monto viene del motor; `UNDETAILED`
 *  cuando hay rule activa pero el motor no segregó el detalle por línea. */
export type LineDiscountStatus = "OK" | "UNDETAILED";

/**
 * Cómo se construyó el monto. Display puro — viene 100% del motor:
 *   · PERCENT     → baseUnit × qty × percent% (= amount).
 *                   `baseUnit` y `qty` se exponen separados para que la UI
 *                   pueda renderizar "(AR$ X × N u.) × P%" cuando qty > 1
 *                   y simplificar a "AR$ X × P%" cuando qty = 1.
 *                   `baseFromEngine` permite mostrar la base efectiva total
 *                   reportada por el motor cuando difiere de
 *                   `baseUnit × qty` (redondeos / applyOn especial).
 *   · FIXED       → monto fijo per-unidad × qty unidades.
 *   · UNAVAILABLE → el motor no segregó base + valor por línea (caso
 *                   ENTITY_RULE applyOn=TOTAL sin metadata explicativa).
 *                   UI muestra "Cálculo: detalle no disponible".
 *   · null        → no aplica para este ítem (ej. ítems UNDETAILED).
 *
 * El frontend NO calcula `base × percent`. Toma todos los valores del motor.
 */
export type LineDiscountCalculation =
  | { kind: "PERCENT";     baseUnit: number; qty: number; percent: number; baseFromEngine?: number | null }
  | { kind: "FIXED";       perUnit:  number; qty:     number }
  | { kind: "UNAVAILABLE" };

/** Un ítem del desglose por línea. */
export type LineDiscountSourceItem = {
  key:    LineDiscountSourceKey;
  /** Etiqueta primaria. SIN `%`. */
  label:  string;
  /** Nombre del recurso o regla aplicada (ej. "Promo Verano", "Tramo cantidad",
   *  "rule del cliente: 15%"). `null` si el motor no lo expuso. */
  originName: string | null;
  /** Base de aplicación: "Total", "Metal", "Hechura", "Metal + Hechura".
   *  `null` cuando el motor no la informó. */
  baseLabel: string | null;
  /** Monto total del ajuste en la línea (positivo). El signo lo dicta el
   *  sub-grupo. `null` cuando `status === "UNDETAILED"` (no mostramos monto). */
  amount: number | null;
  /** Estado del dato: OK con monto, o UNDETAILED (rule activa sin desglose). */
  status: LineDiscountStatus;
  /** Cómo se construyó el monto. `null` cuando no aplica (ej. UNDETAILED). */
  calc: LineDiscountCalculation | null;
};

export type LineDiscountItemGroup = {
  bonifications:     LineDiscountSourceItem[];
  bonificationTotal: number;
  surcharges:        LineDiscountSourceItem[];
  surchargeTotal:    number;
};

export type LineDiscountGroups = {
  automatic: LineDiscountItemGroup;
  manual:    LineDiscountItemGroup;
};

/** Shape esperado por el helper. */
export type LineLikeForDiscount = {
  quantity: number;
  /** Precio unitario FINAL hidratado del motor (`pl.unitPrice`). Junto con
   *  `subtotal` permite calcular el descuento efectivo TOTAL pasada-thru sin
   *  depender del shape per-step (que puede tener bugs como el de
   *  `ENTITY_COMMERCIAL_RULE` sub-dividido). Opcional para back-compat. */
  unitPrice?: number | null;
  /** Subtotal NETO sin tax de la línea, hidratado del motor (= `pl.lineTotal`).
   *  Usado en `lineEffectiveDiscountTotal` para derivar el descuento efectivo
   *  como `baseInitial − subtotal`. Opcional para back-compat. */
  subtotal?: number | null;
  pricingMeta?: {
    /** Precio base de lista per-unit hidratado del motor (`pl.basePrice`).
     *  Usado en `lineEffectiveDiscountTotal` para derivar `baseInitial =
     *  basePrice × qty`. Opcional para back-compat. */
    basePrice?:               number | null;
    quantityDiscountAmount?:  number | null;
    promotionDiscountAmount?: number | null;
    /** Total descontado por la rule del cliente en esta línea (ya incluye qty). */
    customerDiscountAmount?:  number | null;
    appliedPromotionName?:    string | null;
    priceSource?:             string | null;
    /** Metadata explicativa per-origen para mostrar la fórmula sin recalcular.
     *  Sale del motor (`steps[].meta`) y el mapper backend la serializa. */
    quantityDiscountBase?:       number | null;
    quantityDiscountValue?:      number | null;
    quantityDiscountValueType?:  "PERCENTAGE" | "FIXED_AMOUNT" | null;
    promotionDiscountBase?:      number | null;
    promotionDiscountValue?:     number | null;
    promotionDiscountValueType?: "PERCENTAGE" | "FIXED_AMOUNT" | null;
    customerDiscountBase?:       number | null;
    manualDiscount?: {
      value?:     number | null;
      mode?:      string | null;
      appliesTo?: string | null;
      kind?:      string | null;
    } | null;
    inheritedDiscount?: {
      ruleType?:  string | null;
      valueType?: string | null;
      value?:     number | null;
      applyOn?:   string | null;
    } | null;
    componentSaleBreakdown?: {
      metal?:   { adjustments?: Array<LineAdjustment> | null } | null;
      hechura?: { adjustments?: Array<LineAdjustment> | null } | null;
    } | null;
    /** Pipeline serializado del motor (passthrough whitelist). Cuando está
     *  presente, `buildLineDiscountPipeline` lo usa como fuente del orden
     *  real y de los subtotales por paso. */
    pricingSteps?: Array<LinePipelineStep>;
  } | null;
};

/** Shape de un step del pipeline tal como llega del backend. */
export type LinePipelineStep = {
  key:     string;
  label:   string;
  status:  "ok" | "partial" | "missing" | "skipped";
  value:   number | null;
  message?: string;
  meta?: {
    discountBase?:           number | null;
    discountAmount?:         number | null;
    discountBaseEstimated?:  boolean;
    surchargeBase?:          number | null;
    surchargeAmount?:        number | null;
    surchargeBaseEstimated?: boolean;
    value?:     number | null;
    type?:      "PERCENTAGE" | "FIXED_AMOUNT" | null;
    valueType?: "PERCENTAGE" | "FIXED_AMOUNT" | null;
    applyOn?:   string | null;
    ruleType?:  "DISCOUNT" | "BONUS" | "SURCHARGE" | null;
    kind?:      "BONUS" | "SURCHARGE" | null;
    mode?:      "PERCENT" | "FIXED" | null;
    promoId?:    string | null;
    discountId?: string | null;
    promoName?:  string | null;
  };
};

export type LineAdjustment = {
  kind?:       string | null;
  source?:     string | null;
  amount?:     number | null;
  applyOn?:    string | null;
  label?:      string | null;
  percentage?: number | null;
  /** Base sobre la que se calculó el adjustment (per-unidad). El motor la
   *  expone en `componentSaleBreakdown.adjustments[]` cuando el adjustment
   *  vive en METAL/HECHURA. Permite mostrar "Base × % = Impacto" sin
   *  derivar nada. */
  base?:       number | null;
  /** `"PERCENTAGE"` o `"FIXED_AMOUNT"` — distingue cómo el motor calculó
   *  el adjustment. La UI usa esto para elegir cálculo "× %" o "× qty". */
  valueType?:  string | null;
};

const EPSILON = 0.005;

function emptyGroup(): LineDiscountItemGroup {
  return { bonifications: [], bonificationTotal: 0, surcharges: [], surchargeTotal: 0 };
}

function pushItem(
  group: LineDiscountItemGroup,
  item:  LineDiscountSourceItem,
  signed: "negative" | "positive",
): void {
  if (signed === "negative") group.bonifications.push(item);
  else                       group.surcharges.push(item);
}

/** Traduce `applyOn` del motor a etiqueta legible. `null` cuando no hay info. */
function baseLabelFromApplyOn(applyOn: string | null | undefined): string | null {
  switch (applyOn) {
    case "METAL":   return "Metal";
    case "HECHURA": return "Hechura";
    case "TOTAL":   return "Total";
    default:        return null;
  }
}

/** Para cliente: combina los applyOn observados en los adjustments. Si no hay
 *  adjustments, cae al `applyOn` heredado en `pricingMeta.inheritedDiscount`. */
function customerBaseLabel(
  applyOns: Set<"METAL" | "HECHURA" | "TOTAL">,
  inheritedApplyOn: string | null | undefined,
): string | null {
  if (applyOns.size === 1) {
    const only = Array.from(applyOns)[0];
    return baseLabelFromApplyOn(only);
  }
  if (applyOns.size > 1) return "Metal + Hechura";
  return baseLabelFromApplyOn(inheritedApplyOn);
}

/** Suma adjustments por kind, multiplicando por qty. Devuelve también el set
 *  de applyOn observados, la base agregada por línea (Σ base × qty cuando
 *  todos los adjustments del kind tienen base poblada) y el percent/valueType
 *  uniforme cuando coinciden entre componentes. */
function readAdjustments(
  meta: NonNullable<LineLikeForDiscount["pricingMeta"]>,
  qty:  number,
  kinds: Set<string>,
  filter?: (adj: LineAdjustment) => boolean,
): {
  total:     number;
  applyOns:  Set<"METAL" | "HECHURA" | "TOTAL">;
  /** Σ base × qty cuando todos los adjustments del kind tienen `base` poblada.
   *  `null` si alguno carece de base (no podemos mostrar cálculo). */
  baseLine:  number | null;
  /** % uniforme entre los adjustments observados (todos con el mismo value).
   *  `null` si difieren o si alguno no es porcentual. */
  percent:   number | null;
  /** `"PERCENTAGE"` o `"FIXED_AMOUNT"` cuando es uniforme. `null` cuando
   *  difieren o no hay info. */
  valueType: string | null;
} {
  const csb = meta.componentSaleBreakdown;
  let total = 0;
  let baseAcc = 0;
  let baseComplete = true;
  let observedCount = 0;
  const observedPercents = new Set<number>();
  const observedValueTypes = new Set<string>();
  const applyOns = new Set<"METAL" | "HECHURA" | "TOTAL">();
  if (!csb) return { total, applyOns, baseLine: null, percent: null, valueType: null };
  for (const side of ["metal", "hechura"] as const) {
    const adjs = csb[side]?.adjustments;
    if (!Array.isArray(adjs)) continue;
    for (const adj of adjs) {
      if (!adj?.kind || !kinds.has(adj.kind)) continue;
      if (filter && !filter(adj)) continue;
      total += Number(adj.amount ?? 0) * qty;
      observedCount++;
      if (typeof adj.base === "number" && Number.isFinite(adj.base)) {
        baseAcc += adj.base * qty;
      } else {
        baseComplete = false;
      }
      if (typeof adj.percentage === "number") {
        // Redondeo a 4 decimales para tolerar drift de coma flotante entre
        // componentes (es comparación de display, no comercial).
        observedPercents.add(Math.round(adj.percentage * 10000) / 10000);
      }
      if (typeof adj.valueType === "string" && adj.valueType.length > 0) {
        observedValueTypes.add(adj.valueType);
      }
      const ao = adj.applyOn;
      if (ao === "METAL" || ao === "HECHURA" || ao === "TOTAL") applyOns.add(ao);
      else if (side === "metal")  applyOns.add("METAL");
      else                        applyOns.add("HECHURA");
    }
  }
  return {
    total,
    applyOns,
    baseLine:  baseComplete && observedCount > 0 ? baseAcc : null,
    percent:   observedPercents.size === 1   ? Array.from(observedPercents)[0]   : null,
    valueType: observedValueTypes.size === 1 ? Array.from(observedValueTypes)[0] : null,
  };
}

/** Construye `calc` para un ítem a partir de la lectura de adjustments. */
function buildCalc(
  read: ReturnType<typeof readAdjustments>,
  qty:  number,
): LineDiscountCalculation | null {
  // Sin adjustments → sin cálculo.
  if (read.total <= 0) return null;
  if (read.valueType === "PERCENTAGE" && read.percent != null && read.baseLine != null && qty > 0) {
    // `read.baseLine` viene de Σ adjustments.base × qty (ya agregado).
    // Lo dividimos por qty para obtener `baseUnit`, exposición display-only
    // sin recálculo comercial — equivale a lo que el motor emitió per-unidad.
    return {
      kind:    "PERCENT",
      baseUnit: read.baseLine / qty,
      qty,
      percent: read.percent,
    };
  }
  if (read.valueType === "FIXED_AMOUNT" && qty > 0) {
    return { kind: "FIXED", perUnit: read.total / qty, qty };
  }
  return { kind: "UNAVAILABLE" };
}

/** Construye `calc` a partir de la metadata explicativa que el mapper backend
 *  ya serializó desde `steps[].meta`. Es la fuente PRIMARIA: cubre el caso
 *  común (artículos sin desglose metal/hechura) donde los adjustments por
 *  componente quedan vacíos pero el motor sí tiene la base y el valor.
 *
 *  Devuelve `null` si los tres campos no llegaron — la UI cae al fallback
 *  (adjustments) y, si tampoco está ahí, al `UNAVAILABLE`. */
function buildCalcFromExplicitMeta(
  base:      number | null | undefined,
  value:     number | null | undefined,
  valueType: "PERCENTAGE" | "FIXED_AMOUNT" | null | undefined,
  qty:       number,
): LineDiscountCalculation | null {
  if (value == null) return null;
  if (valueType === "PERCENTAGE") {
    if (base == null || qty <= 0) return null;
    // En estos campos explícitos el motor expone la base POR LÍNEA
    // (no per-unidad). Lo dividimos por qty para tener `baseUnit` y
    // exponer ambos: `baseUnit` y `qty`. La UI decide cómo mostrarlo
    // (compacto o con `(unitario × qty) × %`). `baseFromEngine` es la
    // misma base por línea — sirve para detectar discrepancias por
    // redondeo si el render quisiera advertirlo.
    return {
      kind:           "PERCENT",
      baseUnit:       base / qty,
      qty,
      percent:        value,
      baseFromEngine: base,
    };
  }
  if (valueType === "FIXED_AMOUNT" && qty > 0) {
    return { kind: "FIXED", perUnit: value, qty };
  }
  return null;
}

function lineHasManualDiscount(meta: NonNullable<LineLikeForDiscount["pricingMeta"]>): boolean {
  if (meta.manualDiscount != null) return true;
  const qtyDU = meta.quantityDiscountAmount ?? 0;
  return meta.priceSource === "MANUAL_OVERRIDE" && qtyDU > 0;
}

/** Construye el ítem CUSTOMER_RULE. Decide entre OK (con monto) o UNDETAILED
 *  (rule activa pero sin desglose) según los datos del motor. Devuelve `null`
 *  cuando NO hay ninguna evidencia de rule activa (no se muestra el ítem). */
function buildCustomerItem(
  meta: NonNullable<LineLikeForDiscount["pricingMeta"]>,
  qty:  number,
): { item: LineDiscountSourceItem; signed: "negative" | "positive" } | null {
  const inherited = meta.inheritedDiscount ?? null;
  const ruleType  = inherited?.ruleType ?? null;
  const isSurcharge = ruleType === "SURCHARGE";

  // 1) Monto agregado del motor — fuente primaria. Cubre el caso `applyOn=TOTAL`
  //    donde el motor absorbe en `unitPrice` y NO emite adjustments por
  //    componente. Para cliente, el campo YA viene multiplicado por qty.
  const aggregatedAmount = meta.customerDiscountAmount ?? null;

  // 2) Adjustments por componente — fuente secundaria, útil para detectar
  //    qué componentes recibieron el ajuste y construir la baseLabel.
  const adjRead = readAdjustments(
    meta, qty, new Set(["ENTITY_RULE"]),
    (adj) => adj.source === "CLIENT" || adj.source == null,
  );
  const { total: adjTotal, applyOns } = adjRead;

  // Construir originName ("regla cliente: 15% sobre Total") cuando el motor
  // expone el valor de la rule. NUNCA derivamos el % nosotros.
  const inheritedPercent =
    inherited?.valueType === "PERCENTAGE" && typeof inherited.value === "number"
      ? inherited.value
      : null;
  const baseLabel = customerBaseLabel(applyOns, inherited?.applyOn);
  const originName =
    inheritedPercent != null
      ? (baseLabel
          ? `regla del cliente: ${inheritedPercent}% sobre ${baseLabel}`
          : `regla del cliente: ${inheritedPercent}%`)
      : (inherited?.valueType === "FIXED_AMOUNT"
          ? "regla del cliente: monto fijo"
          : null);

  // ── Caso A: hay monto agregado del motor → OK con monto exacto.
  //    Para el cálculo combinamos:
  //      (1) fuente PRIMARIA: `customerDiscountBase` + `inheritedDiscount.value/valueType`
  //          (cubre el caso aplica-sobre-TOTAL — el motor pobla el base
  //          en `steps[].meta.discountBase`).
  //      (2) fallback SECUNDARIO: adjustments por componente (cliente
  //          aplica-sobre-METAL/HECHURA con desglose exacto).
  //      (3) UNAVAILABLE si ninguno alcanza.
  if (aggregatedAmount != null && aggregatedAmount > EPSILON) {
    const inheritedValueType: "PERCENTAGE" | "FIXED_AMOUNT" | null =
      inherited?.valueType === "PERCENTAGE" || inherited?.valueType === "FIXED_AMOUNT"
        ? inherited.valueType
        : null;
    const calc =
      buildCalcFromExplicitMeta(
        meta.customerDiscountBase,
        typeof inherited?.value === "number" ? inherited.value : null,
        inheritedValueType,
        qty,
      ) ??
      (adjTotal > EPSILON ? buildCalc(adjRead, qty) : null) ??
      { kind: "UNAVAILABLE" as const };
    return {
      item: {
        key:        "CUSTOMER_RULE",
        label:      isSurcharge ? "Recargo cliente" : "Cliente",
        originName,
        baseLabel,
        amount:     aggregatedAmount,
        status:     "OK",
        calc,
      },
      signed: isSurcharge ? "positive" : "negative",
    };
  }

  // ── Caso B: no hay agregado, pero los adjustments por componente sí dan
  //    monto > 0 (cliente con applyOn=METAL/HECHURA reportado por componente).
  if (adjTotal > EPSILON) {
    return {
      item: {
        key:        "CUSTOMER_RULE",
        label:      isSurcharge ? "Recargo cliente" : "Cliente",
        originName,
        baseLabel,
        amount:     adjTotal,
        status:     "OK",
        calc:       buildCalc(adjRead, qty),
      },
      signed: isSurcharge ? "positive" : "negative",
    };
  }

  // ── Caso C: hay rule activa configurada pero el motor no segregó el detalle
  //    para esta línea (caso degradado raro). Mostramos UNDETAILED — la UI
  //    explica "Cliente aplicado por el motor — detalle no disponible".
  //    NUNCA mostramos "$0,00" engañoso.
  if (ruleType === "DISCOUNT" || ruleType === "BONUS" || ruleType === "SURCHARGE") {
    return {
      item: {
        key:        "CUSTOMER_RULE",
        label:      isSurcharge ? "Recargo cliente" : "Cliente",
        originName,
        baseLabel,
        amount:     null,
        status:     "UNDETAILED",
        calc:       null,
      },
      signed: isSurcharge ? "positive" : "negative",
    };
  }

  // ── Caso D: no hay rule activa → no se muestra ítem.
  return null;
}

/** Construye los grupos por origen para UNA línea. Pure function. */
export function buildLineDiscountSources(line: LineLikeForDiscount): LineDiscountGroups {
  const automatic = emptyGroup();
  const manual    = emptyGroup();
  const meta      = line.pricingMeta ?? null;
  const qty       = Number.isFinite(line.quantity) ? line.quantity : 0;
  if (!meta || qty <= 0) return { automatic, manual };

  const hasManual = lineHasManualDiscount(meta);

  // ── AJUSTES AUTOMÁTICOS ───────────────────────────────────────────────────

  // PROMOCIÓN — solo si NO hay manual override (el motor lo reemplaza).
  if (!hasManual) {
    const promoUnit = meta.promotionDiscountAmount ?? 0;
    if (promoUnit > 0) {
      const promoRead = readAdjustments(meta, qty, new Set(["PROMOTION"]));
      // Fuente PRIMARIA: metadata explicativa que el mapper backend serializa
      // desde `steps[].meta` (cubre artículos sin desglose metal/hechura).
      // Fallback SECUNDARIO: adjustments por componente (artículos con
      // desglose exacto). Si ninguno aplica, queda UNAVAILABLE.
      const calc =
        buildCalcFromExplicitMeta(
          meta.promotionDiscountBase,
          meta.promotionDiscountValue,
          meta.promotionDiscountValueType,
          qty,
        ) ??
        buildCalc(promoRead, qty) ??
        { kind: "UNAVAILABLE" as const };
      pushItem(automatic, {
        key:        "PROMOTION",
        label:      "Promo",
        originName: meta.appliedPromotionName ?? null,
        baseLabel:  customerBaseLabel(promoRead.applyOns, "TOTAL"),
        amount:     promoUnit * qty,
        status:     "OK",
        calc,
      }, "negative");
    }

    const qtyUnit = meta.quantityDiscountAmount ?? 0;
    if (qtyUnit > 0) {
      const qtyRead = readAdjustments(meta, qty, new Set(["QUANTITY_DISCOUNT"]));
      const calc =
        buildCalcFromExplicitMeta(
          meta.quantityDiscountBase,
          meta.quantityDiscountValue,
          meta.quantityDiscountValueType,
          qty,
        ) ??
        buildCalc(qtyRead, qty) ??
        { kind: "UNAVAILABLE" as const };
      pushItem(automatic, {
        key:        "QUANTITY_DISCOUNT",
        label:      "Desc. por cantidad",
        originName: null,
        baseLabel:  customerBaseLabel(qtyRead.applyOns, "TOTAL"),
        amount:     qtyUnit * qty,
        status:     "OK",
        calc,
      }, "negative");
    }
  }

  // CLIENTE — fuente primaria `customerDiscountAmount` del motor (cubre
  // `applyOn=TOTAL`); fallback a adjustments por componente.
  //
  // Semántica unificada "manual reemplaza automático" (Bonificación):
  // cuando hay override manual (`hasManual === true`), el motor sustituye
  // los descuentos automáticos por el override del operador. Promo y
  // qty-discount ya están filtrados arriba con `if (!hasManual)`; el
  // cliente debe seguir la MISMA semántica → no se agrega al card cuando
  // hay manual. Sin este guard, el chip "Cliente: regla 15%" seguía
  // visible bajo "Ajustes aplicados" aunque el manual ya lo reemplazara
  // → mezcla visual auto + manual que confundía al operador.
  if (!hasManual) {
    const customer = buildCustomerItem(meta, qty);
    if (customer) {
      pushItem(automatic, customer.item, customer.signed);
    }
  }

  // ── AJUSTES MANUALES ──────────────────────────────────────────────────────

  if (hasManual) {
    const manualRead = readAdjustments(meta, qty, new Set(["MANUAL_DISCOUNT"]));
    let manualTotal     = manualRead.total;
    let manualApplyOns  = manualRead.applyOns;
    let manualCalc: LineDiscountCalculation | null = buildCalc(manualRead, qty);
    // T10 — Para SURCHARGE, el motor emite el adjustment MANUAL_DISCOUNT con
    // amount NEGATIVO (convención: positivo = reduce, negativo = aumenta).
    // El gate `> EPSILON` descartaba SURCHARGE manual ⇒ el card de detalle
    // no se montaba. Usamos `Math.abs` para detectar la presencia del ajuste
    // y guardamos el valor ABSOLUTO en `amount` (las sumas y los chips ya
    // tratan el monto como magnitud; el signo se conserva en `pushItem`
    // via `positive`/`negative`). Cero matemática nueva: el motor sigue
    // siendo única fuente de verdad del monto.
    if (Math.abs(manualTotal) <= EPSILON) {
      const qtyDU = meta.quantityDiscountAmount ?? 0;
      if (qtyDU > 0) {
        manualTotal    = qtyDU * qty;
        manualApplyOns = new Set();
        manualCalc     = { kind: "UNAVAILABLE" }; // fallback sin adjustments
      }
    }
    if (Math.abs(manualTotal) > EPSILON) {
      const isSurcharge = meta.manualDiscount?.kind === "SURCHARGE";
      const mdAppliesTo = meta.manualDiscount?.appliesTo ?? null;
      pushItem(manual, {
        key:        "MANUAL",
        label:      isSurcharge ? "Recargo manual" : "Bonificación manual",
        // T9 — sin texto técnico "override del operador (reemplaza promo
        // y desc. por cantidad)". El pill "Manual" del editor ya
        // comunica el origen.
        originName: null,
        baseLabel:  customerBaseLabel(manualApplyOns, mdAppliesTo ?? "TOTAL"),
        amount:     Math.abs(manualTotal),
        status:     "OK",
        calc:       manualCalc ?? { kind: "UNAVAILABLE" },
      }, isSurcharge ? "positive" : "negative");
    }
  }

  // Totales = Σ |amount| dentro de cada sub-grupo. UNDETAILED no aporta.
  const sumAmounts = (items: LineDiscountSourceItem[]) =>
    items.reduce((s, it) => s + (it.amount ?? 0), 0);
  automatic.bonificationTotal = sumAmounts(automatic.bonifications);
  automatic.surchargeTotal    = sumAmounts(automatic.surcharges);
  manual   .bonificationTotal = sumAmounts(manual.bonifications);
  manual   .surchargeTotal    = sumAmounts(manual.surcharges);

  return { automatic, manual };
}

/** True si el grupo está vacío. */
export function isEmptyLineGroup(g: LineDiscountItemGroup): boolean {
  return g.bonifications.length === 0 && g.surcharges.length === 0;
}

/**
 * Descuento EFECTIVO TOTAL de la línea (passthrough estricto). Es el monto
 * que el cliente NO pagó respecto del precio de lista bruto:
 *
 *   effective = max(0, basePrice × qty − subtotalNet)
 *
 * Misma definición que usa el TPNumber de Bonificación del editor — garantiza
 * que el card "Total automático/manual" y el TPNumber muestren SIEMPRE el
 * mismo número (sin divergencia visible al operador).
 *
 * Robusto contra inconsistencias per-unit/per-line en el shape per-step del
 * motor (ej. `ENTITY_COMMERCIAL_RULE` con `applyOn=TOTAL` aplica por LÍNEA,
 * pero los steps `QUANTITY_DISCOUNT`/`PROMOTION` aplican per-unit; sumar
 * `step.discountAmount × qty` uniformemente sub-cuenta el cliente). Tomar
 * `baseInitial − subtotalNet` evita esa ambigüedad porque mide el RESULTADO
 * que el motor aplicó, no los pasos intermedios.
 *
 * POLICY R6 — `meta.basePrice` y `subtotal` son ambos passthrough del motor;
 * el frontend solo los resta y clampa a 0.
 */
export function lineEffectiveDiscountTotal(line: LineLikeForDiscount): number {
  const qty = Number.isFinite(line.quantity) ? (line.quantity as number) : 0;
  if (qty <= 0) return 0;
  const basePrice = line.pricingMeta?.basePrice;
  const fallbackUnit = typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice)
    ? (line.unitPrice as number)
    : 0;
  const baseUnit = typeof basePrice === "number" && basePrice > 0
    ? basePrice
    : fallbackUnit;
  if (baseUnit <= 0) return 0;
  const baseInitial = baseUnit * qty;
  const subtotalNet = typeof line.subtotal === "number" && Number.isFinite(line.subtotal)
    ? (line.subtotal as number)
    : 0;
  return Math.max(0, baseInitial - subtotalNet);
}

/**
 * T10 — Magnitud del ajuste efectivo de la línea (positiva o negativa).
 *
 *   adjustment = baseInitial − subtotalNet
 *
 * Signo positivo = BONIFICACIÓN (precio baja). Signo negativo = RECARGO
 * (precio sube). Misma fórmula que `lineEffectiveDiscountTotal`, pero sin
 * clampear a 0 — necesario para que el card "Total manual / Total
 * automático" de `<SaleLineDiscountSummary>` detecte el caso SURCHARGE y
 * lo muestre con su signo y monto correctos (antes el clamp dejaba el card
 * con 0 y no se montaba para recargos).
 *
 * Passthrough estricto del motor (basePrice, subtotal) — POLICY R6.
 */
export function lineEffectiveAdjustmentSigned(line: LineLikeForDiscount): number {
  const qty = Number.isFinite(line.quantity) ? (line.quantity as number) : 0;
  if (qty <= 0) return 0;
  const basePrice = line.pricingMeta?.basePrice;
  const fallbackUnit = typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice)
    ? (line.unitPrice as number)
    : 0;
  const baseUnit = typeof basePrice === "number" && basePrice > 0
    ? basePrice
    : fallbackUnit;
  if (baseUnit <= 0) return 0;
  const baseInitial = baseUnit * qty;
  const subtotalNet = typeof line.subtotal === "number" && Number.isFinite(line.subtotal)
    ? (line.subtotal as number)
    : 0;
  return baseInitial - subtotalNet; // > 0 BONUS, < 0 SURCHARGE
}

// ─── Pipeline de cálculo en orden real del motor ───────────────────────────
//
// `buildLineDiscountPipeline` recorre `pricingMeta.pricingSteps` (que es el
// passthrough de `pricing.steps` del motor) y arma un timeline ordenado.
// REGLAS:
//   · NO ordena por monto ni por conveniencia UX.
//   · NO recalcula subtotales: cada `subtotalAfter` sale de `step.value × qty`,
//     y `step.value` es lo que el motor declaró como precio resultante.
//   · NO inventa el "Base inicial": sale del primer step ∈ {PRICE_LIST,
//     MANUAL_OVERRIDE, MANUAL_FALLBACK, MANUAL_PRICE_OVERRIDE} con `value`
//     no nulo.
//   · Si la línea no tiene `pricingSteps` (preview legacy), devuelve `null`
//     — el componente cae al modo agrupado anterior. POLICY R4.5.

/** Steps que sirven para calcular la BASE INICIAL del pipeline. El primero
 *  con `value != null` define la base inicial. Orden coincide con el orden
 *  del motor: list → manual override de artículo → fallback → override de
 *  precio en línea → precio del combo.
 *
 *  `COMBO_PRICE` va ÚLTIMO a propósito: un Combo Comercial no tiene
 *  `PRICE_LIST` (su precio canónico es `comboDerivedPrice`), así que su base
 *  del pipeline es el step `COMBO_PRICE` que el motor ya emite. Para líneas
 *  normales nunca se alcanza (matchea `PRICE_LIST`/`MANUAL_*` antes), por eso
 *  no las afecta. Passthrough puro: el valor sale del step del motor. */
const BASE_STEP_KEYS = [
  "PRICE_LIST",
  "MANUAL_OVERRIDE",
  "MANUAL_FALLBACK",
  "MANUAL_PRICE_OVERRIDE",
  "COMBO_PRICE",
] as const;

/** Steps que se renderizan como pasos del pipeline. El orden VIENE DEL MOTOR
 *  (no se reordena). */
const PIPELINE_STEP_KEYS = new Set([
  "QUANTITY_DISCOUNT",
  "PROMOTION",
  "ENTITY_COMMERCIAL_RULE",
  "MANUAL_DISCOUNT_OVERRIDE",
]);

export type LinePipelineGroup = "AUTOMATIC" | "MANUAL";

export type LinePipelineEntry = {
  /** Posición visible (1, 2, 3, ...). Refleja el orden del motor. */
  index:      number;
  key:        string;
  /** Etiqueta primaria — SIN `%`. */
  label:      string;
  /** Origen comercial al que pertenece. Coincide con `LineDiscountSourceKey`. */
  originKey:  LineDiscountSourceKey;
  /** Nombre/regla detallada que el motor expuso (ej. "Promo Verano",
   *  "regla del cliente: 15% sobre Total"). `null` cuando no aplica. */
  originName: string | null;
  /** Base de aplicación (Total/Metal/Hechura). `null` cuando no es claro. */
  baseLabel:  string | null;
  /** Base USADA por línea (= step.meta.discountBase × qty). */
  baseUsed:   number;
  /** Impacto monetario por línea (= step.meta.discountAmount × qty). Siempre
   *  positivo; el grupo dicta el signo. */
  impact:     number;
  /** Subtotal resultante post-step por línea (= step.value × qty). */
  subtotalAfter: number;
  /** Cálculo presentable (passthrough del motor). */
  calc:       LineDiscountCalculation | null;
  /** AUTOMATIC (motor) vs MANUAL (override del operador). */
  group:      LinePipelineGroup;
  /** Signo del paso: negativo (descuento/bonificación) o positivo (recargo). */
  signed:     "negative" | "positive";
  /** `true` cuando el motor marca la base como estimada (`discountBaseEstimated`). */
  baseEstimated: boolean;
};

export type LineDiscountPipeline = {
  /** Precio inicial por línea ANTES del primer descuento (= baseStep.value × qty).
   *  Cuando el motor no declaró ningún step de base, queda `null`. */
  baseInitial:     number | null;
  /** Pasos del pipeline en orden REAL del motor. */
  steps:           LinePipelineEntry[];
  /** Σ |impact| de los pasos AUTOMATIC. */
  automaticTotal:  number;
  /** Σ |impact| de los pasos MANUAL. */
  manualTotal:     number;
  /** Cantidad de la línea (para mostrar en la cabecera del pipeline). */
  quantity:        number;
};

/** Mapea un step.key a su origen canonical + label visible + originName. */
function describePipelineEntry(
  step:      LinePipelineStep,
  inherited: NonNullable<LineLikeForDiscount["pricingMeta"]>["inheritedDiscount"],
): {
  originKey:  LineDiscountSourceKey;
  label:      string;
  originName: string | null;
  baseLabel:  string | null;
  group:      LinePipelineGroup;
  signed:     "negative" | "positive";
} {
  const meta = step.meta ?? {};
  const applyOnLabel =
    meta.applyOn === "METAL"   ? "Metal"   :
    meta.applyOn === "HECHURA" ? "Hechura" :
    meta.applyOn === "TOTAL"   ? "Total"   : null;
  if (step.key === "QUANTITY_DISCOUNT") {
    return {
      originKey: "QUANTITY_DISCOUNT",
      label:     "Desc. por cantidad",
      originName: null,
      baseLabel: applyOnLabel,
      group:     "AUTOMATIC",
      signed:    "negative",
    };
  }
  if (step.key === "PROMOTION") {
    const promoName = meta.promoName ?? null;
    return {
      originKey: "PROMOTION",
      label:     "Promo",
      originName: promoName,
      baseLabel: applyOnLabel,
      group:     "AUTOMATIC",
      signed:    "negative",
    };
  }
  if (step.key === "ENTITY_COMMERCIAL_RULE") {
    const isSurcharge = meta.ruleType === "SURCHARGE";
    const ruleValue =
      typeof meta.value === "number" ? meta.value :
      typeof inherited?.value === "number" ? inherited.value : null;
    const valueType = meta.valueType ?? null;
    let originName: string | null = null;
    if (ruleValue != null && valueType === "PERCENTAGE") {
      originName = applyOnLabel
        ? `regla del cliente: ${ruleValue}% sobre ${applyOnLabel}`
        : `regla del cliente: ${ruleValue}%`;
    } else if (valueType === "FIXED_AMOUNT") {
      originName = "regla del cliente: monto fijo";
    }
    return {
      originKey: "CUSTOMER_RULE",
      label:     isSurcharge ? "Recargo cliente" : "Cliente",
      originName,
      baseLabel: applyOnLabel,
      group:     "AUTOMATIC",
      signed:    isSurcharge ? "positive" : "negative",
    };
  }
  if (step.key === "MANUAL_DISCOUNT_OVERRIDE") {
    const isSurcharge = meta.kind === "SURCHARGE";
    return {
      originKey: "MANUAL",
      // T9 — sin label técnico "override del operador (reemplaza promo
      // y desc. por cantidad)". El pill "Manual" del editor ya comunica
      // el origen al operador.
      label:     isSurcharge ? "Recargo manual" : "Bonificación manual",
      originName: null,
      baseLabel: applyOnLabel,
      group:     "MANUAL",
      signed:    isSurcharge ? "positive" : "negative",
    };
  }
  // Fallback: no debería llegar acá porque el motor solo emite los 4
  // anteriores en el subset whitelist. Defensivo.
  return {
    originKey: "QUANTITY_DISCOUNT",
    label:     step.label || step.key,
    originName: null,
    baseLabel: applyOnLabel,
    group:     "AUTOMATIC",
    signed:    "negative",
  };
}

/** Construye `calc` a partir de un step. Lee directo de `meta.value` +
 *  `meta.valueType/type` + `meta.discountBase` (todos del motor). */
function buildCalcFromStep(
  step: LinePipelineStep,
  qty:  number,
): LineDiscountCalculation | null {
  const m = step.meta ?? {};
  const value = typeof m.value === "number" ? m.value : null;
  // Algunos steps usan `valueType`, otros `type`, MANUAL usa `mode`.
  const vt: "PERCENTAGE" | "FIXED_AMOUNT" | null =
    m.valueType === "PERCENTAGE" || m.valueType === "FIXED_AMOUNT" ? m.valueType :
    m.type      === "PERCENTAGE" || m.type      === "FIXED_AMOUNT" ? m.type      :
    m.mode      === "PERCENT"                                       ? "PERCENTAGE" :
    m.mode      === "FIXED"                                         ? "FIXED_AMOUNT" :
    null;
  const baseUnit = typeof m.discountBase === "number" ? m.discountBase :
                   typeof m.surchargeBase === "number" ? m.surchargeBase : null;
  if (value == null || qty <= 0) return null;
  if (vt === "PERCENTAGE") {
    if (baseUnit == null) return null;
    return { kind: "PERCENT", baseUnit, qty, percent: value };
  }
  if (vt === "FIXED_AMOUNT") {
    return { kind: "FIXED", perUnit: value, qty };
  }
  return null;
}

/** Construye el pipeline en orden REAL del motor. Devuelve `null` cuando la
 *  línea no tiene `pricingSteps` (preview legacy) — el componente cae al
 *  modo agrupado anterior. */
export function buildLineDiscountPipeline(line: LineLikeForDiscount): LineDiscountPipeline | null {
  const meta = line.pricingMeta ?? null;
  const qty  = Number.isFinite(line.quantity) ? line.quantity : 0;
  if (!meta || qty <= 0) return null;
  const steps = meta.pricingSteps;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  // Base inicial — primer step de la base con value != null.
  let baseInitial: number | null = null;
  for (const key of BASE_STEP_KEYS) {
    const s = steps.find((x) => x.key === key && x.status !== "skipped" && x.value != null);
    if (s != null && s.value != null) { baseInitial = s.value * qty; break; }
  }

  // Pasos del pipeline — solo los whitelist y solo status="ok".
  const pipelineSteps: LinePipelineEntry[] = [];
  let runningIndex = 0;
  for (const s of steps) {
    if (!PIPELINE_STEP_KEYS.has(s.key)) continue;
    if (s.status !== "ok")              continue;
    const m = s.meta ?? {};
    const isSurchargeStep = m.ruleType === "SURCHARGE" || m.kind === "SURCHARGE";
    const baseUnit =
      typeof m.discountBase  === "number" ? m.discountBase  :
      typeof m.surchargeBase === "number" ? m.surchargeBase :
      null;
    const amountUnit =
      typeof m.discountAmount  === "number" ? m.discountAmount  :
      typeof m.surchargeAmount === "number" ? m.surchargeAmount :
      null;
    if (baseUnit == null || amountUnit == null) continue; // sin datos suficientes
    const baseUsed      = baseUnit  * qty;
    const impact        = amountUnit * qty;
    const subtotalAfter = (s.value ?? 0) * qty;
    runningIndex += 1;
    const desc = describePipelineEntry(s, meta.inheritedDiscount ?? null);
    pipelineSteps.push({
      index:         runningIndex,
      key:           s.key,
      label:         desc.label,
      originKey:     desc.originKey,
      originName:    desc.originName,
      baseLabel:     desc.baseLabel,
      baseUsed,
      impact,
      subtotalAfter,
      calc:          buildCalcFromStep(s, qty),
      group:         desc.group,
      signed:        desc.signed,
      baseEstimated: m.discountBaseEstimated === true || m.surchargeBaseEstimated === true,
    });
    // Override de seguridad: si es step de surcharge pero describePipelineEntry
    // no lo detectó (edge), usar isSurchargeStep como fallback de signed.
    void isSurchargeStep;
  }

  const automaticTotal = pipelineSteps
    .filter((e) => e.group === "AUTOMATIC")
    .reduce((s, e) => s + e.impact, 0);
  const manualTotal = pipelineSteps
    .filter((e) => e.group === "MANUAL")
    .reduce((s, e) => s + e.impact, 0);

  return { baseInitial, steps: pipelineSteps, automaticTotal, manualTotal, quantity: qty };
}
