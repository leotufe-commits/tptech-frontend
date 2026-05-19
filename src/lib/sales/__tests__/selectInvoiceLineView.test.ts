// src/lib/sales/__tests__/selectInvoiceLineView.test.ts
// =============================================================================
// Test del contrato: el input de impuestos y el label "Total línea c/ imp."
// deben leer del MISMO objeto normalizado del backend cuando la firma del
// preview coincide con el draft.
//
// El bug que cubre este test era visual: el editor mostraba el TPNumber de
// impuestos en 0,00% mientras el label "Impuestos: ARS X" mostraba un monto
// > 0. La causa estaba en TPDocumentLineAdvancedEditor (cascada de derivación
// de tasa que caía a 0 cuando ningún ítem del breakdown traía `rate`), pero
// el invariante a fijar es de selector: cuando el selector devuelve la línea
// con preview aplicado, los 5 campos visuales (`unitPrice`, `discountAmount`,
// `lineTotal`, `taxAmount`, `lineTotalWithTax`) tienen que venir TODOS del
// mismo `NormalizedPricingLine`.
// =============================================================================

import { describe, it, expect } from "vitest";
import { selectInvoiceLineView } from "../selectInvoiceLineView";
import type { DocumentLine } from "../../document-types";
import type { NormalizedPricingLine } from "../../pricing/contract";

function makeDraftLine(overrides: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:             "line-1",
    type:           "ARTICLE",
    article:        "Anillo oro",
    variant:        "",
    articleId:      "art-1",
    quantity:       1,
    unitPrice:      0,        // valores stale del draft, deben reemplazarse
    discountAmount: 0,
    subtotal:       0,
    taxAmount:      0,
    lineTotal:      0,
    ...overrides,
  } as DocumentLine;
}

function makeNormalized(overrides: Partial<NormalizedPricingLine> = {}): NormalizedPricingLine {
  return {
    articleId:               "art-1",
    variantId:               null,
    quantity:                1,
    basePrice:               1000,
    unitPrice:               900,
    unitTaxAmount:           189,
    unitTotalWithTax:        1089,
    quantityDiscountAmount:  0,
    promotionDiscountAmount: 0,
    lineTotal:               900,
    lineTaxAmount:           189,
    lineTotalWithTax:        1089,
    lineDiscount:            100,
    priceSource:             "PRICE_LIST",
    appliedPriceListId:      "pl-1",
    appliedPriceListName:    "Lista test",
    appliedPromotionId:      null,
    appliedPromotionName:    null,
    appliedDiscountId:       null,
    unitCost:                500,
    unitMargin:              400,
    marginPercent:           80,
    costMode:                "COST_LINES",
    costPartial:             false,
    taxBreakdown:            [],
    appliedRounding:         null,
    partial:                 false,
    ...overrides,
  };
}

describe("selectInvoiceLineView — invariante de fuente única", () => {
  it("cuando la firma coincide, los 5 campos visuales vienen del normalizado (no del draft)", () => {
    const draft = makeDraftLine({ unitPrice: 0, taxAmount: 0, lineTotal: 0 });
    const norm  = makeNormalized();
    const out   = selectInvoiceLineView(draft, norm, /* signatureMatches */ true);

    // Los 5 campos visuales que consume la grilla y los labels deben venir
    // todos del mismo objeto. Si un campo se filtra del draft (stale), el
    // input y el label divergen.
    expect(out.unitPrice).toBe(norm.unitPrice);
    expect(out.discountAmount).toBe(norm.lineDiscount);
    expect(out.lineTotal).toBe(norm.lineTotal);
    expect(out.taxAmount).toBe(norm.lineTaxAmount);
    expect(out.lineTotalWithTax).toBe(norm.lineTotalWithTax);
  });

  it("garantiza paridad input ↔ label: lineTaxAmount es la única fuente para impuestos", () => {
    // Caso del bug: backend resuelve impuestos via FIXED_AMOUNT (sin rate
    // explícita) — el label "Impuestos: $X" debe reflejar `lineTaxAmount`.
    const draft = makeDraftLine();
    const norm  = makeNormalized({
      lineTaxAmount:    250.5,
      lineTotalWithTax: 1150.5,
      taxBreakdown: [
        { taxId: "t1", name: "Tributo fijo", rate: null, baseAmount: 900, taxAmount: 250.5 },
      ],
    });
    const out = selectInvoiceLineView(draft, norm, true);

    // El label "Total línea c/ imp." y el desglose deben usar este valor.
    // El input TPNumber, en ausencia de rate, debe derivar la tasa efectiva
    // del mismo `taxAmount` (lo asegura la cascada de TPDocumentLineAdvancedEditor).
    expect(out.taxAmount).toBe(250.5);
    expect(out.lineTotalWithTax).toBe(1150.5);
  });

  it("cuando la firma NO coincide, devuelve el draft tal cual (no muta)", () => {
    const draft = makeDraftLine({ unitPrice: 777, taxAmount: 88, lineTotal: 700 });
    const norm  = makeNormalized();
    const out   = selectInvoiceLineView(draft, norm, /* signatureMatches */ false);

    expect(out).toBe(draft);
  });

  it("cuando no hay normalizedLine, devuelve el draft tal cual", () => {
    const draft = makeDraftLine({ unitPrice: 777 });
    const out   = selectInvoiceLineView(draft, null, true);

    expect(out).toBe(draft);
  });

  it("exención AUTORITATIVA: con firma OK, normalized manda y NO arrastra el meta stale del draft", () => {
    // Cliente anterior exento dejó `pricingMeta.taxExemptByEntity=true` en el
    // draft. El cliente nuevo (normalized, firma OK) NO es exento → el
    // impuesto debe desbloquearse (antes el OR lo dejaba pegado en 0).
    const draft = makeDraftLine({
      taxAmount: 0,
      lineTotal: 900,
      pricingMeta: { taxExemptByEntity: true } as any,
    });
    const norm = makeNormalized({
      taxExemptByEntity: false,
      lineTaxAmount: 189,
      lineTotalWithTax: 1089,
    });
    const out = selectInvoiceLineView(draft, norm, true);

    expect(out.pricingMeta?.taxExemptByEntity).toBe(false);
    expect(out.taxAmount).toBe(189);
    expect(out.lineTotalWithTax).toBe(1089);
  });

  it("exención AUTORITATIVA: normalized exento ⇒ impuesto 0 aunque el draft no lo estuviera", () => {
    const draft = makeDraftLine({ taxAmount: 88, lineTotal: 900 });
    const norm  = makeNormalized({
      taxExemptByEntity: true,
      lineTaxAmount: 189,        // el motor lo reporta pero exención lo anula
      lineTotalWithTax: 1089,
      lineTotal: 900,
    });
    const out = selectInvoiceLineView(draft, norm, true);

    expect(out.pricingMeta?.taxExemptByEntity).toBe(true);
    expect(out.taxAmount).toBe(0);
    expect(out.lineTotalWithTax).toBe(900); // = neto, sin impuesto
  });

  it("preserva el resto del shape del draft (id, articleId, pricingMeta, etc.)", () => {
    const draft = makeDraftLine({
      id:        "line-XYZ",
      articleId: "art-XYZ",
      // @ts-expect-error — campos del DocumentLine que no afectan el selector
      manualOverrides: { tax: true },
      pricingMeta:     { taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" } } as any,
    });
    const norm = makeNormalized({ articleId: "art-XYZ" });
    const out  = selectInvoiceLineView(draft, norm, true);

    expect(out.id).toBe("line-XYZ");
    expect(out.articleId).toBe("art-XYZ");
    expect((out as any).manualOverrides).toEqual({ tax: true });
    expect((out as any).pricingMeta?.taxOverride?.value).toBe(0);
  });
});
