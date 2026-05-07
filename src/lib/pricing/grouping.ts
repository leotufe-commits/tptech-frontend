// src/lib/pricing/grouping.ts
// =============================================================================
// FASE F1.3 G4.x #10-A — helper PURO de agrupación de composition items.
//
// Reusable entre Factura (LineAdvancedOverridesPanel),
// Simulador (TPPriceCompositionKpis) y Comparador (PricingCompare).
// Sin JSX. Sin formateo. Sin colores. Sin i18n. Solo:
//
//   input (arrays de items) → grouped structure
//
// Decisiones del usuario (FASE A — MVP read-only grupal):
//   · METAL: agrupar por `metalVariantId`. Si dentro del grupo `appliedMermaPct`
//     difiere, devolver `appliedMermaPct === "varies"` (centinela).
//   · HECHURA: NO agrupar. Lista plana + agregado simple (count + total).
//   · PRODUCT/SERVICE: NO agrupar. Lista plana + agregado simple.
//   · Orden visual fijo: METAL → HECHURA → PRODUCTO → SERVICIO (no se decide acá;
//     el helper solo emite la estructura, el caller renderea en orden).
//
// Decimal safety:
//   · Sumas con BigInt escalado (6 decimales) para evitar drift de floats.
//   · Cero parseFloat/toFixed acumulativo. Cero Number.reduce con `+`.
//   · Solo el último step convierte BigInt → Number (división exacta por
//     potencia de 10 que cabe en Number sin pérdida).
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Tipos input (mínimos — estructuralmente compatibles con
// NormalizedCompositionMetalItem / pricingMeta.composition.metals[i] / etc.)
// ─────────────────────────────────────────────────────────────────────────────

export type GroupingMetalInput = {
  costLineId:        string | null;
  metalVariantId:    string | null;
  metalName:         string | null;
  purity:            number | null;
  purityLabel:       string | null;
  appliedGrams:      number | null;
  appliedMermaPct:   number | null;
  lineCost:          number | null;
};

export type GroupingHechuraInput = {
  costLineId:        string | null;
  appliedAmount:     number | null;
  lineCost:          number | null;
  lineLabel:         string | null;
};

/** Mínimo común de PRODUCT/SERVICE para grouping (solo campos usados en
 *  agregación). El call site puede pasar items con más campos — TS los
 *  ignora estructuralmente. */
export type GroupingProductServiceInput = {
  costLineId:       string | null;
  totalValue:       number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Tipos output
// ─────────────────────────────────────────────────────────────────────────────

/** Centinela exportable cuando un campo difiere entre items del grupo. */
export const VARIES = "varies" as const;
export type VariesSentinel = typeof VARIES;

export type GroupedMetalEntry<T extends GroupingMetalInput = GroupingMetalInput> = {
  /** Clave de agrupación: `metalVariantId` o `"__unknown__"` cuando es null. */
  groupKey:           string;
  /** Datos representativos del grupo (tomados del PRIMER item).
   *  Por contrato: items dentro del grupo comparten `metalVariantId`,
   *  por lo que estos campos también son consistentes en todo el grupo. */
  metalVariantId:     string | null;
  metalName:          string | null;
  purity:             number | null;
  purityLabel:        string | null;
  /** Cantidad de cost lines en este grupo. */
  count:              number;
  /** Σ appliedGrams de los items (Decimal-safe). null si todos los items son null. */
  totalAppliedGrams:  number | null;
  /** Σ lineCost de los items (Decimal-safe). null si todos son null. */
  totalLineCost:      number | null;
  /** Merma compartida del grupo:
   *   · number → todos los items comparten ese valor.
   *   · VARIES → al menos 2 valores distintos (UI debe mostrar "varias"
   *              y bloquear edición grupal de merma).
   *   · null → ningún item tiene mermaPct definido. */
  appliedMermaPct:    number | VariesSentinel | null;
  /** true cuando count === 1: la edición inline (Gramos/Merma) sigue
   *  siendo segura porque mapea 1-a-1 a la cost line.
   *  false cuando count >= 2: la UI debe mostrar "Editar desde la ficha
   *  del artículo" en vez de inputs editables. */
  isEditableInline:   boolean;
  /** Items originales del grupo (referencia, no copia). */
  items:              T[];
};

export type GroupAggregate = {
  count:    number;
  totalLineCost: number | null;
};

export type ProductServiceAggregate = {
  count:    number;
  totalValue: number | null;
};

export type GroupedComposition<
  M extends GroupingMetalInput        = GroupingMetalInput,
  H extends GroupingHechuraInput      = GroupingHechuraInput,
  P extends GroupingProductServiceInput = GroupingProductServiceInput,
> = {
  /** METAL agrupado por `metalVariantId`. Orden = primera aparición. */
  metals:            GroupedMetalEntry<M>[];
  /** HECHURA NO se agrupa (decisión usuario): lista plana + agregado.
   *  La UI muestra header compacto; al expandir, lines individuales. */
  hechuras:          H[];
  hechurasAggregate: GroupAggregate;
  /** PRODUCT NO se agrupa (decisión usuario): lista plana + agregado. */
  products:          P[];
  productsAggregate: ProductServiceAggregate;
  /** SERVICE NO se agrupa (decisión usuario): lista plana + agregado. */
  services:          P[];
  servicesAggregate: ProductServiceAggregate;
};

// ─────────────────────────────────────────────────────────────────────────────
// Suma Decimal-safe con BigInt escalado
// ─────────────────────────────────────────────────────────────────────────────

/** Escala fija de 6 decimales — suficiente para gramos (típicamente ≤4)
 *  y montos monetarios (típicamente ≤2). 1.000.000 cabe sin pérdida en
 *  Number (Number.MAX_SAFE_INTEGER ≈ 9.007e15, así que sumas hasta ~9e9
 *  unidades base son seguras). */
const SAFE_SUM_SCALE = 1_000_000;

/**
 * Suma Decimal-safe de números potencialmente con drift de float.
 *
 * Estrategia:
 *  · Escalar cada valor finito a entero (×SCALE + Math.round).
 *  · Acumular en BigInt (sin drift, exacto).
 *  · Devolver Number(acc) / SCALE al final (división exacta por potencia
 *    de 10 representable sin pérdida en Number).
 *
 * Devuelve `null` cuando NINGÚN valor del array es finito (todos null/undefined/NaN).
 * Esta semántica permite distinguir "no hay datos" de "suma = 0".
 *
 * Reglas:
 *   · NO usa parseFloat (input ya es number).
 *   · NO usa toFixed acumulativo (acumula en BigInt).
 *   · NO hace coerción JS sobre Number con `+`.
 */
export function safeSumNumbers(values: ReadonlyArray<number | null | undefined>): number | null {
  let acc = 0n;
  let hasAny = false;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    // Math.round del valor escalado neutraliza el float drift del input
    // individual (ej. 0.1 × 1e6 = 100000.00000000001 → Math.round = 100000).
    acc += BigInt(Math.round(v * SAFE_SUM_SCALE));
    hasAny = true;
  }
  if (!hasAny) return null;
  // Number(BigInt) es seguro porque acc cabe en MAX_SAFE_INTEGER para
  // los rangos comerciales esperados (gramos + montos en ARS).
  return Number(acc) / SAFE_SUM_SCALE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper público
// ─────────────────────────────────────────────────────────────────────────────

const UNKNOWN_KEY = "__unknown__";

/**
 * Agrupa items de composition para presentación visual.
 *
 * - METAL → agrupado por `metalVariantId`; merma "varies" cuando difiere.
 * - HECHURA, PRODUCT, SERVICE → lista plana + agregado simple.
 *
 * Cero matemática derivada (POLICY R4.5): solo agrupa, suma con
 * Decimal-safety, y expone agregados que la UI lee tal cual.
 */
export function groupCompositionItems<
  M extends GroupingMetalInput        = GroupingMetalInput,
  H extends GroupingHechuraInput      = GroupingHechuraInput,
  P extends GroupingProductServiceInput = GroupingProductServiceInput,
>(input: {
  metals?:   ReadonlyArray<M>;
  hechuras?: ReadonlyArray<H>;
  products?: ReadonlyArray<P>;
  services?: ReadonlyArray<P>;
}): GroupedComposition<M, H, P> {
  const metalsIn   = input.metals   ?? [];
  const hechurasIn = input.hechuras ?? [];
  const productsIn = input.products ?? [];
  const servicesIn = input.services ?? [];

  // ── METAL: agrupar por metalVariantId, preservar orden de primera
  // aparición usando una Map (Map garantiza insertion-order iteration).
  const metalGroupsMap = new Map<string, M[]>();
  for (const item of metalsIn) {
    const key = item.metalVariantId ?? UNKNOWN_KEY;
    let bucket = metalGroupsMap.get(key);
    if (!bucket) {
      bucket = [];
      metalGroupsMap.set(key, bucket);
    }
    bucket.push(item);
  }

  const metals: GroupedMetalEntry<M>[] = [];
  for (const [key, items] of metalGroupsMap) {
    const first = items[0];
    // Detectar merma compartida: si todos los valores no-null son iguales
    // (incluyendo "todos null"), comparten merma; sino → VARIES.
    let sharedMerma: number | VariesSentinel | null = null;
    let sawAnyNonNull = false;
    let mismatch = false;
    for (const it of items) {
      const m = it.appliedMermaPct ?? null;
      if (m == null) continue;
      if (!sawAnyNonNull) {
        sharedMerma  = m;
        sawAnyNonNull = true;
      } else if (sharedMerma !== m) {
        mismatch = true;
        break;
      }
    }
    if (mismatch) sharedMerma = VARIES;
    metals.push({
      groupKey:          key,
      metalVariantId:    first.metalVariantId,
      metalName:         first.metalName,
      purity:            first.purity,
      purityLabel:       first.purityLabel,
      count:             items.length,
      totalAppliedGrams: safeSumNumbers(items.map(i => i.appliedGrams)),
      totalLineCost:     safeSumNumbers(items.map(i => i.lineCost)),
      appliedMermaPct:   sharedMerma,
      isEditableInline:  items.length === 1,
      items,
    });
  }

  return {
    metals,
    hechuras: [...hechurasIn],
    hechurasAggregate: {
      count:         hechurasIn.length,
      totalLineCost: safeSumNumbers(hechurasIn.map(h => h.lineCost)),
    },
    products: [...productsIn],
    productsAggregate: {
      count:      productsIn.length,
      totalValue: safeSumNumbers(productsIn.map(p => p.totalValue)),
    },
    services: [...servicesIn],
    servicesAggregate: {
      count:      servicesIn.length,
      totalValue: safeSumNumbers(servicesIn.map(s => s.totalValue)),
    },
  };
}
