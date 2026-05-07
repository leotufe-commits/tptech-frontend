// src/lib/featureFlags.ts
// =============================================================================
// FASE 1.0 — PR3. Feature flags centralizados para Fase 1 (frontend reader-only).
//
// Objetivo: permitir que cada migración de Fase 1.2-1.4 entre detrás de un
// flag, de modo que producción pueda flippear `off` desde DevTools sin
// redeploy si aparece divergencia.
//
// Persistencia: localStorage (no sincronizado entre dispositivos a propósito —
// queremos que el operador tenga control local en su navegador).
//
// Reglas:
//   · Default: OFF (comportamiento legacy preservado).
//   · El flag se lee en cada llamada — sin caché — para que el flip desde
//     DevTools tenga efecto inmediato sin reload.
//   · Se exponen helpers de DevTools en window.__tptechFlags para flippear
//     desde la consola del navegador.
//
// Uso desde código:
//   import { isPricingStrictV1Enabled } from "@/lib/featureFlags";
//   if (isPricingStrictV1Enabled()) {
//     // nueva ruta lector-puro
//   } else {
//     // ruta legacy
//   }
//
// Uso desde DevTools (consola del navegador):
//   __tptechFlags.list()                       // lista todos los flags
//   __tptechFlags.enable("tptech_pricing_strict_v1")
//   __tptechFlags.disable("tptech_pricing_strict_v1")
//   __tptechFlags.reset()                      // borra todos los flags
// =============================================================================

/** Nombre canónico de cada flag — usar siempre constante, nunca string mágico. */
export const FEATURE_FLAGS = {
  /** Migración Fase 1.2+ — frontend reader-only para pricing.
   *  Cuando está ON, los componentes que tienen rama lector-puro la usan.
   *  Cuando está OFF (default), usan la rama legacy. */
  PRICING_STRICT_V1: "tptech_pricing_strict_v1",
} as const;

export type FeatureFlagKey = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

const ALL_FLAGS: readonly FeatureFlagKey[] = Object.values(FEATURE_FLAGS);

declare global {
  interface Window {
    __tptechFlags?: {
      list:    () => Record<string, boolean>;
      enable:  (key: FeatureFlagKey) => void;
      disable: (key: FeatureFlagKey) => void;
      reset:   () => void;
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage abstraction
// ─────────────────────────────────────────────────────────────────────────────

/** Acceso defensivo a localStorage. Devuelve null si no está disponible
 *  (SSR, sandboxing, modo incógnito con storage deshabilitado). */
function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    if (!("localStorage" in window)) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lee el estado de un flag desde localStorage. Default: false (legacy).
 *
 * Solo se considera "on" cuando el valor es exactamente "on" o "true" — toda
 * otra entrada (null, undefined, "off", string vacío, JSON inválido, etc.)
 * cae al default.
 */
export function isFeatureFlagEnabled(key: FeatureFlagKey): boolean {
  const ls = safeStorage();
  if (!ls) return false;
  try {
    const raw = ls.getItem(key);
    return raw === "on" || raw === "true";
  } catch {
    return false;
  }
}

/** Sugar específico para PRICING_STRICT_V1 — el flag más usado de Fase 1. */
export function isPricingStrictV1Enabled(): boolean {
  return isFeatureFlagEnabled(FEATURE_FLAGS.PRICING_STRICT_V1);
}

export function setFeatureFlag(key: FeatureFlagKey, enabled: boolean): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    if (enabled) ls.setItem(key, "on");
    else ls.removeItem(key);
  } catch {
    // ignore — storage lleno o read-only
  }
}

export function resetAllFeatureFlags(): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    for (const key of ALL_FLAGS) ls.removeItem(key);
  } catch {
    // ignore
  }
}

export function listFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const out = {} as Record<FeatureFlagKey, boolean>;
  for (const key of ALL_FLAGS) out[key] = isFeatureFlagEnabled(key);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// DevTools registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicializa el helper global `window.__tptechFlags` para que el operador
 * pueda flippear flags desde la consola del navegador. Idempotente: llamar
 * múltiples veces no rompe nada.
 *
 * Se llama una vez desde el bootstrap (main.tsx). En tests/SSR es no-op.
 */
export function registerFeatureFlagsDevTools(): void {
  if (typeof window === "undefined") return;
  if (window.__tptechFlags) return;
  window.__tptechFlags = {
    list:    listFeatureFlags,
    enable:  (key) => setFeatureFlag(key, true),
    disable: (key) => setFeatureFlag(key, false),
    reset:   resetAllFeatureFlags,
  };
}
