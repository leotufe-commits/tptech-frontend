// src/lib/__tests__/baseline-document-helpers.test.ts
// =============================================================================
// FASE 1.0 — PR1 baseline. Congela `document-helpers.ts` (round2,
// calcLineTotalsFromSnapshot, formatters, nextDocNumber).
//
// Cubre Priority 2 (helpers de Factura Ventas) y Priority 9
// (calcLineTotalsFromSnapshot — rama optimista a migrar).
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  round2,
  calcLineTotalsFromSnapshot,
  fmtMoney,
  fmtQty,
  fmtDate,
  nextDocNumber,
  uid,
  todayISO,
} from "../document-helpers";

// =============================================================================
// 1. round2 — utilidad de redondeo a 2 decimales (legacy, se migra en Fase 1.2)
// =============================================================================

describe("round2 — utilidad de redondeo (legacy)", () => {
  it("baseline legacy: redondea a 2 decimales con Math.round(n*100)/100", () => {
    expect(round2(1234.5678)).toBe(1234.57);
    expect(round2(1234.5612)).toBe(1234.56);
    expect(round2(0.005)).toBe(0.01); // 0.005*100=0.5 → Math.round=1 → 0.01
  });

  it("baseline legacy: deja números enteros sin cambio", () => {
    expect(round2(100)).toBe(100);
    expect(round2(0)).toBe(0);
  });

  it("baseline legacy: maneja negativos con Math.round (banker's rule de JS)", () => {
    // Math.round redondea hacia +∞, no es banker's rounding. -0.5 → 0, no -1.
    expect(round2(-0.005)).toBe(-0); // Math.round(-0.5) = 0, /100 = 0 (en JS: -0)
    expect(round2(-1234.5678)).toBe(-1234.57);
  });

  it("baseline suspicious: drift conocido con Math.round vs banker's en valores .5", () => {
    // Documentamos el comportamiento real de Math.round (ties go to +∞).
    expect(round2(0.125)).toBe(0.13); // 12.5 → 13
    expect(round2(0.135)).toBe(0.14); // 13.5 → 14
    expect(round2(0.145)).toBe(0.14); // 14.5 → 15... pero 14.499... → 14
    // Este último drift es el "rounding drift" típico que la migración
    // a backend-as-source-of-truth elimina porque el motor opera en Decimal.
  });
});

// =============================================================================
// 2. calcLineTotalsFromSnapshot — 3 ramas (Priority 9)
// =============================================================================

describe("calcLineTotalsFromSnapshot — rama (1) backend hidratado", () => {
  it("baseline correct: respeta lineTotal del backend cuando partial=false", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       2,
      unitPrice:      100,
      discountAmount: 0,
      taxAmount:      21,
      lineTotal:      242,            // viene del backend con redondeo de lista
      subtotal:       200,
      pricingMeta:    { partial: false },
    } as any);
    expect(r.lineTotal).toBe(242);
    expect(r.subtotal).toBe(200);
  });

  it("baseline correct: deriva subtotal = lineTotal - taxAmount cuando subtotal no viene", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       1,
      unitPrice:      100,
      discountAmount: 0,
      taxAmount:      21,
      lineTotal:      121,
      pricingMeta:    { partial: false },
    } as any);
    expect(r.lineTotal).toBe(121);
    expect(r.subtotal).toBe(100);
  });
});

describe("calcLineTotalsFromSnapshot — rama (2) optimista con unitTotalWithTax (legacy)", () => {
  it("baseline legacy: lineTotal = qty × unitTotalWithTax cuando llega del meta", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       3,
      unitPrice:      100,
      discountAmount: 0,
      taxAmount:      21,
      pricingMeta:    { partial: true, unitTotalWithTax: 121 },
    } as any);
    // r2(3 × 121) = 363
    expect(r.lineTotal).toBe(363);
    // subtotal optimista = 3 × 100 − 0 = 300
    expect(r.subtotal).toBe(300);
  });
});

describe("calcLineTotalsFromSnapshot — rama (3) fallback simple (legacy)", () => {
  it("baseline legacy: subtotal = qty × unitPrice − disc; lineTotal = subtotal + taxAmount", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       2,
      unitPrice:      100,
      discountAmount: 50,
      taxAmount:      31.5,
      // sin pricingMeta → cae a la rama 3
    } as any);
    expect(r.subtotal).toBe(150);   // 2*100 - 50
    expect(r.lineTotal).toBe(181.5); // 150 + 31.5
  });

  it("baseline legacy: sin taxAmount, lineTotal = subtotal", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       4,
      unitPrice:      25,
      discountAmount: 0,
    } as any);
    expect(r.subtotal).toBe(100);
    expect(r.lineTotal).toBe(100);
  });

  it("baseline legacy: clampea negativos a 0 en subtotal", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       1,
      unitPrice:      100,
      discountAmount: 200, // disc > subtotal
    } as any);
    expect(r.subtotal).toBe(0);
    expect(r.lineTotal).toBe(0);
  });

  it("baseline legacy: maneja qty/price NaN o no finitos como 0", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       NaN,
      unitPrice:      Infinity,
      discountAmount: 0,
    } as any);
    expect(r.subtotal).toBe(0);
    expect(r.lineTotal).toBe(0);
  });
});

// =============================================================================
// 3. Formatters — display puro (correct)
// =============================================================================

describe("fmtMoney — formato es-AR", () => {
  it("baseline correct: formatea con 2 decimales y separador de miles", () => {
    expect(fmtMoney(1234.5)).toBe("1.234,50");
    expect(fmtMoney(0)).toBe("0,00");
  });

  it("baseline correct: prefija currency cuando se pasa", () => {
    expect(fmtMoney(1234.5, "ARS")).toBe("ARS 1.234,50");
    expect(fmtMoney(99.99, "USD")).toBe("USD 99,99");
  });

  it("baseline correct: devuelve '—' para no finitos", () => {
    expect(fmtMoney(NaN)).toBe("—");
    expect(fmtMoney(Infinity)).toBe("—");
  });
});

describe("fmtQty — cantidad sin decimales obligatorios", () => {
  it("baseline correct: enteros sin decimales", () => {
    expect(fmtQty(2)).toBe("2");
    expect(fmtQty(1000)).toBe("1.000");
  });

  it("baseline correct: hasta 3 decimales para gramos", () => {
    expect(fmtQty(5.123)).toBe("5,123");
    expect(fmtQty(5.1234)).toMatch(/^5,123/); // se trunca/redondea a 3 decimales
  });

  it("baseline correct: '—' para no finitos", () => {
    expect(fmtQty(NaN)).toBe("—");
  });
});

describe("fmtDate — yyyy-mm-dd → es-AR", () => {
  it("baseline correct: convierte ISO a formato local", () => {
    expect(fmtDate("2026-05-07")).toMatch(/^\d{1,2}\/\d{1,2}\/2026$/);
  });

  it("baseline correct: '—' para null/undefined/empty", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
    expect(fmtDate("")).toBe("—");
  });

  it("baseline correct: devuelve el string crudo si no parsea", () => {
    expect(fmtDate("no-es-fecha")).toBe("no-es-fecha");
  });
});

// =============================================================================
// 4. nextDocNumber — generador correlativo (correct)
// =============================================================================

describe("nextDocNumber — correlativos", () => {
  it("baseline correct: empieza en 0001 cuando no hay docs previos", () => {
    expect(nextDocNumber("OC", [])).toBe("OC-0001");
  });

  it("baseline correct: incrementa el máximo encontrado", () => {
    expect(
      nextDocNumber("FV", [
        { number: "FV-0003" },
        { number: "FV-0001" },
        { number: "FV-0007" },
      ]),
    ).toBe("FV-0008");
  });

  it("baseline correct: respeta el padding configurado", () => {
    expect(nextDocNumber("X", [{ number: "X-99" }], 6)).toBe("X-000100");
  });

  it("baseline correct: prefijo vacío produce solo el número", () => {
    expect(nextDocNumber("", [])).toBe("0001");
    expect(nextDocNumber("", [{ number: "0042" }])).toBe("0043");
  });

  it("baseline correct: ignora numbers no parseables", () => {
    expect(
      nextDocNumber("Z", [{ number: "abc" }, { number: "Z-0005" }]),
    ).toBe("Z-0006");
  });
});

// =============================================================================
// 5. uid + todayISO — utilidades misceláneas (correct)
// =============================================================================

describe("uid + todayISO", () => {
  it("baseline correct: uid genera strings únicos", () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
  });

  it("baseline correct: todayISO devuelve yyyy-mm-dd", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
