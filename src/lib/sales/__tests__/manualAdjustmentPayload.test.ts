// src/lib/sales/__tests__/manualAdjustmentPayload.test.ts
// ============================================================================
// Etapa A — Tests del campo `manualAdjustment` en los builders de payload de
// `sales/preview` y `sales/create|update`. El frontend NO calcula: solo manda
// la INTENCIÓN del operador (monto + reason opcional); el backend valida y
// arma el snapshot.
//
// Reglas (POLICY §R-Rounding-1 capa 17, CLAUDE.md §Etapa A):
//   · `null` o `amount=0` (o |amount| ≤ EPS) → omitir / mandar null.
//   · `amount` válido → `{ scope:"UNIFIED", amount, reason }`.
//   · Reason vacío / solo espacios → `null`.
//   · Cero matemática frontend.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildSalePreviewPayload } from "../buildSalePreviewPayload";
import { buildSaleCreatePayload }  from "../buildSaleCreatePayload";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function makeLine(o: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:           "l1",
    articleId:    "a1",
    article:      "ART-001",
    quantity:     1,
    unitPrice:    100,
    discountAmount: 0,
    taxAmount:    21,
    subtotal:     100,
    lineTotal:    121,
    ...o,
  } as DocumentLine;
}

function makeDraft(o: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id:               "fv1",
    number:           "FV-0001",
    date:             new Date().toISOString(),
    dueDate:          new Date().toISOString(),
    client:           "Juan",
    salesOrderNumber: "",
    deliveryNumber:   "",
    currency:         "ARS",
    fxRate:           1,
    taxPercent:       21,
    seller:           "",
    warehouse:        "",
    paymentTerm:      "",
    referenceNumber:  "",
    notes:            "",
    terms:            "",
    subtotal:         0,
    discountAmount:   0,
    taxAmount:        0,
    total:            0,
    paidAmount:       0,
    lines:            [makeLine()],
    status:           "DRAFT",
    ...o,
  } as SalesInvoice;
}

describe("buildSalePreviewPayload — manualAdjustment", () => {
  it("sin manualAdjustment → payload.manualAdjustment === null", () => {
    const { payload } = buildSalePreviewPayload(makeDraft());
    expect((payload as any).manualAdjustment).toBeNull();
  });

  it("manualAdjustment={amount:0} → null (sin ajuste)", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: { amount: 0 },
    }));
    expect((payload as any).manualAdjustment).toBeNull();
  });

  it("amount negativo → { scope:'UNIFIED', amount, reason:null }", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: { amount: -500 },
    }));
    expect((payload as any).manualAdjustment).toEqual({
      scope:  "UNIFIED",
      amount: -500,
      reason: null,
    });
  });

  it("amount positivo (recargo) → { scope:'UNIFIED', amount, reason:null }", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: { amount: 99.99 },
    }));
    expect((payload as any).manualAdjustment).toEqual({
      scope:  "UNIFIED",
      amount: 99.99,
      reason: null,
    });
  });

  it("reason con espacios se trimea", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: { amount: -100, reason: "  cierre comercial  " },
    }));
    expect((payload as any).manualAdjustment.reason).toBe("cierre comercial");
  });

  it("reason vacío post-trim → null", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: { amount: -100, reason: "   " },
    }));
    expect((payload as any).manualAdjustment.reason).toBeNull();
  });

  it("|amount| dentro de EPS (0.005) → null (sin ajuste)", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: { amount: 0.001 },
    }));
    expect((payload as any).manualAdjustment).toBeNull();
  });

  it("scope siempre se emite como 'UNIFIED' (Etapa A — no es configurable desde frontend)", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: { amount: -42 },
    }));
    expect((payload as any).manualAdjustment.scope).toBe("UNIFIED");
  });
});

describe("buildSaleCreatePayload — manualAdjustment", () => {
  it("sin manualAdjustment → payload.manualAdjustment === null", () => {
    const { payload } = buildSaleCreatePayload(makeDraft());
    expect(payload.manualAdjustment).toBeNull();
  });

  it("amount válido + reason → viaja como { scope:'UNIFIED', amount, reason }", () => {
    const { payload } = buildSaleCreatePayload(makeDraft({
      manualAdjustment: { amount: -250, reason: "ajuste cierre" },
    }));
    expect(payload.manualAdjustment).toEqual({
      scope:  "UNIFIED",
      amount: -250,
      reason: "ajuste cierre",
    });
  });

  it("amount=0 → null al persistir", () => {
    const { payload } = buildSaleCreatePayload(makeDraft({
      manualAdjustment: { amount: 0, reason: "no se aplica" },
    }));
    expect(payload.manualAdjustment).toBeNull();
  });
});

// =============================================================================
// Etapa C — BREAKDOWN
// =============================================================================

describe("buildSalePreviewPayload — manualAdjustment BREAKDOWN", () => {
  it("metals con targetGrams + monetaryAmount → payload completo", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: {
        scope: "BREAKDOWN",
        metals: [
          { metalParentId: "oro-fino", metalParentName: "Oro Fino", targetGrams: 1 },
        ],
        monetaryAmount: 45,
        reason: "cierre",
      },
    }));
    expect((payload as any).manualAdjustment).toEqual({
      scope: "BREAKDOWN",
      metals: [
        { metalParentId: "oro-fino", metalParentName: "Oro Fino", targetGrams: 1, reason: null },
      ],
      monetaryAmount: 45,
      reason: "cierre",
    });
  });

  it("filtra metales sin instrucción significativa", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: {
        scope: "BREAKDOWN",
        metals: [
          { metalParentId: "oro-fino", targetGrams: 1 },
          { metalParentId: "plata", deltaGrams: 0.00001 }, // ← EPS
          { metalParentId: "platino" },                    // ← sin nada
        ],
      },
    }));
    expect((payload as any).manualAdjustment.metals).toHaveLength(1);
    expect((payload as any).manualAdjustment.metals[0].metalParentId).toBe("oro-fino");
  });

  it("sin metales útiles ni monetaryAmount → null", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: {
        scope: "BREAKDOWN",
        metals: [{ metalParentId: "oro", deltaGrams: 0 }],
      },
    }));
    expect((payload as any).manualAdjustment).toBeNull();
  });

  it("monetaryAmount con EPS → null", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: { scope: "BREAKDOWN", metals: [], monetaryAmount: 0.001 },
    }));
    expect((payload as any).manualAdjustment).toBeNull();
  });

  it("solo monetaryAmount (hechura) sin metales → payload con metals=[]", () => {
    const { payload } = buildSalePreviewPayload(makeDraft({
      manualAdjustment: { scope: "BREAKDOWN", monetaryAmount: -100 },
    }));
    expect((payload as any).manualAdjustment).toEqual({
      scope: "BREAKDOWN",
      metals: [],
      monetaryAmount: -100,
      reason: null,
    });
  });
});

describe("buildSaleCreatePayload — manualAdjustment BREAKDOWN", () => {
  it("BREAKDOWN viaja en create/update con misma sanitización que preview", () => {
    const { payload } = buildSaleCreatePayload(makeDraft({
      manualAdjustment: {
        scope: "BREAKDOWN",
        metals: [{ metalParentId: "plata-925", deltaGrams: 0.06 }],
        monetaryAmount: 0,
      },
    }));
    expect(payload.manualAdjustment).toEqual({
      scope: "BREAKDOWN",
      metals: [{ metalParentId: "plata-925", deltaGrams: 0.06, reason: null }],
      reason: null,
    });
  });
});
