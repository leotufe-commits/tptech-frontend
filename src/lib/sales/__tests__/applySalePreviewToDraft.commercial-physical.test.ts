// src/lib/sales/__tests__/applySalePreviewToDraft.commercial-physical.test.ts
// =============================================================================
// Etapa C-comercial / C4-fix (POLICY §R-Rounding-14) — Tests del mapper
// `applySalePreviewToDraft` para verificar el TRANSPORTE de los 5 campos
// nuevos hasta `pricingMeta` del draft.
//
// Cubre los tests obligatorios del brief de C4-fix:
//   1. previewSale con lista PHYSICAL → draft con `commercialPhysical != null`.
//   2. Listas legacy MONETARY → `commercialPhysical` queda `null` (sin
//      cambios visibles en el draft).
//   3. Campos `metalSalePreRounding`/`hechuraSalePreRounding`/
//      `metalSaleRoundingDelta`/`hechuraSaleRoundingDelta` viajan tal cual.
//   4. Cuando `metalHechuraBreakdown` es `null` (línea sin metal) todos los
//      campos quedan `null` por defecto.
//
// Cero matemática nueva — solo paseo del shape. La UI (etapa C6) consumirá
// estos campos. C4-fix solo garantiza el transporte.
// =============================================================================

import { describe, it, expect } from "vitest";
import { applySalePreviewToDraft } from "../applySalePreviewToDraft";
import type { SalesInvoice } from "../types";
import type { SalePreviewResult } from "../../../services/sales";

function makeLine(): SalesInvoice["lines"][number] {
  return {
    id:             "line-1",
    type:           "ARTICLE",
    article:        "Anillo Oro 18K",
    variant:        "",
    articleId:      "art-1",
    quantity:       1,
    unitPrice:      0,
    discountAmount: 0,
    subtotal:       0,
    taxAmount:      0,
    lineTotal:      0,
  } as any;
}

function makeDraft(): SalesInvoice {
  return { lines: [makeLine()] } as SalesInvoice;
}

function makePreview(metalHechuraBreakdown: any): SalePreviewResult {
  return {
    lines: [{
      articleId:               "art-1",
      variantId:               null,
      quantity:                1,
      basePrice:               115000,
      unitPrice:               115000,
      unitTaxAmount:           0,
      unitTotalWithTax:        115000,
      quantityDiscountAmount:  0,
      promotionDiscountAmount: 0,
      lineSubtotal:            115000,
      lineTotal:               115000,
      lineDiscount:            0,
      lineTaxAmount:           0,
      lineTotalWithTax:        115000,
      priceSource:             "PRICE_LIST",
      appliedPriceListId:      "pl-physical",
      appliedPriceListName:    "Lista Desglosada Físico",
      appliedPromotionId:      null,
      appliedPromotionName:    null,
      unitCost:                60400,
      unitMargin:              54600,
      marginPercent:           90.4,
      metalHechuraBreakdown,
      taxBreakdown:            [],
    }] as any,
    // El mapper lee `preview.documentTotals.total` para hidratar el draft —
    // sin este bloque rompe con `Cannot read 'total' of undefined`.
    documentTotals: {
      subtotalBeforeDiscounts:    115000,
      lineDiscountAmount:         0,
      subtotalAfterLineDiscounts: 115000,
      couponDiscountAmount:       0,
      globalDiscountAmount:       0,
      taxAmount:                  0,
      shippingAmount:             0,
      total:                      115000,
    },
  } as any;
}

// ──────────────────────────────────────────────────────────────────────────
// Fixture canónico del brief: Oro Fino 0,908 → 1,000.
// ──────────────────────────────────────────────────────────────────────────

const MHB_PHYSICAL = {
  metalCost:               45400,
  metalSale:               100000,
  metalMarginPct:          100,
  hechuraCost:             15000,
  hechuraSale:             15000,
  hechuraMarginPct:        0,
  metalGramsBase:          0.908,
  metalGramsSale:          1.816,
  metalPricePerGram:       100000,
  // C4-fix.
  metalSalePreRounding:    90800,
  hechuraSalePreRounding:  null,        // hechura no actuó (no había modo).
  metalSaleRoundingDelta:  9200,
  hechuraSaleRoundingDelta:null,
  physical: {
    metals: [{
      metalParentId:      "oro-fino",
      metalParentName:    "Oro Fino",
      preGrams:           0.908,
      postGrams:          1.000,
      deltaGrams:         0.092,
      metalPricePerGram:  100000,
      monetaryEquivalent: 9200,
      mode:               "INTEGER",
      direction:          "NEAREST",
      source:             "COMMERCIAL_PHYSICAL_ROUNDING",
      fallback:           null,
    }],
    metalMonetaryEquivalent: 9200,
    fallback:                null,
  },
};

const MHB_MONETARY_LEGACY = {
  metalCost:               45400,
  metalSale:               90800,
  metalMarginPct:          100,
  hechuraCost:             15000,
  hechuraSale:             15000,
  hechuraMarginPct:        0,
  metalGramsBase:          0.908,
  metalGramsSale:          1.816,
  metalPricePerGram:       50000,
  // C4-fix — listas MONETARY sin actuación del rounding:
  metalSalePreRounding:    null,
  hechuraSalePreRounding:  null,
  metalSaleRoundingDelta:  null,
  hechuraSaleRoundingDelta:null,
  physical:                null,
};

// ──────────────────────────────────────────────────────────────────────────
// (1) Caso PHYSICAL — snapshot llega al draft
// ──────────────────────────────────────────────────────────────────────────

describe("applySalePreviewToDraft — C4-fix: lista PHYSICAL transporta snapshot", () => {
  it("pricingMeta.commercialPhysical refleja exactamente el snapshot del backend", () => {
    const draft = applySalePreviewToDraft(makeDraft(), makePreview(MHB_PHYSICAL));
    const meta = draft.lines[0]!.pricingMeta!;
    expect(meta.commercialPhysical).not.toBeNull();
    expect(meta.commercialPhysical).toEqual(MHB_PHYSICAL.physical);
  });

  it("pricingMeta.metalSalePreRounding y metalSaleRoundingDelta llegan", () => {
    const draft = applySalePreviewToDraft(makeDraft(), makePreview(MHB_PHYSICAL));
    const meta = draft.lines[0]!.pricingMeta!;
    expect(meta.metalSalePreRounding).toBe(90800);
    expect(meta.metalSaleRoundingDelta).toBe(9200);
  });

  it("hechura sin redondeo → metalHechura pre/delta quedan null", () => {
    const draft = applySalePreviewToDraft(makeDraft(), makePreview(MHB_PHYSICAL));
    const meta = draft.lines[0]!.pricingMeta!;
    expect(meta.hechuraSalePreRounding).toBeNull();
    expect(meta.hechuraSaleRoundingDelta).toBeNull();
  });

  it("entry de Oro Fino preserva preGrams/postGrams/deltaGrams + source canónico", () => {
    const draft = applySalePreviewToDraft(makeDraft(), makePreview(MHB_PHYSICAL));
    const cp = draft.lines[0]!.pricingMeta!.commercialPhysical!;
    expect(cp.metals).toHaveLength(1);
    const e = cp.metals[0]!;
    expect(e.metalParentId).toBe("oro-fino");
    expect(e.preGrams).toBe(0.908);
    expect(e.postGrams).toBe(1.000);
    expect(e.deltaGrams).toBeCloseTo(0.092, 4);
    expect(e.monetaryEquivalent).toBe(9200);
    expect(e.source).toBe("COMMERCIAL_PHYSICAL_ROUNDING");
    expect(e.fallback).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (2) Caso MONETARY (legacy) — comportamiento intacto
// ──────────────────────────────────────────────────────────────────────────

describe("applySalePreviewToDraft — C4-fix: lista MONETARY (legacy) sin physical", () => {
  it("pricingMeta.commercialPhysical queda null", () => {
    const draft = applySalePreviewToDraft(makeDraft(), makePreview(MHB_MONETARY_LEGACY));
    expect(draft.lines[0]!.pricingMeta!.commercialPhysical).toBeNull();
  });

  it("los 4 campos pre/delta quedan null cuando el motor no los emitió", () => {
    const draft = applySalePreviewToDraft(makeDraft(), makePreview(MHB_MONETARY_LEGACY));
    const meta = draft.lines[0]!.pricingMeta!;
    expect(meta.metalSalePreRounding).toBeNull();
    expect(meta.hechuraSalePreRounding).toBeNull();
    expect(meta.metalSaleRoundingDelta).toBeNull();
    expect(meta.hechuraSaleRoundingDelta).toBeNull();
  });

  it("campos clásicos (metalCost, metalSale, etc.) viajan igual que antes", () => {
    const draft = applySalePreviewToDraft(makeDraft(), makePreview(MHB_MONETARY_LEGACY));
    const meta = draft.lines[0]!.pricingMeta!;
    expect(meta.metalCost).toBe(45400);
    expect(meta.metalSale).toBe(90800);
    expect(meta.hechuraCost).toBe(15000);
    expect(meta.hechuraSale).toBe(15000);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (3) Caso sin metales — metalHechuraBreakdown null
// ──────────────────────────────────────────────────────────────────────────

describe("applySalePreviewToDraft — C4-fix: sin metalHechuraBreakdown", () => {
  it("línea sin metales → todos los campos C4-fix quedan null por defecto", () => {
    const draft = applySalePreviewToDraft(makeDraft(), makePreview(null));
    const meta = draft.lines[0]!.pricingMeta!;
    expect(meta.commercialPhysical).toBeNull();
    expect(meta.metalSalePreRounding).toBeNull();
    expect(meta.hechuraSalePreRounding).toBeNull();
    expect(meta.metalSaleRoundingDelta).toBeNull();
    expect(meta.hechuraSaleRoundingDelta).toBeNull();
  });
});
