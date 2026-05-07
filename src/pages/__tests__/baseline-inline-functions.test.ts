// src/pages/__tests__/baseline-inline-functions.test.ts
// =============================================================================
// FASE 1.0 — PR1 baseline. Documenta las funciones INLINE no exportadas en
// las pantallas de venta y compras que serán migradas en Fase 1.2-1.4.
//
// Cubre Priority 8 (computeManualTax), Priority 10 (POS lineTotal /
// cartSubtotal / cartMargin) y Priority 11 (Compras recomputeTotals /
// computeGlobalDiscount).
//
// Estas funciones NO son testeables como unidad sin refactor — viven
// definidas dentro de los componentes. Las opciones son:
//   1. Renderear la pantalla completa y verificar via DOM (PR5 E2E lo cubre).
//   2. Extraer las funciones a un módulo (refactor — fuera del scope de PR1).
//   3. Documentar con `it.todo()` y replicar la fórmula en tests
//      auto-contenidos que sirvan como contrato observable.
//
// Acá hacemos (3) — replicamos la fórmula en el test (no en el source) y
// marcamos los todos para que la migración las extraiga al refactor.
// =============================================================================

import { describe, it, expect } from "vitest";

// =============================================================================
// 1. computeManualTax — VentasFacturas.tsx:3906 (Priority 8)
//    Fórmula INLINE: round2(subtotal * (rate / 100))
//    Migración Fase 1.3: eliminar; el motor procesará líneas manuales con
//    manualTaxRate (Gap G2 backend).
// =============================================================================

// Re-implementación auto-contenida para documentar el contrato observable.
// NO se importa del source — éste es el comportamiento que la migración
// debe preservar mientras siga existiendo la rama legacy.
function computeManualTax_legacyContract(subtotal: number, rate: number): number {
  return Math.round(subtotal * (rate / 100) * 100) / 100;
}

describe("computeManualTax (VentasFacturas inline) — contrato legacy", () => {
  it("baseline legacy: IVA 21% sobre subtotal 1000 → 210", () => {
    expect(computeManualTax_legacyContract(1000, 21)).toBe(210);
  });

  it("baseline legacy: IVA 10.5% sobre subtotal 1000 → 105", () => {
    expect(computeManualTax_legacyContract(1000, 10.5)).toBe(105);
  });

  it("baseline legacy: rate 0 devuelve 0", () => {
    expect(computeManualTax_legacyContract(1000, 0)).toBe(0);
  });

  it("baseline legacy: subtotal 0 devuelve 0", () => {
    expect(computeManualTax_legacyContract(0, 21)).toBe(0);
  });

  it("baseline legacy: redondea a 2 decimales con drift conocido", () => {
    // 333.33 × 21% = 69.9993 → round2 → 70
    expect(computeManualTax_legacyContract(333.33, 21)).toBe(70);
    // 333.34 × 21% = 70.0014 → round2 → 70
    expect(computeManualTax_legacyContract(333.34, 21)).toBe(70);
  });

  it.todo(
    "FASE 1.3 — extraer computeManualTax a lib/pricing/manual-line.ts y " +
    "reemplazar por preview backend (Gap G2). Este test debe convertirse en " +
    "un test de paridad: lo que devuelve el motor === lo que devolvía el " +
    "frontend para el mismo input."
  );
});

// =============================================================================
// 2. POS totals — Ventas.tsx:222-228, 732-744 (Priority 10)
//    lineTotal(line):    Math.round(qty * unitPrice * (1 - discountPct/100) * 100) / 100
//    cartSubtotal(lines): Σ lineTotal(l)
//    cartMargin (IIFE):   margen agregado del cart con marginPct = (revenue-cost)/revenue × 100
// =============================================================================

type CartLineLegacy = {
  quantity:    number;
  unitPrice:   number;
  discountPct: number;
};

function lineTotal_legacyContract(line: CartLineLegacy): number {
  return Math.round(line.quantity * line.unitPrice * (1 - line.discountPct / 100) * 100) / 100;
}

function cartSubtotal_legacyContract(lines: CartLineLegacy[]): number {
  return lines.reduce((s, l) => s + lineTotal_legacyContract(l), 0);
}

describe("Ventas.tsx POS — lineTotal / cartSubtotal (Priority 10) contrato legacy", () => {
  it("baseline legacy: lineTotal sin descuento = qty × unitPrice", () => {
    expect(lineTotal_legacyContract({ quantity: 3, unitPrice: 100, discountPct: 0 })).toBe(300);
  });

  it("baseline legacy: lineTotal con 10% off = qty × unitPrice × 0.9", () => {
    expect(lineTotal_legacyContract({ quantity: 2, unitPrice: 100, discountPct: 10 })).toBe(180);
  });

  it("baseline legacy: lineTotal redondea a 2 decimales", () => {
    // 3 × 33.33 × 1 = 99.99 (sin drift)
    expect(lineTotal_legacyContract({ quantity: 3, unitPrice: 33.33, discountPct: 0 })).toBe(99.99);
    // 3 × 33.333 × 1 = 99.999 → round2 → 100
    expect(lineTotal_legacyContract({ quantity: 3, unitPrice: 33.333, discountPct: 0 })).toBe(100);
  });

  it("baseline legacy: discountPct 100% devuelve 0", () => {
    expect(lineTotal_legacyContract({ quantity: 5, unitPrice: 100, discountPct: 100 })).toBe(0);
  });

  it("baseline legacy: cartSubtotal suma todas las líneas sin redondeo final", () => {
    const r = cartSubtotal_legacyContract([
      { quantity: 1, unitPrice: 100, discountPct: 0 },
      { quantity: 2, unitPrice: 50,  discountPct: 0 },
      { quantity: 3, unitPrice: 33.33, discountPct: 0 },
    ]);
    // 100 + 100 + 99.99 = 299.99 (la suma NO se redondea otra vez)
    expect(r).toBeCloseTo(299.99, 2);
  });

  it.todo(
    "FASE 1.3 — POS migrar a salesApi.preview con manualDiscountOverride per " +
    "línea. cartSubtotal y cartMargin leerán de documentTotals.subtotalAfterLineDiscounts " +
    "y documentTotals.marginAmount/marginPercent (Gap G7+G8 backend)."
  );
});

// cartMargin: IIFE inline en Ventas.tsx:732 — contrato observable:
//   revenue = Σ lineTotal(line)
//   cost    = Σ qty × unitCost (cuando unitCost está disponible)
//   margin  = revenue - cost
//   marginPct = revenue > 0 ? (margin / revenue) × 100 : 0
//   linesWithoutCost = count(lines with unitCost == null)
function cartMargin_legacyContract(
  lines: Array<CartLineLegacy & { unitCost?: number | null }>,
): { margin: number; marginPct: number; linesWithoutCost: number } {
  let revenue = 0;
  let cost = 0;
  let linesWithoutCost = 0;
  for (const l of lines) {
    revenue += lineTotal_legacyContract(l);
    if (l.unitCost == null) {
      linesWithoutCost++;
    } else {
      cost += l.quantity * l.unitCost;
    }
  }
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  return { margin, marginPct, linesWithoutCost };
}

describe("Ventas.tsx POS — cartMargin (Priority 10) contrato legacy", () => {
  it("baseline legacy: margin = revenue - cost; marginPct = margin/revenue × 100", () => {
    const r = cartMargin_legacyContract([
      { quantity: 1, unitPrice: 100, discountPct: 0, unitCost: 60 },
      { quantity: 2, unitPrice: 50,  discountPct: 0, unitCost: 30 },
    ]);
    // revenue: 100 + 100 = 200
    // cost:    60 + 60  = 120
    // margin:  80; marginPct: 40%
    expect(r.margin).toBe(80);
    expect(r.marginPct).toBe(40);
    expect(r.linesWithoutCost).toBe(0);
  });

  it("baseline legacy: línea sin unitCost incrementa linesWithoutCost y no contribuye a cost", () => {
    const r = cartMargin_legacyContract([
      { quantity: 1, unitPrice: 100, discountPct: 0, unitCost: null },
      { quantity: 1, unitPrice: 50,  discountPct: 0, unitCost: 30 },
    ]);
    // revenue: 150, cost: 30, margin: 120
    expect(r.linesWithoutCost).toBe(1);
    expect(r.margin).toBe(120);
  });

  it("baseline legacy: marginPct=0 cuando revenue=0", () => {
    const r = cartMargin_legacyContract([]);
    expect(r.marginPct).toBe(0);
    expect(r.margin).toBe(0);
  });
});

// =============================================================================
// 3. Compras recomputeTotals + computeGlobalDiscount (Priority 11)
//    Inline en ComprasFacturasProveedor.tsx:152-177 y
//    ComprasNotasCreditoProveedor.tsx:118-140.
//    Migración: bloqueada por Gap G11 (POST /api/purchases/preview).
// =============================================================================

function computeGlobalDiscount_legacyContract(
  subtotal: number,
  globalDiscount: { type: "PERCENT" | "AMOUNT"; value: number } | null,
): number {
  if (!globalDiscount || globalDiscount.value <= 0) return 0;
  if (globalDiscount.type === "PERCENT") {
    return Math.round(subtotal * (globalDiscount.value / 100) * 100) / 100;
  }
  return Math.min(subtotal, globalDiscount.value);
}

describe("Compras recomputeTotals — computeGlobalDiscount (Priority 11) contrato legacy", () => {
  it("baseline legacy: PERCENT 10% sobre 1000 → 100", () => {
    expect(
      computeGlobalDiscount_legacyContract(1000, { type: "PERCENT", value: 10 }),
    ).toBe(100);
  });

  it("baseline legacy: AMOUNT 250 sobre 1000 → 250", () => {
    expect(
      computeGlobalDiscount_legacyContract(1000, { type: "AMOUNT", value: 250 }),
    ).toBe(250);
  });

  it("baseline legacy: AMOUNT mayor que subtotal se clampea a subtotal", () => {
    expect(
      computeGlobalDiscount_legacyContract(500, { type: "AMOUNT", value: 1000 }),
    ).toBe(500);
  });

  it("baseline legacy: globalDiscount null devuelve 0", () => {
    expect(computeGlobalDiscount_legacyContract(1000, null)).toBe(0);
  });

  it("baseline legacy: value=0 devuelve 0", () => {
    expect(
      computeGlobalDiscount_legacyContract(1000, { type: "PERCENT", value: 0 }),
    ).toBe(0);
  });

  it.todo(
    "FASE 1.4 — Compras migrar a POST /api/purchases/preview (Gap G11). " +
    "Este test debe convertirse en paridad: lo que devuelve el motor de compras " +
    "vs lo que devolvía recomputeTotals/computeGlobalDiscount inline."
  );
});

// =============================================================================
// 4. recomputeTotals patrón legacy (Priority 11)
//    subtotal     = Σ qty × unitPrice
//    lineDiscount = Σ discountAmount
//    taxAmount    = Σ taxAmount
//    total        = max(0, subtotal - lineDiscount - globalDiscount) + taxAmount + shipping
// =============================================================================

function recomputeTotals_legacyContract(
  lines: Array<{ quantity: number; unitPrice: number; discountAmount?: number; taxAmount?: number }>,
  globalDiscount: { type: "PERCENT" | "AMOUNT"; value: number } | null,
  shippingCost: number,
): { subtotal: number; lineDiscount: number; taxAmount: number; globalDiscount: number; total: number } {
  let subtotal = 0;
  let lineDiscount = 0;
  let taxAmount = 0;
  for (const l of lines) {
    subtotal     += (l.quantity || 0) * (l.unitPrice || 0);
    lineDiscount += l.discountAmount || 0;
    taxAmount    += l.taxAmount ?? 0;
  }
  const globalDiscountAmount = computeGlobalDiscount_legacyContract(
    Math.max(0, subtotal - lineDiscount),
    globalDiscount,
  );
  const total = Math.max(0, subtotal - lineDiscount - globalDiscountAmount) + taxAmount + shippingCost;
  return { subtotal, lineDiscount, taxAmount, globalDiscount: globalDiscountAmount, total };
}

describe("Compras recomputeTotals (Priority 11) contrato legacy", () => {
  it("baseline legacy: agrega subtotal Σ qty × unitPrice", () => {
    const r = recomputeTotals_legacyContract(
      [
        { quantity: 2, unitPrice: 500 },
        { quantity: 1, unitPrice: 300 },
      ],
      null,
      0,
    );
    expect(r.subtotal).toBe(1300);
    expect(r.total).toBe(1300);
  });

  it("baseline legacy: lineDiscount Σ discountAmount + globalDiscount aplicado", () => {
    const r = recomputeTotals_legacyContract(
      [{ quantity: 1, unitPrice: 1000, discountAmount: 100, taxAmount: 189 }],
      { type: "PERCENT", value: 10 },
      0,
    );
    // subtotal=1000, lineDiscount=100 → base=900, globalDisc=90
    // total = (1000 - 100 - 90) + 189 + 0 = 999
    expect(r.subtotal).toBe(1000);
    expect(r.lineDiscount).toBe(100);
    expect(r.globalDiscount).toBe(90);
    expect(r.taxAmount).toBe(189);
    expect(r.total).toBe(999);
  });

  it("baseline legacy: shippingCost se suma al total", () => {
    const r = recomputeTotals_legacyContract(
      [{ quantity: 1, unitPrice: 1000 }],
      null,
      150,
    );
    expect(r.total).toBe(1150);
  });

  it("baseline legacy: total no negativo (clamp a 0)", () => {
    const r = recomputeTotals_legacyContract(
      [{ quantity: 1, unitPrice: 100 }],
      { type: "AMOUNT", value: 200 }, // se clampea a 100 dentro de computeGlobalDiscount
      0,
    );
    expect(r.total).toBe(0);
  });
});
