// src/components/pricing/PriceCompositionCards/types.ts
// ============================================================================
// Tipos del bloque "Cards de Composición del precio".
//
// REGLA CRÍTICA (POLICY R6): modelan datos YA EMITIDOS por el motor backend.
// El componente solo los renderiza con formato — cero matemática nueva.
// ============================================================================

import type { NormalizedPricingLine } from "../../../lib/pricing/contract";
import type { PricingStepResult, PricingPreviewResult } from "../../../services/articles";
import type { PricingStepsDisplay, PricingStepsChannelInfo, PricingStepsPaymentInfo } from "../PricingStepsBreakdown/types";

/**
 * Modo de visualización del bloque.
 *
 * - `full` — grid de 2 columnas, padding card estándar. Diseño del Simulador
 *   y Comparador (vista de 2 columnas).
 * - `compact` — grid de 1 columna, padding reducido. Diseño para integración
 *   por línea en Factura (modal estrecho).
 */
export type PriceCompositionCardsVariant = "full" | "compact";

/**
 * Variante individual dentro de un card de metal de precio (modo DESGLOSADO).
 * Salida de `buildMetalPriceMap` — passthrough del motor.
 */
export type MetalSaleVariant = {
  qty:         number;
  factor:      number;
  equivGr:     number;
  purity:      number | null;
  merma:       number | null;
  saleFactor:  number | null;
  sku:         string | null;
  variantName: string | null;
  quotePrice:  number | null;
  /** lineSale canónico (composition.metals[i].lineSale) o fallback legacy. */
  saleLine:    number;
};

/**
 * Acumulador por metal padre (Oro, Plata, etc.) — output de `buildMetalPriceMap`.
 */
export type MetalSaleParent = {
  displayName:  string;
  symbol:       string | null;
  totalCost:    number;
  totalEquivGr: number;
  variants:     MetalSaleVariant[];
};

/**
 * Item de ajuste comercial aplicado a hechura (qty, promo, entity rule, etc.).
 * Combinación de `componentSaleBreakdown.hechura.adjustments` (motor) +
 * `quantityDiscountAmount` / `promotionDiscountAmount` (top-level).
 */
export type HechuraAdjustment = {
  kind:        string;
  label:       string;
  amount:      number;
  base?:       number | null;
  percentage?: number | null;
  valueType?:  string | null;
  [key: string]: unknown;
};

/**
 * Desglose de un impuesto en venta entre metal y hechura.
 * Cálculo display (no commercial logic): cada parte = base × rate / 100.
 */
export type SaleTaxLine = {
  name:        string;
  rate:        number;
  metalPart:   number;
  hechuraPart: number;
  totalTax:    number;
};

/**
 * Props públicas de `<PriceCompositionCards />`.
 */
export type PriceCompositionCardsProps = {
  /** Pasos normalizados del motor. */
  steps: PricingStepResult[];

  /** Línea normalizada del ViewModel. Provee composition + metalHechuraBreakdown. */
  line: NormalizedPricingLine | null;

  /** Resultado bruto del motor. Necesario para channelResult, couponResult,
   *  checkoutResult, shippingResult, taxBreakdown, totalWithTax,
   *  componentSaleBreakdown, appliedPromotionName,
   *  quantityDiscountAmount, promotionDiscountAmount. */
  result: Pick<PricingPreviewResult,
    | "channelResult"
    | "couponResult"
    | "checkoutResult"
    | "shippingResult"
    | "taxBreakdown"
    | "totalWithTax"
    | "componentSaleBreakdown"
    | "appliedPromotionName"
    | "quantityDiscountAmount"
    | "promotionDiscountAmount"
  > | null;

  /** Cantidad seleccionada — usada para totales por unidad. */
  quantity?: number;

  /** Información del canal (display). */
  channel?: PricingStepsChannelInfo | null;

  /** Información del medio de pago (display). */
  payment?: PricingStepsPaymentInfo | null;

  /** Modo what-if — oculta ajustes globales (cupón, canal, pago). */
  whatIfActive?: boolean;

  /** Costo crudo de hechura (de line.metalHechuraBreakdown). Pasado por el
   *  orchestrator para evitar derivación duplicada. */
  hechuraCostRaw?: number | null;

  /** Configuración de moneda. Default `{ rate: 1, symbol: "$" }`. */
  display?: PricingStepsDisplay;

  /** Variante visual. Default `"full"` (grid 2-col + padding estándar).
   *  Pasar `"compact"` desde Factura para modal estrecho. */
  variant?: PriceCompositionCardsVariant;

  /** Estado controlado de expansión (key → boolean). */
  expanded?: Record<string, boolean>;
  onToggle?: (key: string) => void;
};

// Re-exports para conveniencia de los parts.
export type { NormalizedPricingLine, PricingStepResult, PricingPreviewResult };
export type { PricingStepsDisplay, PricingStepsChannelInfo, PricingStepsPaymentInfo };
