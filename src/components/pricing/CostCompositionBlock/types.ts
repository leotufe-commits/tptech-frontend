// src/components/pricing/CostCompositionBlock/types.ts
// ============================================================================
// Tipos internos del bloque de Composición del costo.
//
// Mantenidos co-locados para que el componente sea autocontenido. Si alguno
// se vuelve útil para otro componente de pricing/, se promueve al barrel
// (../index.ts) y se re-exporta desde src/lib/pricing/contract.ts.
//
// REGLA CRÍTICA (POLICY R6): estos tipos modelan datos YA CALCULADOS por el
// motor backend. El componente no realiza cálculos comerciales — los lee y
// formatea.
// ============================================================================

import type {
  NormalizedPricingLine,
  NormalizedComposition,
  NormalizedComponentSaleDetail,
} from "../../../lib/pricing/contract";
import type { PricingStepResult, PricingPreviewResult } from "../../../services/articles";

/**
 * Modo de visualización del bloque.
 *
 * - `full` — diseño completo del Simulador y Comparador. Incluye colapso de
 *   secciones, helpers descriptivos y cards de equivalencia metal/hechura.
 * - `compact` — diseño reducido para integración por línea en Factura
 *   (modal estrecho). Sin cards de equivalencia; solo resumen.
 *
 * El componente debe respetar la `variant` para que las tres pantallas
 * mantengan paridad visual sin diverger.
 */
export type CostCompositionVariant = "full" | "compact";

/**
 * Modo de detalle del Simulador. Solo se aplica cuando `variant === "full"`.
 *
 * - `UNIFICADO` — oculta cards de equivalencia metal/hechura.
 * - `DESGLOSADO` — muestra cards de equivalencia.
 */
export type CostCompositionDetailMode = "UNIFICADO" | "DESGLOSADO";

/**
 * Configuración de moneda para visualización. NO afecta cálculos — solo
 * formatea valores ya resueltos por el motor.
 */
export type CostCompositionDisplay = {
  /** Tasa de conversión de la moneda base del motor a la moneda mostrada.
   *  Default 1 (sin conversión). */
  rate: number;
  /** Símbolo de moneda a mostrar (ej: "$", "USD", "ARS"). */
  symbol: string;
};

/**
 * Props públicas de `<CostCompositionBlock />`.
 *
 * Diseño: un único objeto por componente, agrupando datos del motor + config
 * visual. Evita explosión de props sueltas.
 */
export type CostCompositionBlockProps = {
  /** Pasos normalizados del motor (steps[] tras `normalizePricingPreviewResult`).
   *  Contiene METAL_QUOTE, COST_LINES_*, HECHURA, etc. */
  steps: PricingStepResult[];

  /** Línea normalizada del ViewModel. Provee:
   *   - `unitCost`, `costTaxAmount`
   *   - `metalHechuraBreakdown` (metalCost, hechuraCost)
   *   - `composition` (metals[], hechuras[])
   *   - `componentSaleBreakdown` (base/adjustments/final por componente)
   *   - `products`, `services` (líneas no metal/hechura)
   *  Si es null, el componente renderiza null. */
  line: NormalizedPricingLine | null;

  /** Resultado bruto del motor — necesario para `costTaxBreakdown` (impuestos
   *  de compra agregados que no están en `line.taxBreakdown`) y para resolver
   *  el sub-texto descriptivo del fallback MANUAL/MULTIPLIER. Opcional; si no
   *  se provee, la sección de impuestos se omite y el fallback usa "Costo
   *  del artículo" como sub-texto. */
  result?: Pick<PricingPreviewResult, "costTaxBreakdown" | "taxExemptByEntity" | "costMode"> | null;

  /** Configuración de moneda. Default `{ rate: 1, symbol: "$" }`. */
  display?: CostCompositionDisplay;

  /** Variante visual. Default `"full"`. */
  variant?: CostCompositionVariant;

  /** Solo aplica cuando `variant === "full"`. Default `"DESGLOSADO"`. */
  detailMode?: CostCompositionDetailMode;

  /** Estado controlado de expansión (key → boolean). Si se omite, el
   *  componente maneja estado local. Permite que el padre persista
   *  preferencias del usuario (ej: localStorage). */
  expanded?: Record<string, boolean>;
  /** Callback al togglear una sección. Solo necesario si `expanded` es
   *  controlado. */
  onToggle?: (key: string) => void;
};

// ─── Tipos internos (no exportados al barrel) ──────────────────────────────

/**
 * Variante de metal con datos de equivalencia. Producto interno de la
 * agregación `metalPadreMap` durante el render del card de "DESGLOSADO".
 */
export type MetalVariantEquiv = {
  variantId:    string;
  variantName:  string;
  variantSku:   string | null;
  cost:         number;
  grams:        number | null;
  pureGrams:    number | null;
  pricePerGram: number | null;
  mermaPercent: number;
};

/**
 * Acumulador de un metal padre con sus variantes y totales agregados.
 * Output de la reducción `stepsNorm.filter(METAL_QUOTE).reduce(...)`.
 */
export type MetalPadreAccum = {
  parentId:        string | null;
  parentName:      string;
  variants:        MetalVariantEquiv[];
  totalCost:       number;
  totalGrams:      number;
  totalPureGrams:  number;
  totalEquivGr:    number;
};

// Re-export para conveniencia de tests.
export type { NormalizedPricingLine, NormalizedComposition, NormalizedComponentSaleDetail };
