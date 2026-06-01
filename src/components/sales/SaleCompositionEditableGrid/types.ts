// src/components/sales/SaleCompositionEditableGrid/types.ts
// =============================================================================
// Tipos públicos + privados de la grilla. Extraídos del monolito original sin
// cambios — los callers (TPDocumentLineAdvancedEditor, tests) los siguen
// importando vía `./index.tsx` (re-export de compat).
// =============================================================================

import type { CostLineOverride } from "../../../services/sales";
import type { DocumentLine } from "../../../lib/document-types";
import type { CurrencyByIdMap } from "../../../lib/pricing/display/saleCompositionDisplay";

export type AppliesTo =
  | "TOTAL"
  | "METAL"
  | "HECHURA"
  | "METAL_Y_HECHURA"
  | "SUBTOTAL_AFTER_DISCOUNT"
  | "SUBTOTAL_BEFORE_DISCOUNT"
  | "PRODUCT"
  | "SERVICE";

export type LineOverridePatch = {
  taxOverride?:           { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesTo } | null;
  manualPrice?:           number | null;
  manualDiscount?:        { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesTo } | null;
  gramsOverride?:         number | null;
  mermaPercentOverride?:  number | null;
  metalVariantIdOverride?: string | null;
  hechuraOverrideAmount?: number | null;
  costLineOverrides?:     CostLineOverride[];
};

/**
 * Ajustes globales del documento que el preview backend ya resolvió. La
 * grilla los muestra en un bloque debajo de la tabla, separados de los
 * ajustes per-cost-line. Cada campo es opcional — si todos son null/0 el
 * bloque no se renderea.
 */
export type SaleGlobalAdjustments = {
  channel?:        { name: string; amount: number } | null;
  coupon?:         { code: string; name?: string; amount: number } | null;
  payment?:        { name: string; amount: number; installments?: number | null } | null;
  shipping?:       { mode: "FIXED" | "BY_WEIGHT" | "FREE" | string; amount: number; label?: string } | null;
  globalDiscount?: { type: "PERCENT" | "AMOUNT" | string; value: number; amount: number } | null;
  /** Bonif/Recargo manual con appliesTo=TOTAL (per-línea). Mismo passthrough
   *  que el panel legacy hacía con `documentAdjustments.lineManualDiscount`. */
  lineManualDiscount?: { kind: "BONUS" | "SURCHARGE"; valuePct: number | null; amount: number } | null;
};

export type SaleCompositionEditableGridProps = {
  line:     DocumentLine;
  currency: string;
  onApply:  (patch: LineOverridePatch) => void;
  /** Reset completo: limpia legacy + costLineOverrides[]. */
  onClear?: () => void;
  /** Cierra el panel desde el header. */
  onClose?: () => void;
  /** Mapping `code → name` del catálogo de unidades del tenant. Solo display. */
  unitNameByCode?: Map<string, string>;
  /** Mapping `currencyId → { code, symbol }` del catálogo de monedas del
   *  tenant. Cuando un cost line tiene `currencyId` distinto al code del
   *  documento, la celda "Costo unit." muestra el code original sobre el
   *  número y agrega una sub-línea con el equivalente en moneda del
   *  comprobante (`totalValue / quantity`, derivación trivial sobre datos
   *  del motor). Si no se provee, el comportamiento es idéntico al anterior. */
  currencyById?: CurrencyByIdMap;
  /** Ajustes globales del documento (passthrough del preview backend). */
  globalAdjustments?: SaleGlobalAdjustments;
  /**
   * Fase 4.3 — true cuando hay un preview backend en vuelo. La grilla
   * muestra un mini-spinner inline al lado del título para que el operador
   * sepa que el sistema está recalculando antes de tomar la siguiente
   * decisión. Cero impacto en cálculo.
   */
  previewLoading?: boolean;
  /**
   * Etapa E2 — FIX FX para sub-líneas equivalentes ("≈ X / unidad") en
   * facturas en moneda no-base. El motor backend emite `unitValueBase`
   * SIEMPRE en moneda base del tenant (ver backend
   * `pricing-composition.ts:170-181`). Cuando la factura está en moneda
   * no-base, hay que dividir ese equivalente por el rate del documento
   * antes de renderizarlo con la etiqueta de la moneda doc, sino el
   * operador ve "USD 33.799" siendo un valor en ARS.
   *
   * `documentFxRate` = "unidades de moneda BASE por 1 unidad de la moneda
   * del documento" (ej. 446 si 1 USD = 446 ARS). En moneda base es 1.
   * Default 1 (no convierte). Sólo afecta el equivalente; cero efecto en
   * el resto del display.
   */
  documentFxRate?: number;
};

// FASE F2 — passthrough del backend para el origen de la merma:
// Manual / Cliente / Catálogo / —. Se mantiene el tipo en el contrato
// del MermaLabelEditor para no romper callers; el badge visual fue
// removido en FASE F10.
export type MermaSource = "costLineOverride" | "entity" | "line" | "default" | null;
