// src/lib/sales/__tests__/buildReceiptDraftPayload.test.ts
// ============================================================================
// Tests unitarios del helper de FASE 8.2.5c.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildReceiptDraftPayload } from "../buildReceiptDraftPayload";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";
import type { CurrencyRow } from "../../../services/valuation";

function makeLine(o: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:           "l1",
    articleId:    "art-1",
    article:      "Anillo Oro",
    sku:          "ART-001",
    quantity:     2,
    unitPrice:    500,
    discountAmount: 0,
    taxAmount:    210,
    subtotal:     1000,
    lineTotal:    1210,
    ...o,
  } as DocumentLine;
}

function makeDraft(o: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id:               "fv1",
    number:           "FV-0001",
    date:             "2026-05-11",
    dueDate:          "2026-06-10",
    client:           "Juan",
    salesOrderNumber: "",
    deliveryNumber:   "",
    currency:         "ARS",
    fxRate:           1,
    taxPercent:       21,
    seller:           "",
    warehouse:        "",
    paymentTerm:      "30 días",
    referenceNumber:  "",
    notes:            "Pago contra entrega",
    terms:            "30 días",
    subtotal:         1000,
    discountAmount:   0,
    taxAmount:        210,
    total:            1210,
    paidAmount:       0,
    lines:            [makeLine()],
    status:           "DRAFT",
    ...o,
  } as SalesInvoice;
}

const ars: CurrencyRow = {
  id: "ars-id", code: "ARS", name: "Peso argentino", symbol: "$",
  isBase: true, isActive: true, latestRate: null, latestAt: null,
} as any;
const usd: CurrencyRow = {
  id: "usd-id", code: "USD", name: "Dólar", symbol: "US$",
  isBase: false, isActive: true, latestRate: 1500, latestAt: null,
} as any;

const predicates = {
  isEmptyLine:  (l: DocumentLine) => !l.articleId && !(l.article ?? "").trim(),
  isHeaderLine: (l: DocumentLine) => l.type === "HEADER",
};

describe("buildReceiptDraftPayload", () => {
  it("retorna { ok: false, error: 'NO_REAL_LINES' } sin líneas reales", () => {
    const draft = makeDraft({ lines: [] });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("NO_REAL_LINES");
  });

  it("filtra líneas empty + header del array `lines`", () => {
    const draft = makeDraft({
      lines: [
        { id: "empty",  articleId: "", article: "" } as any,
        { id: "header", type: "HEADER" } as any,
        makeLine(),
      ],
    });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.lines.length).toBe(1);
      expect(r.payload.lines[0].articleId).toBe("art-1");
    }
  });

  it("currencyRate=1 cuando la moneda es base", () => {
    const draft = makeDraft({ currency: "ARS", fxRate: 999 });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.currencyRate).toBe(1);
      expect(r.payload.totalBase).toBe(1210);
    }
  });

  it("currencyRate=fxRate cuando la moneda NO es base", () => {
    const draft = makeDraft({ currency: "USD", fxRate: 1500 });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars, usd], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.currencyRate).toBe(1500);
      // totalBase = total × fxRate (sin doble-conteo de base)
      expect(r.payload.totalBase).toBe(round2Numb(1210 * 1500));
    }
  });

  // ─── FASE 9 — C1: defensa en profundidad contra fxRate inválido ─────────

  it("fxRate=0 (legacy draft corrupto) → fxRate fallback a 1, totalBase=total", () => {
    const draft = makeDraft({ currency: "USD", fxRate: 0 });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars, usd], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.currencyRate).toBe(1);
      expect(r.payload.totalBase).toBe(1210);
    }
  });

  it("fxRate negativo → fallback a 1, totalBase=total", () => {
    const draft = makeDraft({ currency: "USD", fxRate: -2 });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars, usd], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.currencyRate).toBe(1);
      expect(r.payload.totalBase).toBe(1210);
    }
  });

  it("fxRate=NaN → fallback a 1, totalBase=total", () => {
    const draft = makeDraft({ currency: "USD", fxRate: Number.NaN });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars, usd], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.currencyRate).toBe(1);
      expect(r.payload.totalBase).toBe(1210);
      expect(Number.isFinite(r.payload.totalBase)).toBe(true);
    }
  });

  it("manda notes y terms como campos separados (sin fusionar)", () => {
    const draft = makeDraft({ notes: "Sin manchar", terms: "30 días" });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.notes).toBe("Sin manchar");
      expect(r.payload.terms).toBe("30 días");
    }
  });

  it("notes vacío no contamina terms", () => {
    const draft = makeDraft({ notes: "", terms: "Solo términos" });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.notes).toBe("");
      expect(r.payload.terms).toBe("Solo términos");
    }
  });

  it("pricingSnapshot.version = 1 y resolvedAt es ISO", () => {
    const draft = makeDraft();
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const snap: any = r.payload.pricingSnapshot;
      expect(snap.version).toBe(1);
      expect(snap.resolvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(snap.lineCount).toBe(1);
    }
  });

  it("currencySnapshot.baseCurrencyCode fallback a ARS cuando no hay base en catálogo", () => {
    const draft = makeDraft({ currency: "USD", fxRate: 1500 });
    const r = buildReceiptDraftPayload({ draft, currencies: [usd], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.currencySnapshot.baseCurrencyCode).toBe("ARS");
    }
  });

  it("línea con itemKind explícito lo preserva", () => {
    const draft = makeDraft({
      lines: [makeLine({ itemKind: "ARTICLE_VARIANT", variantId: "v-1" })],
    });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.lines[0].itemKind).toBe("ARTICLE_VARIANT");
  });

  it("itemKind derivado: con variantId → ARTICLE_VARIANT", () => {
    const draft = makeDraft({
      lines: [makeLine({ variantId: "v-1", itemKind: undefined as any })],
    });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.lines[0].itemKind).toBe("ARTICLE_VARIANT");
  });

  it("itemKind derivado: sin variantId → ARTICLE_SIMPLE", () => {
    const draft = makeDraft({
      lines: [makeLine({ variantId: null, itemKind: undefined as any })],
    });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.lines[0].itemKind).toBe("ARTICLE_SIMPLE");
  });

  it("totalCost y totalMargin se computan cuando hay pricingMeta", () => {
    const draft = makeDraft({
      lines: [makeLine({ quantity: 2, pricingMeta: { unitCost: 100, unitMargin: 50 } as any })],
    });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.lines[0].totalCost).toBe(200);
      expect(r.payload.lines[0].totalMargin).toBe(100);
    }
  });

  it("totalCost y totalMargin = null sin pricingMeta", () => {
    const draft = makeDraft({ lines: [makeLine({ pricingMeta: undefined as any })] });
    const r = buildReceiptDraftPayload({ draft, currencies: [ars], predicates });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.lines[0].totalCost).toBeNull();
      expect(r.payload.lines[0].totalMargin).toBeNull();
    }
  });
});

// Helper local — el round2 oficial vive en `document-helpers`.
function round2Numb(n: number): number {
  return Math.round(n * 100) / 100;
}
