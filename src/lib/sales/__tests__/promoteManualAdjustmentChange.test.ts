// src/lib/sales/__tests__/promoteManualAdjustmentChange.test.ts
// ============================================================================
// Tests del helper PURO de auto-promoción `balanceModeOverride → BREAKDOWN`
// cuando el operador edita el ajuste manual en modo BREAKDOWN.
//
// Regla canónica TPTech (Etapa C/D): cierra el loop entre el modo VISUAL del
// card (BREAKDOWN cuando hay metales) y el modo FUNCIONAL del backend
// (resolución R11.4). Sin esto, el guard de previewSale/confirmSale rechaza
// el scope=BREAKDOWN con 400 cuando el tenant tiene default UNIFIED.
//
// Tests cubren:
//   1. Auto-promoción cuando scope BREAKDOWN + override null.
//   2. Auto-promoción cuando scope BREAKDOWN + override undefined.
//   3. NO promueve si override ya es "UNIFIED" explícito (operador eligió).
//   4. NO promueve si override ya es "BREAKDOWN" (no-op).
//   5. NO promueve para scope UNIFIED.
//   6. NO promueve cuando next es null (quitar ajuste).
//   7. Pasa el `next` al draft sin mutarlo.
//   8. Helper es PURO (no muta el draft de entrada).
// ============================================================================

import { describe, it, expect } from "vitest";
import { promoteManualAdjustmentChange } from "../promoteManualAdjustmentChange";
import type { SalesInvoice } from "../types";

function makeDraft(over: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id: "fv1",
    number: "FV-0001",
    date: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    client: "Juan",
    salesOrderNumber: "",
    deliveryNumber: "",
    currency: "ARS",
    fxRate: 1,
    taxPercent: 21,
    seller: "",
    warehouse: "",
    paymentTerm: "",
    referenceNumber: "",
    notes: "",
    terms: "",
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: 0,
    paidAmount: 0,
    lines: [],
    status: "DRAFT",
    balanceModeOverride: null,
    ...over,
  } as SalesInvoice;
}

describe("promoteManualAdjustmentChange — auto-promoción BREAKDOWN", () => {
  it("(1) BREAKDOWN + balanceModeOverride=null → promueve a BREAKDOWN", () => {
    const draft = makeDraft({ balanceModeOverride: null });
    const next = {
      scope:  "BREAKDOWN" as const,
      metals: [{ metalParentId: "oro-fino", metalParentName: "Oro Fino", targetGrams: 1 }],
    };
    const out = promoteManualAdjustmentChange(draft, next);
    expect(out.balanceModeOverride).toBe("BREAKDOWN");
    expect(out.manualAdjustment).toBe(next);
  });

  it("(2) BREAKDOWN + balanceModeOverride=undefined → promueve a BREAKDOWN", () => {
    const draft = makeDraft({ balanceModeOverride: undefined });
    const next = { scope: "BREAKDOWN" as const, monetaryAmount: 45 };
    const out = promoteManualAdjustmentChange(draft, next);
    expect(out.balanceModeOverride).toBe("BREAKDOWN");
  });
});

describe("promoteManualAdjustmentChange — Etapa 3A-fix: scope BREAKDOWN siempre sobreescribe", () => {
  // INVERTIDO vs versión anterior. Razón: tener `override="UNIFIED"` con
  // `manualAdjustment.scope="BREAKDOWN"` es incoherente — el motor
  // (`sales.service.ts:5122-5129`) rechaza con 400. La regla "respetar
  // UNIFIED" producía el bug del usuario. Ahora, si el operador empieza a
  // ajustar por metal, el documento OPERA en BREAKDOWN y el override se
  // alinea. Si el operador quiere volver a UNIFIED, debe quitar el ajuste
  // BREAKDOWN antes (clickear el selector mientras hay ajuste BREAKDOWN
  // queda bloqueado por el builder — defensa final en buildSalePreviewPayload).
  it("(3) BREAKDOWN + override='UNIFIED' previo → promueve a BREAKDOWN (sobreescribe)", () => {
    const draft = makeDraft({ balanceModeOverride: "UNIFIED" });
    const next = { scope: "BREAKDOWN" as const, monetaryAmount: 45 };
    const out = promoteManualAdjustmentChange(draft, next);
    expect(out.balanceModeOverride).toBe("BREAKDOWN");
  });

  it("(4) BREAKDOWN + override='BREAKDOWN' → no cambia (no-op)", () => {
    const draft = makeDraft({ balanceModeOverride: "BREAKDOWN" });
    const next = { scope: "BREAKDOWN" as const, monetaryAmount: 45 };
    const out = promoteManualAdjustmentChange(draft, next);
    expect(out.balanceModeOverride).toBe("BREAKDOWN");
  });
});

describe("promoteManualAdjustmentChange — UNIFIED no se altera", () => {
  it("(5a) UNIFIED + override=null → override sigue null (no promueve)", () => {
    const draft = makeDraft({ balanceModeOverride: null });
    const next = { scope: "UNIFIED" as const, amount: -500 };
    const out = promoteManualAdjustmentChange(draft, next);
    expect(out.balanceModeOverride).toBeNull();
  });

  it("(5b) UNIFIED + override='BREAKDOWN' → preserva (operador puede tener override anterior)", () => {
    const draft = makeDraft({ balanceModeOverride: "BREAKDOWN" });
    const next = { scope: "UNIFIED" as const, amount: -500 };
    const out = promoteManualAdjustmentChange(draft, next);
    expect(out.balanceModeOverride).toBe("BREAKDOWN");
  });

  it("(5c) UNIFIED sin scope explícito (default) + override=null → no promueve", () => {
    const draft = makeDraft({ balanceModeOverride: null });
    const next = { amount: -500 } as any; // sin scope, default UNIFIED
    const out = promoteManualAdjustmentChange(draft, next);
    expect(out.balanceModeOverride).toBeNull();
  });
});

describe("promoteManualAdjustmentChange — clear / null", () => {
  it("(6) next=null (quitar ajuste) + override=null → no promueve, manualAdjustment se limpia", () => {
    const draft = makeDraft({ balanceModeOverride: null });
    const out = promoteManualAdjustmentChange(draft, null);
    expect(out.balanceModeOverride).toBeNull();
    expect(out.manualAdjustment).toBeUndefined();
  });

  it("(6b) next=null no revierte un override BREAKDOWN existente", () => {
    const draft = makeDraft({ balanceModeOverride: "BREAKDOWN" });
    const out = promoteManualAdjustmentChange(draft, null);
    expect(out.balanceModeOverride).toBe("BREAKDOWN");
  });
});

describe("promoteManualAdjustmentChange — pureza", () => {
  it("(7) NO muta el draft de entrada (helper puro)", () => {
    const draft = makeDraft({ balanceModeOverride: null });
    const snapshot = JSON.parse(JSON.stringify(draft));
    promoteManualAdjustmentChange(draft, {
      scope: "BREAKDOWN",
      metals: [{ metalParentId: "oro-fino", metalParentName: "Oro Fino", targetGrams: 1 }],
    });
    expect(draft).toEqual(snapshot);
  });

  it("(8) devuelve un objeto NUEVO (no la misma referencia)", () => {
    const draft = makeDraft();
    const out = promoteManualAdjustmentChange(draft, null);
    expect(out).not.toBe(draft);
  });
});
