// src/lib/sales/__tests__/buildSaleCreatePayload.test.ts
// =============================================================================
// Tests del builder de payload para `salesApi.create()`. Funcion PURA — los
// tests cubren shape, filtros (placeholders/headers/manuales sin articulo)
// y normalizacion de strings vacios a null para FKs opcionales.
// =============================================================================

import { describe, it, expect } from "vitest";
import { buildSaleCreatePayload } from "../buildSaleCreatePayload";
import type { SalesInvoice } from "../types";
import type { DocumentLine } from "../../document-types";

function makeLine(over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id:           "line-1",
    type:         "ARTICLE",
    articleId:    "art-1",
    variantId:    null,
    article:      "Anillo Oro",
    variant:      "",
    sku:          "AN-001",
    unitOfMeasure: undefined,
    quantity:        2,
    unitPrice:       100,
    discountAmount:  0,
    lineTotal:       200,
    ...over,
  } as DocumentLine;
}

function makeDraft(over: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    id:               "local-uuid-1",
    number:           "FV-0001",
    date:             "2026-05-26",
    dueDate:          "",
    clientId:         "client-cuid",
    client:           "Cliente SA",
    salesOrderNumber: "",
    deliveryNumber:   "",
    currency:         "ARS",
    fxRate:           1,
    taxPercent:       0,
    seller:           "seller-cuid",
    warehouse:        "wh-cuid",
    paymentTerm:      "",
    referenceNumber:  "",
    notes:            "Entrega martes",
    terms:            "",
    subtotal:         200,
    discountAmount:   0,
    taxAmount:        42,
    total:            242,
    paidAmount:       0,
    lines:            [makeLine()],
    status:           "DRAFT",
    priceListId:      "pl-1",
    channelId:        "ch-1",
    couponCode:       undefined,
    ...over,
  } as SalesInvoice;
}

describe("buildSaleCreatePayload", () => {
  it("mapea draft completo → CreateSalePayload con shape esperado", () => {
    const out = buildSaleCreatePayload(makeDraft());
    expect(out.hasRealLines).toBe(true);
    expect(out.payload).toMatchObject({
      clientId:    "client-cuid",
      sellerId:    "seller-cuid",
      warehouseId: "wh-cuid",
      channelId:   "ch-1",
      couponCode:  null,
      notes:       "Entrega martes",
      // Etapa C16 — la lista global del documento ahora viaja al backend.
      priceListId: "pl-1",
      lines: [
        { articleId: "art-1", variantId: null, quantity: 2, unitPrice: 100 },
      ],
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // C16 — paridad preview ↔ persist del cambio de lista global
  // ──────────────────────────────────────────────────────────────────────────

  it("C16: draft.priceListId = 'prueba2' viaja al payload (no se omite como pre-C16)", () => {
    const out = buildSaleCreatePayload(makeDraft({ priceListId: "prueba2" }));
    expect(out.payload.priceListId).toBe("prueba2");
  });

  it("C16: draft.priceListId = undefined → payload con priceListId: null (no se omite)", () => {
    const out = buildSaleCreatePayload(makeDraft({ priceListId: undefined }));
    expect(out.payload.priceListId).toBeNull();
  });

  it("C16: cambio de lista global limpia overrides por línea (`priceListIdOverride` queda null)", () => {
    const out = buildSaleCreatePayload(makeDraft({
      priceListId: "prueba2",
      lines: [
        makeLine({ id: "l1", articleId: "art-1", priceListIdOverride: null } as any),
      ],
    }));
    expect(out.payload.priceListId).toBe("prueba2");
    expect(out.payload.lines[0]!.priceListIdOverride).toBeNull();
  });

  it("C16: línea con override puntual coexiste con la lista global del doc", () => {
    const out = buildSaleCreatePayload(makeDraft({
      priceListId: "prueba2",
      lines: [
        makeLine({ id: "l1", articleId: "art-1", priceListIdOverride: "pl-otro" } as any),
      ],
    }));
    expect(out.payload.priceListId).toBe("prueba2");
    expect(out.payload.lines[0]!.priceListIdOverride).toBe("pl-otro");
  });

  it("seller/warehouse vacios → null (no string vacio)", () => {
    const out = buildSaleCreatePayload(makeDraft({ seller: "", warehouse: "   " }));
    expect(out.payload.sellerId).toBeNull();
    expect(out.payload.warehouseId).toBeNull();
  });

  it("filtra placeholders (sin articleId)", () => {
    const draft = makeDraft({
      lines: [
        makeLine({ id: "l1", articleId: "art-1" }),
        makeLine({ id: "l2", articleId: undefined, article: "" }),    // placeholder vacio
        makeLine({ id: "l3", articleId: "art-3" }),
      ],
    });
    const out = buildSaleCreatePayload(draft);
    expect(out.payload.lines).toHaveLength(2);
    expect(out.payload.lines.map((l) => l.articleId)).toEqual(["art-1", "art-3"]);
  });

  it("filtra HEADER lines (no van al backend)", () => {
    const draft = makeDraft({
      lines: [
        { ...makeLine({ id: "l1" }) },
        { id: "h1", type: "HEADER", title: "Productos", articleId: undefined } as unknown as DocumentLine,
        { ...makeLine({ id: "l2", articleId: "art-2" }) },
      ],
    });
    const out = buildSaleCreatePayload(draft);
    expect(out.payload.lines).toHaveLength(2);
    expect(out.payload.lines.every((l) => l.articleId !== undefined && l.articleId !== "")).toBe(true);
  });

  it("filtra MANUAL lines sin articleId (limitacion v1 de salesApi.create)", () => {
    const draft = makeDraft({
      lines: [
        makeLine({ id: "l1" }),
        { id: "m1", type: "MANUAL", isManual: true, manualDescription: "Servicio extra", articleId: undefined, quantity: 1, unitPrice: 500, lineTotal: 500 } as unknown as DocumentLine,
      ],
    });
    const out = buildSaleCreatePayload(draft);
    // Solo la linea con articleId pasa.
    expect(out.payload.lines).toHaveLength(1);
    expect(out.payload.lines[0]!.articleId).toBe("art-1");
  });

  it("draft sin lineas reales → hasRealLines: false", () => {
    const out = buildSaleCreatePayload(makeDraft({ lines: [] }));
    expect(out.hasRealLines).toBe(false);
    expect(out.payload.lines).toHaveLength(0);
  });

  it("clientId undefined → null en payload", () => {
    const draft = makeDraft();
    delete (draft as { clientId?: string }).clientId;
    const out = buildSaleCreatePayload(draft);
    expect(out.payload.clientId).toBeNull();
  });

  it("balanceModeOverride: pasa el valor del draft o null", () => {
    expect(buildSaleCreatePayload(makeDraft({ balanceModeOverride: "BREAKDOWN" })).payload.balanceModeOverride).toBe("BREAKDOWN");
    expect(buildSaleCreatePayload(makeDraft({ balanceModeOverride: null })).payload.balanceModeOverride).toBeNull();
    const draft = makeDraft();
    delete (draft as { balanceModeOverride?: "UNIFIED" | "BREAKDOWN" | null }).balanceModeOverride;
    expect(buildSaleCreatePayload(draft).payload.balanceModeOverride).toBeNull();
  });

  it("variantId presente → se pasa tal cual", () => {
    const out = buildSaleCreatePayload(makeDraft({
      lines: [makeLine({ variantId: "var-1" })],
    }));
    expect(out.payload.lines[0]!.variantId).toBe("var-1");
  });

  it("no emite discountPct (campo no presente en DocumentLine v1)", () => {
    const out = buildSaleCreatePayload(makeDraft());
    expect(out.payload.lines[0]!.discountPct).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Etapa 3 — Ajustes a nivel documento (paridad preview ↔ create)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Etapa 3 — ajustes a nivel documento", () => {
    it("persiste shipping.cost como shippingAmount plano", () => {
      const draft = makeDraft({
        shipping: { methodId: "manual", cost: 250, address: "", carrier: "" },
      });
      const out = buildSaleCreatePayload(draft);
      expect(out.payload.shippingAmount).toBe(250);
      // No emite el shape rico mientras DocumentShipping no tenga mode/value/weight.
      expect(out.payload.shipping).toBeUndefined();
    });

    it("shipping.cost == 0 → shippingAmount null (no se persiste)", () => {
      const draft = makeDraft({
        shipping: { methodId: "pickup", cost: 0, address: "", carrier: "" },
      });
      const out = buildSaleCreatePayload(draft);
      expect(out.payload.shippingAmount).toBeNull();
    });

    it("globalDiscount manual → emite { type, value }", () => {
      const draft = makeDraft({
        discountGlobal: { type: "PERCENT", value: 10, reason: "Cliente VIP", origin: "MANUAL" },
      });
      const out = buildSaleCreatePayload(draft);
      expect(out.payload.globalDiscount).toEqual({ type: "PERCENT", value: 10 });
    });

    it("globalDiscount con origin=CLIENT → NO se reenvía (anti doble aplicación)", () => {
      const draft = makeDraft({
        discountGlobal: { type: "PERCENT", value: 5, origin: "CLIENT" },
      });
      const out = buildSaleCreatePayload(draft);
      expect(out.payload.globalDiscount).toBeNull();
    });

    it("globalDiscount.value == 0 → NO se emite", () => {
      const draft = makeDraft({
        discountGlobal: { type: "PERCENT", value: 0, origin: "MANUAL" },
      });
      const out = buildSaleCreatePayload(draft);
      expect(out.payload.globalDiscount).toBeNull();
    });

    it("paymentMethodId + paymentInstallments vienen de opts", () => {
      const out = buildSaleCreatePayload(makeDraft(), {
        paymentMethodId:     "pm-1",
        paymentInstallments: 3,
      });
      expect(out.payload.paymentMethodId).toBe("pm-1");
      expect(out.payload.paymentInstallments).toBe(3);
    });

    it("sin paymentMethodId → installments null (no se persisten huérfanos)", () => {
      const out = buildSaleCreatePayload(makeDraft(), {
        paymentInstallments: 6,
      });
      expect(out.payload.paymentMethodId).toBeNull();
      expect(out.payload.paymentInstallments).toBeNull();
    });

    it("paymentMethodId sin installments → default 1", () => {
      const out = buildSaleCreatePayload(makeDraft(), {
        paymentMethodId: "pm-1",
      });
      expect(out.payload.paymentInstallments).toBe(1);
    });

    it("pricingMeta.gramsOverride viaja como gramsOverride por línea", () => {
      const line = {
        ...makeLine(),
        pricingMeta: {
          gramsOverride:         12.5,
          mermaPercentOverride:  3,
          metalVariantIdOverride: "mv-1",
          hechuraOverrideAmount: 250,
          costLineOverrides: [
            { costLineId: "cl-1", type: "METAL", quantityOverride: 5 },
          ],
        },
      } as unknown as DocumentLine;
      const out = buildSaleCreatePayload(makeDraft({ lines: [line] }));
      expect(out.payload.lines[0]!.gramsOverride).toBe(12.5);
      expect(out.payload.lines[0]!.mermaPercentOverride).toBe(3);
      expect(out.payload.lines[0]!.metalVariantIdOverride).toBe("mv-1");
      expect(out.payload.lines[0]!.hechuraOverrideAmount).toBe(250);
      expect(out.payload.lines[0]!.costLineOverrides).toEqual([
        { costLineId: "cl-1", type: "METAL", quantityOverride: 5 },
      ]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Etapa 4 (cierre limitación Etapa 3) — overrides comerciales per-line
  // ──────────────────────────────────────────────────────────────────────────
  describe("Etapa 4 — overrides comerciales per-line", () => {
    it("manualOverrides.price=true + pricingMeta.manualPrice → manualPriceOverride", () => {
      const line = {
        ...makeLine(),
        manualOverrides: { price: true },
        pricingMeta:     { manualPrice: 1500 },
      } as unknown as DocumentLine;
      const out = buildSaleCreatePayload(makeDraft({ lines: [line] }));
      expect(out.payload.lines[0]!.manualPriceOverride).toBe(1500);
    });

    it("manualOverrides.price=false → manualPriceOverride null (no se reenvía)", () => {
      const line = {
        ...makeLine(),
        manualOverrides: { price: false },
        pricingMeta:     { manualPrice: 1500 },  // existe pero el toggle está OFF
      } as unknown as DocumentLine;
      const out = buildSaleCreatePayload(makeDraft({ lines: [line] }));
      expect(out.payload.lines[0]!.manualPriceOverride).toBeNull();
    });

    it("manualOverrides.discount + pricingMeta.manualDiscount → manualDiscountOverride completo", () => {
      const line = {
        ...makeLine(),
        manualOverrides: { discount: true },
        pricingMeta: {
          manualDiscount: { mode: "PERCENT", value: 12, appliesTo: "HECHURA", kind: "BONUS" },
        },
      } as unknown as DocumentLine;
      const out = buildSaleCreatePayload(makeDraft({ lines: [line] }));
      expect(out.payload.lines[0]!.manualDiscountOverride).toEqual({
        mode: "PERCENT", value: 12, appliesTo: "HECHURA", kind: "BONUS",
      });
    });

    it("manualOverrides.tax + pricingMeta.taxOverride → taxOverride completo", () => {
      const line = {
        ...makeLine(),
        manualOverrides: { tax: true },
        pricingMeta: {
          taxOverride: { mode: "AMOUNT", value: 75, appliesTo: "TOTAL" },
        },
      } as unknown as DocumentLine;
      const out = buildSaleCreatePayload(makeDraft({ lines: [line] }));
      expect(out.payload.lines[0]!.taxOverride).toEqual({
        mode: "AMOUNT", value: 75, appliesTo: "TOTAL",
      });
    });

    it("manualDiscountAppliesTo + manualTaxAppliesTo persisten independientes del valor", () => {
      const line = {
        ...makeLine(),
        pricingMeta: {
          manualDiscountAppliesTo: "METAL",
          manualTaxAppliesTo:      "SUBTOTAL_AFTER_DISCOUNT",
        },
      } as unknown as DocumentLine;
      const out = buildSaleCreatePayload(makeDraft({ lines: [line] }));
      expect(out.payload.lines[0]!.manualDiscountAppliesToOverride).toBe("METAL");
      expect(out.payload.lines[0]!.manualTaxAppliesToOverride).toBe("SUBTOTAL_AFTER_DISCOUNT");
    });

    it("priceListIdOverride se emite desde DocumentLine.priceListIdOverride", () => {
      const line = {
        ...makeLine(),
        priceListIdOverride: "pl-vip",
      } as unknown as DocumentLine;
      const out = buildSaleCreatePayload(makeDraft({ lines: [line] }));
      expect(out.payload.lines[0]!.priceListIdOverride).toBe("pl-vip");
    });

    it("línea sin overrides → todos los campos null/undefined", () => {
      const out = buildSaleCreatePayload(makeDraft());
      expect(out.payload.lines[0]!.manualPriceOverride).toBeNull();
      expect(out.payload.lines[0]!.manualDiscountOverride).toBeNull();
      expect(out.payload.lines[0]!.taxOverride).toBeNull();
      expect(out.payload.lines[0]!.manualDiscountAppliesToOverride).toBeNull();
      expect(out.payload.lines[0]!.manualTaxAppliesToOverride).toBeNull();
      expect(out.payload.lines[0]!.priceListIdOverride).toBeNull();
    });
  });
});
