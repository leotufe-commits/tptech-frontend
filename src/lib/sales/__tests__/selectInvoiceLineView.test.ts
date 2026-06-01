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

  it("ANTI-FLICKER: firma stale + mismo articleId → preserva último valor válido", () => {
    // Cuando el operador cambia la cantidad, la firma del draft se adelanta
    // al backend ~200-500 ms (debounce + RTT). En ese intervalo:
    //   · `draftLine.quantity` ya es la nueva (operador la tipeó).
    //   · `normalizedLine` sigue siendo del preview anterior (qty viejo).
    // El selector debe usar los IMPORTES del normalized (snapshot consistente)
    // en lugar del draftLine — cuyos `unitPrice`/`discountAmount`/`taxAmount`
    // también son del preview anterior, pero el `subtotal` puede estar a
    // medio actualizar si otro path tocó el draft → mejor anclarse a un
    // único snapshot. La quantity del operador igual queda en el output
    // porque viene del spread del draftLine al final.
    const draft = makeDraftLine({
      articleId:      "art-1",
      quantity:       2,        // operador acaba de cambiar 1 → 2
      unitPrice:      900,      // valores del preview anterior (qty=1)
      discountAmount: 100,
      taxAmount:      189,
      lineTotal:      900,
    });
    const norm = makeNormalized({
      articleId:        "art-1",
      quantity:         1,      // snapshot anterior
      unitPrice:        900,
      lineDiscount:     100,
      lineTaxAmount:    189,
      lineTotal:        900,
      lineTotalWithTax: 1089,
    });
    const out = selectInvoiceLineView(draft, norm, /* signatureMatches */ false);

    // Quantity nueva del operador (no la del normalized) — feedback inmediato.
    expect(out.quantity).toBe(2);
    // Importes ANCLADOS al snapshot del normalized — estables, sin frame
    // intermedio incorrecto. Convergerán cuando llegue el nuevo preview.
    expect(out.unitPrice).toBe(900);
    expect(out.discountAmount).toBe(100);
    expect(out.taxAmount).toBe(189);
    expect(out.lineTotal).toBe(900);
    expect(out.lineTotalWithTax).toBe(1089);
    // `previewQuantity` se propaga al meta — el editor lo usa para anclar
    // sus cálculos de % efectivo de bonificación al mismo snapshot.
    expect(out.pricingMeta?.previewQuantity).toBe(1);
  });

  it("ANTI-FLICKER: firma stale + articleId distinto → falla seguro al draft (cache inválido)", () => {
    // Si la línea reemplazó su artículo (el operador eligió otro en el
    // combo), el normalizado cacheado es del artículo viejo → usarlo
    // mostraría datos del producto que ya no está. En ese caso devolvemos
    // el draft tal cual hasta que el nuevo preview llegue.
    const draft = makeDraftLine({
      articleId:      "art-NUEVO",
      unitPrice:      777,
      taxAmount:      88,
      lineTotal:      700,
    });
    const norm = makeNormalized({ articleId: "art-VIEJO" });
    const out  = selectInvoiceLineView(draft, norm, /* signatureMatches */ false);

    expect(out).toBe(draft);
  });

  it("cuando no hay normalizedLine, devuelve el draft tal cual", () => {
    const draft = makeDraftLine({ unitPrice: 777 });
    const out   = selectInvoiceLineView(draft, null, true);

    expect(out).toBe(draft);
  });

  it("propaga `previewQuantity` al pricingMeta cuando hay normalized", () => {
    // El editor de líneas usa `meta.previewQuantity` para anclar los
    // cálculos de % efectivo de bonificación al snapshot del motor. El
    // selector lo expone como passthrough — pieza clave del anti-flicker.
    const draft = makeDraftLine({ quantity: 5 });
    const norm  = makeNormalized({ quantity: 3 });
    const out   = selectInvoiceLineView(draft, norm, true);

    expect(out.pricingMeta?.previewQuantity).toBe(3);
    // La quantity del draft NO se toca — sigue siendo la del operador.
    expect(out.quantity).toBe(5);
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

  // ─────────────────────────────────────────────────────────────────────────
  // Override manual de tax GANA sobre exención del cliente — bug reportado:
  // operador ingresaba 30% sobre cliente exento, el input mostraba 30% pero
  // el footer mostraba "Impuestos: ARS 0,00" porque el adapter aplastaba
  // taxAmount a 0 sin chequear el override manual.
  // ─────────────────────────────────────────────────────────────────────────
  it("exento + override manual PERCENT → tax del motor gana (NO se aplasta a 0)", () => {
    // El motor backend ya respeta el override sobre la exención: con
    // taxOverride en el payload + cliente exento, devuelve lineTaxAmount > 0.
    // Este test fija que el adapter pasa ese valor sin pisarlo.
    const draft = makeDraftLine({
      taxAmount: 0,
      lineTotal: 1000,
      pricingMeta: {
        taxOverride: { mode: "PERCENT", value: 30, appliesTo: "TOTAL" },
      } as any,
    });
    const norm = makeNormalized({
      taxExemptByEntity: true,
      lineTaxAmount:    300, // motor aplica 30% sobre $1000 aunque exento
      lineTotalWithTax: 1300,
      lineTotal:        1000,
    });
    const out = selectInvoiceLineView(draft, norm, true);

    // taxAmount viene del motor, NO se aplasta a 0 por la exención.
    expect(out.taxAmount).toBe(300);
    expect(out.lineTotalWithTax).toBe(1300);
    // taxExemptByEntity sigue siendo true (el cliente sigue siendo exento;
    // el override le gana al valor del tax, no a la condición del cliente).
    expect(out.pricingMeta?.taxExemptByEntity).toBe(true);
  });

  it("exento + override manual AMOUNT → tax del motor gana", () => {
    const draft = makeDraftLine({
      lineTotal: 1000,
      pricingMeta: {
        taxOverride: { mode: "AMOUNT", value: 500, appliesTo: "TOTAL" },
      } as any,
    });
    const norm = makeNormalized({
      taxExemptByEntity: true,
      lineTaxAmount:    500,
      lineTotalWithTax: 1500,
      lineTotal:        1000,
    });
    const out = selectInvoiceLineView(draft, norm, true);
    expect(out.taxAmount).toBe(500);
    expect(out.lineTotalWithTax).toBe(1500);
  });

  it("exento + override manual value=0 (X = manual 0) → tax queda 0 (correcto por override, NO por exención)", () => {
    // Con la nueva semántica global "X = manual 0", la X de Impuestos deja
    // taxOverride = { value: 0 }. El motor aplica 0 manual → lineTaxAmount=0.
    // El adapter debe pasar ese valor (que casualmente es 0). El resultado
    // visible es el mismo que "exento sin override" pero la causa es
    // distinta: aquí es override manual, no exención.
    const draft = makeDraftLine({
      lineTotal: 1000,
      pricingMeta: {
        taxOverride: { mode: "PERCENT", value: 0, appliesTo: "TOTAL" },
      } as any,
    });
    const norm = makeNormalized({
      taxExemptByEntity: true,
      lineTaxAmount:    0,    // motor aplica 0 manual
      lineTotalWithTax: 1000,
      lineTotal:        1000,
    });
    const out = selectInvoiceLineView(draft, norm, true);
    expect(out.taxAmount).toBe(0);
    expect(out.lineTotalWithTax).toBe(1000);
  });

  it("NO exento + override manual sigue funcionando (no regresión)", () => {
    // Sin exención y con override manual, el tax del motor pasa intacto
    // (mismo comportamiento que cualquier override sin exención).
    const draft = makeDraftLine({
      lineTotal: 1000,
      pricingMeta: {
        taxOverride: { mode: "PERCENT", value: 25, appliesTo: "TOTAL" },
      } as any,
    });
    const norm = makeNormalized({
      taxExemptByEntity: false,
      lineTaxAmount:    250,
      lineTotalWithTax: 1250,
      lineTotal:        1000,
    });
    const out = selectInvoiceLineView(draft, norm, true);
    expect(out.taxAmount).toBe(250);
    expect(out.lineTotalWithTax).toBe(1250);
  });

  it("exento SIN override → tax sigue aplastándose a 0 (modo automático preservado)", () => {
    // Anti-regresión del fix. Sin taxOverride en pricingMeta, el guard
    // hasManualTaxOverride === false → la exención sigue ganando (modo
    // automático). El motor puede haber emitido un lineTaxAmount > 0 por
    // datos legacy del artículo; el adapter lo aplasta a 0 (correcto).
    const draft = makeDraftLine({
      lineTotal: 900,
      pricingMeta: {
        // SIN taxOverride.
      } as any,
    });
    const norm = makeNormalized({
      taxExemptByEntity: true,
      lineTaxAmount:    189, // motor reportó algo, exención lo anula
      lineTotalWithTax: 1089,
      lineTotal:        900,
    });
    const out = selectInvoiceLineView(draft, norm, true);
    expect(out.taxAmount).toBe(0);
    expect(out.lineTotalWithTax).toBe(900);
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
