// src/lib/pricing/index.ts
// ============================================================================
// Barrel del contrato común de pricing. Importar siempre desde acá:
//
//   import {
//     buildPricingPreviewPayload,
//     normalizePricingPreviewResult,
//     type PricingPreviewPayload,
//     type NormalizedPricingResult,
//   } from "../lib/pricing";
//
// La exposición intencional es chica: tipos del contrato, adapters por
// endpoint, normalizadores y validador. No exportamos detalles internos.
// ============================================================================

export type {
  PricingPreviewPayload,
  PricingPreviewLinePayload,
  PricingShippingPayload,
  PricingShippingMode,
  PricingOverridesPayload,
  PricingManualPriceOverride,
  PricingManualDiscountOverride,
  PricingManualTaxOverride,
  PricingCostOverridesPayload,
  PricingPreviewEndpoint,
  PricingPreviewMode,
  NormalizedPricingResult,
  NormalizedPricingLine,
  NormalizedTaxBreakdownItem,
  NormalizedAppliedRounding,
  NormalizedChannelInfo,
  NormalizedCouponInfo,
  NormalizedShippingInfo,
  NormalizedPaymentInfo,
  // Fase 2.1
  NormalizedComposition,
  NormalizedCompositionMetal,
  NormalizedCompositionHechura,
  NormalizedCompositionTaxItem,
  NormalizedPurchaseTaxItem,
  NormalizedClientCommercialRules,
  // Fase 2.1.b
  NormalizedPricingStep,
  NormalizedCheckoutStep,
  NormalizedMetalHechuraBreakdown,
  NormalizedCostOverrideContext,
  NormalizedStackingMode,
} from "./contract";

export {
  toArticlePricingPreviewArgs,
  toSalesPreviewArgs,
  resolveLegacyShippingAmount,
  validatePricingPreviewPayload,
  type ArticlePricingPreviewArgs,
  type SalesPreviewArgs,
} from "./buildPricingPreviewPayload";

export {
  normalizeArticlePricingPreview,
  normalizeSalesPreview,
  normalizeSalesLine,
  type NormalizeArticleArgs,
} from "./normalizePricingPreviewResult";

// FASE 1 — logger temporal de paridad (dev-only). Quitar cuando Fase 2/3
// estabilicen y la paridad esté validada por tests.
export { logParity } from "./parityLogger";
