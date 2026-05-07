// src/lib/__tests__/featureFlags.test.ts
// =============================================================================
// FASE 1.0 — PR3 tests del helper de feature flags.
// =============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  FEATURE_FLAGS,
  isFeatureFlagEnabled,
  isPricingStrictV1Enabled,
  setFeatureFlag,
  resetAllFeatureFlags,
  listFeatureFlags,
  registerFeatureFlagsDevTools,
} from "../featureFlags";

describe("featureFlags — API pública", () => {
  beforeEach(() => {
    // Limpia el storage entre tests (jsdom expone localStorage real).
    window.localStorage.clear();
    // Limpia el registry global de DevTools.
    (window as any).__tptechFlags = undefined;
  });

  it("baseline correct: default es OFF para todos los flags", () => {
    expect(isFeatureFlagEnabled(FEATURE_FLAGS.PRICING_STRICT_V1)).toBe(false);
    expect(isPricingStrictV1Enabled()).toBe(false);
  });

  it("baseline correct: setFeatureFlag(true) → isFeatureFlagEnabled=true", () => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    expect(isFeatureFlagEnabled(FEATURE_FLAGS.PRICING_STRICT_V1)).toBe(true);
    expect(isPricingStrictV1Enabled()).toBe(true);
  });

  it("baseline correct: setFeatureFlag(false) elimina el flag de localStorage", () => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, false);
    expect(window.localStorage.getItem(FEATURE_FLAGS.PRICING_STRICT_V1)).toBeNull();
    expect(isFeatureFlagEnabled(FEATURE_FLAGS.PRICING_STRICT_V1)).toBe(false);
  });

  it("baseline correct: valor 'on' lo prende, 'true' también, otros valores no", () => {
    window.localStorage.setItem(FEATURE_FLAGS.PRICING_STRICT_V1, "on");
    expect(isPricingStrictV1Enabled()).toBe(true);

    window.localStorage.setItem(FEATURE_FLAGS.PRICING_STRICT_V1, "true");
    expect(isPricingStrictV1Enabled()).toBe(true);

    window.localStorage.setItem(FEATURE_FLAGS.PRICING_STRICT_V1, "off");
    expect(isPricingStrictV1Enabled()).toBe(false);

    window.localStorage.setItem(FEATURE_FLAGS.PRICING_STRICT_V1, "1");
    expect(isPricingStrictV1Enabled()).toBe(false);

    window.localStorage.setItem(FEATURE_FLAGS.PRICING_STRICT_V1, "");
    expect(isPricingStrictV1Enabled()).toBe(false);
  });

  it("baseline correct: resetAllFeatureFlags borra todos los flags conocidos", () => {
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    expect(isPricingStrictV1Enabled()).toBe(true);
    resetAllFeatureFlags();
    expect(isPricingStrictV1Enabled()).toBe(false);
  });

  it("baseline correct: listFeatureFlags devuelve estado de cada flag", () => {
    const empty = listFeatureFlags();
    expect(empty[FEATURE_FLAGS.PRICING_STRICT_V1]).toBe(false);

    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    const enabled = listFeatureFlags();
    expect(enabled[FEATURE_FLAGS.PRICING_STRICT_V1]).toBe(true);
  });

  it("baseline correct: el flip persiste entre lecturas (sin caché)", () => {
    // Simula flip desde DevTools mientras la app corre.
    setFeatureFlag(FEATURE_FLAGS.PRICING_STRICT_V1, true);
    expect(isPricingStrictV1Enabled()).toBe(true);

    // Otro código flippea sin pasar por setFeatureFlag.
    window.localStorage.removeItem(FEATURE_FLAGS.PRICING_STRICT_V1);
    expect(isPricingStrictV1Enabled()).toBe(false);
  });
});

describe("featureFlags — DevTools registry", () => {
  beforeEach(() => {
    window.localStorage.clear();
    (window as any).__tptechFlags = undefined;
  });

  it("baseline correct: registerFeatureFlagsDevTools expone helpers en window", () => {
    registerFeatureFlagsDevTools();
    expect(window.__tptechFlags).toBeDefined();
    expect(typeof window.__tptechFlags?.list).toBe("function");
    expect(typeof window.__tptechFlags?.enable).toBe("function");
    expect(typeof window.__tptechFlags?.disable).toBe("function");
    expect(typeof window.__tptechFlags?.reset).toBe("function");
  });

  it("baseline correct: __tptechFlags.enable activa el flag", () => {
    registerFeatureFlagsDevTools();
    window.__tptechFlags!.enable(FEATURE_FLAGS.PRICING_STRICT_V1);
    expect(isPricingStrictV1Enabled()).toBe(true);
  });

  it("baseline correct: __tptechFlags.disable desactiva el flag", () => {
    registerFeatureFlagsDevTools();
    window.__tptechFlags!.enable(FEATURE_FLAGS.PRICING_STRICT_V1);
    window.__tptechFlags!.disable(FEATURE_FLAGS.PRICING_STRICT_V1);
    expect(isPricingStrictV1Enabled()).toBe(false);
  });

  it("baseline correct: __tptechFlags.reset borra todos los flags", () => {
    registerFeatureFlagsDevTools();
    window.__tptechFlags!.enable(FEATURE_FLAGS.PRICING_STRICT_V1);
    window.__tptechFlags!.reset();
    expect(isPricingStrictV1Enabled()).toBe(false);
  });

  it("baseline correct: __tptechFlags.list devuelve el snapshot actual", () => {
    registerFeatureFlagsDevTools();
    window.__tptechFlags!.enable(FEATURE_FLAGS.PRICING_STRICT_V1);
    const snap = window.__tptechFlags!.list();
    expect(snap[FEATURE_FLAGS.PRICING_STRICT_V1]).toBe(true);
  });

  it("baseline correct: register es idempotente — segunda llamada no rompe", () => {
    registerFeatureFlagsDevTools();
    const first = window.__tptechFlags;
    registerFeatureFlagsDevTools();
    const second = window.__tptechFlags;
    expect(first).toBe(second); // misma referencia
  });
});

describe("featureFlags — resilencia", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("baseline correct: localStorage corrupto no tumba la lectura", () => {
    // Simula JSON inválido pero el helper acepta cualquier string raw, así
    // que tendríamos que romper el getItem para forzar el catch. En vez de
    // eso verificamos que valores raros caen al default.
    window.localStorage.setItem(FEATURE_FLAGS.PRICING_STRICT_V1, "{not-json}");
    expect(isPricingStrictV1Enabled()).toBe(false);

    window.localStorage.setItem(FEATURE_FLAGS.PRICING_STRICT_V1, "yes");
    expect(isPricingStrictV1Enabled()).toBe(false);
  });
});
