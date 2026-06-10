// src/components/sales/TotalDelComprobanteCard/helpers.ts
// =============================================================================
// Etapa B — Helpers PUROS del card maestro.
//
// Solo MAPPING VISUAL: nombres en español de grupos / modo. Cero matemática
// comercial. Cero side effects.
// =============================================================================

import type {
  BalanceBreakdownDTO,
  BalanceBreakdownMonetaryComponentDTO,
  BalanceMonetaryComponentGroupDTO,
} from "../../../services/sales";
import {
  buildMetalParentSaleLines,
  computeMetalSaleFactor,
} from "../../../lib/pricing/display/saleCompositionDisplay";
import type { BalanceMode, DocumentMetalSummaryItem } from "./types";

/** Label humano del modo de saldo. */
export function balanceModeLabel(mode: BalanceMode): string {
  return mode === "UNIFIED" ? "Unificado" : "Desglosado";
}

/** Label humano del grupo monetario. Mapeo cerrado — cero matemática.
 *  NOTA semántica (Etapa 1 — rename): el `group` key del DTO sigue siendo
 *  "HECHURA" para compat con backend, pero el label visual pasó a "Base
 *  monetaria" — refleja que el bucket abarca hechura + products + services +
 *  todo lo NO metálico pre-descuentos/impuestos (ver
 *  `tptech-backend/src/modules/sales/balance-mode-runtime.ts:366` —
 *  `hechuraSaleSubtotal`). "Hechura" como label confundía con el cost-line. */
export function groupLabel(group: BalanceMonetaryComponentGroupDTO): string {
  switch (group) {
    case "HECHURA":    return "Base monetaria";
    case "PRODUCT":    return "Productos / Servicios";
    case "TAX":        return "Impuestos";
    case "DISCOUNT":   return "Descuentos";
    case "BONUS":      return "Bonificaciones";
    case "SURCHARGE":  return "Recargos";
    case "ADJUSTMENT": return "Ajuste manual";
    case "ROUNDING":   return "Redondeo";
    case "SHIPPING":   return "Envío";
    case "COUPON":     return "Cupón";
    case "CHANNEL":    return "Canal de venta";
    case "PAYMENT":    return "Forma de pago";
    case "MARGIN":     return "Diferencia metal";
  }
}

/** Fallback legacy: deriva el grupo desde el `type` cuando un component no
 *  trae `group` (snapshots históricos pre-Fase 1). */
export function typeToGroup(type: string): BalanceMonetaryComponentGroupDTO {
  switch (type) {
    case "HECHURA":           return "HECHURA";
    case "PRODUCT":           return "PRODUCT";
    case "SERVICE":           return "PRODUCT";
    case "TAX":               return "TAX";
    case "BONUS":             return "BONUS";
    case "SURCHARGE":         return "SURCHARGE";
    case "DISCOUNT_QTY":
    case "DISCOUNT_PROMO":
    case "DISCOUNT_CLIENT":
    case "DISCOUNT_MANUAL":   return "DISCOUNT";
    case "COUPON":            return "COUPON";
    case "CHANNEL":           return "CHANNEL";
    case "PAYMENT":           return "PAYMENT";
    case "SHIPPING":          return "SHIPPING";
    case "ROUNDING_MONETARY": return "ROUNDING";
    case "MANUAL_ADJUSTMENT": return "ADJUSTMENT";
    default:                  return "ADJUSTMENT";
  }
}

export interface GroupedComponents {
  group:      BalanceMonetaryComponentGroupDTO;
  components: BalanceBreakdownMonetaryComponentDTO[];
}

// ────────────────────────────────────────────────────────────────────────────
// Etapa UX-Tax — Reorganización conceptual del desglose monetario
//
// La pila plana original (un grupo tras otro en orden de aparición) mezclaba
// 4 mundos conceptuales en la misma columna visual:
//   · Construcción comercial   — HECHURA, PRODUCT (base del subtotal)
//   · Ajustes a la base        — CHANNEL, COUPON, BONUS, DISCOUNT, SURCHARGE
//   · Impuestos                — TAX (resultado fiscal sobre la base)
//   · Adicionales post-tax     — SHIPPING, PAYMENT, ROUNDING, ADJUSTMENT
//
// `categorizeGroupsForDisplay` clasifica cada `group` en una sección. Es un
// helper PURO: no calcula, no transforma montos, solo mapea grupos a
// secciones. La fuente sigue siendo `balanceBreakdown.monetaryBalance.components[]`
// del backend — passthrough total. Si el backend agrega un grupo nuevo, el
// switch fuerza al desarrollador a clasificarlo (default → POST_TAX, lo más
// conservador: no infla la base imponible).
// ────────────────────────────────────────────────────────────────────────────

export type DisplaySection =
  | "COMMERCIAL"        // Construcción del subtotal gravable
  | "BASE_ADJUSTMENTS"  // Ajustes a la base imponible (modifican taxableBase)
  | "TAXES"             // IVA + percepciones + sellos + cargos fijos
  | "POST_TAX";         // Envío + forma de pago + redondeo + ajustes futuros

/** Clasifica un `BalanceMonetaryComponentGroupDTO` en una de las 4 secciones
 *  conceptuales (POLICY §Tax.1). Helper PURO — sin matemática. */
export function classifyGroup(
  group: BalanceMonetaryComponentGroupDTO,
): DisplaySection {
  switch (group) {
    case "HECHURA":
    case "PRODUCT":
      return "COMMERCIAL";
    case "CHANNEL":
    case "COUPON":
    case "BONUS":
    case "DISCOUNT":
    case "SURCHARGE":
      return "BASE_ADJUSTMENTS";
    case "TAX":
      return "TAXES";
    case "SHIPPING":
    case "PAYMENT":
    case "ROUNDING":
    case "ADJUSTMENT":
      return "POST_TAX";
    // Etapa UX-Auditable — el bucket MARGIN (METAL_MARGIN) clasifica como
    // COMMERCIAL: aparece junto a la HECHURA en la sección comercial porque
    // conceptualmente es el "gap" del metal lado venta vs. físico, no un
    // ajuste de cabecera (no es descuento, no es impuesto, no es post-tax).
    case "MARGIN":
      return "COMMERCIAL";
  }
}

export interface CategorizedGroups {
  section: DisplaySection;
  groups:  GroupedComponents[];
}

/** Reorganiza `GroupedComponents[]` en las 4 secciones conceptuales,
 *  preservando el orden interno de los `groups` dentro de cada sección.
 *  Las secciones se devuelven SIEMPRE en orden canónico:
 *  COMMERCIAL → BASE_ADJUSTMENTS → TAXES → POST_TAX. Si una sección no
 *  tiene grupos, se omite del array de salida. Helper PURO. */
export function categorizeGroupsForDisplay(
  grouped: GroupedComponents[],
): CategorizedGroups[] {
  const buckets = new Map<DisplaySection, GroupedComponents[]>();
  for (const g of grouped) {
    const section = classifyGroup(g.group);
    let bucket = buckets.get(section);
    if (!bucket) {
      bucket = [];
      buckets.set(section, bucket);
    }
    bucket.push(g);
  }
  const ORDER: DisplaySection[] = ["COMMERCIAL", "BASE_ADJUSTMENTS", "TAXES", "POST_TAX"];
  return ORDER
    .filter((s) => buckets.get(s) && buckets.get(s)!.length > 0)
    .map((s) => ({ section: s, groups: buckets.get(s)! }));
}

/** Label visible de cada sección. */
export function sectionLabel(section: DisplaySection): string {
  switch (section) {
    case "COMMERCIAL":       return "Construcción comercial";
    case "BASE_ADJUSTMENTS": return "Ajustes a la base imponible";
    case "TAXES":            return "Impuestos";
    case "POST_TAX":         return "Adicionales financieros";
  }
}

/** Caption secundaria por sección (display only). En POST_TAX deja claro
 *  que no afecta IVA — central a la pedagogía del card. */
export function sectionCaption(section: DisplaySection): string | null {
  switch (section) {
    case "COMMERCIAL":       return null;
    case "BASE_ADJUSTMENTS": return "Modifican la base imponible";
    case "TAXES":            return null;
    case "POST_TAX":         return "No afectan el IVA";
  }
}

/** Agrupa por `group` preservando el orden de PRIMERA APARICIÓN. Función
 *  pura — cero matemática. */
export function groupComponentsByGroup(
  components: BalanceBreakdownMonetaryComponentDTO[] | undefined,
): GroupedComponents[] {
  if (!components || components.length === 0) return [];
  const order: BalanceMonetaryComponentGroupDTO[] = [];
  const buckets = new Map<BalanceMonetaryComponentGroupDTO, BalanceBreakdownMonetaryComponentDTO[]>();
  for (const c of components) {
    const g = c.group ?? typeToGroup(c.type);
    let bucket = buckets.get(g);
    if (!bucket) {
      bucket = [];
      buckets.set(g, bucket);
      order.push(g);
    }
    bucket.push(c);
  }
  return order.map((g) => ({ group: g, components: buckets.get(g)! }));
}

// ────────────────────────────────────────────────────────────────────────────
// METALES — fuentes y normalización para `MetalsSummary`.
//
// REGLA DE PARIDAD (crítica): el bloque METALES del card maestro debe
// mostrar EXACTAMENTE las mismas cifras que el mini desglose por línea
// (`TPDocumentLineAdvancedEditor` "Composición del total"). La línea usa
// `buildMetalParentSaleLines` — gramos LADO VENTA (= cost × purity × merma ×
// `metalSaleFactor` × qty) y monto = Σ `lineSale` × qty. Si el card usa
// otra magnitud (ej. `gramsPure`, `totalEquivGr` sin factor de venta) el
// operador ve dos cifras distintas para el mismo metal del mismo
// comprobante → bug.
//
// Fuentes posibles:
//   1. `documentMetals` (preferida) — derivada por el caller desde
//      `lines[*].composition.metals[]` + `metalHechuraBreakdown` usando los
//      MISMOS helpers que la línea (`buildMetalParentSaleLines` +
//      `computeMetalSaleFactor`). Garantiza paridad exacta línea ↔ documento.
//   2. `balanceBreakdown.metals[]` (fallback) — autoridad del backend cuando
//      no hay `documentMetals` (snapshot sin `lines`/legacy). Usa los gramos
//      y valuación que el backend persistió.
//
// Cero matemática nueva: consolidación PURA (Σ por nombre de padre).
// ────────────────────────────────────────────────────────────────────────────

/** Slug del nombre del padre — key estable para listas (cuando no hay
 *  `metalParentId` del backend). Display-only. */
// number-format:ignore — slug interno, no display numérico
function slugMetalName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Normaliza las metals del backend (BREAKDOWN) al shape común. Fallback
 *  cuando NO hay `documentMetals` derivado de líneas (snapshot viejo, etc). */
function metalsFromBreakdown(
  metals: BalanceBreakdownDTO["metals"],
): DocumentMetalSummaryItem[] {
  return metals.map((m) => ({
    id:    m.metalParentId,
    name:  m.metalParentName,
    grams: m.gramsPure,
    monetaryAmount: m.valuationMonetary,
    sourceLineIds: Array.isArray((m as { sourceLineIds?: unknown }).sourceLineIds)
      ? ((m as { sourceLineIds: string[] }).sourceLineIds)
      : undefined,
  }));
}

/** Item per-línea aceptado por `deriveDocumentHechuraFromLines`. Mismo
 *  patrón que `CardLineForMetals`: paridad línea↔documento — cero matemática
 *  comercial nueva, solo Σ del `hechuraSale` ya emitido por el motor por
 *  línea (`metalHechuraBreakdown.hechuraSale`). */
export type CardLineForHechura = {
  quantity?: number | null;
  metalHechuraBreakdown?: {
    hechuraSale?: number | null;
  } | null;
} | null | undefined;

/** Deriva el bucket HECHURA puro consolidado del documento desde las líneas.
 *  Es Σ_lines( hechuraSale_line × quantity_line ) — passthrough exacto del
 *  campo que el motor ya emitió per línea (`metalHechuraBreakdown.hechuraSale`,
 *  post-rounding por componente si la lista lo configuró).
 *
 *  Acompaña a `deriveDocumentMetalsFromLines` con la misma garantía de
 *  paridad línea↔documento: si una línea muestra hechura 15.000, el
 *  total del documento debe mostrar Σ del mismo campo, no un derivado
 *  monetario combinado.
 *
 *  Devuelve `null` si el array está vacío o ninguna línea aporta hechura
 *  finita — el caller decide qué fallback usar.
 *
 *  IMPORTANTE: `hechuraSale` del motor viene ya per-unidad (no per-línea)
 *  en `metalHechuraBreakdown`. Multiplicamos por `quantity` para obtener
 *  el aporte de la línea al subtotal del documento (mismo criterio que
 *  el motor usa internamente en `computeSaleDocumentTotals`). */
export function deriveDocumentHechuraFromLines(
  lines: ReadonlyArray<CardLineForHechura>,
): number | null {
  if (!lines || lines.length === 0) return null;
  let sum = 0;
  let any = false;
  for (const line of lines) {
    if (!line) continue;
    const h = line.metalHechuraBreakdown?.hechuraSale;
    if (h == null || !Number.isFinite(h)) continue;
    const q = line.quantity != null && Number.isFinite(line.quantity) && line.quantity > 0
      ? line.quantity : 1;
    sum += h * q;
    any = true;
  }
  return any ? sum : null;
}

/** Resuelve el importe del label "Total hechura" según el modo.
 *
 *  - BREAKDOWN → bucket HECHURA puro. Cascada de fuentes (en orden de
 *    prioridad, todas passthrough del backend — cero matemática comercial):
 *      1. `monetaryBalance.components[]` con `group === "HECHURA"`
 *         (shape moderno — el backend lo emite desde
 *         `buildDocumentMonetaryComponentsFromTotals` con autoridad).
 *      2. Σ de `lines[i].metalHechuraBreakdown.hechuraSale × quantity`
 *         (paridad línea↔documento — mismo campo que el mini-desglose
 *         por línea ya muestra; el motor lo emite post-rounding por
 *         componente). Si el backend NO popula `components[]` por
 *         cualquier razón pero las líneas SÍ tienen el desglose, esta
 *         derivación garantiza el bucket correcto.
 *      3. Fallback legacy: snapshots viejos sin components[] ni líneas —
 *         se devuelve `monetaryBalance.amount` (comportamiento previo,
 *         degradación SEGURA). Snapshots históricos quedan como estaban.
 *    NUNCA se usa `monetaryBalance.amount` cuando hay fuente moderna —
 *    ese campo es el saldo monetario COMPLETO post-metales (incluye IVA,
 *    descuentos, canal, cupón, envío, redondeo) y mezclaría todo en el
 *    label "Total hechura" → bug visual histórico (mostraba 59.384,06
 *    cuando hechura pura era 15.000,00).
 *
 *  - UNIFIED  → resta visual `totalDocument − Σ documentMetals[*].monetaryAmount`.
 *    El motor en UNIFIED emite `monetaryBalance.amount === documentTotal`
 *    (no resta metales) → usar ese campo duplicaría el Total del comprobante.
 *    La resta NO es pricing; usa dos valores ya normalizados (total del
 *    motor + monto venta consolidado por padre vía `buildMetalParentSaleLines`)
 *    para mostrar el bucket "no metal". Si un metal trae `monetaryAmount`
 *    null (snapshot legacy sin `lineSale`), se omite de la Σ — no se inventa.
 *
 *  Devuelve `null` cuando no se puede derivar (sin breakdown ni líneas en
 *  BREAKDOWN, sin total finito en UNIFIED). El caller decide si renderiza.
 *  Cero matemática comercial: passthrough + Σ + resta de display. */
export function resolveMonetaryHeaderAmount(
  mode:             BalanceMode,
  totalDocument:    number | null | undefined,
  breakdown:        BalanceBreakdownDTO | null | undefined,
  resolvedMetals:   ReadonlyArray<DocumentMetalSummaryItem>,
  lines?:           ReadonlyArray<CardLineForHechura> | null,
): number | null {
  if (mode === "BREAKDOWN") {
    // (1) Autoridad backend explícita: components[] con group=HECHURA.
    const comps = breakdown?.monetaryBalance?.components;
    if (comps && Array.isArray(comps)) {
      let hechura = 0;
      let foundHechura = false;
      for (const c of comps) {
        if (c && c.group === "HECHURA" && Number.isFinite(c.amount)) {
          hechura += c.amount;
          foundHechura = true;
        }
      }
      if (foundHechura) return hechura;
      // components[] presente pero SIN HECHURA → probar derivación de líneas
      // (caso donde el backend emite otros components pero no HECHURA).
    }
    // (2) Derivación de líneas — paridad línea↔documento.
    if (lines && lines.length > 0) {
      const derived = deriveDocumentHechuraFromLines(lines);
      if (derived != null) return derived;
    }
    // (3) Fallback legacy: snapshot sin components[] ni líneas.
    const a = breakdown?.monetaryBalance?.amount;
    return a != null && Number.isFinite(a) ? a : null;
  }
  // UNIFIED
  if (totalDocument == null || !Number.isFinite(totalDocument)) return null;
  let metalSum = 0;
  for (const m of resolvedMetals) {
    if (m.monetaryAmount != null && Number.isFinite(m.monetaryAmount)) {
      metalSum += m.monetaryAmount;
    }
  }
  return totalDocument - metalSum;
}

/** Shape mínimo del `documentRoundingApplied` que necesitamos leer para
 *  detectar redondeo FÍSICO de gramos por metal padre (POLICY §R-Rounding-13,
 *  Etapa D). Tipado al ras para no acoplarnos al shape estricto del DTO. */
export type DocumentRoundingAppliedPhysicalLike = {
  breakdown?: {
    metalDomain?:   string | null;
    metalPhysical?: {
      metals?: ReadonlyArray<{
        deltaGrams?: number | null;
      } | null | undefined>;
      metalMonetaryEquivalent?: number | null;
    } | null;
  } | null;
  totals?: {
    metalMonetaryEquivalent?: number | null;
  } | null;
} | null | undefined;

/** Detecta si el redondeo físico de gramos (Etapa D, capa 16) está
 *  activo en este preview/confirm.
 *
 *  Reglas (cualquiera basta — degradación segura, OR explícito):
 *    1. `breakdown.metalDomain === "PHYSICAL"` — el backend marca dominio.
 *    2. `breakdown.metalPhysical.metals[]` tiene al menos un `deltaGrams ≠ 0`.
 *    3. `breakdown.metalPhysical.metalMonetaryEquivalent ≠ 0` o
 *       `totals.metalMonetaryEquivalent ≠ 0` (la capa 16 produjo delta $).
 *
 *  Helper PURO, sin side effects. */
export function hasPhysicalRoundingActive(
  documentRoundingApplied: DocumentRoundingAppliedPhysicalLike,
): boolean {
  if (!documentRoundingApplied) return false;
  const dra = documentRoundingApplied;
  if (dra.breakdown?.metalDomain === "PHYSICAL") return true;
  const mp = dra.breakdown?.metalPhysical;
  if (mp) {
    const eq = mp.metalMonetaryEquivalent;
    if (typeof eq === "number" && Number.isFinite(eq) && Math.abs(eq) > 0.005) {
      return true;
    }
    if (Array.isArray(mp.metals)) {
      for (const m of mp.metals) {
        const d = m?.deltaGrams;
        if (typeof d === "number" && Number.isFinite(d) && Math.abs(d) > 1e-9) {
          return true;
        }
      }
    }
  }
  const totalsEq = dra.totals?.metalMonetaryEquivalent;
  if (typeof totalsEq === "number" && Number.isFinite(totalsEq) && Math.abs(totalsEq) > 0.005) {
    return true;
  }
  return false;
}

/** Etapa 2D — Enriquece cada item con `displayGrams` (gramos LADO VENTA /
 *  comercial consolidado) tomados de `documentMetals` (= `gramsEquivLine` de
 *  `deriveDocumentMetalsFromLines`, lo que muestra el card de línea). Mantiene
 *  `grams` (físico `gramsPure`) intacto para ajuste manual / cuenta corriente /
 *  redondeo físico. Match por `id` (canónico) → fallback por nombre. Si no hay
 *  match, `displayGrams` queda sin setear y el render cae a `grams`. Cero
 *  matemática — solo selección de un campo ya derivado por el caller. */
function attachDisplayGrams(
  items: DocumentMetalSummaryItem[],
  documentMetals: DocumentMetalSummaryItem[] | undefined,
): DocumentMetalSummaryItem[] {
  if (!documentMetals || documentMetals.length === 0) return items;
  const byId   = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const dm of documentMetals) {
    if (typeof dm.grams !== "number" || !Number.isFinite(dm.grams)) continue;
    if (dm.id) byId.set(dm.id, dm.grams);
    byName.set((dm.name ?? "").trim().toLowerCase(), dm.grams);
  }
  return items.map((it) => {
    const dg = (it.id != null && byId.has(it.id))
      ? byId.get(it.id)
      : byName.get((it.name ?? "").trim().toLowerCase());
    return (typeof dg === "number" && Number.isFinite(dg))
      ? { ...it, displayGrams: dg }
      : it;
  });
}

/** Elige la fuente de metales para el card "Patrimonio Metálico".
 *
 *  REGLA MADRE (POLICY §R-Rounding-14, Opción C de la auditoría):
 *  El bloque "Patrimonio Metálico" SIEMPRE muestra gramos FÍSICOS — nunca
 *  `metalGramsSale` (lado venta con margen). El valor que ve el operador
 *  representa lo que TIENE físicamente, no un concepto de pricing.
 *
 *  Prioridad de fuentes (orden estricto):
 *
 *    0. **Etapa D' — Redondeo COMERCIAL PER_DOCUMENT** (capa nueva, snapshot
 *       a nivel documento). FUENTE ÚNICA DE VERDAD cuando existe. Override
 *       de `grams` por `postGrams` agrupado por `metalParentName` (que el
 *       backend pobló legible). Es passthrough puro — cero cálculo FE.
 *       PROHIBIDO reconstruir desde balanceBreakdown / monetaryBalance /
 *       documentMetals cuando este snapshot existe.
 *
 *    1. **Redondeo FINANCIERO PHYSICAL activo** (Etapa D, capa 16) →
 *       `balanceBreakdown.metals[]` (`gramsPure` ya viene mutado a `postGrams`
 *       por `applyDocumentPhysicalRounding`). Autoridad backend.
 *
 *    2. **Redondeo COMERCIAL PHYSICAL activo** (snapshot por línea, legacy
 *       PER_LINE) → merge: tomar `balanceBreakdown.metals[]` como base y,
 *       por cada metal padre que tenga override comercial, REEMPLAZAR `grams`
 *       por la suma de `postGrams` agregada por `metalParentId` desde el
 *       snapshot comercial. Es agregación canónica (Σ por key estable), NO
 *       cálculo de precios.
 *
 *    3. **Sin redondeo PHYSICAL** → `balanceBreakdown.metals[]` (`gramsPure`
 *       físico del documento, sin margen). ANTES esta rama caía a
 *       `documentMetals` que devuelve `metalGramsSale` (gramos lado venta)
 *       — eso confundía precio con inventario y mostraba "1,068 gr" cuando
 *       el operador realmente tiene "0,9075 gr".
 *
 *    4. **Último fallback** — `documentMetals` cuando el balance no viene
 *       (snapshot legacy sin `lines`/balance). Preserva back-compat.
 *
 *  Cero matemática comercial nueva — solo selección de campos y agregación
 *  por key. POLICY §R-Rounding-9 (frontend lector puro). */
export function resolveCardMetals(
  breakdown:               BalanceBreakdownDTO | null | undefined,
  documentMetals:          DocumentMetalSummaryItem[] | undefined,
  documentRoundingApplied?: DocumentRoundingAppliedPhysicalLike,
  commercialPhysicalMetals?: ReadonlyArray<{
    metalParentId?:  string | null;
    metalParentName?: string;
    postGrams?:      number;
    deltaGrams?:     number | null;
    quantity?:       number | null;
  } | null | undefined>,
  /** Etapa D' (cierre conceptual) — snapshot canónico del Redondeo Comercial
   *  PER_DOCUMENT (`Sale.commercialDocumentRoundingSnapshot` / response
   *  `documentTotals.commercialDocumentRoundingApplied`). Cuando existe con
   *  scope BREAKDOWN y `breakdown.metals[]`, es la FUENTE ÚNICA DE VERDAD
   *  del gramos por metal padre — todas las otras prioridades quedan
   *  subordinadas. Passthrough puro — cero matemática FE. */
  commercialDocSnapshot?: {
    scope?: "UNIFIED" | "BREAKDOWN" | string;
    breakdown?: {
      metals?: ReadonlyArray<{
        metalParentId?:   string;
        metalParentName?: string;
        postGrams?:       number;
      } | null | undefined>;
    } | null;
  } | null,
): DocumentMetalSummaryItem[] {
  // Etapa 2D — el cuerpo histórico resuelve los gramos FÍSICOS (`grams`); al
  // final se enriquece con `displayGrams` (lado venta) sin tocar `grams`.
  const result: DocumentMetalSummaryItem[] = (() => {
  // Prioridad 0: Etapa D' — snapshot canónico del Redondeo Comercial
  // PER_DOCUMENT. FUENTE ÚNICA DE VERDAD cuando existe.
  const commercialDocByName = aggregateCommercialDocPostGramsByName(commercialDocSnapshot);
  if (commercialDocByName.size > 0) {
    // Merge con el balance breakdown como base (para preservar metadata
    // accesoria del item — sourceLineIds, monetaryAmount, etc.) y override
    // `grams` por postGrams agrupado por NOMBRE del padre (legible, post-fix
    // backend). Si no hay balance breakdown, armamos items mínimos desde el
    // snapshot — degradación segura. Si el nombre no matchea ningún item del
    // balance (caso edge), agregamos uno nuevo desde el snapshot.
    if (breakdown && breakdown.metals.length > 0) {
      const baseItems = metalsFromBreakdown(breakdown.metals);
      const baseByName = new Map(baseItems.map((it) => [it.name, it]));
      const out: DocumentMetalSummaryItem[] = [];
      for (const [name, postGrams] of commercialDocByName) {
        const base = baseByName.get(name);
        if (base) {
          out.push({ ...base, grams: postGrams });
          baseByName.delete(name);
        } else {
          out.push({ id: slugMetalName(name) || name, name, grams: postGrams, monetaryAmount: null });
        }
      }
      // Items del balance que NO tienen override en el snapshot quedan tal cual.
      for (const it of baseByName.values()) out.push(it);
      return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    // Sin balance breakdown: armar items directos desde el snapshot.
    return Array.from(commercialDocByName.entries())
      .map(([name, postGrams]) => ({
        id:             slugMetalName(name) || name,
        name,
        grams:          postGrams,
        monetaryAmount: null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  const financialActive = hasPhysicalRoundingActive(documentRoundingApplied);

  // Prioridad 1: Financiero PHYSICAL — balance ya viene con postGrams.
  if (financialActive && breakdown && breakdown.metals.length > 0) {
    return metalsFromBreakdown(breakdown.metals);
  }

  // Prioridad 2: Comercial PHYSICAL — override de gramos por metal padre con
  // postGrams agregados desde el snapshot de líneas (legacy PER_LINE).
  const commercialPostByParent = aggregateCommercialPostGrams(commercialPhysicalMetals);
  if (commercialPostByParent.size > 0 && breakdown && breakdown.metals.length > 0) {
    return metalsFromBreakdown(breakdown.metals).map((item) => {
      const override = commercialPostByParent.get(item.id);
      return override != null ? { ...item, grams: override } : item;
    });
  }

  // Prioridad 3: Sin PHYSICAL — gramos físicos del balance (gramsPure).
  if (breakdown && breakdown.metals.length > 0) {
    return metalsFromBreakdown(breakdown.metals);
  }

  // Prioridad 4: Fallback legacy — documentMetals (snapshot sin balance).
  if (documentMetals && documentMetals.length > 0) {
    return documentMetals;
  }

  return [];
  })();
  // SSOT card ↔ footer (fix listas mixtas 2026-06) — el gramo PRINCIPAL de
  // METALES debe ser SIEMPRE `displayGrams` (= `gramsEquivLine` / `saleEquivGr`
  // del card: metal padre equivalente con pureza + merma + margen) cuando exista,
  // independientemente de si hubo redondeo físico (comercial PER_DOC / financiero
  // PHYSICAL).
  //
  // Antes se suprimía `displayGrams` cuando `physicalOverrideActive` era true y el
  // gramo caía a `grams` (físico `postGrams`). En documentos MIXED (sin snapshot
  // comercial PER_DOCUMENT) + redondeo financiero PHYSICAL activo, eso hacía que
  // el footer mostrara gramos FÍSICOS en vez del equivalente comercial de los
  // cards → divergencia card↔footer.
  //
  // `attachDisplayGrams` SOLO agrega el campo `displayGrams` (NO toca `grams`):
  // así el físico `postGrams` queda disponible intacto para la cuenta corriente
  // metálica, las sub-filas de redondeo físico y los tooltips, mientras el
  // gramo grande renderiza `displayGrams ?? grams`. Si el caller no provee
  // `documentMetals` (sin líneas), `attachDisplayGrams` es no-op → fallback a
  // `grams` (físico), sin cambio de comportamiento.
  return attachDisplayGrams(result, documentMetals);
}

/** Helper puro: Σ `postGrams` por `metalParentName` desde el snapshot canónico
 *  Etapa D'. Devuelve `Map<name, postGrams>`. Map vacío cuando el snapshot
 *  no existe, no es BREAKDOWN, o no trae metals[]. Cero matemática nueva —
 *  solo selección + agregación por key estable. */
function aggregateCommercialDocPostGramsByName(
  snapshot?: {
    scope?: "UNIFIED" | "BREAKDOWN" | string;
    breakdown?: {
      metals?: ReadonlyArray<{
        metalParentName?: string;
        postGrams?:       number;
      } | null | undefined>;
    } | null;
  } | null,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!snapshot || snapshot.scope !== "BREAKDOWN") return out;
  const metals = snapshot.breakdown?.metals;
  if (!Array.isArray(metals)) return out;
  for (const m of metals) {
    if (!m) continue;
    const name = typeof m.metalParentName === "string" && m.metalParentName.length > 0
      ? m.metalParentName
      : null;
    const post = typeof m.postGrams === "number" && Number.isFinite(m.postGrams) ? m.postGrams : null;
    if (name == null || post == null) continue;
    out.set(name, (out.get(name) ?? 0) + post);
  }
  return out;
}

/** Etapa UX.32 (2026-05-30) — Deriva el valor COMERCIAL por metal padre
 *  agrupando `composition.metals[i].lineCost × line.quantity` por `metalName`.
 *
 *  El backend emite `lineCost` por cost-line (= `qty_artículo × purity ×
 *  (1+merma) × unitValue` — `pricing-engine.cost.ts:233`). Sumar esos
 *  valores por metalName y multiplicar por la cantidad de la línea de
 *  venta da el valor comercial total del metal padre.
 *
 *  Garantía verificada E2E contra qty=1, 3 y 7 contra el preview real:
 *    Σ_padres(derivado) === documentTotals.metalCostSubtotal
 *
 *  Cero matemática comercial nueva — agregación pura de un campo del motor.
 *  Devuelve `Record<metalName, monto>`. Mapas vacíos para casos sin metal. */
export function buildCommercialMetalValueByParent(
  lines: ReadonlyArray<{
    quantity?: number | null;
    composition?: {
      metals?: ReadonlyArray<{
        metalName?: string | null;
        lineCost?:  number | string | null;
      } | null | undefined> | null;
    } | null;
  } | null | undefined>,
): Record<string, number> {
  const acc: Record<string, number> = {};
  if (!Array.isArray(lines)) return acc;
  for (const line of lines) {
    if (!line) continue;
    const qty =
      typeof line.quantity === "number" && Number.isFinite(line.quantity) && line.quantity > 0
        ? line.quantity
        : 1;
    const metals = line.composition?.metals ?? [];
    for (const m of metals) {
      if (!m) continue;
      const name = typeof m.metalName === "string" && m.metalName.trim().length > 0
        ? m.metalName.trim()
        : null;
      if (!name) continue;
      const lcRaw = m.lineCost;
      const lc = typeof lcRaw === "number"
        ? lcRaw
        : typeof lcRaw === "string"
          ? Number.parseFloat(lcRaw)
          : Number.NaN;
      if (!Number.isFinite(lc)) continue;
      const contribution = lc * qty;
      acc[name] = Math.round(((acc[name] ?? 0) + contribution) * 100) / 100;
    }
  }
  return acc;
}

/** Helper PURO de agregación: Σ (`postGrams` × `quantity`) por `metalParentId`
 *  desde el snapshot comercial PHYSICAL. Es selección + suma por key estable
 *  — POLICY §R-Rounding-9 lo permite (no es cálculo comercial; los gramos
 *  vienen ya redondeados del backend, sólo consolidamos por metal padre y
 *  escalamos por la cantidad de la línea para reflejar el PATRIMONIO TOTAL
 *  del documento, no por unidad).
 *
 *  El backend emite `postGrams` POR UNIDAD del metal padre (la entry vive
 *  dentro de `lines[i].appliedRounding.physical.metals[]`, una por línea).
 *  Si `quantity` no llega o no es finita/positiva, se asume `1` para
 *  preservar back-compat con fixtures y callers viejos.
 *
 *  Devuelve `Map` vacío cuando no hay entries con delta != 0. */
function aggregateCommercialPostGrams(
  metals?: ReadonlyArray<{
    metalParentId?:  string | null;
    postGrams?:      number;
    deltaGrams?:     number | null;
    quantity?:       number | null;
  } | null | undefined>,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!Array.isArray(metals)) return out;
  for (const m of metals) {
    if (!m) continue;
    const delta = m.deltaGrams;
    if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) continue;
    const id   = typeof m.metalParentId === "string" && m.metalParentId.length > 0
      ? m.metalParentId
      : null;
    const post = typeof m.postGrams === "number" && Number.isFinite(m.postGrams) ? m.postGrams : null;
    if (id == null || post == null) continue;
    const qty = typeof m.quantity === "number" && Number.isFinite(m.quantity) && m.quantity > 0
      ? m.quantity
      : 1;
    out.set(id, (out.get(id) ?? 0) + post * qty);
  }
  return out;
}

/** Item per-línea aceptado por `deriveDocumentMetalsFromLines`. Se acopla
 *  al shape mínimo de `SalePreviewLine` (composition.metals + quantity +
 *  metalHechuraBreakdown). El último es CRÍTICO para resolver el
 *  `metalSaleFactor` per línea — sin él los gramos quedan en lado COSTO y
 *  rompen la paridad con la línea. */
export type CardLineForMetals = {
  quantity?: number | null;
  composition?: {
    metals?: ReadonlyArray<{
      metalName?:        string | null;
      purity?:           number | null;
      appliedGrams?:     number | null;
      appliedMermaPct?:  number | null;
      variantName?:      string | null;
      metalVariantName?: string | null;
      purityLabel?:      string | null;
      lineSale?:         number | null;
      /** Venta BASE PRE-redondeo per cost-line (Composición). Cae a `lineSale`
       *  cuando el item no trae el campo. Permite consolidar "Valor de venta
       *  metal" (PRE) en el footer = el mismo dato del card. */
      lineSalePreRounding?: number | null;
    } | null | undefined>;
  } | null;
  metalHechuraBreakdown?: {
    metalCost?: number | null;
    metalSale?: number | null;
  } | null;
} | null | undefined;

/** Deriva el resumen consolidado de metales padres del documento desde las
 *  líneas del preview, GARANTIZANDO PARIDAD EXACTA con el mini desglose por
 *  línea (`TPDocumentLineAdvancedEditor` → "Composición del total" → bloque
 *  METAL). Misma fórmula que la línea:
 *
 *    factor = metalSale / metalCost                   (por línea)
 *    grams  = Σ_lineas( gramsEquivLine(factor, qty) )  (por padre)
 *    amount = Σ_lineas( saleAmountLine(qty) )          (por padre)
 *
 *  Cero matemática comercial nueva: delega en `buildMetalParentSaleLines`
 *  + `computeMetalSaleFactor` (los mismos helpers canónicos que ya usa
 *  `TPDocumentLineAdvancedEditor` per línea). La consolidación cross-líneas
 *  es Σ pura por nombre de padre. */
export function deriveDocumentMetalsFromLines(
  lines: ReadonlyArray<CardLineForMetals>,
): DocumentMetalSummaryItem[] {
  const acc = new Map<
    string,
    { grams: number; amount: number; hasAmount: boolean }
  >();
  for (const line of lines) {
    if (!line || !line.composition?.metals) continue;
    const factor = computeMetalSaleFactor({
      metalCost: line.metalHechuraBreakdown?.metalCost ?? null,
      metalSale: line.metalHechuraBreakdown?.metalSale ?? null,
    });
    // Normaliza al shape requerido por `buildMetalParentSaleLines`
    // (campos requeridos como `metalName: string | null`). Passthrough puro.
    const normalizedMetals = line.composition.metals.map((m) =>
      m == null
        ? null
        : {
            metalName:        m.metalName        ?? null,
            purity:           m.purity           ?? null,
            appliedGrams:     m.appliedGrams     ?? null,
            appliedMermaPct:  m.appliedMermaPct  ?? null,
            variantName:      m.variantName      ?? null,
            metalVariantName: m.metalVariantName ?? null,
            purityLabel:      m.purityLabel      ?? null,
            lineSale:         m.lineSale         ?? null,
          },
    );
    const parents = buildMetalParentSaleLines(
      normalizedMetals,
      line.quantity ?? 1,
      factor,
    );
    for (const p of parents) {
      const prev = acc.get(p.name) ?? { grams: 0, amount: 0, hasAmount: false };
      prev.grams += p.gramsEquivLine;
      if (p.saleAmountLine != null) {
        prev.amount   += p.saleAmountLine;
        prev.hasAmount = true;
      }
      acc.set(p.name, prev);
    }
  }
  return Array.from(acc.entries())
    .map(([name, v]) => ({
      id:             slugMetalName(name) || name,
      name,
      grams:          v.grams,
      monetaryAmount: v.hasAmount ? v.amount : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Fase 1 (2026-06) — Valor de VENTA del metal por padre como
 *  `Record<metalName, monto>`. Fuente canónica ÚNICA: el MISMO
 *  `deriveDocumentMetalsFromLines` (`monetaryAmount = saleAmountLine =
 *  Σ lineSale × qty = metalSale del motor`). A diferencia de
 *  `buildCommercialMetalValueByParent` (que devuelve el COSTO `lineCost`),
 *  este devuelve el valor de VENTA (con margen).
 *
 *  Se separa de `m.monetaryAmount` del card porque ese campo es ambiguo
 *  (venta cuando viene de líneas, valuación FÍSICA cuando viene de
 *  `balanceBreakdown`). Acá la fuente es SIEMPRE líneas → SIEMPRE venta.
 *
 *  Passthrough puro — reusa el helper canónico, cero recálculo. Devuelve `{}`
 *  cuando no hay venta derivable (sin líneas / `lineSale` ausente). El footer
 *  usa ese `{}` para degradar a costo (fallback). */
export function buildMetalSaleByParent(
  lines: ReadonlyArray<CardLineForMetals>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of deriveDocumentMetalsFromLines(lines)) {
    if (typeof m.monetaryAmount === "number" && Number.isFinite(m.monetaryAmount)) {
      out[m.name] = (out[m.name] ?? 0) + m.monetaryAmount;
    }
  }
  return out;
}

/** Fix listas mixtas (2026-06) — Valor de venta del metal por padre PRE-redondeo
 *  comercial (`saleAmountLinePre` = Σ `lineSalePreRounding × qty`). Es el MISMO
 *  "Valor comercial" que muestra el card del artículo. El footer lo usa como
 *  BASE de la consolidación (en vez de `saleAmountLine` POST), para que
 *  `final = base + redondeo` NO duplique el redondeo cuando la lista lo aplica
 *  por línea (MIXED). Passthrough puro — reusa `buildMetalParentSaleLines`,
 *  cero recálculo. Devuelve `{}` si ninguna línea trae venta derivable. */
export function buildMetalSalePreByParent(
  lines: ReadonlyArray<CardLineForMetals>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of lines) {
    if (!line || !line.composition?.metals) continue;
    const factor = computeMetalSaleFactor({
      metalCost: line.metalHechuraBreakdown?.metalCost ?? null,
      metalSale: line.metalHechuraBreakdown?.metalSale ?? null,
    });
    const normalizedMetals = line.composition.metals.map((m) =>
      m == null
        ? null
        : {
            metalName:           m.metalName        ?? null,
            purity:              m.purity           ?? null,
            appliedGrams:        m.appliedGrams     ?? null,
            appliedMermaPct:     m.appliedMermaPct  ?? null,
            variantName:         m.variantName      ?? null,
            metalVariantName:    m.metalVariantName ?? null,
            purityLabel:         m.purityLabel      ?? null,
            lineSale:            m.lineSale         ?? null,
            lineSalePreRounding: m.lineSalePreRounding ?? null,
          },
    );
    const parents = buildMetalParentSaleLines(normalizedMetals, line.quantity ?? 1, factor);
    for (const p of parents) {
      if (typeof p.saleAmountLinePre === "number" && Number.isFinite(p.saleAmountLinePre)) {
        out[p.name] = Math.round(((out[p.name] ?? 0) + p.saleAmountLinePre) * 100) / 100;
      }
    }
  }
  return out;
}

/** FASE 1 — Footer "Monetario (saldo)" (2026-06-03).
 *  Σ del SALDO MONETARIO comercial por línea. Fuente ÚNICA:
 *  `lineCommercialSummary.monetary.amount` — el MISMO "MONETARIO" que muestra
 *  el Resumen Comercial de cada línea (`TPDocumentLineAdvancedEditor`). Lee
 *  top-level del preview o, defensivamente, de `pricingMeta` (draft).
 *
 *  Agregación PURA (Σ) — cero matemática comercial (passthrough del contrato
 *  por línea). Paridad por construcción: el footer = suma de los MONETARIO
 *  visibles por línea, así "Desglosada 185.500 + Desglosada 185.500 = 371.000".
 *
 *  Devuelve `null` cuando NINGUNA línea trae el contrato (snapshots viejos /
 *  líneas sin `lineCommercialSummary`) → el caller cae al cálculo legacy del
 *  header (back-compat, no rompe flujos existentes). */
type LineCommercialSummaryShape = {
  monetary?: { amount?: number | null; roundingImpact?: number | null } | null;
  /** Bloque METAL — presente en líneas DESGLOSADAS. `byParent[].roundingImpact`
   *  = impacto $ del redondeo comercial del metal padre de ESA línea. Usado
   *  para consolidar el footer MIXED cuando no hay snapshot document-level. */
  metals?: {
    roundingImpact?: number | null;
    byParent?: ReadonlyArray<{
      metalParentId?:   string | null;
      metalParentName?: string | null;
      roundingImpact?:  number | null;
      /** Gramo VISIBLE del metal padre que el card del artículo RENDERIZA
       *  (post-redondeo comercial PER_DOCUMENT). Es el `postGrams`/`visibleGrams`
       *  que `TPDocumentLineAdvancedEditor` muestra como gramo principal de la
       *  línea. El footer lo consolida (`buildVisibleGramsByParent`) para que
       *  card y footer muestren EXACTAMENTE el mismo gramo. */
      visibleGrams?:    number | null;
    }> | null;
  } | null;
} | null | undefined;

export function sumLineCommercialMonetary(
  lines: ReadonlyArray<unknown>,
): number | null {
  if (!Array.isArray(lines)) return null;
  let sum = 0;
  let any = false;
  for (const item of lines) {
    if (!item || typeof item !== "object") continue;
    const line = item as {
      lineCommercialSummary?: LineCommercialSummaryShape;
      pricingMeta?: { lineCommercialSummary?: LineCommercialSummaryShape } | null;
    };
    // NOTA (2026-06) — NO usar `lineOwnMonetarySaldoPostCommercialRounding` como
    // fuente del "Valor final monetario". En listas DESGLOSADAS SIN redondeo ese
    // campo trae el TOTAL DE LÍNEA (no el saldo monetario) → inflaría el footer.
    // El "Valor final monetario" del footer DESGLOSADO se resuelve por residual
    // `total − Σ valor final metal` en `TotalDelComprobanteCard`
    // (`monetarioSaldoResolved`), que SIEMPRE da el saldo y cierra el invariante.
    // Este helper queda como Σ del contrato `monetary.amount` (referencia /
    // back-compat); el redondeo autónomo se suma aparte (sibling helper).
    const summary = line.lineCommercialSummary ?? line.pricingMeta?.lineCommercialSummary ?? null;
    const amt = summary?.monetary?.amount;
    if (typeof amt === "number" && Number.isFinite(amt)) {
      sum += amt;
      any = true;
    }
  }
  return any ? Math.round(sum * 100) / 100 : null;
}

/** Σ del IMPACTO del redondeo comercial MONETARIO por línea. Sibling de
 *  `sumLineCommercialMonetary`: misma fuente única
 *  (`lineCommercialSummary.monetary.roundingImpact`), misma agregación PURA (Σ)
 *  — cero matemática comercial, passthrough del contrato por línea.
 *
 *  Permite que el footer "Monetario (saldo)" muestre el desglose
 *  Valor comercial → Redondeo → Valor redondeado igual que el bloque de metal.
 *  En listas UNIFICADAS el contrato trae `roundingImpact = 0` (el redondeo ya
 *  está embebido en el total), así que la Σ da 0 y el caller oculta la fila.
 *
 *  Devuelve `null` cuando NINGUNA línea trae el contrato (back-compat). */
export function sumLineCommercialMonetaryRoundingImpact(
  lines: ReadonlyArray<unknown>,
): number | null {
  if (!Array.isArray(lines)) return null;
  let sum = 0;
  let any = false;
  for (const item of lines) {
    if (!item || typeof item !== "object") continue;
    const line = item as {
      lineCommercialDisplaySummary?: LineCommercialSummaryShape;
      lineOwnHechuraRoundingMonetaryImpact?: number | null;
      lineCommercialSummary?: LineCommercialSummaryShape;
      pricingMeta?: {
        lineCommercialDisplaySummary?: LineCommercialSummaryShape;
        lineOwnHechuraRoundingMonetaryImpact?: number | null;
        lineCommercialSummary?: LineCommercialSummaryShape;
      } | null;
    };
    // SSOT card↔footer (Etapa 2 — Paso 2.2) — el card lee como fuente primaria
    // el resumen comercial AUTÓNOMO display-only `lineCommercialDisplaySummary`
    // (C-FASE1, line-local e inmune a otras líneas/modo). La Σ del footer usa la
    // MISMA prioridad para que ambos coincidan, también en MIXED:
    //   1) lineCommercialDisplaySummary.monetary.roundingImpact  (C-FASE1)
    //   2) lineOwnHechuraRoundingMonetaryImpact                  (B, autónomo)
    //   3) lineCommercialSummary.monetary.roundingImpact         (C-FASE0)
    // (1) y (2) provienen del mismo primitivo autónomo → equivalentes; (1) es el
    // contrato canónico. Para líneas sin C-FASE1 cae a B → C-FASE0 (histórico).
    // ❌ NUNCA `metalRoundingMonetaryImpact` (prorrateo documental).
    const display = line.lineCommercialDisplaySummary ?? line.pricingMeta?.lineCommercialDisplaySummary ?? null;
    const own =
      line.lineOwnHechuraRoundingMonetaryImpact ??
      line.pricingMeta?.lineOwnHechuraRoundingMonetaryImpact;
    const summary = line.lineCommercialSummary ?? line.pricingMeta?.lineCommercialSummary ?? null;
    const displayImpact = display?.monetary?.roundingImpact;
    const impact =
      typeof displayImpact === "number" && Number.isFinite(displayImpact)
        ? displayImpact
        : typeof own === "number" && Number.isFinite(own)
          ? own
          : summary?.monetary?.roundingImpact;
    if (typeof impact === "number" && Number.isFinite(impact)) {
      sum += impact;
      any = true;
    }
  }
  return any ? Math.round(sum * 100) / 100 : null;
}

/** SSOT card ↔ footer — Gramo PRINCIPAL de METALES consolidado (2026-06).
 *
 *  CONTRATO: `FOOTER = consolidación exacta de los CARDS`. El footer NO
 *  reinterpreta el patrimonio metálico: suma el MISMO gramo que cada card del
 *  artículo ya decidió mostrar, por metal padre.
 *
 *  Por línea, replica la elección EXACTA del card
 *  (`TPDocumentLineAdvancedEditor.tsx:5190`):
 *
 *    visibleGrams        (= `lineCommercialSummary.metals.byParent[].visibleGrams`,
 *                          el gramo post-redondeo comercial que el card renderiza)
 *    ?? gramsEquivLine    (fallback EXACTO del card cuando la línea no trae summary)
 *
 *  y consolida `Σ por metal padre`. NO usa `displayGrams`/`saleEquivGr` ni el
 *  físico `postGrams` como fuente cuando existe el dato visible comercial del
 *  card. Passthrough puro: reusa `buildMetalParentSaleLines` (solo para el
 *  fallback + identidad del padre) y lee el summary del backend. Devuelve `{}`
 *  cuando no hay líneas / metales → el caller cae al display previo
 *  (degradación segura). */
export function buildVisibleGramsByParent(
  lines: ReadonlyArray<CardLineForMetals>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of lines) {
    if (!line || !line.composition?.metals) continue;
    const factor = computeMetalSaleFactor({
      metalCost: line.metalHechuraBreakdown?.metalCost ?? null,
      metalSale: line.metalHechuraBreakdown?.metalSale ?? null,
    });
    const normalizedMetals = line.composition.metals.map((m) =>
      m == null
        ? null
        : {
            metalName:        m.metalName        ?? null,
            purity:           m.purity           ?? null,
            appliedGrams:     m.appliedGrams     ?? null,
            appliedMermaPct:  m.appliedMermaPct  ?? null,
            variantName:      m.variantName      ?? null,
            metalVariantName: m.metalVariantName ?? null,
            purityLabel:      m.purityLabel      ?? null,
            lineSale:         m.lineSale         ?? null,
          },
    );
    const parents = buildMetalParentSaleLines(normalizedMetals, line.quantity ?? 1, factor);
    // Summary comercial de ESTA línea — la MISMA fuente que el card lee para
    // pintar `visibleGrams`/`postGrams` por metal padre. Lee top-level del
    // preview o, defensivamente, de `pricingMeta` (draft).
    // Trabajo #1 (Evolución) — gramos C-FASE1-first, simétrico con
    // `groupLineCommercialMetalRoundingByParent`: display (FASE1, line-local,
    // inmune a otras líneas) → summary (FASE0) → fallback `gramsEquivLine`.
    // Near-no-op (FASE1==FASE0 en líneas frescas); FASE1 más correcto en MIXED.
    const display =
      (line as { lineCommercialDisplaySummary?: LineCommercialSummaryShape }).lineCommercialDisplaySummary ??
      (line as { pricingMeta?: { lineCommercialDisplaySummary?: LineCommercialSummaryShape } | null })
        .pricingMeta?.lineCommercialDisplaySummary ??
      null;
    const summary =
      (line as { lineCommercialSummary?: LineCommercialSummaryShape }).lineCommercialSummary ??
      (line as { pricingMeta?: { lineCommercialSummary?: LineCommercialSummaryShape } | null })
        .pricingMeta?.lineCommercialSummary ??
      null;
    const byParent = display?.metals?.byParent ?? summary?.metals?.byParent ?? null;
    for (const p of parents) {
      // Match por nombre del padre (clave canónica de consolidación del footer),
      // igual que `deriveDocumentMetalsFromLines`.
      const cm = byParent
        ? byParent.find(
            (x) =>
              !!x &&
              typeof x.metalParentName === "string" &&
              x.metalParentName.trim().toLowerCase() === p.name.trim().toLowerCase(),
          )
        : null;
      // MISMA elección que el card: `hasPostGrams ? visibleGrams : gramsEquivLine`.
      const g =
        cm && typeof cm.visibleGrams === "number" && Number.isFinite(cm.visibleGrams)
          ? cm.visibleGrams
          : p.gramsEquivLine;
      if (typeof g === "number" && Number.isFinite(g)) {
        out[p.name] = (out[p.name] ?? 0) + g;
      }
    }
  }
  return out;
}

/** Lee un campo numérico de la línea o de su `pricingMeta` (draft). */
function lineNum(
  line: { pricingMeta?: Record<string, unknown> | null } & Record<string, unknown>,
  key: string,
): number | null {
  const top = line[key];
  if (typeof top === "number" && Number.isFinite(top)) return top;
  const meta = line.pricingMeta?.[key];
  if (typeof meta === "number" && Number.isFinite(meta)) return meta;
  return null;
}

/** Σ del IMPACTO del redondeo comercial del METAL por línea — FUENTE AUTÓNOMA
 *  por línea, en prioridad (la línea "como si estuviera sola"):
 *    1. `lineCommercialDisplaySummary.metals.roundingImpact` (FASE 1 — AUTÓNOMO
 *       puro, inmune a otras líneas; en MIXED preserva el valor real de la línea)
 *    2. `lineCommercialSummary.metals.roundingImpact`        (FASE 0 — autónomo,
 *       pero se contamina con el contexto documental en MIXED)
 *    3. `lineOwnMetalRoundingMonetaryImpact`                 (autónomo PER_DOC/MIXED)
 *    4. `metalHechuraBreakdown.metalSaleRoundingDelta`       (PER_LINE motor)
 *    5. 0
 *
 *  ❌ NUNCA `metalRoundingMonetaryImpact` — ese es el PRORRATEO DOCUMENTAL
 *  (`distributeMetalRoundingImpactPerLine`), que reparte el agregado del
 *  comprobante entre líneas y depende de las demás líneas.
 *
 *  Agregación PURA (Σ). Alimenta el footer MIXED "REDONDEOS COMERCIALES"
 *  (fila Metal): la suma de la lógica comercial VISIBLE en cada línea, no el
 *  snapshot documental. `null` si ninguna línea trae impacto de metal. */
export function sumLineCommercialMetalRoundingImpact(
  lines: ReadonlyArray<unknown>,
): number | null {
  if (!Array.isArray(lines)) return null;
  let sum = 0;
  let any = false;
  for (const item of lines) {
    if (!item || typeof item !== "object") continue;
    const line = item as {
      lineCommercialDisplaySummary?: LineCommercialSummaryShape;
      lineCommercialSummary?: LineCommercialSummaryShape;
      pricingMeta?: ({
        lineCommercialDisplaySummary?: LineCommercialSummaryShape;
        lineCommercialSummary?: LineCommercialSummaryShape;
      } & Record<string, unknown>) | null;
      metalHechuraBreakdown?: { metalSaleRoundingDelta?: number | null } | null;
    } & Record<string, unknown>;
    const display = line.lineCommercialDisplaySummary ?? line.pricingMeta?.lineCommercialDisplaySummary ?? null;
    const summary = line.lineCommercialSummary ?? line.pricingMeta?.lineCommercialSummary ?? null;
    // Prioridad autónoma: display (FASE 1) → summary (FASE 0) → legacy.
    let impact: number | null = null;
    if (typeof display?.metals?.roundingImpact === "number" && Number.isFinite(display.metals.roundingImpact)) {
      impact = display.metals.roundingImpact;
    } else if (typeof summary?.metals?.roundingImpact === "number" && Number.isFinite(summary.metals.roundingImpact)) {
      impact = summary.metals.roundingImpact;
    } else {
      const own = lineNum(line, "lineOwnMetalRoundingMonetaryImpact");
      if (own != null) {
        impact = own;
      } else {
        const mhb = line.metalHechuraBreakdown ?? (line.pricingMeta?.metalHechuraBreakdown as { metalSaleRoundingDelta?: number | null } | undefined) ?? null;
        const delta = mhb?.metalSaleRoundingDelta;
        if (typeof delta === "number" && Number.isFinite(delta)) impact = delta;
      }
    }
    if (impact != null) {
      sum += impact;
      any = true;
    }
  }
  return any ? Math.round(sum * 100) / 100 : null;
}

/** Agrupa el impacto $ del redondeo comercial del METAL por `metalParentName`,
 *  sumando a través de TODAS las líneas. Fuente AUTÓNOMA per-línea:
 *    primary:  `lineCommercialSummary.metals.byParent[]` (`metalParentName`, `roundingImpact`)
 *    fallback: `lineCommercialRoundingMetals[]`           (`metalParentName`, `monetaryImpact`)
 *  ❌ NUNCA `metalRoundingMonetaryImpact` (prorrateo documental).
 *
 *  Alimenta la Opción 1 de METALES (filas Redondeo comercial + Valor final por
 *  metal) en MIXED, cuando no hay snapshot document-level. Devuelve `undefined`
 *  si ninguna línea aporta. */
export function groupLineCommercialMetalRoundingByParent(
  lines: ReadonlyArray<unknown>,
): Readonly<Record<string, number>> | undefined {
  if (!Array.isArray(lines)) return undefined;
  const acc: Record<string, number> = {};
  let any = false;
  const add = (name: string | null, imp: number | null) => {
    if (!name || imp == null) return;
    acc[name] = Math.round(((acc[name] ?? 0) + imp) * 100) / 100;
    any = true;
  };
  for (const item of lines) {
    if (!item || typeof item !== "object") continue;
    const line = item as {
      lineCommercialDisplaySummary?: LineCommercialSummaryShape;
      lineCommercialSummary?: LineCommercialSummaryShape;
      pricingMeta?: ({
        lineCommercialDisplaySummary?: LineCommercialSummaryShape;
        lineCommercialSummary?: LineCommercialSummaryShape;
      } & Record<string, unknown>) | null;
      lineCommercialRoundingMetals?: ReadonlyArray<{ metalParentName?: string | null; monetaryImpact?: number | null }> | null;
    } & Record<string, unknown>;
    // Prioridad autónoma: display (FASE 1, inmune a otras líneas) → summary (FASE 0).
    const display = line.lineCommercialDisplaySummary ?? line.pricingMeta?.lineCommercialDisplaySummary ?? null;
    const summary = line.lineCommercialSummary ?? line.pricingMeta?.lineCommercialSummary ?? null;
    const byParent = display?.metals?.byParent ?? summary?.metals?.byParent;
    if (Array.isArray(byParent) && byParent.length > 0) {
      for (const p of byParent) {
        add(
          typeof p?.metalParentName === "string" ? p.metalParentName : null,
          typeof p?.roundingImpact === "number" && Number.isFinite(p.roundingImpact) ? p.roundingImpact : null,
        );
      }
      continue;
    }
    // Fallback autónomo: gramos comerciales POST por línea (mismo origen que el
    // card cuando el summary no trae `byParent`).
    const lcrm =
      line.lineCommercialRoundingMetals ??
      (line.pricingMeta?.lineCommercialRoundingMetals as
        | ReadonlyArray<{ metalParentName?: string | null; monetaryImpact?: number | null }>
        | undefined) ??
      null;
    if (Array.isArray(lcrm)) {
      for (const m of lcrm) {
        add(
          typeof m?.metalParentName === "string" ? m.metalParentName : null,
          typeof m?.monetaryImpact === "number" && Number.isFinite(m.monetaryImpact) ? m.monetaryImpact : null,
        );
      }
    }
  }
  return any ? acc : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa D' — Selector PURO del snapshot comercial PER_DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────

/** Rows de display canónicos del redondeo comercial PER_DOCUMENT.
 *  Selector PURO sin matemática nueva: solo proyecta el snapshot del backend
 *  a una lista plana de filas listas para renderizar. Cada row trae el
 *  `label` ya en español + los valores `pre/post/delta` PASSTHROUGH desde
 *  el snapshot persistido (`Sale.commercialDocumentRoundingSnapshot`).
 *
 *  Cuando el snapshot es `null` o trae `fallback` sin movimiento, devuelve
 *  `null` y el componente NO renderiza la sub-sección. */
export interface CommercialDocRoundingDisplayRow {
  key:       string;
  label:     string;
  /** "DECIMAL_1 NEAREST", "HUNDRED NEAREST", etc. */
  modeLabel: string;
  /** Discrimina visualmente cómo renderizar el row. */
  domain:    "METAL" | "HECHURA";

  // ── Dominio HECHURA — valores en MONEDA del documento ───────────────────
  /** Solo cuando `domain === "HECHURA"`. Pre / post / delta en pesos —
   *  passthrough exacto del snapshot del backend. */
  pre?:    number;
  post?:   number;
  delta?:  number;

  // ── Dominio METAL — gramos físicos + equivalente monetario passthrough ──
  /** Solo cuando `domain === "METAL"`. Gramos pre/post/delta passthrough
   *  del snapshot del backend (sin cálculos). */
  preGrams?:           number;
  postGrams?:          number;
  deltaGrams?:         number;
  /** Equivalente monetario del delta físico — el backend YA lo calcula
   *  (`deltaGrams × metalPricePerGram`) y lo persiste en el snapshot.
   *  El frontend SOLO lo lee — NUNCA lo recalcula. */
  monetaryEquivalent?: number;
}

export interface CommercialDocRoundingDisplay {
  scope: "UNIFIED" | "BREAKDOWN";
  totalAdjustment: number;
  rows: ReadonlyArray<CommercialDocRoundingDisplayRow>;
  fallback?: string | null;
}

export function selectCommercialDocRoundingDisplay(
  snapshot:
    | import("./types").TotalDelComprobanteCardProps["commercialDocumentRoundingSnapshot"]
    | undefined
    | null,
): CommercialDocRoundingDisplay | null {
  if (snapshot == null) return null;

  // UNIFIED — un único row sobre el total comercial.
  if (snapshot.scope === "UNIFIED") {
    if (!snapshot.unified) {
      // ALL_NONE / sin movimiento → no mostramos rows pero sí el aviso.
      return {
        scope:           "UNIFIED",
        totalAdjustment: snapshot.totalAdjustment ?? 0,
        rows:            [],
        fallback:        snapshot.fallback ?? null,
      };
    }
    return {
      scope:           "UNIFIED",
      totalAdjustment: snapshot.totalAdjustment ?? 0,
      rows: [{
        key:       "unified",
        label:     "Redondeo comercial (total)",
        pre:       snapshot.unified.pre,
        post:      snapshot.unified.post,
        delta:     snapshot.unified.adjustment,
        modeLabel: `${snapshot.unified.mode} ${snapshot.unified.direction}`,
        domain:    "HECHURA",
      }],
      fallback: snapshot.fallback ?? null,
    };
  }

  // BREAKDOWN — metal padre (gramos) + hechura/saldo monetario.
  const bd = snapshot.breakdown;
  if (!bd) {
    return {
      scope:           "BREAKDOWN",
      totalAdjustment: snapshot.totalAdjustment ?? 0,
      rows:            [],
      fallback:        snapshot.fallback ?? null,
    };
  }
  const rows: CommercialDocRoundingDisplayRow[] = [];
  for (const m of bd.metals) {
    // Dominio METAL — passthrough puro. NO multiplicamos gramos × precio:
    // el `monetaryEquivalent` ya viene calculado por el backend.
    rows.push({
      key:                `metal:${m.metalParentId}`,
      label:              `Redondeo comercial — ${m.metalParentName}`,
      modeLabel:          `${m.mode} ${m.direction}`,
      domain:             "METAL",
      preGrams:           m.preGrams,
      postGrams:          m.postGrams,
      deltaGrams:         m.deltaGrams,
      monetaryEquivalent: m.monetaryEquivalent,
    });
  }
  // Dominio HECHURA — passthrough puro de los tres campos monetarios.
  rows.push({
    key:       "hechura",
    label:     "Redondeo comercial — Hechura / Saldo monetario",
    modeLabel: `${bd.hechura.mode} ${bd.hechura.direction}`,
    domain:    "HECHURA",
    pre:       bd.hechura.preRoundingSaldoMonetario,
    post:      bd.hechura.postRoundingSaldoMonetario,
    delta:     bd.hechura.deltaSaldoMonetario,
  });
  return {
    scope:           "BREAKDOWN",
    totalAdjustment: snapshot.totalAdjustment ?? 0,
    rows,
    fallback:        snapshot.fallback ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 2C — Valor Final Metal real (modo DESGLOSADO)
//
// `aggregateMetalFinalByParent` consolida, por metal padre, el valor final
// monetario del metal sumando los CUATRO mecanismos:
//
//   finalMetalValue = baseCommercialValue
//                   + commercialRoundingImpact   (monetaryEquivalent comercial)
//                   + financialRoundingImpact    (monetaryEquivalent capa 16 PHYSICAL)
//                   + manualAdjustmentImpact      (monetaryEquivalent ajuste manual)
//
// REGLA DE ORO (POLICY): el frontend SOLO suma `monetaryEquivalent` ya emitidos
// por el backend. NO multiplica gramos × cotización, NO aplica margen/pureza/
// merma, NO clampea, PRESERVA negativos. El ajuste manual de metal sigue siendo
// FÍSICO (gramos) — su equivalente monetario se SUMA al valor del metal, pero
// NUNCA se vuelca a `breakdown.monetary.amount` (no se mezcla con hechura).
//
// Join: primero por `metalParentId` (canónico); fallback por `metalParentName`
// normalizado (porque `baseByParentName` viene indexado por nombre).
// ─────────────────────────────────────────────────────────────────────────────

/** Detalle físico passthrough de un mecanismo (financiero o manual) por metal. */
export interface MetalPhysicalImpactDetail {
  preGrams:           number;
  postGrams:          number;
  deltaGrams:         number;
  metalPricePerGram:  number;
  monetaryEquivalent: number;
}

/** Fila final consolidada por metal padre para el bloque METALES (BREAKDOWN). */
export interface MetalFinalRow {
  metalParentId:   string | null;
  metalParentName: string;
  /** Gramos informativos (passthrough de `resolvedMetals`). */
  grams: number;
  sourceLineIds?: ReadonlyArray<string>;
  baseCommercialValue:      number;
  commercialRoundingImpact: number;
  financialRoundingImpact:  number;
  manualAdjustmentImpact:   number;
  /** = base + comercial + financiero + manual (round2). */
  finalMetalValue: number;
  /** Detalle físico del redondeo financiero (capa 16), si actuó sobre el padre. */
  financial?: MetalPhysicalImpactDetail;
  /** Detalle físico del ajuste manual (Etapa C), si actuó sobre el padre. */
  manual?: MetalPhysicalImpactDetail;
}

/** Shape mínimo de una entry física por metal padre (financiero o manual).
 *  Acepta el shape del snapshot financiero (`metalPhysical.metals[]`) y del
 *  manual (`manualAdjustmentSnapshot.breakdown.metals[]`). */
type PhysicalMetalEntryLike = {
  metalParentId?:     string | null;
  metalParentName?:   string;
  preGrams?:          number;
  postGrams?:         number;
  deltaGrams?:        number | null;
  metalPricePerGram?: number;
  monetaryEquivalent?: number;
} | null | undefined;

const r2cents = (n: number): number => Math.round(n * 100) / 100;
const finiteOr0 = (x: unknown): number =>
  typeof x === "number" && Number.isFinite(x) ? x : 0;

/** Busca la entry de un metal padre por id (canónico) o por nombre normalizado. */
function matchPhysicalEntry(
  pool: ReadonlyArray<PhysicalMetalEntryLike> | undefined,
  id:   string | null,
  name: string,
): PhysicalMetalEntryLike {
  if (!pool || pool.length === 0) return undefined;
  const nameNorm = name.trim().toLowerCase();
  for (const e of pool) {
    if (!e) continue;
    if (e.metalParentId != null && id != null && e.metalParentId === id) return e;
  }
  for (const e of pool) {
    if (!e) continue;
    if ((e.metalParentName ?? "").trim().toLowerCase() === nameNorm) return e;
  }
  return undefined;
}

/** Proyecta una entry física al detalle passthrough (sin recalcular nada). */
function pickPhysical(e: NonNullable<PhysicalMetalEntryLike>): MetalPhysicalImpactDetail {
  return {
    preGrams:           finiteOr0(e.preGrams),
    postGrams:          finiteOr0(e.postGrams),
    deltaGrams:         finiteOr0(e.deltaGrams),
    metalPricePerGram:  finiteOr0(e.metalPricePerGram),
    monetaryEquivalent: finiteOr0(e.monetaryEquivalent),
  };
}

/** Consolida el valor final por metal padre (DESGLOSADO). Agregación PURA:
 *  suma de `monetaryEquivalent` ya emitidos por el backend. Cero cálculo de
 *  negocio, sin clamp, preserva negativos. */
export function aggregateMetalFinalByParent(args: {
  /** Orden + nombre + gramos + sourceLineIds (de `resolveCardMetals`). */
  resolvedMetals: ReadonlyArray<DocumentMetalSummaryItem>;
  /** Valor comercial por nombre de padre (venta `metalSaleByParent` o costo). */
  baseByParentName: Readonly<Record<string, number>>;
  /** Impacto $ del redondeo comercial por nombre de padre. */
  commercialByParentName?: Readonly<Record<string, number>>;
  /** Entries físicas del redondeo FINANCIERO (capa 16 PHYSICAL). */
  financialMetals?: ReadonlyArray<PhysicalMetalEntryLike>;
  /** Entries físicas del AJUSTE MANUAL (scope BREAKDOWN). */
  manualMetals?: ReadonlyArray<PhysicalMetalEntryLike>;
}): MetalFinalRow[] {
  return args.resolvedMetals.map((m) => {
    const name = m.name;
    // Valor comercial base por padre. Prioridad: mapa explícito
    // (`metalSaleByParent` venta / `commercialMetalValueByParent` costo) →
    // fallback canónico `m.monetaryAmount` (valuación física / `documentMetals`
    // / snapshot sin líneas). Passthrough — no se inventa valor.
    const baseExplicit = args.baseByParentName?.[name];
    const base = (typeof baseExplicit === "number" && Number.isFinite(baseExplicit))
      ? baseExplicit
      : finiteOr0(m.monetaryAmount);
    const cr   = finiteOr0(args.commercialByParentName?.[name]);
    const fin  = matchPhysicalEntry(args.financialMetals, m.id ?? null, name);
    const man  = matchPhysicalEntry(args.manualMetals,    m.id ?? null, name);
    const finImpact = finiteOr0(fin?.monetaryEquivalent);
    const manImpact = finiteOr0(man?.monetaryEquivalent);
    return {
      metalParentId:   m.id ?? null,
      metalParentName:  name,
      grams:            m.grams,
      ...(m.sourceLineIds ? { sourceLineIds: m.sourceLineIds } : {}),
      baseCommercialValue:      r2cents(base),
      commercialRoundingImpact: r2cents(cr),
      financialRoundingImpact:  r2cents(finImpact),
      manualAdjustmentImpact:   r2cents(manImpact),
      finalMetalValue:          r2cents(base + cr + finImpact + manImpact),
      ...(fin ? { financial: pickPhysical(fin) } : {}),
      ...(man ? { manual:    pickPhysical(man) } : {}),
    };
  });
}
