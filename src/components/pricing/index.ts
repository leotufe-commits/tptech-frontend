// src/components/pricing/index.ts
// ============================================================================
// Barrel — bloques read-only UI del dominio comercial.
//
// Reglas (ver README.md):
//   1. El backend pricing-engine es autoridad absoluta. Estos componentes
//      LEEN y FORMATEAN, nunca calculan.
//   2. Recibir datos por props (NormalizedPricingResult / NormalizedPricingLine
//      de src/lib/pricing/contract.ts).
//   3. Prohibido importar apiFetch o services/ desde acá.
//   4. Adapters viven en src/lib/pricing/adapters/ y solo mapean shape.
// ============================================================================

// Re-export del contrato compartido para consumo conveniente desde estos
// componentes y sus tests. Single source of truth en src/lib/pricing/contract.ts.
export type {
  NormalizedPricingResult,
  NormalizedPricingLine,
  NormalizedComposition,
  NormalizedTaxBreakdownItem,
  NormalizedAppliedRounding,
  NormalizedComponentSaleDetail,
  NormalizedComponentSaleBreakdown,
  NormalizedCostOverrideContext,
  NormalizedCostLineOverride,
  NormalizedStackingMode,
} from "../../lib/pricing/contract";

// Componentes — se irán agregando por fase.
//
export { CostCompositionBlock } from "./CostCompositionBlock";
export type {
  CostCompositionBlockProps,
  CostCompositionVariant,
  CostCompositionDetailMode,
  CostCompositionDisplay,
} from "./CostCompositionBlock";

export { PricingStepsBreakdown } from "./PricingStepsBreakdown";
export type {
  PricingStepsBreakdownProps,
  PricingStepsBreakdownVariant,
  PricingStepsDetailMode,
  PricingStepsDisplay,
  PricingStepsChannelInfo,
  PricingStepsPaymentInfo,
} from "./PricingStepsBreakdown";

export { PriceCompositionCards } from "./PriceCompositionCards";
export type {
  PriceCompositionCardsProps,
  PriceCompositionCardsVariant,
  MetalSaleParent,
  MetalSaleVariant,
  HechuraAdjustment,
  SaleTaxLine,
} from "./PriceCompositionCards";
// FASE 2: export { PricingStepsBreakdown } from "./PricingStepsBreakdown/PricingStepsBreakdown";
// FASE 3: export { TaxBreakdownTable } from "./TaxBreakdownTable/TaxBreakdownTable";
// FASE 3: export { CheckoutResultDisplay } from "./CheckoutResultDisplay/CheckoutResultDisplay";
// FASE 3: export { WhatIfPanel } from "./WhatIfPanel/WhatIfPanel";
