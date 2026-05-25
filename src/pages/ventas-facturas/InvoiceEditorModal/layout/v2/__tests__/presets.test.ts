// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/__tests__/presets.test.ts
// ============================================================================
// Cobertura del módulo de presets de usuario (Etapa 5 — Layout Pro).
//
// Verifica:
//   · `createUserPreset` sanitiza nombre y arranca con isDefault=false.
//   · Mutators puros: add/rename/duplicate/delete/setDefault.
//   · `setDefaultPreset` mutex — solo uno activo a la vez.
//   · `normalizeUserPresets` defensivo: descarta basura, mantiene válidos,
//     fuerza el mutex isDefault.
//   · `nextPresetId` produce ids únicos.
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  PRESET_NAME_MAX_LENGTH,
  addPreset,
  createUserPreset,
  deletePreset,
  duplicatePreset,
  findDefaultPreset,
  nextPresetId,
  normalizeUserPresets,
  renamePreset,
  setDefaultPreset,
  _resetPresetIdCounterForTests,
} from "../presets";
import { DEFAULT_LAYOUT_V2 } from "../defaults";

beforeEach(() => {
  _resetPresetIdCounterForTests();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1) createUserPreset + factory
// ─────────────────────────────────────────────────────────────────────────────

describe("createUserPreset", () => {
  it("crea un preset con name trimmed e isDefault=false", () => {
    const p = createUserPreset("  Venta rápida  ", DEFAULT_LAYOUT_V2);
    expect(p.name).toBe("Venta rápida");
    expect(p.isDefault).toBe(false);
    expect(p.config).toBe(DEFAULT_LAYOUT_V2);
    expect(p.id.startsWith("up_")).toBe(true);
  });

  it("fallback 'Vista sin nombre' cuando el nombre es vacío o whitespace", () => {
    expect(createUserPreset("", DEFAULT_LAYOUT_V2).name).toBe("Vista sin nombre");
    expect(createUserPreset("   ", DEFAULT_LAYOUT_V2).name).toBe("Vista sin nombre");
  });

  it("trunca nombres muy largos al MAX_LENGTH", () => {
    const longName = "x".repeat(PRESET_NAME_MAX_LENGTH + 50);
    const p = createUserPreset(longName, DEFAULT_LAYOUT_V2);
    expect(p.name.length).toBe(PRESET_NAME_MAX_LENGTH);
  });
});

describe("nextPresetId", () => {
  it("produce ids únicos en llamadas consecutivas", () => {
    const a = nextPresetId();
    const b = nextPresetId();
    const c = nextPresetId();
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });

  it("usa prefijo 'up_'", () => {
    expect(nextPresetId().startsWith("up_")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) Mutators puros — no mutan input
// ─────────────────────────────────────────────────────────────────────────────

describe("addPreset / renamePreset / duplicatePreset / deletePreset", () => {
  it("addPreset agrega al final sin mutar", () => {
    const a = createUserPreset("A", DEFAULT_LAYOUT_V2);
    const b = createUserPreset("B", DEFAULT_LAYOUT_V2);
    const list = [a];
    const next = addPreset(list, b);
    expect(next).toHaveLength(2);
    expect(next[1].id).toBe(b.id);
    expect(list).toHaveLength(1); // no mutó
  });

  it("renamePreset por id", () => {
    const a = createUserPreset("A", DEFAULT_LAYOUT_V2);
    const next = renamePreset([a], a.id, "  Nuevo nombre  ");
    expect(next[0].name).toBe("Nuevo nombre");
  });

  it("renamePreset con id inexistente → no-op", () => {
    const a = createUserPreset("A", DEFAULT_LAYOUT_V2);
    const next = renamePreset([a], "FAKE", "X");
    expect(next).toEqual([a]);
  });

  it("duplicatePreset crea nuevo id + sufijo '(copia)'", () => {
    const a = createUserPreset("Vista A", DEFAULT_LAYOUT_V2);
    const next = duplicatePreset([a], a.id);
    expect(next).toHaveLength(2);
    expect(next[1].name).toBe("Vista A (copia)");
    expect(next[1].id).not.toBe(a.id);
    expect(next[1].isDefault).toBe(false);
  });

  it("duplicatePreset con id inexistente → devuelve copia del array sin cambios", () => {
    const a = createUserPreset("A", DEFAULT_LAYOUT_V2);
    const list = [a];
    const next = duplicatePreset(list, "FAKE");
    expect(next).toEqual([a]);
    expect(next).not.toBe(list); // pero es un array nuevo
  });

  it("deletePreset por id", () => {
    const a = createUserPreset("A", DEFAULT_LAYOUT_V2);
    const b = createUserPreset("B", DEFAULT_LAYOUT_V2);
    const next = deletePreset([a, b], a.id);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(b.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) setDefaultPreset — mutex
// ─────────────────────────────────────────────────────────────────────────────

describe("setDefaultPreset — mutex", () => {
  it("marca solo el id especificado como default; los demás quedan false", () => {
    const a = createUserPreset("A", DEFAULT_LAYOUT_V2);
    const b = createUserPreset("B", DEFAULT_LAYOUT_V2);
    const c = createUserPreset("C", DEFAULT_LAYOUT_V2);
    const next = setDefaultPreset([a, b, c], b.id);
    expect(next[0].isDefault).toBe(false);
    expect(next[1].isDefault).toBe(true);
    expect(next[2].isDefault).toBe(false);
  });

  it("setDefaultPreset(null) desactiva el default actual sin elegir otro", () => {
    const a = createUserPreset("A", DEFAULT_LAYOUT_V2);
    const list = setDefaultPreset([a], a.id);
    expect(list[0].isDefault).toBe(true);
    const next = setDefaultPreset(list, null);
    expect(next[0].isDefault).toBe(false);
    expect(findDefaultPreset(next)).toBeNull();
  });

  it("findDefaultPreset devuelve el preset marcado o null", () => {
    const a = createUserPreset("A", DEFAULT_LAYOUT_V2);
    const b = createUserPreset("B", DEFAULT_LAYOUT_V2);
    expect(findDefaultPreset([a, b])).toBeNull();
    const next = setDefaultPreset([a, b], b.id);
    expect(findDefaultPreset(next)?.id).toBe(b.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) normalizeUserPresets defensivo
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeUserPresets — defensivo", () => {
  it("input null/no-array → []", () => {
    expect(normalizeUserPresets(null)).toEqual([]);
    expect(normalizeUserPresets(undefined)).toEqual([]);
    expect(normalizeUserPresets("garbage")).toEqual([]);
    expect(normalizeUserPresets(42)).toEqual([]);
    expect(normalizeUserPresets({ not: "array" })).toEqual([]);
  });

  it("descarta entradas que no son objeto", () => {
    const out = normalizeUserPresets([
      "string",
      42,
      null,
      { id: "x", name: "Válido", isDefault: false, config: null },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Válido");
  });

  it("preserva ids cuando vienen como string no vacío", () => {
    const out = normalizeUserPresets([
      { id: "abc123", name: "A", isDefault: false, config: null },
    ]);
    expect(out[0].id).toBe("abc123");
  });

  it("genera id nuevo si el persistido es inválido", () => {
    const out = normalizeUserPresets([
      { id: 42, name: "A", isDefault: false, config: null },
    ]);
    expect(out[0].id.startsWith("up_")).toBe(true);
  });

  it("MUTEX isDefault — solo el PRIMER true sobrevive", () => {
    const out = normalizeUserPresets([
      { id: "a", name: "A", isDefault: true,  config: null },
      { id: "b", name: "B", isDefault: true,  config: null },
      { id: "c", name: "C", isDefault: true,  config: null },
    ]);
    expect(out[0].isDefault).toBe(true);
    expect(out[1].isDefault).toBe(false);
    expect(out[2].isDefault).toBe(false);
  });

  it("config inválido se reconcilia con DEFAULT_LAYOUT_V2 (no descarta preset)", () => {
    const out = normalizeUserPresets([
      { id: "a", name: "A", isDefault: false, config: { garbage: true } },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].config.version).toBe(2);
    expect(out[0].config.cards.length).toBeGreaterThan(0);
  });

  it("config válido se preserva (passa por reconcileLayoutV2)", () => {
    const validConfig = {
      version: 2,
      presetBase: "COMPACT",
      grid: { columns: 12, rowHeight: 16, gap: 12 },
      cards: [
        { id: "discount", region: "aside", x: 10, y: 5, w: 2, h: 6, sticky: true },
      ],
    };
    const out = normalizeUserPresets([
      { id: "a", name: "Custom", isDefault: false, config: validConfig },
    ]);
    expect(out).toHaveLength(1);
    const discount = out[0].config.cards.find((c) => c.id === "discount");
    expect(discount).toBeDefined();
    expect(discount!.x).toBe(10);
    expect(discount!.y).toBe(5);
    expect(discount!.w).toBe(2);
    expect(discount!.h).toBe(6);
    expect(discount!.sticky).toBe(true);
  });
});
