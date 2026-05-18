// src/lib/sales/__tests__/applies-to-override-payload.test.ts
// ============================================================================
// El override de SOLO la base ("Aplica a") viaja en el payload INDEPENDIENTE
// del valor: con `pricingMeta.manualTaxAppliesTo` / `manualDiscountAppliesTo`
// seteado y SIN override de %/monto, el payload manda
// `manualTaxAppliesToOverride` / `manualDiscountAppliesToOverride` por línea
// → `previewSignature` cambia → el preview recalcula al toque.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function line(id: string, meta: any): DocumentLine {
  return {
    id, articleId: "ART-1", article: "Anillo", quantity: 1,
    unitPrice: 1000, discountAmount: 0, subtotal: 1000,
    taxAmount: 210, lineTotal: 1210, lineTotalWithTax: 1210,
    pricingMeta: { priceSource: "PRICE_LIST", basePrice: 1000, ...meta },
  } as unknown as DocumentLine;
}
function draft(lines: DocumentLine[]): SalesInvoice {
  return {
    id: "fv1", number: "FV", date: "", dueDate: "", client: "",
    salesOrderNumber: "", deliveryNumber: "", currency: "ARS", fxRate: 1,
    taxPercent: 21, seller: "", warehouse: "", paymentTerm: "",
    referenceNumber: "", notes: "", terms: "", subtotal: 0, discountAmount: 0,
    taxAmount: 0, total: 0, paidAmount: 0, lines, status: "DRAFT",
  } as SalesInvoice;
}

describe("payload — override de base 'Aplica a' (sin override de valor)", () => {
  it("manualTaxAppliesTo viaja como manualTaxAppliesToOverride; taxOverride sigue null", () => {
    const { payload } = buildSalePreviewPayload(
      draft([line("L1", { manualTaxAppliesTo: "HECHURA" })]),
    );
    const pl = payload.lines[0] as any;
    expect(pl.manualTaxAppliesToOverride).toBe("HECHURA");
    expect(pl.taxOverride).toBeNull(); // NO se inventó override de valor
  });

  it("manualDiscountAppliesTo viaja como manualDiscountAppliesToOverride", () => {
    const { payload } = buildSalePreviewPayload(
      draft([line("L1", { manualDiscountAppliesTo: "METAL" })]),
    );
    const pl = payload.lines[0] as any;
    expect(pl.manualDiscountAppliesToOverride).toBe("METAL");
    expect(pl.manualDiscountOverride).toBeNull();
  });

  it("sin override de base → no viaja (null)", () => {
    const { payload } = buildSalePreviewPayload(draft([line("L1", {})]));
    const pl = payload.lines[0] as any;
    expect(pl.manualTaxAppliesToOverride).toBeNull();
    expect(pl.manualDiscountAppliesToOverride).toBeNull();
  });

  it("dos líneas mismo artículo → override de base independiente por línea", () => {
    const { payload } = buildSalePreviewPayload(
      draft([
        line("A", { manualTaxAppliesTo: "HECHURA" }),
        line("B", {}),
      ]),
    );
    expect((payload.lines[0] as any).manualTaxAppliesToOverride).toBe("HECHURA");
    expect((payload.lines[1] as any).manualTaxAppliesToOverride).toBeNull();
  });
});
