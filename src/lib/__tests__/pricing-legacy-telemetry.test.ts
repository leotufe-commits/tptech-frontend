// src/lib/__tests__/pricing-legacy-telemetry.test.ts
// ============================================================================
// Fase 5 — tests del helper de telemetría DEV-only.
//
// Confirma:
//   1. Contadores incrementan correctamente.
//   2. Deduplicación de console.warn (solo primer hit).
//   3. `silent = true` suprime warns pero sigue contando.
//   4. `reset()` reinicia todos los contadores.
//   5. `firstSeen` se mantiene como timestamp del primer hit.
//   6. `lastContext` retiene el último context reportado.
//   7. `getPricingLegacyCounts()` devuelve una copia (no muta el store).
// ============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  trackLegacyPricingPath,
  getPricingLegacyCounts,
} from "../pricing-legacy-telemetry";

describe("pricing-legacy-telemetry — comportamiento DEV", () => {
  beforeEach(() => {
    // Reiniciar el store entre tests para aislamiento.
    const store = (globalThis as any).__TPTECH_PRICING_DEBUG__;
    if (store?.reset) store.reset();
    if (store) store.silent = false;
  });

  it("incrementa el contador en cada llamada", () => {
    trackLegacyPricingPath("LEGACY_METAL_NORMALIZATION");
    trackLegacyPricingPath("LEGACY_METAL_NORMALIZATION");
    trackLegacyPricingPath("LEGACY_METAL_NORMALIZATION");
    const counts = getPricingLegacyCounts();
    expect(counts?.LEGACY_METAL_NORMALIZATION).toBe(3);
  });

  it("contadores por path son independientes", () => {
    trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_METAL");
    trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_HECHURA");
    trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_HECHURA");
    const counts = getPricingLegacyCounts();
    expect(counts?.PRE_V7_LINE_SALE_FALLBACK_METAL).toBe(1);
    expect(counts?.PRE_V7_LINE_SALE_FALLBACK_HECHURA).toBe(2);
  });

  it("console.warn dispara SOLO en el primer hit (dedup)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    trackLegacyPricingPath("LEGACY_HECHURA_NORMALIZATION");
    trackLegacyPricingPath("LEGACY_HECHURA_NORMALIZATION");
    trackLegacyPricingPath("LEGACY_HECHURA_NORMALIZATION");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("silent=true suprime warns pero NO afecta contadores", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = (globalThis as any).__TPTECH_PRICING_DEBUG__;
    store.silent = true;
    trackLegacyPricingPath("GLOBAL_FACTOR_FALLBACK_METAL");
    trackLegacyPricingPath("GLOBAL_FACTOR_FALLBACK_METAL");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(getPricingLegacyCounts()?.GLOBAL_FACTOR_FALLBACK_METAL).toBe(2);
    warnSpy.mockRestore();
  });

  it("reset() reinicia counts, firstSeen y lastContext", () => {
    trackLegacyPricingPath("LEGACY_METAL_NORMALIZATION", { context: "test" });
    expect(getPricingLegacyCounts()?.LEGACY_METAL_NORMALIZATION).toBe(1);
    const store = (globalThis as any).__TPTECH_PRICING_DEBUG__;
    store.reset();
    expect(store.counts.LEGACY_METAL_NORMALIZATION).toBeUndefined();
    expect(store.firstSeen.LEGACY_METAL_NORMALIZATION).toBeUndefined();
    expect(store.lastContext.LEGACY_METAL_NORMALIZATION).toBeUndefined();
  });

  it("firstSeen retiene el timestamp del primer hit (no se sobreescribe)", async () => {
    trackLegacyPricingPath("LEGACY_METAL_NORMALIZATION");
    const store = (globalThis as any).__TPTECH_PRICING_DEBUG__;
    const t1 = store.firstSeen.LEGACY_METAL_NORMALIZATION;
    expect(t1).toBeTypeOf("number");
    // Esperar 5ms y verificar que el timestamp no cambia.
    await new Promise(r => setTimeout(r, 5));
    trackLegacyPricingPath("LEGACY_METAL_NORMALIZATION");
    expect(store.firstSeen.LEGACY_METAL_NORMALIZATION).toBe(t1);
  });

  it("lastContext retiene el último valor reportado", () => {
    trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_HECHURA", { context: "A" });
    trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_HECHURA", { context: "B" });
    const store = (globalThis as any).__TPTECH_PRICING_DEBUG__;
    expect(store.lastContext.PRE_V7_LINE_SALE_FALLBACK_HECHURA).toBe("B");
  });

  it("context opcional: si no se pasa, no toca lastContext previo", () => {
    trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_METAL", { context: "primer-hit" });
    trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_METAL"); // sin context
    const store = (globalThis as any).__TPTECH_PRICING_DEBUG__;
    expect(store.lastContext.PRE_V7_LINE_SALE_FALLBACK_METAL).toBe("primer-hit");
  });

  it("getPricingLegacyCounts() devuelve copia defensiva", () => {
    trackLegacyPricingPath("LEGACY_METAL_NORMALIZATION");
    const counts1 = getPricingLegacyCounts()!;
    counts1.LEGACY_METAL_NORMALIZATION = 999;
    const counts2 = getPricingLegacyCounts()!;
    // Mutación externa no afecta el store interno.
    expect(counts2.LEGACY_METAL_NORMALIZATION).toBe(1);
  });

  it("store global accesible vía window.__TPTECH_PRICING_DEBUG__", () => {
    trackLegacyPricingPath("LEGACY_METAL_NORMALIZATION");
    const store = (globalThis as any).__TPTECH_PRICING_DEBUG__;
    expect(store).toBeDefined();
    expect(store.counts).toBeDefined();
    expect(store.reset).toBeTypeOf("function");
  });
});
