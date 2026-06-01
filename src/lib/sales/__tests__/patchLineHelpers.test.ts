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
  resetLineForClientChange,
  clearLineExemptionFlag,
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

  // ──────────────────────────────────────────────────────────────────────
  // Anti-regresión "manual siempre manda aunque qty cambie".
  //
  // Cambiar la cantidad cuando hay `manualOverrides.discount=true` activo
  // NO debe perder ese flag. detectManualEdit detecta `flagDeltas.quantity`
  // y buildPatchedLine acumula con el manualOverrides previo (spread). El
  // motor backend respeta el override al recibir el payload con la nueva
  // qty + manualDiscountOverride, así que promo/qty/cliente NO se
  // reactivan funcionalmente.
  // ──────────────────────────────────────────────────────────────────────
  it("ANTI-REGRESIÓN: cambiar qty preserva manualOverrides.discount existente", () => {
    // Línea con manual de bonificación activo + qty=2.
    const line = makeLine({
      quantity: 2,
      manualOverrides: { discount: true } as any,
      pricingMeta: {
        manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS" },
      } as any,
    });
    // Detectar edit de qty (escenario "qty entra en tramo de descuento").
    const det = detectManualEdit(line, { quantity: 5 });
    expect(det.flagDeltas).toEqual({ quantity: true });
    expect(det.isManualPriceEdit).toBe(false);
    expect(det.isEngineDriven).toBe(false);

    const out = buildPatchedLine({
      line, patch: { quantity: 5 },
      isManualPriceEdit: det.isManualPriceEdit,
      flagDeltas: det.flagDeltas,
    });
    // Manual de descuento NUNCA se pierde — el spread { ...prev, ...new }
    // acumula sin pisar a false.
    expect(out.manualOverrides?.discount).toBe(true);
    expect(out.manualOverrides?.quantity).toBe(true);
    // manualDiscount en meta se preserva (no se sobrescribe).
    expect(out.pricingMeta?.manualDiscount).toEqual({
      mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "BONUS",
    });
    expect(out.quantity).toBe(5);
  });

  it("ANTI-REGRESIÓN: múltiples cambios de qty mantienen manualOverrides.discount intacto", () => {
    // Simula qty=2 → 5 → 10 → 3. El flag manual debe persistir en cada paso.
    let line = makeLine({
      quantity: 2,
      manualOverrides: { discount: true } as any,
      pricingMeta: {
        manualDiscount: { mode: "PERCENT", value: 20, appliesTo: "TOTAL", kind: "BONUS" },
      } as any,
    });
    for (const nextQty of [5, 10, 3]) {
      const det = detectManualEdit(line, { quantity: nextQty });
      line = buildPatchedLine({
        line, patch: { quantity: nextQty },
        isManualPriceEdit: det.isManualPriceEdit,
        flagDeltas: det.flagDeltas,
      });
      expect(line.manualOverrides?.discount).toBe(true);
      expect((line.pricingMeta as any)?.manualDiscount?.value).toBe(20);
      expect(line.quantity).toBe(nextQty);
    }
  });

  it("ANTI-REGRESIÓN: manual 0 (md.value=0) también preserva flag al cambiar qty", () => {
    // Con la nueva semántica global "X = manual 0", el operador tiene
    // un override con value=0 explícito. Cambiar qty NO debe restaurar
    // automáticos: el flag y el meta se mantienen.
    const line = makeLine({
      quantity: 2,
      manualOverrides: { discount: true } as any,
      pricingMeta: {
        manualDiscount: { mode: "PERCENT", value: 0, appliesTo: "TOTAL", kind: "BONUS" },
      } as any,
    });
    const det = detectManualEdit(line, { quantity: 10 });
    const out = buildPatchedLine({
      line, patch: { quantity: 10 },
      isManualPriceEdit: det.isManualPriceEdit,
      flagDeltas: det.flagDeltas,
    });
    expect(out.manualOverrides?.discount).toBe(true);
    expect((out.pricingMeta as any)?.manualDiscount?.value).toBe(0);
  });
});

// ─── resetLineForClientChange ──────────────────────────────────────────────

describe("resetLineForClientChange", () => {
  it("resetea impuesto (override + taxAmount + breakdown + exención + total c/imp.)", () => {
    const line = makeLine({
      taxAmount: 21,
      lineTotal: 100,
      lineTotalWithTax: 121,
      manualOverrides: { price: true, discount: true, tax: true } as any,
      pricingMeta: {
        taxOverride: { mode: "PERCENT", value: 21, appliesTo: "TOTAL" },
        manualTaxAppliesTo: "METAL",
        taxExemptByEntity: false,
        taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 21 }],
      } as any,
    });
    const out = resetLineForClientChange(line);
    expect(out.manualOverrides?.tax).toBeUndefined();
    expect(out.pricingMeta?.taxOverride ?? null).toBeNull();
    expect((out.pricingMeta as any)?.manualTaxAppliesTo ?? null).toBeNull();
    expect(out.pricingMeta?.taxBreakdown).toEqual([]);
    expect(out.pricingMeta?.taxExemptByEntity).toBeUndefined();
    expect(out.taxAmount).toBe(0);
    expect(out.lineTotalWithTax).toBe(100);
    // Precio/bonificación manual NO se tocan.
    expect(out.manualOverrides?.price).toBe(true);
    expect(out.manualOverrides?.discount).toBe(true);
    expect(line.taxAmount).toBe(21); // no muta el original
    expect(out).not.toBe(line);
  });

  it("resetea bonificación HEREDADA (inheritedDiscount + appliesTo + discountAmount)", () => {
    // Estado que dejó el cliente A (13% heredado) hidratado en la línea.
    const lineFromClientA = makeLine({
      discountAmount: 13,
      pricingMeta: {
        inheritedDiscount: {
          ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13,
          applyOn: "TOTAL", origin: "CLIENT",
        },
        inheritedDiscountAppliesTo: "TOTAL",
      } as any,
    });
    // Recalcular al cliente B (sin descuento) → SIN rastro del 13%/"Cliente":
    // ni badge ni "−US$ 0.01". El preview de B lo re-hidrata a 0 autoritativo.
    const out = resetLineForClientChange(lineFromClientA);
    expect(out.discountAmount).toBe(0);
    expect((out.pricingMeta as any)?.inheritedDiscount ?? null).toBeNull();
    expect((out.pricingMeta as any)?.inheritedDiscountAppliesTo ?? null).toBeNull();
  });

  it("escenario A(13%) → B(0) Recalcular: no queda 'Cliente −US$ 0.01' pegado", () => {
    const lineFromClientA = makeLine({
      discountAmount: 0.01, // residual stale del cliente anterior
      pricingMeta: {
        inheritedDiscount: { ruleType: "DISCOUNT", valueType: "PERCENTAGE", value: 13, applyOn: "TOTAL", origin: "CLIENT" },
        inheritedDiscountAppliesTo: "TOTAL",
      } as any,
    });
    const out = resetLineForClientChange(lineFromClientA);
    expect(out.discountAmount).toBe(0);
    expect((out.pricingMeta as any)?.inheritedDiscount ?? null).toBeNull();
  });

  it("preserva manualPrice / manualDiscount / unitPrice / lineTotal", () => {
    const line = makeLine({
      taxAmount: 50,
      unitPrice: 200,
      lineTotal: 200,
      manualOverrides: { tax: true, price: true } as any,
      pricingMeta: {
        taxOverride: { mode: "AMOUNT", value: 50 },
        manualPrice: 999,
        manualDiscount: { mode: "PERCENT", value: 5 },
      } as any,
    });
    const out = resetLineForClientChange(line);
    expect(out.pricingMeta?.taxOverride ?? null).toBeNull();
    expect(out.pricingMeta?.manualPrice).toBe(999);
    expect(out.pricingMeta?.manualDiscount).toEqual({ mode: "PERCENT", value: 5 });
    expect(out.unitPrice).toBe(200);
    expect(out.lineTotal).toBe(200);
  });

  it("no-op (misma referencia) cuando no hay NADA reseteable", () => {
    const line = makeLine({
      taxAmount: 0,
      discountAmount: 0,
      manualOverrides: { price: true } as any,
      pricingMeta: { manualPrice: 100 } as any,
    });
    expect(resetLineForClientChange(line)).toBe(line);
  });

  // ────────────────────────────────────────────────────────────────────────
  // clearManualOverrides: true → "Recalcular precios" debe limpiar TAMBIÉN
  // los overrides MANUALES del operador (decisión del cliente nuevo manda).
  // ────────────────────────────────────────────────────────────────────────

  it("clearManualOverrides=true: limpia manualDiscount + flag discount", () => {
    const line = makeLine({
      taxAmount: 0,
      discountAmount: 100,
      manualOverrides: { discount: true } as any,
      pricingMeta: {
        manualDiscount: { mode: "PERCENT", value: 15, appliesTo: "TOTAL", kind: "SURCHARGE" },
      } as any,
    });
    const out = resetLineForClientChange(line, { clearManualOverrides: true });
    expect((out.pricingMeta as any).manualDiscount).toBeNull();
    expect(out.manualOverrides?.discount).toBeUndefined();
    expect(out.discountAmount).toBe(0);
  });

  it("clearManualOverrides=true: limpia manualPrice + flag price + restaura unitPrice desde basePrice", () => {
    const line = makeLine({
      unitPrice: 80,
      manualOverrides: { price: true } as any,
      pricingMeta: { manualPrice: 80, basePrice: 100 } as any,
    });
    const out = resetLineForClientChange(line, { clearManualOverrides: true });
    expect((out.pricingMeta as any).manualPrice).toBeNull();
    expect(out.manualOverrides?.price).toBeUndefined();
    expect(out.unitPrice).toBe(100); // vuelve al basePrice de lista
  });

  it("clearManualOverrides=true: limpia manualDiscountAppliesTo independiente del valor", () => {
    const line = makeLine({
      pricingMeta: { manualDiscountAppliesTo: "METAL" } as any,
    });
    const out = resetLineForClientChange(line, { clearManualOverrides: true });
    expect((out.pricingMeta as any).manualDiscountAppliesTo).toBeNull();
  });

  it("clearManualOverrides=true: la limpieza es AMPLIA — también borra estado heredado (igual que sin flag)", () => {
    const line = makeLine({
      taxAmount: 42,
      discountAmount: 10,
      manualOverrides: { discount: true, tax: true } as any,
      pricingMeta: {
        manualDiscount: { mode: "PERCENT", value: 5, appliesTo: "TOTAL", kind: "BONUS" },
        taxOverride: { mode: "PERCENT", value: 21, appliesTo: "TOTAL" },
        inheritedDiscount: { ruleType: "DISCOUNT", value: 10, applyOn: "TOTAL", origin: "CLIENT" },
        taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 42 }],
      } as any,
    });
    const out = resetLineForClientChange(line, { clearManualOverrides: true });
    // Manual + heredado, todo limpio.
    expect((out.pricingMeta as any).manualDiscount).toBeNull();
    expect((out.pricingMeta as any).taxOverride).toBeNull();
    expect((out.pricingMeta as any).inheritedDiscount).toBeNull();
    expect(out.manualOverrides?.discount).toBeUndefined();
    expect(out.manualOverrides?.tax).toBeUndefined();
    expect(out.taxAmount).toBe(0);
    expect(out.discountAmount).toBe(0);
  });

  it("clearManualOverrides=false (default): preserva manualDiscount/manualPrice (back-compat)", () => {
    const line = makeLine({
      taxAmount: 42,
      discountAmount: 0,
      manualOverrides: { discount: true, tax: true, price: true } as any,
      pricingMeta: {
        manualDiscount: { mode: "PERCENT", value: 5, appliesTo: "TOTAL", kind: "BONUS" },
        manualPrice: 80,
        taxOverride: { mode: "PERCENT", value: 21, appliesTo: "TOTAL" },
        taxBreakdown: [{ name: "IVA", rate: 21, taxAmount: 42 }],
      } as any,
    });
    const out = resetLineForClientChange(line); // sin opciones → default
    // Manual preservado (contrato histórico).
    expect((out.pricingMeta as any).manualDiscount).not.toBeNull();
    expect((out.pricingMeta as any).manualPrice).toBe(80);
    expect(out.manualOverrides?.discount).toBe(true);
    expect(out.manualOverrides?.price).toBe(true);
    // Pero tax / heredado SÍ se limpiaron.
    expect((out.pricingMeta as any).taxOverride).toBeNull();
    expect(out.manualOverrides?.tax).toBeUndefined();
    expect(out.taxAmount).toBe(0);
  });

  it("clearManualOverrides=true: sin basePrice válido NO toca unitPrice (deja que el preview lo hidrate)", () => {
    const line = makeLine({
      unitPrice: 50,
      manualOverrides: { price: true } as any,
      pricingMeta: { manualPrice: 50 } as any, // sin basePrice
    });
    const out = resetLineForClientChange(line, { clearManualOverrides: true });
    expect((out.pricingMeta as any).manualPrice).toBeNull();
    // unitPrice se mantiene como estaba (50) — el preview vuelve a hidratar.
    expect(out.unitPrice).toBe(50);
  });

  it("clearManualOverrides=true: no-op cuando ya no hay nada que limpiar (incluso con flag activo)", () => {
    const line = makeLine({
      taxAmount: 0,
      discountAmount: 0,
      manualOverrides: {} as any,
      pricingMeta: {} as any,
    });
    expect(resetLineForClientChange(line, { clearManualOverrides: true })).toBe(line);
  });
});

// ─── clearLineExemptionFlag (P1 #3 — Etapa E2) ──────────────────────────────

describe("clearLineExemptionFlag — Mantener precios al cambiar cliente", () => {
  // REPRODUCTOR DEL BUG:
  // Operador tiene factura con cliente exento (`taxExemptByEntity=true`,
  // taxAmount=0). Cambia a cliente NO exento y elige "Mantener precios".
  // Sin este fix, las líneas seguían con flag exento pegado mientras el
  // header mostraba cliente nuevo → inconsistencia visual + riesgo de
  // confirmar factura sin IVA cuando el cliente nuevo sí debe tributar.
  it("limpia taxExemptByEntity cuando estaba en true", () => {
    const line = makeLine({
      taxAmount: 0,
      pricingMeta: {
        taxExemptByEntity: true,
        taxBreakdown: [],
      } as any,
    });
    const out = clearLineExemptionFlag(line);
    expect(out.pricingMeta?.taxExemptByEntity).toBeUndefined();
  });

  it("preserva taxAmount, taxOverride, taxBreakdown, discountAmount y unitPrice (NO recalcula precios)", () => {
    // Esta es la garantía clave: 'Mantener precios' significa mantener
    // los importes cotizados. El helper SOLO limpia el flag fiscal.
    const line = makeLine({
      unitPrice:      100,
      discountAmount: 15,
      taxAmount:      0,                      // del cliente exento previo
      subtotal:       85,
      lineTotal:      85,
      manualOverrides: { discount: true } as any,
      pricingMeta: {
        taxExemptByEntity: true,
        taxOverride: { mode: "PERCENT", value: 21 } as any,
        taxBreakdown: [{ taxId: "iva", taxName: "IVA", rate: 21, taxAmount: 0 }] as any,
        manualDiscount: { value: 15, mode: "AMOUNT" } as any,
        inheritedDiscount: { value: 5, origin: "CLIENT" } as any,
      } as any,
    });
    const out = clearLineExemptionFlag(line);
    expect(out.pricingMeta?.taxExemptByEntity).toBeUndefined();
    // Todo lo demás se preserva tal cual:
    expect(out.unitPrice).toBe(100);
    expect(out.discountAmount).toBe(15);
    expect(out.taxAmount).toBe(0);
    expect(out.subtotal).toBe(85);
    expect(out.lineTotal).toBe(85);
    expect((out.pricingMeta as any).taxOverride).toEqual({ mode: "PERCENT", value: 21 });
    expect((out.pricingMeta as any).taxBreakdown).toEqual([{ taxId: "iva", taxName: "IVA", rate: 21, taxAmount: 0 }]);
    expect((out.pricingMeta as any).manualDiscount).toEqual({ value: 15, mode: "AMOUNT" });
    expect((out.pricingMeta as any).inheritedDiscount).toEqual({ value: 5, origin: "CLIENT" });
    expect(out.manualOverrides).toEqual({ discount: true });
  });

  it("limpia taxExemptByEntity cuando estaba en false (también lo borra: el preview lo re-hidrata)", () => {
    const line = makeLine({
      pricingMeta: { taxExemptByEntity: false } as any,
    });
    const out = clearLineExemptionFlag(line);
    expect(out.pricingMeta?.taxExemptByEntity).toBeUndefined();
  });

  it("devuelve la MISMA referencia si el flag ya estaba undefined (identidad estable)", () => {
    const line = makeLine({
      pricingMeta: { basePrice: 100 } as any,
    });
    expect(clearLineExemptionFlag(line)).toBe(line);
  });

  it("devuelve la MISMA referencia si la línea no tiene pricingMeta", () => {
    const line = makeLine({ pricingMeta: undefined });
    expect(clearLineExemptionFlag(line)).toBe(line);
  });

  it("preserva otros campos del pricingMeta (basePrice, composition, etc.)", () => {
    const line = makeLine({
      pricingMeta: {
        basePrice: 100,
        taxExemptByEntity: true,
        composition: { metals: [], hechuras: [], products: [], services: [], taxes: [] } as any,
      } as any,
    });
    const out = clearLineExemptionFlag(line);
    expect(out.pricingMeta?.basePrice).toBe(100);
    expect((out.pricingMeta as any).composition).toEqual({ metals: [], hechuras: [], products: [], services: [], taxes: [] });
    expect(out.pricingMeta?.taxExemptByEntity).toBeUndefined();
  });
});
