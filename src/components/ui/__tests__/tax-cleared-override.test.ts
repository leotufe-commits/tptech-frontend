// src/components/ui/__tests__/tax-cleared-override.test.ts
// ============================================================================
// `isTaxClearedOverride` — decide si el label de impuestos debe LIMPIARSE
// porque el operador borró/puso 0 el input (intención explícita "sin
// impuesto"). Bug: al borrar el impuesto el label seguía mostrando el
// IVA/monto anterior. Esta función es la fuente única de esa decisión:
// cuando es true el componente NO renderiza badge IVA ni "+$ monto".
// ============================================================================

import { describe, it, expect } from "vitest";
import { isTaxClearedOverride } from "../TPDocumentLineAdvancedEditor";

describe("isTaxClearedOverride", () => {
  it("sin override (impuesto automático normal) → false (no se limpia)", () => {
    expect(isTaxClearedOverride(null)).toBe(false);
    expect(isTaxClearedOverride(undefined)).toBe(false);
  });

  it("override con value 0 → true (PERCENT): borrar input limpia el label", () => {
    expect(isTaxClearedOverride({ value: 0 } as any)).toBe(true);
    expect(isTaxClearedOverride({ mode: "PERCENT", value: 0 } as any)).toBe(true);
  });

  it("override con value 0 en modo AMOUNT → true (también limpia)", () => {
    expect(isTaxClearedOverride({ mode: "AMOUNT", value: 0 } as any)).toBe(true);
  });

  it("override con value > 0 → false (impuesto manual real, NO se limpia)", () => {
    expect(isTaxClearedOverride({ value: 21 } as any)).toBe(false);
    expect(isTaxClearedOverride({ mode: "PERCENT", value: 10 } as any)).toBe(false);
    expect(isTaxClearedOverride({ mode: "AMOUNT", value: 0.01 } as any)).toBe(false);
  });

  it("value null/0 → true (vacío/borrado se trata como 'sin impuesto', "
   + "evita revivir el IVA stale); NaN/undefined → false", () => {
    // `Number(null) === 0` → un value vacío/borrado se considera cleared
    // (comportamiento SEGURO: no resucitar el impuesto anterior).
    expect(isTaxClearedOverride({ value: null } as any)).toBe(true);
    // NaN / sin value → no es un "0 explícito" → false (no se asume cleared).
    expect(isTaxClearedOverride({ value: NaN } as any)).toBe(false);
    expect(isTaxClearedOverride({} as any)).toBe(false);
  });

  it("estable bajo round-trip: el mismo override 0 sigue siendo 'cleared' "
   + "(el preview no revive el IVA porque taxOverride={value:0} se preserva)", () => {
    const cleared = { mode: "PERCENT" as const, value: 0, appliesTo: "TOTAL" as const };
    // Simula el override preservado por applyLineOverrides / applySalePreviewToDraft.
    expect(isTaxClearedOverride(cleared)).toBe(true);
    expect(isTaxClearedOverride({ ...cleared })).toBe(true);
  });
});
