// src/lib/pricing/display/saleCompositionDisplay.ts
// ============================================================================
// Helpers display-only para la grilla "Composición del costo del artículo"
// (Factura) — y futuro reuso desde Simulador / Comparador.
//
// Reglas comunes a los 3 helpers:
//   · Display puro — NO recalculan precios comerciales.
//   · Operan sólo sobre datos que el pricing-engine YA emite (passthrough).
//   · Frontend NUNCA reemplaza valores reales (lineSale, unitValue, etc.);
//     sólo provee un "view" alternativo cuando el motor declara colapso
//     intencional (modos derivados: MARGIN_TOTAL / PROPORTIONAL_COST /
//     SERVICE_AS_HECHURA / MANUAL_AS_HECHURA / COMBO_COMPONENTS).
//   · Snapshots legacy sin datos extra: fallback al comportamiento anterior.
//
// POLICY R6 / POLICY R4.5 — frontend read-only en pricing.
// ============================================================================

// Formato region-aware (config del tenant). Único helper de formato — fuente
// compartida por Factura ↔ Simulador (paridad). NO formatear inline acá.
import { formatByType } from "../format";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos compartidos
// ─────────────────────────────────────────────────────────────────────────────
export type CurrencyByIdMap = Map<
  string,
  { code?: string | null; symbol?: string | null }
>;

// ─────────────────────────────────────────────────────────────────────────────
// metalEquivFactor — FÓRMULA CANÓNICA ÚNICA del factor de equivalencia de un
// metal (pureza/ley + merma). Es la MISMA que usa el Simulador en
// `buildMetalPadreMap` (CostCompositionBlock/helpers.ts) y la card
// `MetalEquivCard`. NO duplicar esta fórmula en ningún otro lado:
//
//   · con pureza:  factor = purity × (merma ≠ 0 ? (1 + merma/100) : 1)
//   · sin pureza:  factor = 1 + (merma ?? 0)/100
//
// `equivGr = grams × factor`. POLICY R4.5 — pura, sin side-effects.
// ─────────────────────────────────────────────────────────────────────────────
export function metalEquivFactor(
  purity:  number | null | undefined,
  mermaPct: number | null | undefined,
): number {
  const p = purity != null && Number.isFinite(purity) ? purity : null;
  const m = mermaPct != null && Number.isFinite(mermaPct) ? mermaPct : null;
  if (p != null) {
    const mermaMul = m != null && m !== 0 ? (1 + m / 100) : 1;
    return p * mermaMul;
  }
  return 1 + (m ?? 0) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildMetalParentTotals — consolidado por METAL PADRE (Oro, Plata, …) a
// partir de `composition.metals[]`. Devuelve, por padre:
//   · totalGrams     = Σ grams (bruto)
//   · totalPureGrams = Σ grams × purity         (sin merma)
//   · totalEquivGr   = Σ grams × metalEquivFactor(purity, merma)  ← lo que
//                       muestra el Simulador en sus cards "Oro (Au): 8,01 gr"
//
// Misma matemática que `buildMetalPadreMap` del Simulador (delega en
// `metalEquivFactor` + acumulación con `+=` idéntica) → paridad exacta
// Simulador ↔ Factura, sin recalcular ni duplicar fórmulas. Agrupa por
// `metalName` (nombre del metal padre); ordena por nombre (es-AR) estable.
// ─────────────────────────────────────────────────────────────────────────────
export type MetalParentTotal = {
  name:           string;
  totalGrams:     number;
  totalPureGrams: number;
  totalEquivGr:   number;
};

export function buildMetalParentTotals(
  items: ReadonlyArray<{
    metalName:       string | null;
    purity:          number | null;
    appliedGrams:    number | null;
    appliedMermaPct: number | null;
  } | null | undefined>,
): MetalParentTotal[] {
  const acc = new Map<string, MetalParentTotal>();
  for (const it of items) {
    if (!it) continue;
    const name = typeof it.metalName === "string" ? it.metalName.trim() : "";
    const g = it.appliedGrams != null && Number.isFinite(it.appliedGrams) ? it.appliedGrams : null;
    if (!name || g == null) continue;
    const p = it.purity != null && Number.isFinite(it.purity) ? it.purity : null;
    const equivGr = g * metalEquivFactor(p, it.appliedMermaPct);
    const pureGr  = p != null ? g * p : 0;
    const prev = acc.get(name) ?? { name, totalGrams: 0, totalPureGrams: 0, totalEquivGr: 0 };
    prev.totalGrams     += g;
    prev.totalPureGrams += pureGr;
    prev.totalEquivGr   += equivGr;
    acc.set(name, prev);
  }
  return Array.from(acc.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

// ─────────────────────────────────────────────────────────────────────────────
// computeMetalSaleFactor / computeHechuraSaleFactor — ratio del motor
// `metalSale / metalCost` (resp. hechura). FÓRMULA CANÓNICA ÚNICA del factor
// de venta: la usa el Simulador (`PriceCompositionCards`) y la Factura. NO
// duplicar. `null` cuando el motor no lo resolvió (costo 0 / sale ausente).
// ─────────────────────────────────────────────────────────────────────────────
export function computeMetalSaleFactor(
  mhb: { metalCost: number | null; metalSale: number | null } | null,
): number | null {
  if (!mhb) return null;
  if (mhb.metalCost == null || mhb.metalCost <= 0.001) return null;
  if (mhb.metalSale == null) return null;
  return mhb.metalSale / mhb.metalCost;
}

export function computeHechuraSaleFactor(
  mhb: { hechuraCost: number | null; hechuraSale: number | null } | null,
): number | null {
  if (!mhb) return null;
  if (mhb.hechuraCost == null || mhb.hechuraCost <= 0.001) return null;
  if (mhb.hechuraSale == null) return null;
  return mhb.hechuraSale / mhb.hechuraCost;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildMetalParentSaleTotals — consolidado por metal padre del LADO VENTA,
// IDÉNTICO a las cards del Simulador (`MetalSaleCard`):
//
//     saleEquivGr = costEquivGr × metalSaleFactor
//
// donde `costEquivGr` = `buildMetalParentTotals(...).totalEquivGr` (la MISMA
// agregación que el Simulador, vía `metalEquivFactor`) y `metalSaleFactor` =
// `computeMetalSaleFactor(metalHechuraBreakdown)` = `metalSale / metalCost`.
// Es exactamente `padre.totalEquivGr * metalSaleFactor` de MetalSaleCard
// (con el mismo fallback: si el factor es null/≤0, cae a `costEquivGr`).
//
// NO recalcula precios ni inventa fórmula: compone los dos helpers canónicos
// ya compartidos con el Simulador. Garantiza paridad numérica exacta
// Simulador (Composición del precio) ↔ Factura (header METALES).
// ─────────────────────────────────────────────────────────────────────────────
export type MetalParentSaleTotal = {
  name:         string;
  /** Σ gramos × pureza × (1+merma/100) — equivalente de COSTO. */
  costEquivGr:  number;
  /** costEquivGr × metalSaleFactor — equivalente de VENTA (lo que muestra
   *  el Simulador). Cae a `costEquivGr` cuando no hay factor de venta. */
  saleEquivGr:  number;
};

export function buildMetalParentSaleTotals(
  items: ReadonlyArray<{
    metalName:       string | null;
    purity:          number | null;
    appliedGrams:    number | null;
    appliedMermaPct: number | null;
  } | null | undefined>,
  metalSaleFactor: number | null,
): MetalParentSaleTotal[] {
  const hasFactor =
    metalSaleFactor != null && Number.isFinite(metalSaleFactor) && metalSaleFactor > 0.0001;
  return buildMetalParentTotals(items).map((p) => ({
    name:        p.name,
    costEquivGr: p.totalEquivGr,
    // Mismo criterio que MetalSaleCard: si hay factor de venta válido y
    // gramos > 0 → gramos de venta; si no → fallback al equivalente de costo.
    saleEquivGr:
      hasFactor && p.totalEquivGr > 0.0001
        ? p.totalEquivGr * (metalSaleFactor as number)
        : p.totalEquivGr,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// buildMetalParentLineWeights — pesos por metal PADRE escalados a la LÍNEA,
// para la mini-lectura del header METALES en Factura:
//
//   Oro · 0,91 gr c/u · 2,73 gr total · Oro puro 2,05 gr
//
//   · gramsPerUnit   = Σ appliedGrams              (por unidad de artículo)
//   · gramsTotal      = gramsPerUnit × lineQty      (peso total de la línea)
//   · pureGramsTotal  = (Σ appliedGrams × purity) × lineQty   (sin merma)
//   · hasPure         = había al menos un metal con pureza > 0
//
// Reusa `buildMetalParentTotals` (fórmula canónica única; paridad Simulador).
// Display puro: NO recalcula pricing — solo escala gramos ya emitidos por el
// motor por la cantidad de la línea de venta. Si falta `appliedGrams` el item
// ya se ignora en `buildMetalParentTotals`; si falta pureza → `hasPure=false`
// y el caller NO muestra el segmento "puro" (no se inventa nada).
// ─────────────────────────────────────────────────────────────────────────────
export type MetalParentLineWeight = {
  /** Nombre del metal PADRE ("Oro", "Oro 999.99"). Segmento 2 ("<padre>: puro"). */
  name:          string;
  /** Nombre de la VARIANTE de metal para el segmento 1 ("<variante> = bruto").
   *  = `variantName` cuando hay UNA sola variante para ese padre (ej.
   *  "Oro 18k"); si hay varias variantes distintas → cae al nombre del padre.
   *  NUNCA concatena padre + ley (evita "Oro 999.99 18k"). */
  label:         string;
  gramsPerUnit:  number;
  gramsTotal:    number;
  pureGramsTotal: number;
  hasPure:       boolean;
};

/** Resuelve el nombre de VARIANTE de un padre a partir del set de
 *  `variantName` de sus items. Display puro, sin lógica comercial.
 *  Sin variantName (o varias distintas) → nombre del padre (NO se mezcla
 *  con ley/purityLabel). */
function resolveVariantLabel(parentName: string, variantNames: Set<string>): string {
  if (variantNames.size !== 1) return parentName;
  const v = [...variantNames][0]?.trim() ?? "";
  return v || parentName;
}

export function buildMetalParentLineWeights(
  items: ReadonlyArray<{
    metalName:       string | null;
    purity:          number | null;
    appliedGrams:    number | null;
    appliedMermaPct: number | null;
    /** Nombre de la variante de metal (segmento 1 del header, ej. "Oro 18k").
     *  Acepta `variantName` o el alias `metalVariantName`. */
    variantName?:     string | null;
    metalVariantName?: string | null;
    /** Aceptado por compat de callers; NO se usa para el label (evita
     *  mezclar padre + ley). */
    purityLabel?:    string | null;
  } | null | undefined>,
  lineQty: number | null | undefined,
): MetalParentLineWeight[] {
  const q =
    lineQty != null && Number.isFinite(lineQty) && lineQty > 0 ? lineQty : 1;

  // Set de variantNames por metal padre — solo de items con gramos válidos
  // (mismo criterio de inclusión que `buildMetalParentTotals`).
  const variantsByParent = new Map<string, Set<string>>();
  for (const it of items) {
    if (!it) continue;
    const name = typeof it.metalName === "string" ? it.metalName.trim() : "";
    const g = it.appliedGrams != null && Number.isFinite(it.appliedGrams) ? it.appliedGrams : null;
    if (!name || g == null) continue;
    const vn = ((it.variantName ?? it.metalVariantName) ?? "").trim();
    if (!vn) continue;
    if (!variantsByParent.has(name)) variantsByParent.set(name, new Set());
    variantsByParent.get(name)!.add(vn);
  }

  return buildMetalParentTotals(items)
    .filter((p) => p.totalGrams > 0.0000001)
    .map((p) => ({
      name:           p.name,
      label:          resolveVariantLabel(p.name, variantsByParent.get(p.name) ?? new Set()),
      gramsPerUnit:   p.totalGrams,
      gramsTotal:     p.totalGrams * q,
      pureGramsTotal: p.totalPureGrams * q,
      hasPure:        p.totalPureGrams > 0.0000001,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// T22 — `buildMetalParentSaleLines` — desglose por METAL PADRE escalado a la
// LÍNEA, con gramos equivalentes de VENTA y monto de venta (paridad EXACTA
// con la card `MetalSaleCard` del Simulador):
//
//     Oro Fino — 1,53 gr  ·  ARS 381.562,50
//
//   · gramsEquivLine = Σ (appliedGrams × metalEquivFactor) × metalSaleFactor × qty
//                       — gramos equivalentes del LADO VENTA (con margen)
//                       escalados a la línea. Es la MISMA cifra que muestra
//                       `MetalSaleCard` en la cabecera del card del Simulador
//                       (`saleGramsTotal = padre.totalEquivGr × metalSaleFactor`).
//                       Fallback: si `metalSaleFactor` es null/≤0 (motor no lo
//                       resolvió o snapshot legacy), cae a `costEquivGr × qty`
//                       (= sin margen). Eso ya lo hace `buildMetalParentSaleTotals`.
//   · saleAmountLine = (Σ lineSale del padre) × qty
//                       — `composition.metals[i].lineSale` (passthrough motor:
//                       sale-side per cost-line METAL, CON margen).
//                       Contrato: `Σ metals[i].lineSale === metalHechuraBreakdown.metalSale`
//                       → multiplicado por qty reproduce EXACTO el subtotal
//                       de venta del metal por padre que muestra el Simulador.
//                       NULL para snapshots legacy sin lineSale.
//
// Cero matemática comercial: compone helpers canónicos ya compartidos con el
// Simulador (`buildMetalParentSaleTotals` + `computeMetalSaleFactor`). No
// infiere precios, no aplica margen nuevo, no convierte monedas.
// (POLICY R6 / POLICY R4.5)
// ─────────────────────────────────────────────────────────────────────────────
/** Sub-fila de variante de metal — origen real de los gramos del padre.
 *  Para mostrar bajo cada metal padre la lista de variantes que lo componen
 *  con sus gramos originales × cantidad de línea. */
export type MetalParentVariantLine = {
  /** Nombre legible de la variante (`variantName` del catálogo, ej.
   *  "Oro 18 Kilates"). Cuando falta, cae a `purityLabel` ("18k") y, sin
   *  ninguno, al nombre del padre como fallback. */
  label:         string;
  /** Σ appliedGrams de items que comparten variante × lineQty (gramos
   *  ORIGINALES, sin merma ni pureza). Cero matemática nueva. */
  gramsLine:     number;
};

export type MetalParentSaleLine = {
  name:           string;
  /** Σ (appliedGrams × metalEquivFactor) × metalSaleFactor × lineQty.
   *  Gramos equivalentes del LADO VENTA, escalados a la línea.
   *  Cae a `costEquivGr × lineQty` si no hay metalSaleFactor. */
  gramsEquivLine: number;
  /** (Σ lineSale del padre) × lineQty. `null` si ningún item trae lineSale
   *  (snapshot legacy). */
  saleAmountLine: number | null;
  /** Variantes del padre, agrupadas y sumadas por nombre. Cada entrada es
   *  el "origen" de los gramos: `<variantName>: <gramos originales> gr`.
   *  Sólo se incluyen variantes con gramos > 0; ordenadas por nombre. */
  variants:       MetalParentVariantLine[];
};

export function buildMetalParentSaleLines(
  items: ReadonlyArray<{
    metalName:       string | null;
    purity:          number | null;
    appliedGrams:    number | null;
    appliedMermaPct: number | null;
    lineSale?:       number | null;
    /** F1.3 Fase 2.4 — Nombre comercial de la variante de metal. */
    variantName?:    string | null;
    /** Alias aceptado por compat (algunos callers usan este nombre). */
    metalVariantName?: string | null;
    /** Ley/pureza ("18k") — fallback cuando no hay variantName. */
    purityLabel?:    string | null;
  } | null | undefined>,
  lineQty: number | null | undefined,
  /** Ratio metalSale/metalCost del motor (`computeMetalSaleFactor`). Cuando
   *  es null/≤0 (snapshot legacy o costo 0), el helper cae a `costEquivGr`
   *  (sin margen) — mismo fallback que `MetalSaleCard` del Simulador. */
  metalSaleFactor: number | null | undefined,
): MetalParentSaleLine[] {
  const q =
    lineQty != null && Number.isFinite(lineQty) && lineQty > 0 ? lineQty : 1;
  // Acumulación de `lineSale` per-unit por metal padre. `has` distingue
  // "snapshot legacy sin lineSale" (→ null al final) de "motor declara
  // lineSale = 0" (→ 0 al final).
  const saleByParent = new Map<string, { sum: number; has: boolean }>();
  // T26 — Agregación de variantes por padre: `<padre> → Map<label, grams>`.
  // El label se resuelve por preferencia: variantName → purityLabel → padre.
  // Items con el MISMO label suman sus `appliedGrams`. Antes de escalar por
  // qty (eso se hace al final).
  const variantsByParent = new Map<string, Map<string, number>>();
  for (const it of items) {
    if (!it) continue;
    const name = typeof it.metalName === "string" ? it.metalName.trim() : "";
    const g    = it.appliedGrams;
    if (!name || g == null || !Number.isFinite(g)) continue;
    // sale
    const prev = saleByParent.get(name) ?? { sum: 0, has: false };
    const ls = it.lineSale;
    if (ls != null && Number.isFinite(ls)) {
      prev.sum += ls;
      prev.has  = true;
    }
    saleByParent.set(name, prev);
    // variantes
    const variantLabel =
      ((it.variantName ?? it.metalVariantName) ?? "").trim()
      || (it.purityLabel ?? "").trim()
      || name;
    if (!variantsByParent.has(name)) variantsByParent.set(name, new Map());
    const vMap = variantsByParent.get(name)!;
    vMap.set(variantLabel, (vMap.get(variantLabel) ?? 0) + g);
  }
  // Delegamos en `buildMetalParentSaleTotals` para `saleEquivGr` (= gramos
  // equivalentes LADO VENTA con margen). Es la MISMA composición que usa
  // `MetalSaleCard`: `costEquivGr × metalSaleFactor` con fallback a
  // `costEquivGr` cuando el factor no aplica.
  const factor =
    metalSaleFactor != null && Number.isFinite(metalSaleFactor) && metalSaleFactor > 0.0001
      ? metalSaleFactor
      : null;
  return buildMetalParentSaleTotals(items, factor)
    .filter((p) => p.saleEquivGr > 0.0000001)
    .map((p) => {
      const s = saleByParent.get(p.name);
      const vMap = variantsByParent.get(p.name) ?? new Map<string, number>();
      const variants: MetalParentVariantLine[] = Array.from(vMap.entries())
        .filter(([, g]) => g > 0.0000001)
        .map(([label, g]) => ({ label, gramsLine: g * q }))
        .sort((a, b) => a.label.localeCompare(b.label, "es"));
      return {
        name:           p.name,
        gramsEquivLine: p.saleEquivGr * q,
        saleAmountLine: s?.has ? s.sum * q : null,
        variants,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// T13 — `buildLineHechuraSaleUnified` — total HECHURA UNIFICADA per-línea
// (paridad visual con el card HECHURA del Simulador).
//
// Conceptualmente:
//
//   hechuraUnified =
//     subtotalHechura          (= metalHechuraBreakdown.hechuraSale × qty)
//   + Σ products.totalValue    (composition.products[i].totalValue)
//   + Σ services.totalValue    (composition.services[i].totalValue)
//   + impuestos imputados a HECHURA
//       (parte proporcional según taxBreakdown × applyOn,
//        usando la misma lógica que `buildSaleTaxLines` del simulador)
//
// Cero matemática comercial nueva: todos los inputs son passthrough
// estricto del motor (POLICY R6). El helper SUMA y DISTRIBUYE bases que el
// motor ya emitió — equivalente a las agregaciones de display que ya hace
// `TPPriceCompositionKpis` (Simulador).
//
// `productsTotal` y `servicesTotal` se calculan a partir de `totalValue` de
// cada cost line de composición; el motor emite estos campos en escala de
// línea (no per-unit). Por eso NO los multiplicamos por `qty`.
//
// `taxOnHechura` se obtiene distribuyendo cada impuesto entre metal y
// hechura proporcionalmente a sus bases (mismo criterio que el Simulador).
// Si no hay tax breakdown con `rate`, devuelve 0 (sin recalcular nada).
// ─────────────────────────────────────────────────────────────────────────────

export type LineHechuraUnified = {
  /** Subtotal hechura (per-unit × qty) post-ajustes, pre-impuestos. */
  hechuraSubtotal: number;
  /** Σ composition.products[].totalValue. */
  productsTotal:   number;
  /** Σ composition.services[].totalValue. */
  servicesTotal:   number;
  /** Σ parte de cada impuesto imputada a HECHURA (distribución
   *  proporcional contra metalSale × qty / hechuraSubtotal). */
  taxOnHechura:    number;
  /** Total unificado para mostrar al usuario. */
  total:           number;
};

export function buildLineHechuraSaleUnified(args: {
  metalSaleUnit:   number | null | undefined;
  hechuraSaleUnit: number | null | undefined;
  quantity:        number | null | undefined;
  products?: ReadonlyArray<{ totalValue?: number | null } | null | undefined>;
  services?: ReadonlyArray<{ totalValue?: number | null } | null | undefined>;
  taxBreakdown?: ReadonlyArray<{
    rate?:   number | null;
    taxAmount?: number | null;
    applyOn?: string | null;
  } | null | undefined>;
}): LineHechuraUnified {
  const qty = Number.isFinite(args.quantity ?? 0) && (args.quantity ?? 0) > 0
    ? (args.quantity as number)
    : 1;
  const hechuraUnit = typeof args.hechuraSaleUnit === "number" && args.hechuraSaleUnit > 0
    ? args.hechuraSaleUnit
    : 0;
  const metalUnit = typeof args.metalSaleUnit === "number" && args.metalSaleUnit > 0
    ? args.metalSaleUnit
    : 0;
  const hechuraSubtotal = hechuraUnit * qty;
  const metalSubtotal   = metalUnit   * qty;

  const sumTotalValue = (xs: ReadonlyArray<{ totalValue?: number | null } | null | undefined> | undefined) => {
    if (!xs) return 0;
    let s = 0;
    for (const x of xs) {
      const v = x?.totalValue;
      if (typeof v === "number" && Number.isFinite(v)) s += v;
    }
    return s;
  };
  const productsTotal = sumTotalValue(args.products);
  const servicesTotal = sumTotalValue(args.services);

  // Tax distribuido entre metal y hechura proporcionalmente. Si una
  // applyOn del item viene como "HECHURA" o "METAL" explícita, se respeta.
  // Para applyOn=TOTAL (default), se splittea por proporción de bases.
  let taxOnHechura = 0;
  if (Array.isArray(args.taxBreakdown)) {
    for (const t of args.taxBreakdown) {
      if (!t) continue;
      const taxAmount = typeof t.taxAmount === "number" ? t.taxAmount : 0;
      if (!Number.isFinite(taxAmount) || taxAmount <= 0) continue;
      const apply = (t.applyOn ?? "TOTAL") as string;
      if (apply === "HECHURA") {
        taxOnHechura += taxAmount;
      } else if (apply === "METAL") {
        // 0 contribución a hechura
      } else {
        // TOTAL — proporcional a las bases imponibles.
        const base = metalSubtotal + hechuraSubtotal;
        if (base > 0) {
          taxOnHechura += taxAmount * (hechuraSubtotal / base);
        }
      }
    }
  }

  const total = hechuraSubtotal + productsTotal + servicesTotal + taxOnHechura;
  return { hechuraSubtotal, productsTotal, servicesTotal, taxOnHechura, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveItemCurrencyDisplay — display de moneda original + equivalente en
// moneda del comprobante para cost lines (HECHURA / PRODUCT / SERVICE).
//
// El motor backend ya entrega:
//   · `unitValue` en moneda ORIGINAL del cost line (ej. USD 74,76).
//   · `totalValue` en moneda BASE / del documento (ej. ARS 100.926,00).
//   · `currencyId` (id de la moneda original; null = moneda base).
//
// El frontend NO convierte montos. Sólo:
//   · Etiqueta el `unitValue` con el code correcto (USD, no ARS).
//   · Muestra una sub-línea informativa con el equivalente unitario en moneda
//     del documento (`totalValue / quantity`), que el motor ya calculó.
//
// Cuando `currencyId` falta, no hay catálogo (`currencyById`), no se puede
// resolver el code, o el code resuelto coincide con `documentCurrency` → la
// función devuelve `null` y el caller mantiene el render por defecto.
//
// FIX FX (Etapa E2): `unitValueBase` viene SIEMPRE en moneda BASE del tenant
// (ver backend `pricing-composition.ts:170-181`), incluso cuando el preview
// fue convertido a moneda de display. En facturas en moneda no-base (ej.
// USD), si se renderiza ese equivalente con la etiqueta de la moneda del
// documento sin convertir, el operador ve "USD 33.799,00" siendo un valor
// en ARS. Para corregirlo sin tocar el motor, este helper acepta un
// `displayRate` opcional (= rate del documento, "unidades base por 1
// unidad de moneda doc") y divide el equivalente antes de devolverlo.
// `displayRate=1` (default) o factura en moneda base → no convierte, mismo
// comportamiento anterior. Cero matemática nueva: división trivial sobre
// dato del motor.
// ─────────────────────────────────────────────────────────────────────────────
export function resolveItemCurrencyDisplay(
  item: {
    currencyId?:     string | null;
    /** Code emitido por el backend cuando el motor registró conversión
     *  (passthrough de `step.meta.currencyCode`). Cuando está, gana sobre
     *  el mapping vía `currencyById` — snapshot autocontenido. */
    currencyCode?:   string | null;
    unitValue?:      number | null;
    /** `unitValue × rate` en moneda base, PRE-ajuste. Cuando está disponible,
     *  se usa como `equivalentUnitValue` (lectura directa de la conversión
     *  sin el ajuste). Sin él, fallback a `totalValue / quantity` (que es
     *  post-ajuste — sólo coherente cuando el cost line no tiene ajuste). */
    unitValueBase?:  number | null;
    totalValue?:     number | null;
    quantity?:       number | null;
  } | null | undefined,
  documentCurrency: string,
  currencyById?: CurrencyByIdMap | null,
  /**
   * Rate de la moneda del documento — "unidades de moneda BASE por 1
   * unidad de la moneda del documento" (ej. 446 si 1 USD = 446 ARS y la
   * base es ARS). Cuando el documento está en moneda base, el rate es
   * efectivamente 1. Sólo afecta el cálculo del `equivalentUnitValue`
   * (que siempre vuelve en base desde el motor); cero efecto si la
   * factura es en moneda base o si el rate es inválido / ausente.
   */
  displayRate?: number,
): {
  originalCurrencyLabel: string;
  equivalentUnitValue:   number | null;
} | null {
  if (!item) return null;
  // 1) Code autocontenido (snapshot enriquecido por el backend display).
  // 2) Fallback al catálogo del tenant vía `currencyId` (compat snapshots
  //    viejos o casos donde el motor no emite conversionMeta).
  let code: string | null = null;
  const selfCode = (item.currencyCode ?? "").trim();
  if (selfCode.length > 0) {
    code = selfCode;
  } else {
    const cid = item.currencyId;
    if (cid && currencyById && currencyById.size > 0) {
      const cur = currencyById.get(cid);
      const mapped = (cur?.code ?? "").trim();
      if (mapped.length > 0) code = mapped;
    }
  }
  if (!code) return null;
  // Mismo code que el documento → no hay conversión efectiva, sin override.
  if (code === documentCurrency) return null;
  // Equivalente — preferimos `unitValueBase` (pre-ajuste autocontenido) sobre
  // la derivación `totalValue / quantity` (post-ajuste, induce a percibir
  // doble descuento cuando el cost line tiene Merma/Ajuste).
  let equivalentUnitValue: number | null = null;
  const uvb = item.unitValueBase;
  if (uvb != null && Number.isFinite(uvb) && uvb > 0) {
    equivalentUnitValue = uvb;
  } else {
    const qty   = Number(item.quantity ?? 0);
    const total = Number(item.totalValue ?? 0);
    equivalentUnitValue =
      Number.isFinite(qty) && qty > 0 && Number.isFinite(total) && total > 0
        ? total / qty
        : null;
  }
  // FIX FX (Etapa E2) — convertir BASE → moneda del documento si la factura
  // no está en moneda base. Sólo aplica si el caller provee `displayRate`
  // válido distinto de 1. División trivial sobre dato del motor; cero
  // matemática nueva.
  if (
    equivalentUnitValue != null
    && typeof displayRate === "number"
    && Number.isFinite(displayRate)
    && displayRate > 0
    && displayRate !== 1
  ) {
    equivalentUnitValue = equivalentUnitValue / displayRate;
  }
  return { originalCurrencyLabel: code, equivalentUnitValue };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveSaleForRowDisplay — display-only override del `lineSale` por fila
// cuando el motor opera en modo derivado (MARGIN_TOTAL / PROPORTIONAL_COST /
// SERVICE_AS_HECHURA / MANUAL_AS_HECHURA / COMBO_COMPONENTS).
//
// En esos modos el backend emite `hechuraMarginPct = 0` (o `metalMarginPct = 0`)
// a propósito y `composition.{hechuras|metals|products|services}[i].lineSale`
// colapsa al `lineCost` — el margen es unificado a nivel total del artículo,
// no atribuible por componente (ver backend `pricing-composition.ts:936-956`).
// Pasar ese `lineSale` colapsado a la columna "Venta" muestra una fila donde
// Costo Total === Venta, lo que confunde al operador.
//
// El Simulador (`HechuraSaleCard.tsx` / `PriceBaseSection.tsx`) resuelve esto
// reemplazando visualmente `lineSale → lineCost × unifiedFactor` (donde
// `unifiedFactor = basePrice / unitCost` del artículo). Esta función replica
// la misma regla para que Factura y Simulador rendericen idénticos.
//
// Paridad agregada: Σ(lineCost × unifiedFactor) === basePrice por construcción
// del motor en modos derivados (factor uniforme aplicado a todas las cost
// lines del bucket).
// ─────────────────────────────────────────────────────────────────────────────
export function resolveSaleForRowDisplay(
  lineCost:             number | null,
  canonicalSale:        number | null,
  unifiedFactor:        number | null,
  marginUnattributable: boolean,
): { saleForRow: number | null; isUnified: boolean } {
  const useUnifiedFactor =
       marginUnattributable
    && canonicalSale != null && Number.isFinite(canonicalSale)
    && lineCost      != null && Number.isFinite(lineCost) && lineCost > 0.0001
    && Math.abs(canonicalSale - lineCost) < 0.005
    && unifiedFactor != null && Number.isFinite(unifiedFactor)
    && Math.abs(unifiedFactor - 1) > 0.0005;
  if (useUnifiedFactor) {
    return {
      saleForRow: (lineCost as number) * (unifiedFactor as number),
      isUnified:  true,
    };
  }
  return { saleForRow: canonicalSale, isUnified: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveMarginForRowDisplay — display del margen por fila (texto + tono +
// tooltip).
//
// Casos cubiertos:
//   1. lineSale real ≠ lineCost (modo desglosado):
//        margenPct = ((sale − cost) / cost) × 100 — derivación trivial.
//   2. lineSale colapsado al lineCost en modo derivado:
//        si `unifiedFactor` disponible y ≠ 1 → usar `(unifiedFactor − 1) × 100`
//        y agregar tooltip "Margen unificado…".
//   3. lineSale === lineCost SIN modo derivado declarado:
//        margen es 0% real (lista con margen 0% declarado) — se muestra
//        "+0,0%" honesto.
//   4. Modo derivado sin `unifiedFactor` (snapshot legacy / datos insuficientes):
//        margenPct = null → la celda muestra "—" para evitar "+0,0%" engañoso.
//   5. Datos faltantes (lineCost ≤ 0 o saleLineValue null): margenPct = null.
//
// El tono semántico se decide a partir del `margenPct` final ya elegido.
// ─────────────────────────────────────────────────────────────────────────────
export type MarginRowDisplay = {
  /** Porcentaje numérico (signed) o `null` si no se pudo derivar. */
  margenPct:     number | null;
  /** Texto formateado es-AR con coma decimal (sin signo ±, lo agrega el caller). */
  margenPctText: string | null;
  /** Clase Tailwind para el tono semántico. */
  margenTone:    string;
  /** Tooltip opcional — sólo se setea cuando el % proviene del `unifiedFactor`
   *  del artículo (modo derivado MARGIN_TOTAL / etc.). */
  margenTooltip: string | null;
};

export function resolveMarginForRowDisplay(
  lineCost:             number | null,
  saleLineValue:        number | null,
  marginUnattributable: boolean,
  unifiedFactor:        number | null,
): MarginRowDisplay {
  let margenPct:     number | null = null;
  let margenPctText: string | null = null;
  let margenTooltip: string | null = null;

  if (lineCost != null && Number.isFinite(lineCost) && lineCost > 0
      && saleLineValue != null && Number.isFinite(saleLineValue)) {
    const raw = ((saleLineValue - lineCost) / lineCost) * 100;
    // Modo derivado con sale colapsado: si hay unifiedFactor válido se usa
    // como margen visual del artículo; si no, "—" (no inventamos +0,0%).
    if (marginUnattributable && Math.abs(raw) < 0.05) {
      if (unifiedFactor != null
          && Number.isFinite(unifiedFactor)
          && Math.abs(unifiedFactor - 1) > 0.0005) {
        margenPct     = (unifiedFactor - 1) * 100;
        margenPctText = `${formatByType(margenPct, "MARGIN_PERCENT", { bare: true })}%`;
        margenTooltip = "Margen unificado aplicado al total del artículo";
      }
      // else: margenPct queda null → "—"
    } else {
      margenPct     = raw;
      margenPctText = `${formatByType(raw, "MARGIN_PERCENT", { bare: true })}%`;
    }
  }

  const margenTone = (() => {
    if (margenPct == null) return "text-muted/60";
    if (margenPct >= 40)   return "text-emerald-600 dark:text-emerald-400";
    if (margenPct >= 15)   return "text-text";
    if (margenPct >  0)    return "text-amber-600 dark:text-amber-400";
    return "text-red-500";
  })();

  return { margenPct, margenPctText, margenTone, margenTooltip };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildCostLineTriView — vista unificada de 3 segmentos para la tabla
// "Composición del costo del artículo". Compartida por:
//   · CostCompositionBlock (Simulador / Factura preview / Snapshot)
//   · SaleCompositionEditableGrid (Factura editable)
//
// Garantiza que Simulador y Factura muestren EXACTAMENTE la misma estructura:
//
//   1. Costo unit.   → SOLO el valor base unitario (sin merma/ajuste/impacto).
//   2. Merma / Ajuste → DOS niveles:
//        A) valor INGRESADO por el usuario (dato principal):
//             "Bonif. 10,00 %" · "Recargo 5,00 %" · "Merma 3,00 %" · "Bonif. fija"
//        B) impacto MONETARIO calculado por el motor (secundario):
//             `lineAdjAmount` = base × %  (ej. 35.000 × 10% = 3.500).
//             Passthrough puro: el frontend NO lo recalcula. NUNCA es el
//             costo final, acumulado ni subtotal — solo el impacto.
//
//      CONVENCIÓN DE SIGNO: el motor emite `lineAdjAmount` con signo
//      INTERNO "positivo = reducción (BONIF)" / "negativo = aumento
//      (RECARGO)". El helper conserva ese número TAL CUAL en `impact`
//      (passthrough). El SIGNO VISUAL (− bonif, + recargo/merma) lo decide
//      la PRESENTACIÓN a partir de `kind`, igual que el AdjustmentLabelEditor
//      de la grilla → mismo signo en Simulador, Factura y grilla. La
//      magnitud mostrada es siempre |impact|.
//   3. Costo total   → resultado final del motor (`step.value` / `lineCost`).
//
// REGLA CRÍTICA (POLICY R6 / R4.5): passthrough puro. NO recalcula precios,
// NO infiere impactos, NO revierte ajustes. Si el motor no emite el impacto
// (`adjAmount == null`, snapshots legacy) → `impact = null` y la UI muestra
// "—". El frontend NUNCA reconstruye el monto.
// ─────────────────────────────────────────────────────────────────────────────

/** Tipo de modificador aplicado a la línea de costo. */
export type CostLineAdjustKind = "BONUS" | "SURCHARGE" | "MERMA";

/** Entrada normalizada — los adapters (`*FromStep` / `*FromComposition`)
 *  mapean el shape del motor a esta forma. SIN lógica comercial. */
export type CostLineTriInput = {
  /** METAL usa precio/gr base; el resto usa valor unitario. */
  kind:          "METAL" | "OTHER";
  /** Valor base unitario en moneda original de la línea (pre-merma/ajuste). */
  unitBase:      number | null;
  /** Cantidad (gramos para METAL, unidades para el resto). */
  qty:           number | null;
  /** Code de moneda original cuando el motor registró conversión (ej. "USD"). */
  currencyCode?: string | null;
  /** Equivalente unitario en moneda del documento (passthrough del motor:
   *  `unitValueBase` ó `totalValue / qty` PRE-ajuste). null si no aplica. */
  equivUnit?:    number | null;
  /** METAL — merma % ingresada. */
  mermaPct?:     number | null;
  /** OTHER — tipo de ajuste ingresado. */
  adjKind?:      "BONUS" | "SURCHARGE" | null;
  adjType?:      "PERCENTAGE" | "FIXED_AMOUNT" | null;
  adjValue?:     number | null;
  /** Impacto monetario del motor (`lineAdjAmount`, firmado). null = legacy. */
  adjAmount?:    number | null;
  /** Costo total final emitido por el motor (`step.value` / `lineCost`). */
  total:         number;
};

export type CostLineTriView = {
  /** Columna "Costo unit." — SOLO base. El caller formatea con su `fm`. */
  base: {
    unit:         number | null;
    qty:          number | null;
    currencyCode: string | null;
    equivUnit:    number | null;
    /** Valor unitario EFECTIVO = `total / qty` (el costo por unidad/gramo que
     *  YA incluye merma/ajuste, el mismo "Valor unitario" de la tabla inferior).
     *  Por construcción `qty × unitEffective === total` → la fórmula del card
     *  multiplica exacto al Costo total mostrado. Passthrough del total del
     *  motor expresado como tasa: NO recalcula el costo. `null` si `qty` es 0/null. */
    unitEffective: number | null;
  };
  /** Columna "Merma / Ajuste" — 2 niveles. null si no hay modificador. */
  adjust: {
    /** Nivel A — texto del valor INGRESADO (dato principal). */
    inputLabel: string;
    kind:       CostLineAdjustKind;
    /** Nivel B — impacto monetario del motor (firmado). null → UI muestra "—". */
    impact:     number | null;
  } | null;
  /** Columna "Costo total" — final del motor. */
  total: number;
};

function fmtPct(n: number): string {
  return formatByType(n, "PERCENT", { bare: true });
}

export function buildCostLineTriView(i: CostLineTriInput): CostLineTriView {
  const qtyVal = i.qty ?? null;
  const base = {
    unit:         i.unitBase ?? null,
    qty:          qtyVal,
    currencyCode: i.currencyCode ?? null,
    equivUnit:    i.equivUnit ?? null,
    // Valor unitario efectivo (con merma/ajuste) = total / qty. Tautológico:
    // qty × unitEffective === total. Solo expresa el total del motor como tasa.
    unitEffective:
      qtyVal != null && Number.isFinite(qtyVal) && Math.abs(qtyVal) > 1e-9
        ? i.total / qtyVal
        : null,
  };

  let adjust: CostLineTriView["adjust"] = null;

  if (i.kind === "METAL") {
    const m = i.mermaPct;
    if (m != null && Number.isFinite(m) && Math.abs(m) > 0.0001) {
      adjust = {
        inputLabel: `Merma ${fmtPct(m)} %`,
        kind:       "MERMA",
        // Impacto de merma: solo si el motor lo emitió como passthrough.
        // No se reconstruye (POLICY R4.5).
        impact:     i.adjAmount != null && Number.isFinite(i.adjAmount) ? i.adjAmount : null,
      };
    }
  } else if (i.adjKind && i.adjType) {
    const word = i.adjKind === "BONUS" ? "Bonif." : "Recargo";
    const inputLabel =
      i.adjType === "PERCENTAGE" && i.adjValue != null && Number.isFinite(i.adjValue)
        ? `${word} ${fmtPct(i.adjValue)} %`
        : `${word} ${i.adjKind === "BONUS" ? "fija" : "fijo"}`;
    adjust = {
      inputLabel,
      kind:   i.adjKind,
      impact: i.adjAmount != null && Number.isFinite(i.adjAmount) ? i.adjAmount : null,
    };
  }

  return { base, adjust, total: i.total };
}

// ─── Adapters de shape (passthrough puro — NO calculan) ──────────────────────

/**
 * Mapea un `PricingStepResult` (steps del motor) a `CostLineTriInput`.
 * Usado por `CostLineMetalRow` / `CostLineOtherRow`.
 *
 * `equivUnit` se resuelve con `resolveItemCurrencyDisplay` (mismo passthrough
 * que ya usa la grilla) para que la sub-línea "≈ AR$ … / unidad" sea idéntica.
 */
export function costLineTriFromStep(
  step: { key?: string; value?: unknown; meta?: Record<string, unknown> | null },
  documentCurrency: string,
  currencyById?: CurrencyByIdMap | null,
): CostLineTriInput {
  const m       = step.meta ?? {};
  const key     = String(step.key ?? "");
  const isMetal = key === "COST_LINES_METAL" || key === "METAL_QUOTE";
  const total   = step.value != null ? parseFloat(String(step.value)) : 0;

  const num = (v: unknown): number | null =>
    v != null && Number.isFinite(parseFloat(String(v))) ? parseFloat(String(v)) : null;

  if (isMetal) {
    return {
      kind:      "METAL",
      unitBase:  num(m.quotePrice ?? m.price),
      qty:       num(m.qty ?? m.grams),
      mermaPct:  num(m.merma),
      adjAmount: num(m.mermaAmount), // solo si el motor lo emite; si no → null
      total,
    };
  }

  const conv = resolveItemCurrencyDisplay(
    {
      currencyId:    (m.fromCurrencyId as string | null | undefined) ?? null,
      currencyCode:  (m.currencyCode as string | null | undefined) ?? null,
      unitValue:     num(m.unitValue),
      unitValueBase: num(m.unitValueBase),
      totalValue:    total,
      quantity:      num(m.qty),
    },
    documentCurrency,
    currencyById,
  );

  return {
    kind:         "OTHER",
    unitBase:     num(m.unitValue),
    qty:          num(m.qty),
    currencyCode: conv?.originalCurrencyLabel ?? null,
    equivUnit:    conv?.equivalentUnitValue ?? null,
    adjKind:      (m.lineAdjKind as "BONUS" | "SURCHARGE" | undefined) ?? null,
    adjType:      (m.lineAdjType as "PERCENTAGE" | "FIXED_AMOUNT" | undefined) ?? null,
    adjValue:     num(m.lineAdjValue),
    adjAmount:    num(m.lineAdjAmount), // passthrough motor (firmado)
    total,
  };
}
