// src/lib/sales/promoteManualAdjustmentChange.ts
// ============================================================================
// Helper PURO de la auto-promoción del `balanceModeOverride` cuando el
// operador edita el ajuste manual en modo BREAKDOWN.
//
// Regla canónica TPTech (Etapa 3A-fix — endurecida):
//
//   Si el operador edita un ajuste manual con `scope === "BREAKDOWN"`, el
//   `balanceModeOverride` del draft se fuerza a `"BREAKDOWN"`, SIN IMPORTAR
//   el valor previo (null / "UNIFIED" / "BREAKDOWN").
//
// Razón: el backend (`sales.service.ts:5122-5129`, POLICY §R-Rounding-1
// capa 17) RECHAZA con 400 cualquier `previewSale`/`confirmSale` con
// `manualAdjustment.scope === "BREAKDOWN"` y `balanceMode !== "BREAKDOWN"`.
// Si el operador ajusta por metal padre, el documento OPERA en BREAKDOWN —
// no hay forma de tener ajuste BREAKDOWN con override "UNIFIED" coherente.
//
// Cambio vs versión anterior:
//   ANTES: la promoción solo activaba si `draft.balanceModeOverride == null`.
//   Resultado: si el operador había clickeado "Unificado" en algún momento
//   (o si el draft se hidrató con UNIFIED desde DB), el override quedaba
//   en UNIFIED y el payload llegaba con `{override: UNIFIED, scope: BREAKDOWN}`
//   → 400 del backend. AHORA: scope BREAKDOWN siempre sobreescribe.
//
// El override sigue REVERSIBLE: el operador puede volver a UNIFIED clickeando
// el selector inline del header del card. Si lo hace MIENTRAS hay ajuste
// BREAKDOWN activo, el `buildSalePreviewPayload` (defensa final) vuelve a
// forzar BREAKDOWN en el payload — la UI se desactualiza con el payload
// pero el motor recibe coherente. Para limpiar el ajuste, el operador debe
// quitar todos los gramos por metal y el monetario; el helper detecta `next
// === null` (sanitizado por el editor) y deja de promover.
//
// Función PURA — sin React, sin side effects, devuelve un nuevo objeto draft
// sin mutar la entrada. Testeable en aislamiento.
// ============================================================================

import type { SalesInvoice, SalesInvoiceManualAdjustmentDraft } from "./types";

/**
 * Devuelve el nuevo draft con `manualAdjustment` actualizado + posible
 * auto-promoción de `balanceModeOverride` a "BREAKDOWN".
 *
 * Reglas (Etapa 3A-fix):
 *   · `next.scope === "BREAKDOWN"` → `balanceModeOverride` SIEMPRE se setea
 *     en "BREAKDOWN" (sobreescribe null / "UNIFIED" / "BREAKDOWN").
 *   · `next.scope === "UNIFIED"` o `next === null` → `balanceModeOverride`
 *     se preserva tal cual (el operador puede mantener "BREAKDOWN" sin
 *     ajuste, por ejemplo).
 */
export function promoteManualAdjustmentChange(
  draft: SalesInvoice,
  next:  SalesInvoiceManualAdjustmentDraft | null,
): SalesInvoice {
  const wantsBreakdown =
    next != null && (next as { scope?: string }).scope === "BREAKDOWN";

  const nextOverride: SalesInvoice["balanceModeOverride"] = wantsBreakdown
    ? "BREAKDOWN"
    : draft.balanceModeOverride;

  return {
    ...draft,
    manualAdjustment:    next ?? undefined,
    balanceModeOverride: nextOverride,
  };
}
