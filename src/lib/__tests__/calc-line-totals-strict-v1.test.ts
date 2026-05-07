// src/lib/__tests__/calc-line-totals-strict-v1.test.ts
// =============================================================================
// FASE 1.2 paso 5 — verifica el comportamiento de calcLineTotalsFromSnapshot
// detrás del feature flag tptech_pricing_strict_v1.
//
// Política:
//   · Flag OFF (default): legacy idéntico — 3 ramas, optimismo permitido.
//   · Flag ON:
//       - Backend hidratado: passthrough (sin cambios).
//       - Cualquier otra rama: pending=true + subtotal/lineTotal=NaN
//         (fmtMoney mapea NaN → "—" sin tocar consumers; comparaciones
//         fallan safe → bloquean confirmación).
//
// Cubre Priority 9 (calcLineTotalsFromSnapshot — rama optimista a migrar).
//
// Pantalla afectada:
//   · VentasFacturas.tsx (5 call-sites: 2943, 3412, 3452, 3462, 3665).
//     Bajo ON, líneas recién agregadas/editadas muestran "—" hasta que
//     preview backend responde (UX hit ≤350ms aceptado).
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { calcLineTotalsFromSnapshot, fmtMoney } from "../document-helpers";
import {
  setFeatureFlag,
  resetAllFeatureFlags,
  FEATURE_FLAGS,
} from "../featureFlags";

beforeEach(() => { resetAllFeatureFlags(); });
afterEach(()  => { resetAllFeatureFlags(); });

// =============================================================================
// 1. Backend hidratado — passthrough bajo AMBOS flags
// =============================================================================

describe("calcLineTotalsFromSnapshot — backend hidratado (rama 1)", () => {
  it("baseline correct: flag OFF respeta lineTotal del backend", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       2,
      unitPrice:      100,
      discountAmount: 0,
      taxAmount:      21,
      lineTotal:      242,
      subtotal:       200,
      pricingMeta:    { partial: false },
    } as any);
    expect(r.lineTotal).toBe(242);
    expect(r.pending).toBe(false);
  });

  it("baseline correct: flag ON respeta lineTotal del backend (sin cambios)", () => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const r = calcLineTotalsFromSnapshot({
      quantity:       2,
      unitPrice:      100,
      discountAmount: 0,
      taxAmount:      21,
      lineTotal:      242,
      subtotal:       200,
      pricingMeta:    { partial: false },
    } as any);
    expect(r.lineTotal).toBe(242);
    expect(r.subtotal).toBe(200);
    expect(r.pending).toBe(false);
  });
});

// =============================================================================
// 2. Flag OFF — comportamiento legacy preservado (rama optimista activa)
// =============================================================================

describe("calcLineTotalsFromSnapshot — flag OFF legacy", () => {
  it("baseline correct: cálculo optimista qty × unitPrice", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       2,
      unitPrice:      100,
      discountAmount: 50,
      taxAmount:      31.5,
    } as any);
    expect(r.subtotal).toBe(150);
    expect(r.lineTotal).toBe(181.5);
    expect(r.pending).toBe(false);
  });

  it("baseline correct: rama unitTotalWithTax sigue activa", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       3,
      unitPrice:      100,
      discountAmount: 0,
      taxAmount:      21,
      pricingMeta:    { partial: true, unitTotalWithTax: 121 },
    } as any);
    expect(r.lineTotal).toBe(363);  // 3 × 121
    expect(r.subtotal).toBe(300);
    expect(r.pending).toBe(false);
  });
});

// =============================================================================
// 3. Flag ON — pending state explícito (rama optimista eliminada)
// =============================================================================

describe("calcLineTotalsFromSnapshot — flag ON (strict v1 pending)", () => {
  beforeEach(() => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
  });

  it("baseline correct: rama optimista (sin pricingMeta) → pending + NaN", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       2,
      unitPrice:      100,
      discountAmount: 50,
      taxAmount:      31.5,
    } as any);
    expect(r.pending).toBe(true);
    expect(Number.isNaN(r.subtotal)).toBe(true);
    expect(Number.isNaN(r.lineTotal)).toBe(true);
  });

  it("baseline correct: rama unitTotalWithTax tampoco calcula → pending", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       3,
      unitPrice:      100,
      discountAmount: 0,
      taxAmount:      21,
      pricingMeta:    { partial: true, unitTotalWithTax: 121 },
    } as any);
    expect(r.pending).toBe(true);
    expect(Number.isNaN(r.lineTotal)).toBe(true);
    // NO se devuelve 363 ni nada cercano — pending puro.
  });

  it("baseline correct: pricingMeta.partial=true (no hidratado) → pending", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       2,
      unitPrice:      100,
      discountAmount: 0,
      taxAmount:      21,
      lineTotal:      999, // viene un valor stale, NO se respeta porque partial=true
      pricingMeta:    { partial: true },
    } as any);
    expect(r.pending).toBe(true);
    expect(Number.isNaN(r.lineTotal)).toBe(true);
  });

  it("baseline correct: NaN se renderiza como '—' via fmtMoney (sin tocar consumers)", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       2,
      unitPrice:      100,
      discountAmount: 0,
    } as any);
    expect(fmtMoney(r.lineTotal)).toBe("—");
    expect(fmtMoney(r.subtotal)).toBe("—");
    expect(fmtMoney(r.lineTotal, "ARS")).toBe("—");
  });

  it("baseline correct: comparaciones con NaN bloquean confirmación", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:  1,
      unitPrice: 1000,
      discountAmount: 0,
    } as any);
    // NaN > 0 → false. Botón "Cobrar" gateado por `total > 0` queda disabled.
    expect(r.lineTotal > 0).toBe(false);
    expect(r.lineTotal === 0).toBe(false);
    expect(r.lineTotal === r.lineTotal).toBe(false); // NaN !== NaN
  });

  it("baseline correct: aritmética con NaN propaga (suma de líneas = NaN)", () => {
    const r1 = calcLineTotalsFromSnapshot({
      quantity: 1, unitPrice: 100, discountAmount: 0,
    } as any);
    const r2 = calcLineTotalsFromSnapshot({
      quantity: 2, unitPrice: 50, discountAmount: 0,
    } as any);
    // El total agregado del documento queda NaN → fmtMoney → "—".
    const docTotal = r1.lineTotal + r2.lineTotal;
    expect(Number.isNaN(docTotal)).toBe(true);
    expect(fmtMoney(docTotal)).toBe("—");
  });

  it("baseline correct: edge cases (qty=0, unitPrice=NaN) → pending igual", () => {
    const r = calcLineTotalsFromSnapshot({
      quantity:       NaN,
      unitPrice:      Infinity,
      discountAmount: 0,
    } as any);
    expect(r.pending).toBe(true);
    expect(Number.isNaN(r.lineTotal)).toBe(true);
  });
});

// =============================================================================
// 4. Equivalencia OFF/ON cuando línea YA viene hidratada (paridad)
// =============================================================================

describe("calcLineTotalsFromSnapshot — paridad OFF/ON con backend hidratado", () => {
  it("baseline correct: backend hidratado devuelve mismo resultado en ambos flags", () => {
    const input = {
      quantity:       2,
      unitPrice:      900,
      discountAmount: 0,
      taxAmount:      378,
      lineTotal:      2178,
      subtotal:       1800,
      pricingMeta:    { partial: false },
    } as any;

    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    const off = calcLineTotalsFromSnapshot(input);
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const on  = calcLineTotalsFromSnapshot(input);

    expect(on.lineTotal).toBe(off.lineTotal);
    expect(on.subtotal).toBe(off.subtotal);
    expect(on.pending).toBe(off.pending);
    expect(on.pending).toBe(false);
  });
});

// =============================================================================
// 5. Visual proxy — los casos del playbook que aplican a Factura editing
// =============================================================================

describe("F1.2 paso 5 — proxy visual del flujo de edición de factura", () => {
  function runBoth(input: any) {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    const off = calcLineTotalsFromSnapshot(input);
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const on  = calcLineTotalsFromSnapshot(input);
    return { off, on };
  }

  it("Caso 1 — Producto simple agregado al carrito (pre-preview)", () => {
    const { off, on } = runBoth({
      quantity:  1,
      unitPrice: 1000,
      discountAmount: 0,
    });
    // OFF: optimista 1000. ON: pending NaN (fmtMoney → "—").
    expect(off.lineTotal).toBe(1000);
    expect(on.pending).toBe(true);
    expect(fmtMoney(on.lineTotal)).toBe("—");
  });

  it("Caso 2 — Edita qty antes del preview", () => {
    // Operador cambió qty de 1 a 5; preview no respondió aún.
    const { off, on } = runBoth({
      quantity:  5,
      unitPrice: 1000,
      discountAmount: 0,
      pricingMeta: { partial: true, unitTotalWithTax: 1210 },
    });
    // OFF: optimista 5 × 1210 = 6050.
    // ON:  pending — el operador ve "—" hasta que preview responda (≤350ms).
    expect(off.lineTotal).toBe(6050);
    expect(on.pending).toBe(true);
  });

  it("Caso 3 — Línea YA hidratada por preview (post-debounce)", () => {
    const { off, on } = runBoth({
      quantity:       2,
      unitPrice:      900,
      discountAmount: 0,
      taxAmount:      378,
      lineTotal:      2178,
      subtotal:       1800,
      pricingMeta:    { partial: false },
    });
    // Ambos respetan el backend.
    expect(off.lineTotal).toBe(2178);
    expect(on.lineTotal).toBe(2178);
    expect(off.pending).toBe(false);
    expect(on.pending).toBe(false);
  });

  it("Caso 4 — Línea sin articleId (placeholder manual)", () => {
    const { off, on } = runBoth({
      quantity:       1,
      unitPrice:      0,    // placeholder
      discountAmount: 0,
      // sin pricingMeta → fallback simple
    });
    expect(off.lineTotal).toBe(0);
    // Bajo ON, una línea placeholder sin valor real también queda pending —
    // correcto, el operador debe completar y esperar el preview.
    expect(on.pending).toBe(true);
  });

  it("Caso shipping/redondeo — línea con redondeo de lista (preview hidratado)", () => {
    // Lista redondeó el total a 11.500 cuando legacy daría 11.495.
    const { off, on } = runBoth({
      quantity:       10,
      unitPrice:      950,
      discountAmount: 0,
      taxAmount:      1995,
      lineTotal:      11500,  // backend con redondeo
      subtotal:       9505,   // backend con redondeo
      pricingMeta:    { partial: false },
    });
    // Ambos respetan el redondeo del backend.
    expect(off.lineTotal).toBe(11500);
    expect(on.lineTotal).toBe(11500);
  });
});
