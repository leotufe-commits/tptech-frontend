// src/lib/sales/__tests__/patchLineHelpers.test.ts
// ============================================================================
// Tests unitarios de los helpers de `patchLine` (FASE 8.2.5a).
//
// Cubren cada función pura con escenarios de edge cases para garantizar
// paridad con el comportamiento original inline en VentasFacturas.tsx.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  computeManualTax,
  detectManualEdit,
  applyTransientManualPrice,
  applyManualTaxRate,
  buildPatchedLine,
} from "../patchLineHelpers";
import type { DocumentLine } from "../../document-types";

function makeLine(o: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:           "l1",
    quantity:     1,
    unitPrice:    100,
    discountAmount: 0,
    taxAmount:    21,
    subtotal:     100,
    lineTotal:    121,
    ...o,
  } as DocumentLine;
}

// ─── computeManualTax ──────────────────────────────────────────────────────

describe("computeManualTax", () => {
  it("calcula IVA 21% sobre 1000 → 210", () => {
    expect(computeManualTax(1000, 21)).toBe(210);
  });

  it("redondea a 2 decimales", () => {
    expect(computeManualTax(1000, 10.5)).toBe(105);
    // 333.33 × 0.21 = 69.9993 → round2 = 70 (matemática estándar)
    expect(computeManualTax(333.33, 21)).toBe(70);
  });

  it("retorna 0 cuando rate <= 0", () => {
    expect(computeManualTax(1000, 0)).toBe(0);
    expect(computeManualTax(1000, -5)).toBe(0);
  });

  it("retorna 0 cuando subtotal <= 0", () => {
    expect(computeManualTax(0, 21)).toBe(0);
    expect(computeManualTax(-100, 21)).toBe(0);
  });

  it("retorna 0 ante valores no finitos", () => {
    expect(computeManualTax(NaN, 21)).toBe(0);
    expect(computeManualTax(1000, NaN)).toBe(0);
    expect(computeManualTax(Infinity, 21)).toBe(0);
  });
});

// ─── detectManualEdit ──────────────────────────────────────────────────────

describe("detectManualEdit", () => {
  it("flagDeltas vacío cuando before es undefined", () => {
    const r = detectManualEdit(undefined, { unitPrice: 200 });
    expect(r.flagDeltas).toEqual({});
  });

  it("isManualPriceEdit=true cuando cambia unitPrice sin pricingMeta", () => {
    const before = makeLine({ unitPrice: 100 });
    const r = detectManualEdit(before, { unitPrice: 200 });
    expect(r.isManualPriceEdit).toBe(true);
    expect(r.flagDeltas.price).toBe(true);
  });

  it("isManualPriceEdit=false cuando el patch trae pricingMeta", () => {
    const before = makeLine({ unitPrice: 100 });
    const r = detectManualEdit(before, {
      unitPrice: 200,
      pricingMeta: { priceSource: "PRICE_LIST" } as any,
    });
    expect(r.isManualPriceEdit).toBe(false);
    expect(r.isEngineDriven).toBe(true);
    // engine-driven → no flagDeltas
    expect(r.flagDeltas.price).toBeUndefined();
  });

  it("isEngineDriven=true cuando trae articleId", () => {
    const before = makeLine();
    const r = detectManualEdit(before, { articleId: "art-1" } as any);
    expect(r.isEngineDriven).toBe(true);
    expect(r.flagDeltas).toEqual({});
  });

  it("isEngineDriven=true cuando trae manualOverrides explícito", () => {
    const before = makeLine();
    const r = detectManualEdit(before, { manualOverrides: { price: true } });
    expect(r.isEngineDriven).toBe(true);
    expect(r.flagDeltas).toEqual({});
  });

  it("acumula flags quantity/price/discount/tax cuando cambian individualmente", () => {
    const before = makeLine({ quantity: 1, unitPrice: 100, discountAmount: 0, taxAmount: 21 });
    const r = detectManualEdit(before, {
      quantity:       2,
      unitPrice:      150,
      discountAmount: 10,
      taxAmount:      30,
    });
    expect(r.flagDeltas).toEqual({ quantity: true, price: true, discount: true, tax: true });
  });

  it("NO marca flag cuando el valor no cambia (idempotencia)", () => {
    const before = makeLine({ quantity: 1, unitPrice: 100 });
    const r = detectManualEdit(before, { quantity: 1, unitPrice: 100 });
    expect(r.flagDeltas).toEqual({});
  });
});

// ─── applyTransientManualPrice ─────────────────────────────────────────────

describe("applyTransientManualPrice", () => {
  it("setea pricingMeta con priceSource=MANUAL_OVERRIDE + manualOverride=true", () => {
    const merged = makeLine({ unitPrice: 200, quantity: 2 });
    const out = applyTransientManualPrice(merged);
    expect(out.pricingMeta?.priceSource).toBe("MANUAL_OVERRIDE");
    expect((out.pricingMeta as any)?.manualOverride).toBe(true);
    expect(out.pricingMeta?.partial).toBe(false);
  });

  it("invalida unitTotalWithTax (queda null)", () => {
    const merged = makeLine({
      pricingMeta: { unitTotalWithTax: 121 } as any,
    });
    const out = applyTransientManualPrice(merged);
    expect(out.pricingMeta?.unitTotalWithTax).toBeNull();
  });

  it("fuerza discountAmount=0 (replica regla del motor: manualPrice ignora descuentos)", () => {
    const merged = makeLine({ unitPrice: 200, discountAmount: 30 });
    const out = applyTransientManualPrice(merged);
    expect(out.discountAmount).toBe(0);
  });

  it("recalcula subtotal/taxAmount/lineTotal usando rate del taxBreakdown", () => {
    const merged = makeLine({
      unitPrice: 200,
      quantity:  3,
      pricingMeta: { taxBreakdown: [{ rate: 21 }] } as any,
    });
    const out = applyTransientManualPrice(merged);
    // net = 200 × 3 = 600; tax = 21% = 126; total = 726
    expect(out.subtotal).toBe(600);
    expect(out.taxAmount).toBe(126);
    expect(out.lineTotal).toBe(726);
  });

  it("suma rates múltiples del taxBreakdown (IVA + percepciones)", () => {
    const merged = makeLine({
      unitPrice: 100, quantity: 1,
      pricingMeta: { taxBreakdown: [{ rate: 21 }, { rate: 3 }] } as any,
    });
    const out = applyTransientManualPrice(merged);
    // net = 100; tax = 24%; total = 124
    expect(out.taxAmount).toBe(24);
    expect(out.lineTotal).toBe(124);
  });

  it("cae a taxAmount absoluto cuando no hay rate en taxBreakdown", () => {
    const merged = makeLine({
      unitPrice: 200, quantity: 2,
      taxAmount: 50,
      pricingMeta: { taxBreakdown: [] } as any,
    });
    const out = applyTransientManualPrice(merged);
    // net = 400; sin rate → usa taxAmount absoluto = 50; total = 450
    expect(out.subtotal).toBe(400);
    expect(out.lineTotal).toBe(450);
  });

  it("asume IVA 0 cuando ni rate ni taxAmount son finitos", () => {
    const merged = makeLine({
      unitPrice: 100, quantity: 1, taxAmount: NaN as any,
    });
    const out = applyTransientManualPrice(merged);
    expect(out.subtotal).toBe(100);
    expect(out.lineTotal).toBe(100);
  });
});

// ─── applyManualTaxRate ────────────────────────────────────────────────────

describe("applyManualTaxRate", () => {
  it("no-op cuando line no es MANUAL", () => {
    const line = makeLine({ subtotal: 100, manualTaxRate: 21 } as any);
    const out = applyManualTaxRate(line, {});
    expect(out).toBe(line); // misma referencia
  });

  it("no-op cuando MANUAL sin manualTaxRate", () => {
    const line = makeLine({ isManual: true, subtotal: 100 } as any);
    const out = applyManualTaxRate(line, {});
    expect(out).toBe(line);
  });

  it("no-op cuando el patch trae taxAmount explícito (override)", () => {
    const line = makeLine({ isManual: true, subtotal: 100, manualTaxRate: 21 } as any);
    const out = applyManualTaxRate(line, { taxAmount: 99 });
    expect(out).toBe(line);
  });

  it("recalcula taxAmount + lineTotal cuando MANUAL + rate > 0", () => {
    const line = makeLine({
      isManual: true, subtotal: 1000, manualTaxRate: 21,
    } as any);
    const out = applyManualTaxRate(line, {});
    expect(out.taxAmount).toBe(210);
    expect(out.lineTotal).toBe(1210);
  });
});

// ─── buildPatchedLine (orchestrator) ───────────────────────────────────────

describe("buildPatchedLine", () => {
  it("merge crudo + recalcula totales cuando no hay flags", () => {
    const line = makeLine({ quantity: 1, unitPrice: 100 });
    const out  = buildPatchedLine({
      line, patch: { quantity: 2 },
      isManualPriceEdit: false, flagDeltas: {},
    });
    expect(out.quantity).toBe(2);
    // calcLineTotalsFromSnapshot reconstruye subtotal/lineTotal del shape
    expect(out.subtotal).toBeGreaterThan(0);
  });

  it("aplica applyTransientManualPrice cuando isManualPriceEdit=true", () => {
    const line = makeLine({
      quantity: 1, unitPrice: 100,
      pricingMeta: { taxBreakdown: [{ rate: 21 }] } as any,
    });
    const out = buildPatchedLine({
      line, patch: { unitPrice: 200 },
      isManualPriceEdit: true, flagDeltas: { price: true },
    });
    expect(out.pricingMeta?.priceSource).toBe("MANUAL_OVERRIDE");
    expect(out.discountAmount).toBe(0);
    expect(out.taxAmount).toBe(42); // 200 × 21%
  });

  it("acumula flagDeltas con manualOverrides previos (no pisa)", () => {
    const line = makeLine({
      manualOverrides: { quantity: true } as any,
    });
    const out = buildPatchedLine({
      line, patch: { unitPrice: 200 },
      isManualPriceEdit: false, flagDeltas: { price: true },
    });
    expect(out.manualOverrides).toEqual({ quantity: true, price: true });
  });

  it("NO toca manualOverrides cuando flagDeltas está vacío", () => {
    const line = makeLine({ manualOverrides: { quantity: true } as any });
    const out = buildPatchedLine({
      line, patch: { discountAmount: 10 },
      isManualPriceEdit: false, flagDeltas: {},
    });
    expect(out.manualOverrides).toEqual({ quantity: true });
  });
});
