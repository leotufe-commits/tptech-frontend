// src/lib/sales/__tests__/invoiceUiPreferences.test.ts
// ============================================================================
// Tests del resolver de Configuraciones finas de UI (UX.20 — Fase 1).
//
// Cubre:
//   1. Defaults cuando el JSON persistido es null / vacío / inválido.
//   2. Sanitización defensiva de cada campo (density, stickyActions).
//   3. Combinaciones válidas.
//   4. Metadata de density options (selector UI).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  resolveInvoiceUiPreferences,
  INVOICE_DENSITY_OPTIONS,
  INVOICE_TOGGLEABLE_CARDS,
  type InvoiceUiPreferences,
} from "../invoiceUiPreferences";

describe("resolveInvoiceUiPreferences — defaults", () => {
  it.each([
    null,
    undefined,
    {} as InvoiceUiPreferences,
  ])("input %p → defaults (density NORMAL, stickyActions true)", (input) => {
    const r = resolveInvoiceUiPreferences(input as any);
    expect(r.density).toBe("NORMAL");
    expect(r.stickyActions).toBe(true);
  });
});

describe("resolveInvoiceUiPreferences — sanitización defensiva", () => {
  it("density string desconocido → default NORMAL", () => {
    const r = resolveInvoiceUiPreferences({ density: "ULTRA_TIGHT" });
    expect(r.density).toBe("NORMAL");
  });

  it("density NO string → default NORMAL", () => {
    const r = resolveInvoiceUiPreferences({ density: 42 as any });
    expect(r.density).toBe("NORMAL");
  });

  it("stickyActions NO boolean → default true", () => {
    const r = resolveInvoiceUiPreferences({ stickyActions: "yes" as any });
    expect(r.stickyActions).toBe(true);
  });

  it("stickyActions explícito false se respeta", () => {
    const r = resolveInvoiceUiPreferences({ stickyActions: false });
    expect(r.stickyActions).toBe(false);
  });
});

describe("resolveInvoiceUiPreferences — valores válidos", () => {
  it.each(["COMPACT", "NORMAL", "COMFORTABLE"] as const)(
    "density %s se respeta tal cual",
    (density) => {
      const r = resolveInvoiceUiPreferences({ density });
      expect(r.density).toBe(density);
    },
  );

  it("combinación: COMPACT + stickyActions false", () => {
    const r = resolveInvoiceUiPreferences({ density: "COMPACT", stickyActions: false });
    expect(r.density).toBe("COMPACT");
    expect(r.stickyActions).toBe(false);
  });

  it("combinación: COMFORTABLE + stickyActions true", () => {
    const r = resolveInvoiceUiPreferences({ density: "COMFORTABLE", stickyActions: true });
    expect(r.density).toBe("COMFORTABLE");
    expect(r.stickyActions).toBe(true);
  });

  it("ignora keys ajenas al schema (passthrough en backend)", () => {
    const r = resolveInvoiceUiPreferences({
      density: "NORMAL",
      futureFlag: "X",
      anotherFlag: 999,
    } as any);
    expect(r.density).toBe("NORMAL");
    expect(r.stickyActions).toBe(true);
  });
});

describe("INVOICE_DENSITY_OPTIONS — selector UI", () => {
  it("contiene los 3 valores válidos en orden", () => {
    const values = INVOICE_DENSITY_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["COMPACT", "NORMAL", "COMFORTABLE"]);
  });

  it("labels en español: Compacta / Normal / Cómoda", () => {
    const labels = INVOICE_DENSITY_OPTIONS.map((o) => o.label);
    expect(labels).toEqual(["Compacta", "Normal", "Cómoda"]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// UX.21 — Cards visibles + Totales (Fase 1)
// ────────────────────────────────────────────────────────────────────────────

describe("visibleCards — defaults y override parcial", () => {
  it("default: todos los cards toggleables en true", () => {
    const r = resolveInvoiceUiPreferences(null);
    // 10 cards toggleables, todos visibles por default.
    expect(Object.keys(r.visibleCards).length).toBe(10);
    for (const key of Object.keys(r.visibleCards)) {
      expect(r.visibleCards[key as keyof typeof r.visibleCards]).toBe(true);
    }
  });

  it("override parcial: solo las keys provistas cambian; el resto queda true", () => {
    const r = resolveInvoiceUiPreferences({
      visibleCards: { shipping: false, coupon: false },
    });
    expect(r.visibleCards.shipping).toBe(false);
    expect(r.visibleCards.coupon).toBe(false);
    expect(r.visibleCards.discount).toBe(true);  // no provisto → default
    expect(r.visibleCards.totals).toBe(true);
    expect(r.visibleCards.observations).toBe(true);
  });

  it("array → defaults (sanitización defensiva)", () => {
    const r = resolveInvoiceUiPreferences({ visibleCards: [1, 2] as any });
    expect(r.visibleCards.discount).toBe(true);
  });

  it("keys ajenas se ignoran; valores no-boolean caen al default", () => {
    const r = resolveInvoiceUiPreferences({
      visibleCards: {
        discount: false,
        shipping: "yes" as any,  // no-boolean → default true
        fakeCard: true as any,    // key ajena
      } as any,
    });
    expect(r.visibleCards.discount).toBe(false);
    expect(r.visibleCards.shipping).toBe(true);  // sanitizado
    expect((r.visibleCards as any).fakeCard).toBeUndefined();
  });

  it("header / lines NO están en visibleCards (cards obligatorios)", () => {
    const r = resolveInvoiceUiPreferences(null);
    expect((r.visibleCards as any).header).toBeUndefined();
    expect((r.visibleCards as any).lines).toBeUndefined();
  });
});

describe("totalsMode — STANDARD por default; EMPHASIZED opt-in", () => {
  it("default → STANDARD", () => {
    expect(resolveInvoiceUiPreferences(null).totalsMode).toBe("STANDARD");
  });

  it("EMPHASIZED se respeta", () => {
    expect(resolveInvoiceUiPreferences({ totalsMode: "EMPHASIZED" }).totalsMode)
      .toBe("EMPHASIZED");
  });

  it("string desconocido → STANDARD", () => {
    expect(resolveInvoiceUiPreferences({ totalsMode: "GIANT" as any }).totalsMode)
      .toBe("STANDARD");
  });
});

describe("breakdownExpanded — null = heurística por modo", () => {
  it("default → null (respeta heurística del hook useDesgloseOpen)", () => {
    expect(resolveInvoiceUiPreferences(null).breakdownExpanded).toBeNull();
  });

  it.each([true, false])("user explícito %p se respeta", (val) => {
    expect(resolveInvoiceUiPreferences({ breakdownExpanded: val }).breakdownExpanded)
      .toBe(val);
  });

  it("string → null (sanitización defensiva)", () => {
    expect(resolveInvoiceUiPreferences({ breakdownExpanded: "yes" as any }).breakdownExpanded)
      .toBeNull();
  });
});

describe("INVOICE_TOGGLEABLE_CARDS — metadata del selector", () => {
  it("contiene exactamente los 10 cards (sin header/lines)", () => {
    expect(INVOICE_TOGGLEABLE_CARDS.length).toBe(10);
    const ids = INVOICE_TOGGLEABLE_CARDS.map((c) => c.id);
    expect(ids).toContain("discount");
    expect(ids).toContain("shipping");
    expect(ids).toContain("observations");
    // OBLIGATORIOS — NO toggleables.
    expect(ids).not.toContain("header" as any);
    expect(ids).not.toContain("lines" as any);
  });

  it("cada card tiene label y description", () => {
    for (const c of INVOICE_TOGGLEABLE_CARDS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });
});
