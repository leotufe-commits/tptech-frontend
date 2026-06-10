// src/components/ui/__tests__/resolveLineListBadge.test.ts
// ============================================================================
// Tests del helper PURO `resolveLineListBadge` — claridad de "lista aplicada
// por línea". Cubre los escenarios pedidos en la auditoría:
//   1. Línea con la MISMA lista que el documento → sin badge.
//   2. Línea con override explícito distinto → badge "Override de línea".
//   3. Línea cuya lista aplicada (motor) difiere del documento sin override →
//      badge "Lista distinta al documento".
//
// Es display-only: el helper solo compara ids ya resueltos por el backend.
// No hay matemática, ni importes, ni redondeos.
// ============================================================================

import { describe, it, expect } from "vitest";
import { resolveLineListBadge } from "../TPDocumentLineAdvancedEditor.helpers";

describe("resolveLineListBadge", () => {
  it("1) misma lista que el documento → sin badge", () => {
    const r = resolveLineListBadge({
      appliedPriceListId:    "list-unificada",
      appliedPriceListName:  "Lista de Precios Unificada",
      priceListIdOverride:   null,
      documentPriceListId:   "list-unificada",
      documentPriceListName: "Lista de Precios Unificada",
    });
    expect(r.differs).toBe(false);
    expect(r.label).toBeNull();
    expect(r.appliedName).toBe("Lista de Precios Unificada");
  });

  it("2) override explícito de línea distinto → badge 'Override de línea'", () => {
    const r = resolveLineListBadge({
      appliedPriceListId:    "list-desglosada",
      appliedPriceListName:  "Lista de Precios Desglosadaa",
      priceListIdOverride:   "list-desglosada",
      documentPriceListId:   "list-unificada",
      documentPriceListName: "Lista de Precios Unificada",
    });
    expect(r.differs).toBe(true);
    expect(r.label).toBe("Override de línea");
    expect(r.appliedName).toBe("Lista de Precios Desglosadaa");
    expect(r.documentName).toBe("Lista de Precios Unificada");
  });

  it("3) lista aplicada por el motor ≠ documento, sin override → 'Lista distinta al documento'", () => {
    const r = resolveLineListBadge({
      appliedPriceListId:    "list-desglosada",
      appliedPriceListName:  "Lista de Precios Desglosadaa",
      priceListIdOverride:   null,
      documentPriceListId:   "list-unificada",
      documentPriceListName: "Lista de Precios Unificada",
    });
    expect(r.differs).toBe(true);
    expect(r.label).toBe("Lista distinta al documento");
  });

  it("override tiene prioridad sobre la comparación de ids", () => {
    // Aunque applied == doc, si hay override explícito mostramos el badge de override.
    const r = resolveLineListBadge({
      appliedPriceListId:    "list-unificada",
      appliedPriceListName:  "Lista de Precios Unificada",
      priceListIdOverride:   "list-unificada",
      documentPriceListId:   "list-unificada",
      documentPriceListName: "Lista de Precios Unificada",
    });
    expect(r.differs).toBe(true);
    expect(r.label).toBe("Override de línea");
  });

  it("sin lista de documento → no se afirma 'distinta' salvo override", () => {
    const r = resolveLineListBadge({
      appliedPriceListId:    "list-x",
      appliedPriceListName:  "Lista X",
      priceListIdOverride:   null,
      documentPriceListId:   null,
      documentPriceListName: null,
    });
    expect(r.differs).toBe(false);
    expect(r.label).toBeNull();
    // Igual expone el nombre aplicado para mostrar "Lista aplicada: X".
    expect(r.appliedName).toBe("Lista X");
  });

  it("appliedName cae al nombre del documento cuando la línea no trae nombre", () => {
    const r = resolveLineListBadge({
      appliedPriceListId:    null,
      appliedPriceListName:  null,
      priceListIdOverride:   null,
      documentPriceListId:   "list-unificada",
      documentPriceListName: "Lista de Precios Unificada",
    });
    expect(r.differs).toBe(false);
    expect(r.appliedName).toBe("Lista de Precios Unificada");
  });
});
