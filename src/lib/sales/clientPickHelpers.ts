// src/lib/sales/clientPickHelpers.ts
// ============================================================================
// Helpers PUROS para `handleClientPick` (VentasFacturas.tsx).
//
// Extraídos durante FASE 8.2.5b. Cada helper:
//   - es función pura (sin React, sin side effects, sin async).
//   - tiene una sola responsabilidad clara.
//   - es testeable de forma aislada.
//
// `handleClientPick` queda como **orchestrator delgado** en VentasFacturas que:
//   1. Maneja el caso null (reset). Side effects + onChange.
//   2. Llama `normalizeEntityCurrency(entity, currencies)` → entity con
//      `currency` resuelto contra el catálogo.
//   3. Llama `applyClientToDraft(draft, entity)` (helper existente externo).
//   4. Llama `resolveClientFxRate(autoPatch.currency, currencies)` → fxRate +
//      warning opcional.
//   5. Llama `canonicalizeTerm` (existente) + `computeDueDateFromTerm` para
//      armar el patch de vencimiento.
//   6. Compone el patch final y ejecuta el optimistic apply + detail fetch +
//      recalc prompt (side effects).
//
// Cero cambio funcional vs. comportamiento original.
// ============================================================================

import type { TPEntityLite } from "../../components/ui/TPEntitySearchSelect";
import type { CurrencyRow } from "../../services/valuation";
import type { SalesInvoice, ClientSnapshot } from "./types";

// ─── 1. normalizeEntityCurrency ───────────────────────────────────────────

/**
 * El backend guarda `currencyId` (CUID) en EntityRow, no el code ISO.
 * Esta función normaliza `entity.currency` contra el catálogo:
 *   - Si ya es un code conocido (ARS, USD, ...) → se mantiene.
 *   - Si coincide con un `id` del catálogo → se reemplaza por el code.
 *   - Si no coincide con nada → se borra (undefined) para NO corromper el draft.
 *
 * Pure. Replica la lógica original de VentasFacturas.tsx:3877-3885.
 *
 * @returns Una copia mutable del entity con `currency` normalizado.
 */
export function normalizeEntityCurrency(
  entity: TPEntityLite,
  currencies: CurrencyRow[],
): TPEntityLite {
  const normalized: TPEntityLite = { ...entity };
  if (!normalized.currency) return normalized;
  const known = currencies.some((c) => c.code === normalized.currency);
  if (known) return normalized;
  const matchById = currencies.find((c) => c.id === normalized.currency);
  if (matchById) {
    normalized.currency = matchById.code;
  } else {
    normalized.currency = undefined;
  }
  return normalized;
}

// ─── 2. resolveClientFxRate ───────────────────────────────────────────────

export type ResolvedFxRate = {
  /** Nueva fxRate a aplicar al draft. `undefined` significa "no tocar". */
  fxRate?:  number;
  /** Mensaje de warning para toast cuando la moneda existe pero no tiene
   *  cotización vigente. `null` cuando no hay warning. */
  warning:  string | null;
};

/**
 * Resuelve la cotización a aplicar al draft cuando se selecciona un cliente
 * con moneda asignada.
 *
 * Reglas (idénticas al inline original VentasFacturas.tsx:3888-3917):
 *   - Sin currency → no tocar fxRate (return `{ fxRate: undefined }`).
 *   - Moneda no encontrada en catálogo → no tocar fxRate.
 *   - Moneda base → `fxRate = 1`, sin warning.
 *   - Moneda con `latestRate` válida → `fxRate = latestRate`, sin warning.
 *   - Moneda válida sin cotización vigente → `fxRate = 1` + warning.
 *
 * Pure. El warning lo emite el caller (ej: `toast.warning(...)`).
 */
export function resolveClientFxRate(
  currencyCodeOrId: string | undefined | null,
  currencies: CurrencyRow[],
): ResolvedFxRate {
  if (!currencyCodeOrId) return { warning: null };
  const cur = currencies.find(
    (c) => c.code === currencyCodeOrId || c.id === currencyCodeOrId,
  );
  if (!cur) return { warning: null };
  if (cur.isBase) {
    return { fxRate: 1, warning: null };
  }
  if (typeof cur.latestRate === "number" && cur.latestRate > 0) {
    return { fxRate: cur.latestRate, warning: null };
  }
  // Moneda válida pero sin cotización vigente.
  return {
    fxRate: 1,
    warning: `La moneda ${cur.code} no tiene cotización vigente. Cargala desde el botón de moneda.`,
  };
}

// ─── 3. computeDueDateFromTerm ─────────────────────────────────────────────

/**
 * Calcula el `dueDate` del documento a partir del término de pago canonical
 * y la fecha del comprobante.
 *
 * Reglas (idénticas al inline original VentasFacturas.tsx:3933-3942):
 *   - Sin término o sin fecha → `""` (limpia el vencimiento del cliente
 *     anterior — IMPORTANTE para evitar leak entre clientes).
 *   - Término sin días asociables → `""` (mismo motivo).
 *   - Término con días → fecha + días en ISO.
 *
 * Los lookups (`getTermDays`) y la suma (`addDaysISO`) se inyectan para que
 * el helper sea testeable sin depender del catálogo cargado en runtime.
 */
export function computeDueDateFromTerm(args: {
  canonicalTerm: string;
  draftDate:     string;
  getTermDays:   (term: string) => number | null;
  addDaysISO:    (isoDate: string, days: number) => string;
}): string {
  const { canonicalTerm, draftDate, getTermDays, addDaysISO } = args;
  if (!canonicalTerm || !draftDate) return "";
  const days = getTermDays(canonicalTerm);
  if (days === null) return "";
  return addDaysISO(draftDate, days);
}

// ─── 4. buildClientPatches ─────────────────────────────────────────────────

/**
 * Parte el cambio de cliente en DOS patches disjuntos. Es la fuente única
 * del contrato del modal "Cambiar cliente":
 *
 *   - `clientDataPatch` → identidad / snapshot / vendedor / término /
 *     vencimiento. SIEMPRE se aplica (ambas ramas del modal). NO contiene
 *     NINGÚN campo que mueva el `previewSignature` → "Mantener precios
 *     actuales" no recalcula líneas.
 *   - `pricingPatch`    → SOLO `priceListId` / `currency` / `fxRate` (lo que
 *     mueve el `previewSignature`). Se aplica únicamente en "Recalcular
 *     precios", y recién ahí se dispara `salesApi.preview`.
 *
 * `currency` es el TARGET ya RESUELTO por el caller: la moneda propia del
 * cliente nuevo SI tiene, o la moneda BASE del sistema si NO tiene. Se emite
 * SIEMPRE (no condicionado a que el cliente tenga moneda) para que en
 * "Recalcular" sea AUTORITATIVO: al pasar de un cliente USD a uno sin moneda
 * propia, el documento DEBE volver a la base (antes quedaba USD pegado
 * porque `currency` no se incluía y `{...cur, ...pricingPatch}` conservaba
 * la del cliente anterior). `fxRate` se emite siempre que sea un número
 * finito (el caller lo resuelve: 1 para base, cotización vigente si no).
 *
 * Invariante testeada: `pricingPatch` ⊆ {priceListId, currency, fxRate} y
 * `clientDataPatch` NUNCA incluye ninguno de esos tres. Pure.
 */
export function buildClientPatches(input: {
  clientId:        string;
  clientName:      string;
  clientSnapshot:  ClientSnapshot;
  sellerId:        string;
  canonicalTerm:   string;
  dueDate:         string;
  autoPriceListId?: string | null;
  /** Moneda TARGET ya resuelta (propia del cliente o base del sistema). */
  currency?:       string | null;
  fxRate?:         number;
}): {
  clientDataPatch: Partial<SalesInvoice>;
  pricingPatch:    Partial<SalesInvoice>;
} {
  const clientDataPatch: Partial<SalesInvoice> = {
    client:         input.clientName,
    clientId:       input.clientId,
    clientSnapshot: input.clientSnapshot,
    seller:         input.sellerId,
    paymentTerm:    input.canonicalTerm,
    dueDate:        input.dueDate,
  };

  const pricingPatch: Partial<SalesInvoice> = {
    ...(input.autoPriceListId ? { priceListId: input.autoPriceListId } : {}),
    // Moneda SIEMPRE (target resuelto = propia del cliente o base) →
    // "Recalcular" autoritativo, sin moneda stale del cliente anterior.
    ...(input.currency ? { currency: input.currency } : {}),
    ...(typeof input.fxRate === "number" && Number.isFinite(input.fxRate)
      ? { fxRate: input.fxRate }
      : {}),
  };

  return { clientDataPatch, pricingPatch };
}
