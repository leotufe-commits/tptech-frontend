// src/lib/sales/patchLineHelpers.ts
// ============================================================================
// Helpers PUROS para `patchLine` (VentasFacturas.tsx).
//
// Extraídos durante FASE 8.2.5a. Cada helper:
//   - es función pura (sin React, sin side effects).
//   - tiene una sola responsabilidad.
//   - es testeable de forma aislada.
//
// `patchLine` queda como **orchestrator delgado** en VentasFacturas que:
//   1. Llama `detectManualEdit(before, patch)` → flags.
//   2. Llama `buildPatchedLine({ line, patch, ...flags })` por cada línea.
//   3. Hace el side-effect `initialLineSnapshots.current.set(...)` (queda inline
//      porque toca un ref de React).
//   4. Llama `onChange({...draft, lines: patched})`.
//
// Cero cambio funcional vs. comportamiento original.
// ============================================================================

import { round2, calcLineTotalsFromSnapshot } from "../document-helpers";
import type { DocumentLine } from "../document-types";

// ─── 1. computeManualTax ───────────────────────────────────────────────────

/**
 * Calcula el IVA absoluto de una línea MANUAL con `manualTaxRate`.
 *
 * Pure. Cero acceso a backend/draft. Replicada del inline original
 * (VentasFacturas.tsx:3550-3554) sin cambios.
 *
 * @param subtotal Subtotal neto de la línea (sin impuestos).
 * @param rate     Porcentaje de IVA (ej: 21 para 21 %).
 * @returns Monto del impuesto absoluto, redondeado a 2 decimales.
 *          0 cuando `rate` ≤ 0 o `subtotal` ≤ 0 (WYSIWYG).
 */
export function computeManualTax(subtotal: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  return round2(subtotal * (rate / 100));
}

// ─── 2. detectManualEdit ───────────────────────────────────────────────────

export type ManualEditDetection = {
  /** True si el patch cambia explícitamente `unitPrice` y NO trae
   *  `pricingMeta` (edición directa del input / "Aplicar simulador"). */
  isManualPriceEdit: boolean;
  /** True si el patch viene del motor (trae `pricingMeta`, `articleId` o
   *  `manualOverrides` explícitos). En ese caso NO setear flags manuales. */
  isEngineDriven: boolean;
  /** Delta de flags manuales detectados. Vacío `{}` cuando no hay cambios
   *  manuales editables (cantidad/precio/bonificación/impuesto). */
  flagDeltas: NonNullable<DocumentLine["manualOverrides"]>;
};

/**
 * Detecta si un patch sobre una línea representa una edición manual del
 * operador (vs. una hidratación del motor).
 *
 * Pure. Replica la lógica original de VentasFacturas.tsx:3285-3305.
 *
 * Reglas:
 *   - `isManualPriceEdit`: patch cambia `unitPrice` Y no trae `pricingMeta`.
 *   - `isEngineDriven`: patch trae `pricingMeta` O `articleId` O `manualOverrides`.
 *   - `flagDeltas`: si NO es engine-driven, comparar `quantity/unitPrice/
 *     discountAmount/taxAmount` antes vs. después y marcar los que cambian.
 */
export function detectManualEdit(
  before: DocumentLine | undefined,
  patch: Partial<DocumentLine>,
): ManualEditDetection {
  const isManualPriceEdit = Boolean(
    patch.unitPrice != null
    && before
    && before.unitPrice !== patch.unitPrice
    && patch.pricingMeta === undefined,
  );

  const isEngineDriven = Boolean(
    patch.pricingMeta !== undefined
    || patch.articleId !== undefined
    || patch.manualOverrides !== undefined,
  );

  const flagDeltas: NonNullable<DocumentLine["manualOverrides"]> = {};
  if (!isEngineDriven && before) {
    if (patch.quantity       != null && before.quantity       !== patch.quantity)       flagDeltas.quantity = true;
    if (patch.unitPrice      != null && before.unitPrice      !== patch.unitPrice)      flagDeltas.price    = true;
    if (patch.discountAmount != null && before.discountAmount !== patch.discountAmount) flagDeltas.discount = true;
    if (patch.taxAmount      != null && before.taxAmount      !== patch.taxAmount)      flagDeltas.tax      = true;
  }

  return { isManualPriceEdit, isEngineDriven, flagDeltas };
}

// ─── 3. applyTransientManualPrice ──────────────────────────────────────────

/**
 * Aplica el ajuste TRANSITORIO cuando el operador editó manualmente el
 * `unitPrice` de una línea (priceSource = "MANUAL_OVERRIDE"):
 *
 *   - Sobrescribe `pricingMeta` con flag manual + invalida `unitTotalWithTax`.
 *   - `discountAmount = 0` (el motor de venta IGNORA descuentos cuando hay
 *     manualPriceOverride; replicamos esa regla acá para evitar saltos
 *     visuales mientras viaja el preview).
 *   - Recalcula `subtotal`, `taxAmount`, `lineTotal` escalando con la tasa
 *     conocida del último preview (`taxBreakdown[].rate`). Si no hay tasa,
 *     cae al `taxAmount` absoluto previo. Si nada, asume IVA 0.
 *
 * Pure. Replica la lógica original de VentasFacturas.tsx:3311-3357.
 *
 * IMPORTANTE: este es un valor TRANSITORIO. Cuando `salesApi.preview`
 * responde, `applySalePreviewToDraft` lo pisa con los valores exactos
 * del motor backend.
 */
export function applyTransientManualPrice(merged: DocumentLine): DocumentLine {
  const out: DocumentLine = {
    ...merged,
    pricingMeta: {
      ...(merged.pricingMeta ?? {}),
      priceSource:    "MANUAL_OVERRIDE",
      manualOverride: true,
      partial:        false,
      resolvedAt:     Date.now(),
      // Invalidar derivado stale: `unitTotalWithTax` se calculó con el
      // unitPrice anterior. Si lo dejamos vivo, calcLineTotalsFromSnapshot
      // usa `qty × unitTotalWithTax` y devuelve el total VIEJO.
      unitTotalWithTax: null,
    },
    discountAmount: 0,
  };

  const qtyTr  = Number.isFinite(out.quantity)  ? out.quantity  : 0;
  const unitTr = Number.isFinite(out.unitPrice) ? out.unitPrice : 0;
  const netTr  = Math.max(0, qtyTr * unitTr);
  const totalRate = (out.pricingMeta?.taxBreakdown ?? [])
    .map((t: any) => Number.isFinite(t?.rate) ? Number(t.rate) : 0)
    .reduce((a: number, b: number) => a + b, 0);

  if (totalRate > 0) {
    const taxTr = netTr * (totalRate / 100);
    out.taxAmount = round2(taxTr);
    out.subtotal  = round2(netTr);
    out.lineTotal = round2(netTr + taxTr);
  } else if (Number.isFinite(out.taxAmount)) {
    out.subtotal  = round2(netTr);
    out.lineTotal = round2(netTr + Math.max(0, Number(out.taxAmount)));
  } else {
    out.subtotal  = round2(netTr);
    out.lineTotal = round2(netTr);
  }

  return out;
}

// ─── 4. applyManualTaxRate ─────────────────────────────────────────────────

/**
 * Si la línea es MANUAL y tiene `manualTaxRate` configurada, recalcula
 * `taxAmount` aplicando el % sobre el subtotal y rehace `lineTotal`.
 *
 * Si el patch trae un `taxAmount` explícito (override directo del usuario),
 * NO recalcula — respeta lo que el operador escribió.
 *
 * Pure. Replica la lógica original de VentasFacturas.tsx:3364-3373.
 */
export function applyManualTaxRate(
  line: DocumentLine,
  patch: Partial<DocumentLine>,
): DocumentLine {
  if (!line.isManual) return line;
  if (typeof line.manualTaxRate !== "number" || line.manualTaxRate <= 0) return line;
  if (patch.taxAmount !== undefined) return line; // override directo

  const tx = computeManualTax(line.subtotal, line.manualTaxRate);
  return {
    ...line,
    taxAmount: tx,
    lineTotal: round2(line.subtotal + tx),
  };
}

// ─── 5. buildPatchedLine ───────────────────────────────────────────────────

/**
 * Orchestrator puro de la transformación per-línea.
 *
 * Compone las 3 transformaciones anteriores en orden:
 *   1. `{...line, ...patch}` (merge crudo).
 *   2. `calcLineTotalsFromSnapshot(merged)` → recalcula `subtotal`/`lineTotal`.
 *   3. Si `isManualPriceEdit` → `applyTransientManualPrice`.
 *   4. `applyManualTaxRate` (no-op cuando no aplica).
 *   5. Acumula `flagDeltas` sobre `manualOverrides` (sin pisar previos).
 *
 * Replica la lógica original de VentasFacturas.tsx:3306-3381.
 */
export function buildPatchedLine(args: {
  line:               DocumentLine;
  patch:              Partial<DocumentLine>;
  isManualPriceEdit:  boolean;
  flagDeltas:         NonNullable<DocumentLine["manualOverrides"]>;
}): DocumentLine {
  const { line, patch, isManualPriceEdit, flagDeltas } = args;

  const merged = { ...line, ...patch };
  const { subtotal, lineTotal } = calcLineTotalsFromSnapshot(merged);
  let out: DocumentLine = { ...merged, subtotal, lineTotal };

  if (isManualPriceEdit) {
    out = applyTransientManualPrice(out);
  }

  out = applyManualTaxRate(out, patch);

  // Acumulamos los flags manuales SIN pisar los previos. Quedan en true
  // hasta que el usuario cambie de artículo o invoque "Restablecer línea"
  // — esos dos paths limpian `manualOverrides` explícitamente.
  if (Object.keys(flagDeltas).length > 0) {
    out = {
      ...out,
      manualOverrides: { ...(line.manualOverrides ?? {}), ...flagDeltas },
    };
  }

  return out;
}

// ─── resetLineForClientChange ──────────────────────────────────────────────

/**
 * "Recalcular precios" con un cliente nuevo: el cliente nuevo es 100%
 * AUTORITATIVO. Deja la línea SIN ningún estado de IMPUESTO ni de
 * BONIFICACIÓN HEREDADA del cliente anterior, para que la rehidratación del
 * preview del cliente nuevo sea la única fuente.
 *
 * Impuesto — limpia / resetea:
 *   - `manualOverrides.tax`            → flag que hacía que
 *     `buildSalePreviewPayload` reenviara el override del cliente anterior.
 *   - `pricingMeta.taxOverride`        → valor del override manual.
 *   - `pricingMeta.manualTaxAppliesTo` → override de SOLO la base del impuesto.
 *   - `pricingMeta.taxBreakdown`       → []  (fuente de la tasa visual: sin
 *     esto el editor servía la tasa 21% cacheada del cliente anterior).
 *   - `pricingMeta.taxExemptByEntity`  → undefined (lo fija el preview nuevo).
 *   - `taxAmount`                      → 0   (importe stale).
 *   - `lineTotalWithTax`               → `lineTotal` (neto; quitar impuesto
 *     stale hasta que el preview re-hidrate — NO es recálculo de pricing).
 *
 * Bonificación HEREDADA del cliente (origin CLIENT) — limpia / resetea:
 *   - `pricingMeta.inheritedDiscount`         → null (badge "Cliente" stale).
 *   - `pricingMeta.inheritedDiscountAppliesTo`→ null.
 *   - `discountAmount`                        → 0  (monto residual "−US$ 0.01"
 *     del cliente anterior; el preview del cliente nuevo lo re-hidrata).
 *
 * NO toca: bonificación/precio MANUAL del operador (`manualOverrides.price/
 * discount`, `pricingMeta.manualPrice`, `pricingMeta.manualDiscount`),
 * cantidad, `unitPrice`, `lineTotal` (los re-hidrata el preview / los
 * conserva "Mantener precios actuales", que NO llama a esta función).
 * Pure — clona, no muta. Si no hay NADA reseteable, devuelve la misma
 * referencia (identidad estable para líneas sin tocar).
 */
export function resetLineForClientChange(line: DocumentLine): DocumentLine {
  const mo = line.manualOverrides;
  const meta = line.pricingMeta as
    | (NonNullable<DocumentLine["pricingMeta"]> & {
        manualTaxAppliesTo?: unknown;
        inheritedDiscount?: unknown;
        inheritedDiscountAppliesTo?: unknown;
      })
    | undefined;
  const hadResetableState =
    mo?.tax === true ||
    (meta?.taxOverride ?? null) !== null ||
    meta?.manualTaxAppliesTo != null ||
    (meta?.taxBreakdown?.length ?? 0) > 0 ||
    meta?.taxExemptByEntity != null ||
    (typeof line.taxAmount === "number" && line.taxAmount !== 0) ||
    meta?.inheritedDiscount != null ||
    meta?.inheritedDiscountAppliesTo != null ||
    (typeof line.discountAmount === "number" && line.discountAmount !== 0);
  if (!hadResetableState) return line;

  const nextManualOverrides = mo ? { ...mo } : undefined;
  if (nextManualOverrides) delete nextManualOverrides.tax;

  const nextMeta = meta ? { ...meta } : undefined;
  if (nextMeta) {
    nextMeta.taxOverride = null;
    (nextMeta as { manualTaxAppliesTo?: unknown }).manualTaxAppliesTo = null;
    nextMeta.taxBreakdown = [];
    nextMeta.taxExemptByEntity = undefined;
    (nextMeta as { inheritedDiscount?: unknown }).inheritedDiscount = null;
    (nextMeta as { inheritedDiscountAppliesTo?: unknown }).inheritedDiscountAppliesTo = null;
  }

  return {
    ...line,
    taxAmount: 0,
    discountAmount: 0,
    ...(typeof line.lineTotal === "number"
      ? { lineTotalWithTax: line.lineTotal }
      : {}),
    ...(nextManualOverrides ? { manualOverrides: nextManualOverrides } : {}),
    ...(nextMeta ? { pricingMeta: nextMeta } : {}),
  };
}
