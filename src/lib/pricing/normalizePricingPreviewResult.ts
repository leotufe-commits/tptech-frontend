// src/lib/pricing/normalizePricingPreviewResult.ts
// ============================================================================
// normalizePricingPreviewResult — convierte la respuesta cruda de los dos
// endpoints actuales del backend a un único `NormalizedPricingResult`.
//
// Endpoints soportados:
//   · ARTICLE_PRICING_PREVIEW → `articlesApi.getPricingPreview` (1 línea,
//     valores per-unit, channel/coupon también per-unit, sin documentTotals)
//   · SALES_PREVIEW           → `salesApi.preview` (N líneas con per-unit y
//     per-línea, documentTotals con todo per-doc)
//
// La normalización NO calcula plata: solo agrupa, parsea strings → number y
// escala canal/cupón/envío del simulador a "per-doc" (como hace hoy
// PricingCompare). Esto es necesario para que la UI consuma un único shape
// independientemente del endpoint origen.
//
// Cuando el backend en Fase 4 responda con un shape común, esta función
// devuelve casi 1:1 sin necesidad de escalar nada.
// ============================================================================

import type {
  PricingPreviewResult as ArticlePricingResult,
  TaxBreakdownItem,
  PricingAlert,
  PricingPolicyResult,
} from "../../services/articles";
import type {
  SalePreviewResult,
  SalePreviewLine,
} from "../../services/sales";

import type {
  NormalizedPricingResult,
  NormalizedPricingLine,
  NormalizedTaxBreakdownItem,
  NormalizedAppliedRounding,
  NormalizedChannelInfo,
  NormalizedCouponInfo,
  NormalizedShippingInfo,
  NormalizedPaymentInfo,
  // Fase 2.1
  NormalizedComposition,
  // F1.3 G4.1
  NormalizedCompositionItemBlock,
  // F1.3 G4.x #9-B
  NormalizedCompositionMetalItem,
  NormalizedCompositionHechuraItem,
  NormalizedPurchaseTaxItem,
  NormalizedClientCommercialRules,
  // Fase 2.1.b
  NormalizedPricingStep,
  NormalizedCheckoutStep,
  NormalizedMetalHechuraBreakdown,
  NormalizedComponentSaleBreakdown,
  NormalizedComponentSaleAdjustment,
  NormalizedComponentSaleDetail,
  NormalizedCostOverrideContext,
  NormalizedStackingMode,
  // Paso 6
  NormalizedCostComponent,
} from "./contract";
import { isPricingStrictV1Enabled } from "../featureFlags";

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function asNum(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asNumOr(v: string | number | null | undefined, fallback: number): number {
  return asNum(v) ?? fallback;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composition / cost / commercial rules — mapeos comunes (Fase 2.1)
// ─────────────────────────────────────────────────────────────────────────────

/** Mapea el `composition` raw (mismo shape en articles y sales tras Fase 2A.7)
 *  al shape normalizado. Devuelve `null` si el raw no trae el bloque (ej.
 *  endpoint que aún no lo expone para esa línea).
 *
 *  Sprint 2 / POLICY.md §4 R4.1 — `pureGramsBase` y `pureGramsSale` son
 *  passthrough del backend. Antes el frontend los reconstruía como
 *    pureGramsBase = appliedGrams × purity × (1 + merma%/100)
 *    pureGramsSale = pureGramsBase × (1 + metalMarginPct/100)
 *  pero eso violaba la regla de "lector puro": cualquier cambio de fórmula
 *  en el motor producía divergencia silenciosa. Sprint 1 agregó los campos
 *  al snapshot del backend (hoy `null` hasta que el motor propague purity).
 *  Si el backend devuelve `null`, la UI muestra "—" según POLICY.md R4.4. */
function normalizeComposition(
  raw: any,
  _metalMarginPct?: number | null,  // legacy: se mantiene la firma para call sites; no se usa
): NormalizedComposition | null {
  if (!raw) return null;
  const pureGramsBase = raw.metal?.pureGramsBase ?? null;
  const pureGramsSale = raw.metal?.pureGramsSale ?? null;

  // F1.3 G4.x #9-B — normalize legacy alias `metal`/`hechura` (objetos
  // únicos del shape v3/v4) primero. Lo usamos tanto para el campo
  // `metal`/`hechura` (mantener back-compat) como para el fallback
  // de `metals`/`hechuras` cuando el backend no emitió arrays.
  const metalLegacy: NormalizedComposition["metal"] = raw.metal
    ? {
          originalGrams:     raw.metal.originalGrams     ?? null,
          appliedGrams:      raw.metal.appliedGrams      ?? null,
          gramsManual:       Boolean(raw.metal.gramsManual),
          originalMermaPct:  raw.metal.originalMermaPct  ?? null,
          appliedMermaPct:   raw.metal.appliedMermaPct   ?? null,
          mermaManual:       Boolean(raw.metal.mermaManual),
          originalVariantId: raw.metal.originalVariantId ?? null,
          appliedVariantId:  raw.metal.appliedVariantId  ?? null,
          variantManual:     Boolean(raw.metal.variantManual),
          purity:            raw.metal.purity            ?? null,
          purityLabel:       raw.metal.purityLabel       ?? null,
          metalName:         raw.metal.metalName         ?? null,
          pureGramsBase,
          pureGramsSale,
        }
    : null;
  const hechuraLegacy: NormalizedComposition["hechura"] = raw.hechura
    ? {
        originalAmount: raw.hechura.originalAmount ?? null,
        appliedAmount:  raw.hechura.appliedAmount  ?? null,
        manual:         Boolean(raw.hechura.manual),
        appliesTo:      raw.hechura.appliesTo      ?? null,
      }
    : null;

  return {
    metal:   metalLegacy,
    hechura: hechuraLegacy,
    // F1.3 G4.x #9-B — metals/hechuras siempre arrays (nunca undefined).
    // Si backend NO emite arrays (snapshot v4/v3), fallback al alias
    // legacy: 1-item array desde metal/hechura, o [] si no hay nada.
    // Cuando backend SÍ emite arrays (v5+), se respetan tal cual.
    metals:   normalizeCompositionMetals(raw.metals, raw.metal),
    hechuras: normalizeCompositionHechuras(raw.hechuras, raw.hechura),
    // F1.3 G4.1 — products/services con default `[]` para retrocompat
    // snapshots v3 que no traen el campo. Passthrough puro: cero recálculo
    // monetario y cero heurística sobre `lineAdjAmount`.
    products: normalizeCompositionItems(raw.products),
    services: normalizeCompositionItems(raw.services),
    taxes: Array.isArray(raw.taxes)
      ? raw.taxes.map((t: any) => ({
          id:        String(t?.id ?? ""),
          name:      String(t?.name ?? "Impuesto"),
          code:      String(t?.code ?? ""),
          rate:      t?.rate != null ? Number(t.rate) : null,
          appliesTo: String(t?.appliesTo ?? ""),
          taxAmount: Number(t?.taxAmount ?? 0),
          manual:    Boolean(t?.manual),
        }))
      : [],
  };
}

/**
 * F1.3 G4.x #9-B — normaliza `composition.metals[]` raw con fallback legacy.
 *
 * Reglas de retrocompat:
 *   · Backend v5+ emite `raw.metals` array → se normaliza item a item.
 *   · Backend v4/v3 NO emite `metals` pero SÍ tiene `raw.metal` (alias) →
 *     genera `[normalize(metal)]` (1-item array desde el legacy).
 *   · Sin metals ni metal → `[]`.
 *
 * Reader-only: cero recálculo monetario. Si `lineCost` no viene del backend,
 * cae a 0 (tipo `number`, no null — el tipo lo permite mediante `Number(... ?? 0)`).
 * `appliedGrams`/`appliedMermaPct`: null cuando no son finitos (defensa).
 */
function normalizeCompositionMetals(
  raw: any,
  legacyMetal: any,
): NormalizedCompositionMetalItem[] {
  if (Array.isArray(raw)) {
    return raw.map((it: any): NormalizedCompositionMetalItem => ({
      costLineId:      it?.costLineId      ?? null,
      metalVariantId:  it?.metalVariantId  ?? null,
      metalName:       it?.metalName       ?? null,
      purity:          it?.purity          != null ? Number(it.purity)          : null,
      purityLabel:     it?.purityLabel     ?? null,
      appliedGrams:    it?.appliedGrams    != null && Number.isFinite(Number(it.appliedGrams))
                         ? Number(it.appliedGrams) : null,
      appliedMermaPct: it?.appliedMermaPct != null && Number.isFinite(Number(it.appliedMermaPct))
                         ? Number(it.appliedMermaPct) : null,
      lineCost:        it?.lineCost        != null && Number.isFinite(Number(it.lineCost))
                         ? Number(it.lineCost) : null,
    }));
  }
  // Fallback legacy — backend pre-v5 sin metals, pero con `metal` único.
  // Construir array de 1 item desde el legacy para que la UI tenga shape
  // unificado.
  if (legacyMetal) {
    return [{
      costLineId:      null,                                  // no disponible en legacy
      metalVariantId:  legacyMetal.appliedVariantId ?? legacyMetal.originalVariantId ?? null,
      metalName:       legacyMetal.metalName        ?? null,
      purity:          legacyMetal.purity           ?? null,
      purityLabel:     legacyMetal.purityLabel      ?? null,
      appliedGrams:    legacyMetal.appliedGrams     ?? null,
      appliedMermaPct: legacyMetal.appliedMermaPct  ?? null,
      lineCost:        null,                                  // no expuesto en legacy
    }];
  }
  return [];
}

/**
 * F1.3 G4.x #9-B — normaliza `composition.hechuras[]` raw con fallback
 * legacy desde `composition.hechura`. Mismo patrón que metals.
 */
function normalizeCompositionHechuras(
  raw: any,
  legacyHechura: any,
): NormalizedCompositionHechuraItem[] {
  if (Array.isArray(raw)) {
    return raw.map((it: any): NormalizedCompositionHechuraItem => ({
      costLineId:    it?.costLineId    ?? null,
      appliedAmount: it?.appliedAmount != null && Number.isFinite(Number(it.appliedAmount))
                       ? Number(it.appliedAmount) : null,
      lineCost:      it?.lineCost      != null && Number.isFinite(Number(it.lineCost))
                       ? Number(it.lineCost) : null,
      lineLabel:     it?.lineLabel     ?? null,
    }));
  }
  if (legacyHechura) {
    return [{
      costLineId:    null,
      appliedAmount: legacyHechura.appliedAmount ?? null,
      lineCost:      null,
      lineLabel:     null,
    }];
  }
  return [];
}

/**
 * F1.3 G4.1 — mapea `composition.products[]` o `composition.services[]` raw
 * al shape normalizado. Defaults seguros: array `[]` cuando el raw no es
 * iterable; cada campo numérico cae a `0` si el backend no lo emite, y los
 * opcionales discriminados (`lineAdjKind` / `lineAdjType`) caen a `null`.
 *
 * Reglas:
 *   · Cero matemática derivada. `totalValue` viene del backend tal cual.
 *   · `lineAdjAmount` ausente → `null` (la UI muestra "—").
 *   · `affectsStock` desconocido → `null` (no se asume `false`).
 */
function normalizeCompositionItems(raw: any): NormalizedCompositionItemBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it: any): NormalizedCompositionItemBlock => {
    const adjKindRaw = it?.lineAdjKind;
    const adjTypeRaw = it?.lineAdjType;
    return {
      costLineId:      it?.costLineId      ?? null,
      catalogItemId:   it?.catalogItemId   ?? null,
      catalogItemCode: it?.catalogItemCode ?? null,
      catalogItemName: it?.catalogItemName ?? null,
      quantity:        Number(it?.quantity   ?? 0),
      unitValue:       Number(it?.unitValue  ?? 0),
      totalValue:      Number(it?.totalValue ?? 0),
      currencyId:      it?.currencyId ?? null,
      lineAdjKind:     adjKindRaw === "BONUS" || adjKindRaw === "SURCHARGE"
                         ? adjKindRaw : null,
      lineAdjType:     adjTypeRaw === "PERCENTAGE" || adjTypeRaw === "FIXED_AMOUNT"
                         ? adjTypeRaw : null,
      lineAdjValue:    it?.lineAdjValue  != null ? Number(it.lineAdjValue)  : null,
      lineAdjAmount:   it?.lineAdjAmount != null ? Number(it.lineAdjAmount) : null,
      affectsStock:    typeof it?.affectsStock === "boolean" ? it.affectsStock : null,
    };
  });
}

/** Mapea el array de `costTaxBreakdown` (impuestos de COMPRA). */
function normalizeCostTaxBreakdown(raw: any): NormalizedPurchaseTaxItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((t: any) => ({
    taxId:           String(t?.taxId ?? ""),
    name:            String(t?.name  ?? "Impuesto"),
    calculationType: String(t?.calculationType ?? ""),
    rate:            t?.rate != null ? Number(t.rate) : null,
    fixedAmount:     t?.fixedAmount != null ? Number(t.fixedAmount) : null,
    taxAmount:       Number(t?.taxAmount ?? 0),
  }));
}

function normalizeClientCommercialRules(raw: any): NormalizedClientCommercialRules | null {
  if (!raw) return null;
  return {
    ruleType:  raw.ruleType  ?? null,
    valueType: raw.valueType ?? null,
    value:     raw.value != null ? Number(raw.value) : null,
    applyOn:   raw.applyOn   ?? null,
  };
}

// ── Fase 2.1.b ──────────────────────────────────────────────────────────────

function normalizeSteps(raw: any): NormalizedPricingStep[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((s: any) => ({
    key:     String(s?.key ?? ""),
    label:   String(s?.label ?? ""),
    status:  (s?.status ?? "skipped") as NormalizedPricingStep["status"],
    value:   s?.value ?? null,
    message: s?.message,
    meta:    s?.meta,
  }));
}

function normalizeCheckoutSteps(raw: any): NormalizedCheckoutStep[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((s: any) => ({
    code:         String(s?.code ?? ""),
    label:        String(s?.label ?? ""),
    formula:      String(s?.formula ?? ""),
    amount:       Number(s?.amount ?? 0),
    currencyCode: String(s?.currencyCode ?? ""),
  }));
}

function normalizeMetalHechuraBreakdown(raw: any): NormalizedMetalHechuraBreakdown | null {
  if (!raw) return null;
  return {
    metalCost:         Number(raw.metalCost        ?? 0),
    metalSale:         Number(raw.metalSale        ?? 0),
    metalMarginPct:    Number(raw.metalMarginPct   ?? 0),
    hechuraCost:       Number(raw.hechuraCost      ?? 0),
    hechuraSale:       Number(raw.hechuraSale      ?? 0),
    hechuraMarginPct:  Number(raw.hechuraMarginPct ?? 0),
    metalGramsBase:    raw.metalGramsBase    != null ? Number(raw.metalGramsBase)    : null,
    metalGramsSale:    raw.metalGramsSale    != null ? Number(raw.metalGramsSale)    : null,
    metalPricePerGram: raw.metalPricePerGram != null ? Number(raw.metalPricePerGram) : null,
    // FASE 1 — passthrough de los nuevos campos del backend.
    metalSaleEstimated:   raw.metalSaleEstimated   != null ? Boolean(raw.metalSaleEstimated)   : undefined,
    hechuraSaleEstimated: raw.hechuraSaleEstimated != null ? Boolean(raw.hechuraSaleEstimated) : undefined,
    source:               raw.source ?? undefined,
  };
}

/**
 * Passthrough puro: preserva TODOS los adjustments sin filtrar por `kind`
 * ni reordenar. Solo casteamos `base`/`final`/`amount` a Number para
 * defenderse de strings (multimoneda en algunos paths) y conservamos
 * `applyOn` y `kind` como vienen del backend.
 *
 * Reglas:
 *   - NO filtrar adjustments por kind.
 *   - NO descartar entries.
 *   - NO recalcular ni inferir valores.
 *   - Si `c.adjustments` no es array, dejamos `[]`.
 */
function normalizeComponentSaleBreakdown(raw: any): NormalizedComponentSaleDetail | null {
  if (!raw || !raw.metal || !raw.hechura) return null;
  const normComp = (c: any): NormalizedComponentSaleBreakdown => ({
    base:  Number(c.base  ?? 0),
    final: Number(c.final ?? 0),
    // F1.3 G4.3 — passthrough puro. Snapshots viejos sin el campo → null
    // (la UI lee `pre != null && pre !== final` para decidir si renderea
    // la fila "Pre-bonif."). Cero recálculo: el motor backend es la única
    // fuente. Si llegara un valor no numérico (raw inesperado) cae a null.
    salePreManualDiscount:
      c.salePreManualDiscount != null && Number.isFinite(Number(c.salePreManualDiscount))
        ? Number(c.salePreManualDiscount)
        : null,
    adjustments: Array.isArray(c.adjustments)
      ? c.adjustments.map((a: any): NormalizedComponentSaleAdjustment => ({
          ...a,
          // Solo casteo defensivo. `kind`, `label`, `applyOn` quedan como
          // los manda el backend (passthrough); `amount` se asegura Number.
          amount: Number(a.amount ?? 0),
        }))
      : [],
  });
  return { metal: normComp(raw.metal), hechura: normComp(raw.hechura) };
}

function normalizeCostOverrideContext(raw: any): NormalizedCostOverrideContext | null {
  if (!raw) return null;
  const pickEntry = (e: any) => e
    ? { original: e.original ?? null, applied: e.applied ?? null, manual: !!e.manual }
    : undefined;
  const out: NormalizedCostOverrideContext = {
    grams:        pickEntry(raw.grams),
    mermaPercent: pickEntry(raw.mermaPercent),
    hechura:      pickEntry(raw.hechura),
    metalVariant: raw.metalVariant
      ? {
          originalId: raw.metalVariant.originalId ?? null,
          appliedId:  raw.metalVariant.appliedId  ?? null,
          manual:     !!raw.metalVariant.manual,
        }
      : undefined,
  };
  // Si todas las claves quedaron undefined, devolver null (caller hace `?? null`).
  return out;
}

/** Extrae los componentes PRODUCT/SERVICE desde `steps[]` raw. Acepta steps
 *  ya normalizados (`NormalizedPricingStep`) o el array crudo del backend
 *  (mismo shape modulo tipos). NO calcula nada: solo filtra y mapea.
 *
 *  El motor (pricing-engine.cost.ts) emite un step con `key = COST_LINES_${type}`
 *  por cada línea de la composición de costo. Los `meta.qty`, `meta.unitValue`,
 *  `meta.lineLabel`, `meta.lineCode` y `meta.lineAdj*` vienen serializados
 *  como string Decimal — los pasamos a number defensivamente. */
function extractCostComponents(
  steps: any[] | undefined | null,
  componentType: "PRODUCT" | "SERVICE",
): NormalizedCostComponent[] {
  if (!Array.isArray(steps)) return [];
  const targetKey = `COST_LINES_${componentType}`;
  return steps
    .filter(s => s && s.key === targetKey && s.status === "ok" && s.value != null)
    .map((s: any): NormalizedCostComponent => {
      const meta = s.meta ?? {};
      const qtyNum       = asNum(meta.qty);
      const unitValueNum = asNum(meta.unitValue);
      const valueNum     = asNum(s.value) ?? 0;
      const lineLabel    = typeof meta.lineLabel === "string" && meta.lineLabel.length > 0
        ? meta.lineLabel : null;
      const fallbackLabel = typeof s.label === "string" && s.label.length > 0
        ? s.label : null;
      const lineCode = typeof meta.lineCode === "string" && meta.lineCode.length > 0
        ? meta.lineCode : null;
      const hasAdj = meta.lineAdjKind != null && meta.lineAdjKind !== "";
      const adjustment = hasAdj
        ? {
            kind:  String(meta.lineAdjKind),
            type:  String(meta.lineAdjType ?? ""),
            value: asNum(meta.lineAdjValue) ?? 0,
          }
        : null;
      return {
        value:     valueNum,
        quantity:  qtyNum,
        unitValue: unitValueNum,
        label:     lineLabel ?? fallbackLabel,
        code:      lineCode,
        adjustment,
      };
    });
}

function normalizeStackingMode(raw: any): NormalizedStackingMode | undefined {
  if (raw === "CHAINED" || raw === "BEST_OF_QD" || raw === "BEST_OF_PROMO" || raw === "NONE") {
    return raw;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tax breakdown — mapeo común
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTaxBreakdown(
  items: TaxBreakdownItem[] | any[] | undefined | null,
): NormalizedTaxBreakdownItem[] {
  if (!items?.length) return [];
  return items.map((tb: any) => ({
    taxId:        String(tb?.taxId ?? ""),
    name:         String(tb?.name  ?? "Impuesto"),
    code:         tb?.code ? String(tb.code) : undefined,
    rate:         tb?.rate != null ? Number(tb.rate) : null,
    fixedAmount:  tb?.fixedAmount != null ? Number(tb.fixedAmount) : null,
    baseAmount:   Number(tb?.base ?? tb?.baseAmount ?? 0),
    taxAmount:    Number(tb?.taxAmount ?? 0),
    applyOn:      tb?.applyOn ? String(tb.applyOn) : undefined,
    overridden:   Boolean(tb?.applyOnOverriddenByEntity ?? tb?.overridden ?? false),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLE_PRICING_PREVIEW → Normalized
// ─────────────────────────────────────────────────────────────────────────────

export type NormalizeArticleArgs = {
  /** Respuesta cruda del endpoint. */
  result:    ArticlePricingResult;
  /** Inputs de la línea: necesarios para conocer articleId/variantId/qty,
   *  que el endpoint no devuelve en la respuesta. */
  articleId: string;
  variantId?: string | null;
  quantity:  number;
};

export function normalizeArticlePricingPreview(
  args: NormalizeArticleArgs,
): NormalizedPricingResult {
  const { result, articleId, variantId, quantity } = args;
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

  // ===========================================================================
  // FASE 1.2 paso 2 (+ G3.1 + G3.2) — passthrough completo del simulador
  // bajo flag tptech_pricing_strict_v1=ON.
  //
  // Política:
  //   · Flag OFF (default): legacy idéntico — escalación local con r2().
  //   · Flag ON: lee top-level del backend:
  //       G3   (commit 539c437): lineTotal / lineTaxAmount / lineTotalWithTax
  //       G3.1 (commit c6c4f0e): lineDiscount
  //       G3.2 (este commit):    channel.amount = documentTotals
  //                              .channelAdjustmentAmount;
  //                              coupon.amount = documentTotals
  //                              .couponDiscountAmount.
  //     Si algún campo no viene (backend legacy desplegado), cae a legacy.
  //
  // Justificación POLICY:
  //   · POLICY.md §4 R4.5 — los normalizadores transforman shape, no valores.
  //   · POLICY.md §1 R1.4 — frontend no calcula plata; backend es fuente.
  //
  // Frontend desbloqueado:
  //   · Priority 1 — normalizeArticlePricingPreview es 100% reader-only en
  //     strict mode para todos los campos comerciales (4 totales per-línea
  //     + canal + cupón). Cero cálculos monetarios bajo flag ON. La
  //     migración del simulador queda completa.
  //
  // Cálculos restantes en este normalizer bajo flag ON (NO comerciales):
  //   · `qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1`
  //     — sanitización de input no monetario.
  //   · Mapeos de tipos (asNum / asNumOr / Number) sobre campos NO escalados.
  // ===========================================================================
  const useStrict = isPricingStrictV1Enabled();

  // Per-unit del simulador
  const basePrice    = asNum(result.basePrice);
  const unitPrice    = asNum(result.unitPrice);
  const unitTax      = asNumOr(result.taxAmount, 0);
  const unitTotalTax = asNum(result.totalWithTax);
  const qtyDiscUnit  = asNumOr(result.quantityDiscountAmount,  0);
  const promoDiscU   = asNumOr(result.promotionDiscountAmount, 0);

  // documentTotals del backend — fuente única de los agregados doc-level
  // bajo flag ON. Bajo OFF se usa solo más abajo en el bloque documentTotals.
  const dt = result.documentTotals;

  // Canal y cupón en el simulador vienen PER UNIT en channelResult /
  // couponResult, pero documentTotals los emite per-doc (G3.2).
  // Bajo flag ON: passthrough de doc-level. Bajo OFF: legacy (r2 escalado).
  const channelPerUnit = result.channelResult?.channelAmount ?? 0;
  const couponApplied  = !!result.couponResult?.applied;
  const couponPerUnit  = couponApplied ? (result.couponResult?.discountAmount ?? 0) : 0;
  const channelDoc     = useStrict && dt?.channelAdjustmentAmount != null
    ? Number(dt.channelAdjustmentAmount)
    : r2(channelPerUnit * qty);
  const couponDoc      = useStrict && dt?.couponDiscountAmount != null
    ? Number(dt.couponDiscountAmount)
    : r2(couponPerUnit * qty);

  // Per-line totals — G3 + G3.1 ya migrados.
  const lineTotalRes: number | null = useStrict && result.lineTotal != null
    ? result.lineTotal
    : (unitPrice != null ? r2(unitPrice * qty) : null);
  const lineTaxAmountRes: number = useStrict && result.lineTaxAmount != null
    ? result.lineTaxAmount
    : r2(unitTax * qty);
  const lineTotalWithTaxRes: number | null = useStrict && result.lineTotalWithTax != null
    ? result.lineTotalWithTax
    : (unitTotalTax != null ? r2(unitTotalTax * qty) : null);
  const lineDiscountRes: number = useStrict && result.lineDiscount != null
    ? result.lineDiscount
    : (basePrice != null && unitPrice != null
        ? r2((basePrice - unitPrice) * qty)
        : 0);

  const line: NormalizedPricingLine = {
    articleId,
    variantId: variantId ?? null,
    quantity:  qty,

    basePrice,
    unitPrice,
    unitTaxAmount:    unitTax,
    unitTotalWithTax: unitTotalTax,

    quantityDiscountAmount:  qtyDiscUnit,
    promotionDiscountAmount: promoDiscU,

    lineTotal:        lineTotalRes,
    lineTaxAmount:    lineTaxAmountRes,
    lineTotalWithTax: lineTotalWithTaxRes,
    lineDiscount:     lineDiscountRes,

    priceSource:          result.priceSource ?? "NONE",
    appliedPriceListId:   result.appliedPriceListId   ?? null,
    appliedPriceListName: result.appliedPriceListName ?? null,
    appliedPriceListMode: (result as any).appliedPriceListMode ?? null,
    appliedPromotionId:   result.appliedPromotionId   ?? null,
    appliedPromotionName: result.appliedPromotionName ?? null,
    appliedDiscountId:    result.appliedDiscountId    ?? null,

    unitCost:      asNum(result.unitCost),
    unitMargin:    asNum(result.unitMargin),
    marginPercent: asNum(result.marginPercent),
    costMode:      result.costMode ?? "NONE",
    costPartial:   Boolean(result.costPartial),

    taxBreakdown:    normalizeTaxBreakdown(result.taxBreakdown),
    appliedRounding: normalizeAppliedRounding(result.appliedRounding),

    partial:           Boolean(result.partial),
    taxExemptByEntity: result.taxExemptByEntity,

    // Fase 2.1 — composition + cost (articles los expone desde siempre).
    composition:         normalizeComposition(
      (result as any).composition,
      result.metalHechuraBreakdown?.metalMarginPct,
    ),
    appliedMermaPercent: (result as any).composition?.metal?.appliedMermaPct ?? null,
    costBase:            asNum(result.costBase),
    costTaxAmount:       asNum(result.costTaxAmount),
    costWithTax:         asNum(result.costWithTax),
    costTaxBreakdown:    normalizeCostTaxBreakdown(result.costTaxBreakdown),

    // Fase 2.1.b — articles result-level → línea[0] (Simulador siempre 1 línea).
    metalHechuraBreakdown:  normalizeMetalHechuraBreakdown(result.metalHechuraBreakdown),
    componentSaleBreakdown: normalizeComponentSaleBreakdown((result as any).componentSaleBreakdown),
    costOverrideContext:    normalizeCostOverrideContext(result.costOverrideContext),

    // Paso 6 — componentes PRODUCT/SERVICE desde steps[] raw del motor.
    // articles/pricing-preview expone `result.steps` a nivel raíz (1 línea).
    products: extractCostComponents(result.steps, "PRODUCT"),
    services: extractCostComponents(result.steps, "SERVICE"),
  };

  // ── Totales del documento ──────────────────────────────────────────────
  // El backend del Simulador (`articles.controller.getPricingPreview`)
  // SIEMPRE devuelve `documentTotals` calculados por el mismo motor que
  // `salesApi.preview` (`computeSaleDocumentTotals`). El frontend hace
  // passthrough puro: cero matemática comercial acá.
  //
  // Si el campo no viniera (caso anómalo: backend desplegado fuera de fase),
  // devolvemos un objeto con todos los valores en 0 — la UI lo trata como
  // "sin totales" y NO inventamos números derivados, manteniendo la regla
  // del proyecto "el motor es la única fuente de verdad".
  // (`dt` se declaró arriba — reutilizado acá; G3.2.)
  const documentTotals: NormalizedPricingResult["documentTotals"] = {
    subtotalBeforeDiscounts:    Number(dt?.subtotalBeforeDiscounts    ?? 0),
    lineDiscountAmount:         Number(dt?.lineDiscountAmount         ?? 0),
    subtotalAfterLineDiscounts: Number(dt?.subtotalAfterLineDiscounts ?? 0),
    channelAdjustmentAmount:    Number(dt?.channelAdjustmentAmount    ?? 0),
    couponDiscountAmount:       Number(dt?.couponDiscountAmount       ?? 0),
    paymentAdjustmentAmount:    Number(dt?.paymentAdjustmentAmount    ?? 0),
    shippingAmount:             Number(dt?.shippingAmount             ?? 0),
    globalDiscountAmount:       Number(dt?.globalDiscountAmount       ?? 0),
    taxableBase:                Number(dt?.taxableBase                ?? 0),
    taxAmount:                  Number(dt?.taxAmount                  ?? 0),
    roundingAdjustment:         Number(dt?.roundingAdjustment         ?? 0),
    totalBeforeTax:             Number(dt?.totalBeforeTax             ?? 0),
    totalWithTax:               Number(dt?.totalWithTax               ?? 0),
    total:                      Number(dt?.total                      ?? 0),
    // FASE 2 — passthrough de los agregados Metal/Hechura.
    metalCostSubtotal:    dt && (dt as any).metalCostSubtotal    != null ? Number((dt as any).metalCostSubtotal)    : undefined,
    hechuraCostSubtotal:  dt && (dt as any).hechuraCostSubtotal  != null ? Number((dt as any).hechuraCostSubtotal)  : undefined,
    metalSaleSubtotal:    dt && (dt as any).metalSaleSubtotal    != null ? Number((dt as any).metalSaleSubtotal)    : undefined,
    hechuraSaleSubtotal:  dt && (dt as any).hechuraSaleSubtotal  != null ? Number((dt as any).hechuraSaleSubtotal)  : undefined,
    breakdownEstimated:   dt && (dt as any).breakdownEstimated   != null ? Boolean((dt as any).breakdownEstimated)  : undefined,
  };

  return {
    source:  "ARTICLE_PRICING_PREVIEW",
    lines:   [line],
    channel: result.channelResult
      ? {
          channelId:   result.channelResult.channelId   ?? null,
          channelName: result.channelResult.channelName ?? null,
          amount:      channelDoc,
        }
      : null,
    coupon: result.couponResult
      ? {
          couponCode:     result.couponResult.couponCode ?? null,
          couponName:     result.couponResult.couponName ?? null,
          amount:         couponDoc,
          applied:        couponApplied,
          rejectedReason: !couponApplied ? "Cupón rechazado por el motor" : undefined,
        }
      : null,
    payment: normalizePaymentFromArticle(result, qty),
    shipping: result.shippingResult
      ? {
          mode:   result.shippingResult.mode,
          amount: result.shippingResult.amount,
          label:  result.shippingResult.label,
        }
      : null,
    documentTotals,
    // `roundingInfo` consolidado: si el backend ya lo expone en
    // `documentTotals.roundingInfo`, lo usamos directo. Si no (response
    // legacy), caemos a la derivación desde `line.appliedRounding`.
    roundingInfo: dt?.roundingInfo
      ? {
          source:        dt.roundingInfo.source as "PRICE_LIST" | "TENANT_POLICY",
          priceListId:   dt.roundingInfo.priceListId,
          priceListName: dt.roundingInfo.priceListName,
          applyOn:       dt.roundingInfo.applyOn,
          mode:          dt.roundingInfo.mode,
          direction:     dt.roundingInfo.direction,
        }
      : line.appliedRounding
        ? {
            source:        line.appliedRounding.source as "PRICE_LIST" | "TENANT_POLICY",
            priceListId:   line.appliedRounding.priceListId,
            priceListName: line.appliedRounding.priceListName,
            applyOn:       line.appliedRounding.applyOn,
            mode:          line.appliedRounding.mode,
            direction:     line.appliedRounding.direction,
          }
        : null,
    // Articles preview no expone política de redondeo a nivel comprobante
    // (es per-artículo). Para Simulador siempre null.
    documentRoundingApplied: null,
    policy: normalizePolicy(result.policy),
    alerts: normalizeAlerts(result.alerts),

    // Fase 2.1 — info doc-level. articles hoy SOLO expone
    // appliedPriceListId/Name a nivel línea. Eco de los campos del cliente y
    // del flag de override quedan undefined hasta Fase 2A.8 (extender
    // articles/pricing-preview con clientBalanceType y reglas comerciales).
    clientBalanceType:      null,
    clientCommercialRules:  null,
    requestedPriceListId:   null,
    appliedPriceListId:     line.appliedPriceListId,
    appliedPriceListName:   line.appliedPriceListName,
    // priceListWasOverridden queda undefined a propósito.

    // Fase 2.1.b — pasos del motor + modo de stacking (articles los expone).
    steps:        normalizeSteps(result.steps),
    stackingMode: normalizeStackingMode(result.stackingMode),
  };
}

function normalizePaymentFromArticle(result: ArticlePricingResult, _qty: number): NormalizedPaymentInfo | null {
  const co = result.checkoutResult;
  if (!co) return null;
  // checkoutResult del Simulador YA viene PER-DOC desde `articles.controller`,
  // que invoca `getCheckoutPreview(jewelryId, commercialAmount * quantity, …)`.
  // No multiplicar acá — daba × qty² y rompía la fila "Forma de pago" del
  // Comparador para qty>1.
  return {
    paymentMethodId:         null,
    paymentMethodName:       null,
    installments:            co.installments,
    installmentAmount:       co.installmentAmount,
    baseAmount:              Number(co.baseAmount ?? 0),
    paymentAdjustment:       Number(co.paymentAdjustment ?? 0),
    finalAmountAfterPayment: Number(co.finalAmount ?? 0),
    // Fase 2.1.b — pasos del checkout (fórmula del recargo).
    steps:                   normalizeCheckoutSteps(co.steps),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SALES_PREVIEW → Normalized
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeSalesPreview(result: SalePreviewResult): NormalizedPricingResult {
  const lines = (result.lines ?? []).map(normalizeSalesLine);
  const dt    = result.documentTotals;

  const channel: NormalizedChannelInfo | null = result.channelResult
    ? {
        channelId:   result.channelResult.channelId   ?? null,
        channelName: result.channelResult.channelName ?? null,
        amount:      Number(dt?.channelAdjustmentAmount ?? result.channelResult.channelAmount ?? 0),
      }
    : null;

  const coupon: NormalizedCouponInfo | null = result.couponResult
    ? {
        couponId:       result.couponResult.couponId   ?? null,
        couponCode:     result.couponResult.couponCode ?? null,
        couponName:     result.couponResult.couponName ?? null,
        amount:         Number(dt?.couponDiscountAmount ?? result.couponResult.discountAmount ?? 0),
        applied:        Boolean(result.couponResult.applied),
        rejectedReason: result.couponResult.applied ? undefined : (result.couponResult.reason ?? "Cupón rechazado"),
      }
    : null;

  const payment: NormalizedPaymentInfo | null = result.checkoutResult
    ? {
        paymentMethodId:         null,
        paymentMethodName:       null,
        installments:            result.checkoutResult.installments,
        installmentAmount:       result.checkoutResult.installmentAmount,
        baseAmount:              Number(result.checkoutResult.baseAmount ?? 0),
        paymentAdjustment:       Number(dt?.paymentAdjustmentAmount ?? result.checkoutResult.paymentAdjustment ?? 0),
        finalAmountAfterPayment: Number(result.checkoutResult.finalAmount ?? 0),
        // Fase 2.1.b — pasos del checkout también del lado sales.
        steps:                   normalizeCheckoutSteps(result.checkoutResult.steps),
      }
    : null;

  // En el endpoint de ventas hoy NO viene un `shippingResult` — solo el monto
  // dentro de documentTotals. Reconstruyo lo mínimo para la UI.
  const shipping: NormalizedShippingInfo | null = (dt?.shippingAmount ?? 0) > 0
    ? { mode: null, amount: Number(dt!.shippingAmount) }
    : null;

  const documentTotals: NormalizedPricingResult["documentTotals"] = {
    subtotalBeforeDiscounts:    Number(dt?.subtotalBeforeDiscounts    ?? 0),
    lineDiscountAmount:         Number(dt?.lineDiscountAmount         ?? 0),
    subtotalAfterLineDiscounts: Number(dt?.subtotalAfterLineDiscounts ?? 0),
    channelAdjustmentAmount:    Number(dt?.channelAdjustmentAmount    ?? 0),
    couponDiscountAmount:       Number(dt?.couponDiscountAmount       ?? 0),
    paymentAdjustmentAmount:    Number(dt?.paymentAdjustmentAmount    ?? 0),
    shippingAmount:             Number(dt?.shippingAmount             ?? 0),
    globalDiscountAmount:       Number(dt?.globalDiscountAmount       ?? 0),
    taxableBase:                Number(dt?.taxableBase                ?? 0),
    taxAmount:                  Number(dt?.taxAmount                  ?? 0),
    roundingAdjustment:         Number(dt?.roundingAdjustment         ?? 0),
    totalBeforeTax:             Number(dt?.totalBeforeTax             ?? 0),
    totalWithTax:               Number(dt?.totalWithTax               ?? 0),
    total:                      Number(dt?.total                      ?? 0),
    // FASE 2 — agregados Metal/Hechura del backend.
    metalCostSubtotal:    dt && (dt as any).metalCostSubtotal    != null ? Number((dt as any).metalCostSubtotal)    : undefined,
    hechuraCostSubtotal:  dt && (dt as any).hechuraCostSubtotal  != null ? Number((dt as any).hechuraCostSubtotal)  : undefined,
    metalSaleSubtotal:    dt && (dt as any).metalSaleSubtotal    != null ? Number((dt as any).metalSaleSubtotal)    : undefined,
    hechuraSaleSubtotal:  dt && (dt as any).hechuraSaleSubtotal  != null ? Number((dt as any).hechuraSaleSubtotal)  : undefined,
    breakdownEstimated:   dt && (dt as any).breakdownEstimated   != null ? Boolean((dt as any).breakdownEstimated)  : undefined,
  };

  // Política agregada de las líneas. El endpoint de ventas no expone una a
  // nivel documento — la derivamos como AND de las líneas.
  const allCanConfirm = lines.length > 0 && lines.every(l => true /* placeholder */);
  const blockingFromLines = ([] as string[]); // (los blocking se exponen a nivel línea)
  void allCanConfirm; void blockingFromLines;

  return {
    source: "SALES_PREVIEW",
    lines,
    channel,
    coupon,
    payment,
    shipping,
    documentTotals,
    roundingInfo: dt?.roundingInfo
      ? {
          source:        dt.roundingInfo.source as "PRICE_LIST" | "TENANT_POLICY",
          priceListId:   dt.roundingInfo.priceListId,
          priceListName: dt.roundingInfo.priceListName,
          applyOn:       dt.roundingInfo.applyOn,
          mode:          dt.roundingInfo.mode,
          direction:     dt.roundingInfo.direction,
        }
      : null,
    // Detalle del redondeo a nivel comprobante (UNIFIED). Passthrough — el
    // backend lo expone en `documentTotals.documentRoundingApplied` desde
    // que se introdujo la política doc; lo subimos al nivel raíz del
    // resultado normalizado para que la UI lo lea sin conocer la estructura
    // interna de documentTotals.
    documentRoundingApplied: (dt as any)?.documentRoundingApplied ?? null,
    // Política y alertas: el endpoint no las expone consolidadas a nivel
    // documento. Devolvemos un default permisivo y la UI puede inspeccionar
    // `lines[i].partial` para decidir.
    policy: { canConfirm: true, blockingAlerts: [] },
    alerts: [],

    // Fase 2.1 — info doc-level expuesta por sales/preview desde Fase 2A.7.
    clientBalanceType:      (result as any).clientBalanceType     ?? null,
    clientCommercialRules:  normalizeClientCommercialRules((result as any).clientCommercialRules),
    requestedPriceListId:   (result as any).requestedPriceListId  ?? null,
    appliedPriceListId:     (result as any).appliedPriceListId    ?? null,
    appliedPriceListName:   (result as any).appliedPriceListName  ?? null,
    priceListWasOverridden: (result as any).priceListWasOverridden ?? undefined,
  };
}

function normalizeSalesLine(l: SalePreviewLine): NormalizedPricingLine {
  return {
    articleId: l.articleId,
    variantId: l.variantId ?? null,
    quantity:  Number(l.quantity ?? 0),

    basePrice:        l.basePrice ?? null,
    unitPrice:        l.unitPrice ?? null,
    unitTaxAmount:    Number(l.unitTaxAmount ?? 0),
    // Sprint 4 — POLICY.md §4 R4.1: lector puro. El backend v3 emite
    // unitTotalWithTax en sales/preview; el frontend NO lo deriva.
    unitTotalWithTax: l.unitTotalWithTax ?? null,

    quantityDiscountAmount:  Number(l.quantityDiscountAmount  ?? 0),
    promotionDiscountAmount: Number(l.promotionDiscountAmount ?? 0),

    lineTotal:        l.lineTotal        ?? null,
    lineTaxAmount:    Number(l.lineTaxAmount ?? 0),
    lineTotalWithTax: l.lineTotalWithTax ?? null,
    lineDiscount:     Number(l.lineDiscount ?? 0),

    priceSource:          l.priceSource          ?? "NONE",
    appliedPriceListId:   l.appliedPriceListId   ?? null,
    appliedPriceListName: l.appliedPriceListName ?? null,
    appliedPriceListMode: (l as any).appliedPriceListMode ?? null,
    appliedPromotionId:   l.appliedPromotionId   ?? null,
    appliedPromotionName: l.appliedPromotionName ?? null,
    appliedDiscountId:    l.appliedDiscountId    ?? null,

    unitCost:      l.unitCost      ?? null,
    unitMargin:    l.unitMargin    ?? null,
    marginPercent: l.marginPercent ?? null,
    costMode:      l.costMode      ?? "NONE",
    costPartial:   Boolean(l.costPartial),

    taxBreakdown:    normalizeTaxBreakdown(l.taxBreakdown as any),
    appliedRounding: normalizeAppliedRounding(l.appliedRounding),

    partial: false,

    // Fase 2.1 — campos que sales/preview empezó a exponer en Fase 2A.7.
    composition:         normalizeComposition(
      (l as any).composition,
      l.metalHechuraBreakdown?.metalMarginPct,
    ),
    appliedMermaPercent: (l as any).appliedMermaPercent ?? null,
    costBase:            (l as any).costBase != null      ? Number((l as any).costBase)      : null,
    costTaxAmount:       (l as any).costTaxAmount != null ? Number((l as any).costTaxAmount) : null,
    costWithTax:         (l as any).costWithTax != null   ? Number((l as any).costWithTax)   : null,
    costTaxBreakdown:    normalizeCostTaxBreakdown((l as any).costTaxBreakdown),

    // Fase 2.1.b — sales sí expone metalHechuraBreakdown por línea desde
    // siempre. costOverrideContext aún no — queda null.
    metalHechuraBreakdown:  normalizeMetalHechuraBreakdown(l.metalHechuraBreakdown),
    componentSaleBreakdown: normalizeComponentSaleBreakdown((l as any).componentSaleBreakdown),
    costOverrideContext:    null,

    // Paso 6 — componentes PRODUCT/SERVICE.
    // sales/preview NO expone `steps[]` por línea hoy: el response solo trae
    // `pricingSnapshot` per-línea pero sin steps detallados. Hasta que el
    // backend lo exponga, los arrays quedan vacíos. Factura tendrá que
    // invocar /articles/:id/pricing-preview por línea (o el backend agregar
    // `steps` al SalePreviewLine) para popular este campo.
    products: extractCostComponents((l as any).steps, "PRODUCT"),
    services: extractCostComponents((l as any).steps, "SERVICE"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeAppliedRounding(
  r: ArticlePricingResult["appliedRounding"] | SalePreviewLine["appliedRounding"] | undefined | null,
): NormalizedAppliedRounding | null {
  if (!r) return null;
  return {
    source:         r.source,
    priceListId:    r.priceListId,
    priceListName:  r.priceListName,
    applyOn:        r.applyOn,
    mode:           r.mode,
    direction:      r.direction,
    unitAdjustment: Number(r.unitAdjustment ?? 0),
  };
}

function normalizePolicy(p: PricingPolicyResult | undefined): { canConfirm: boolean; blockingAlerts: string[] } {
  if (!p) return { canConfirm: true, blockingAlerts: [] };
  return {
    canConfirm:     Boolean(p.canConfirm),
    blockingAlerts: p.blockingAlerts ?? [],
  };
}

function normalizeAlerts(alerts: PricingAlert[] | undefined): Array<{ code: string; level: "info" | "warning" | "error"; message: string }> {
  if (!alerts?.length) return [];
  return alerts.map(a => ({ code: a.code, level: a.level, message: a.message }));
}
