// src/lib/sales/__tests__/buildClientPatches.test.ts
// =============================================================================
// Contrato del modal "Cambiar cliente" a nivel puro.
//
// `buildClientPatches` parte el cambio de cliente en DOS patches disjuntos:
//   - `clientDataPatch` → identidad/snapshot/vendedor/término/vencimiento.
//     Se aplica SIEMPRE (keep y recalc). NO debe contener NINGÚN campo que
//     mueva el `previewSignature` (priceListId / currency / fxRate) →
//     garantiza que "Mantener precios actuales" NO recalcula líneas.
//   - `pricingPatch` → SOLO priceListId / currency / fxRate. Se aplica
//     únicamente en "Recalcular precios" (y recién ahí se dispara preview).
//
// Estos tests fijan la invariante de separación (la lógica de cuándo se
// aplica cada uno vive en VentasFacturas; acá fijamos QUE estén separados).
// =============================================================================

import { describe, it, expect } from "vitest";
import { buildClientPatches } from "../clientPickHelpers";
import type { ClientSnapshot } from "../types";

const snap: ClientSnapshot = {
  name: "Cliente Nuevo",
  displayName: "Cliente Nuevo",
  entityType: "COMPANY",
} as ClientSnapshot;

const PRICING_KEYS = ["priceListId", "currency", "fxRate"] as const;

describe("buildClientPatches — separación identidad vs. pricing", () => {
  it("clientDataPatch NUNCA contiene priceListId/currency/fxRate", () => {
    const { clientDataPatch } = buildClientPatches({
      clientId: "c2", clientName: "Cliente Nuevo", clientSnapshot: snap,
      sellerId: "s1", canonicalTerm: "NET_30", dueDate: "2026-06-18",
      autoPriceListId: "pl-9", autoCurrency: "USD", fxRate: 1450,
    });
    for (const k of PRICING_KEYS) {
      expect(k in clientDataPatch).toBe(false);
    }
    // Sí lleva identidad + términos.
    expect(clientDataPatch).toMatchObject({
      client: "Cliente Nuevo", clientId: "c2", seller: "s1",
      paymentTerm: "NET_30", dueDate: "2026-06-18",
    });
    expect(clientDataPatch.clientSnapshot).toBe(snap);
  });

  it("pricingPatch SOLO lleva priceListId/currency/fxRate", () => {
    const { pricingPatch } = buildClientPatches({
      clientId: "c2", clientName: "X", clientSnapshot: snap,
      sellerId: "", canonicalTerm: "", dueDate: "",
      autoPriceListId: "pl-9", autoCurrency: "USD", fxRate: 1450,
    });
    expect(pricingPatch).toEqual({
      priceListId: "pl-9", currency: "USD", fxRate: 1450,
    });
    expect(Object.keys(pricingPatch).every((k) => (PRICING_KEYS as readonly string[]).includes(k))).toBe(true);
  });

  it("pricingPatch OMITE campos ausentes (cliente sin lista/moneda/fx)", () => {
    const { pricingPatch } = buildClientPatches({
      clientId: "c2", clientName: "X", clientSnapshot: snap,
      sellerId: "", canonicalTerm: "", dueDate: "",
      autoPriceListId: null, autoCurrency: null, fxRate: undefined,
    });
    expect(pricingPatch).toEqual({});
  });

  it("aplicar SOLO clientDataPatch (rama 'Mantener') no toca lista/moneda/fx del draft", () => {
    const draft = {
      clientId: "c1", priceListId: "pl-OLD", currency: "ARS", fxRate: 1,
    };
    const { clientDataPatch } = buildClientPatches({
      clientId: "c2", clientName: "Nuevo", clientSnapshot: snap,
      sellerId: "s1", canonicalTerm: "NET_30", dueDate: "2026-06-18",
      autoPriceListId: "pl-NEW", autoCurrency: "USD", fxRate: 1450,
    });
    const kept = { ...draft, ...clientDataPatch };
    // Pricing del documento intacto → preview NO se mueve.
    expect(kept.priceListId).toBe("pl-OLD");
    expect(kept.currency).toBe("ARS");
    expect(kept.fxRate).toBe(1);
    // Identidad sí cambió.
    expect(kept.clientId).toBe("c2");
  });

  it("aplicar clientDataPatch + pricingPatch (rama 'Recalcular') rehidrata pricing", () => {
    const draft = {
      clientId: "c1", priceListId: "pl-OLD", currency: "ARS", fxRate: 1,
    };
    const { clientDataPatch, pricingPatch } = buildClientPatches({
      clientId: "c2", clientName: "Nuevo", clientSnapshot: snap,
      sellerId: "s1", canonicalTerm: "NET_30", dueDate: "2026-06-18",
      autoPriceListId: "pl-NEW", autoCurrency: "USD", fxRate: 1450,
    });
    const recalced = { ...draft, ...clientDataPatch, ...pricingPatch };
    expect(recalced.clientId).toBe("c2");
    expect(recalced.priceListId).toBe("pl-NEW");
    expect(recalced.currency).toBe("USD");
    expect(recalced.fxRate).toBe(1450);
  });
});
