// src/lib/pricing-legacy-telemetry.ts
// ============================================================================
// Telemetría DEV-only para tracking de paths retrocompat pre-v7.
//
// Propósito:
//   Medir empíricamente cuántas veces se disparan los fallbacks legacy
//   (snapshots sin `lineSale`, normalización de `legacyMetal`/`legacyHechura`,
//   multiplicadores globales). Permite responder en 2-3 meses:
//     "¿quedan snapshots pre-v7 reales en producción?"
//
//   Cuando los contadores lleguen a 0 durante varios sprints, los fallbacks
//   se pueden retirar con seguridad (Fase 4.3).
//
// Reglas de diseño:
//   1. **DEV-only**: en producción la función es no-op. Cero costo runtime.
//   2. **Sin analytics externos**: nada se envía a la red. Solo `console.warn`
//      + contadores en `window.__TPTECH_PRICING_DEBUG__` accesibles por
//      DevTools.
//   3. **Sin impacto visual**: no muestra UI al usuario final.
//   4. **Dedup automático**: el primer hit de cada path emite `console.warn`;
//      los siguientes solo incrementan el contador (no spamean).
//   5. **Opt-out por flag**: el usuario puede silenciar todo con
//      `window.__TPTECH_PRICING_DEBUG__.silent = true`.
//
// API:
//   trackLegacyPricingPath("PRE_V7_LINE_SALE_FALLBACK_METAL", {
//     context: "PricingSimulator card metal",
//   });
//
//   // En DevTools console:
//   window.__TPTECH_PRICING_DEBUG__         → ver contadores + last context
//   window.__TPTECH_PRICING_DEBUG__.reset() → reiniciar contadores
//   window.__TPTECH_PRICING_DEBUG__.silent = true  → silenciar warnings
//
// Sample output (DEV):
//   [TPTech-pricing-legacy] PRE_V7_LINE_SALE_FALLBACK_METAL
//     context: "PricingSimulator card metal"
//     (subsecuentes hits incrementan contador silenciosamente)
// ============================================================================

/**
 * Nombres canónicos de paths legacy instrumentados. Mantener sincronizado
 * con la lista del README de auditoría Fase 4. NO renombrar: los contadores
 * usan estos strings como key.
 */
export type LegacyPathName =
  // Snapshots pre-v7 sin `composition.{type}[i].lineSale`. Fallback cae a
  // multiplicador agregado del breakdown.
  | "PRE_V7_LINE_SALE_FALLBACK_METAL"
  | "PRE_V7_LINE_SALE_FALLBACK_HECHURA"
  // Normalizer cayó al alias legacy `composition.metal` / `composition.hechura`
  // (objetos únicos, snapshots v3/v4). Backend v5+ emite arrays `metals[]`.
  | "LEGACY_METAL_NORMALIZATION"
  | "LEGACY_HECHURA_NORMALIZATION"
  // Simulador usó factor global derivado (`mhb.metalSale / metalCost` o
  // `mhb.hechuraSale / hechuraCost`) en lugar del `lineSale` per-fila. Esto
  // pasa cuando el step no trae `costLineId` mapeado en el composition.
  | "GLOBAL_FACTOR_FALLBACK_METAL"
  | "GLOBAL_FACTOR_FALLBACK_HECHURA";

/**
 * Shape interno del debug store. Expuesto en `window.__TPTECH_PRICING_DEBUG__`.
 */
export interface PricingDebugStore {
  /** Contador acumulado por path (incrementa con cada hit). */
  counts: Record<string, number>;
  /** Timestamp del primer hit de cada path (en ms desde epoch). Permite
   *  saber cuándo apareció el primer caso de un fallback. */
  firstSeen: Record<string, number>;
  /** Último `context` (opcional) reportado por path. Útil para debugging:
   *  identifica desde qué pantalla se disparó. */
  lastContext: Record<string, string | undefined>;
  /** Cuando true, suprime los `console.warn`. Los contadores siguen
   *  acumulando (útil para medir sin ruido en consola). */
  silent: boolean;
  /** Reinicia todos los contadores y caches. Útil cuando se cambia de
   *  pantalla para medir un escenario específico. */
  reset(): void;
}

/**
 * Detecta si estamos en build de desarrollo. En producción esta función
 * retorna false y el resto de la telemetría es no-op. Funciona tanto con
 * Vite (`import.meta.env.DEV`) como con setups sin Vite (fallback a
 * `process.env.NODE_ENV`).
 */
function isDevBuild(): boolean {
  try {
    // Vite expone `import.meta.env.DEV` como boolean en dev / `false` en build.
    // El `(globalThis as any).import` es un truco para evitar el error de
    // sintaxis cuando se evalúa en non-Vite environments (Vitest, Jest).
    const env = (globalThis as any)?.import?.meta?.env;
    if (env && typeof env.DEV === "boolean") return env.DEV;
  } catch { /* ignore */ }
  // Fallback: NODE_ENV. En tests typically "test", en dev "development",
  // en prod "production". Cualquier cosa distinta de "production" se trata
  // como DEV (incluye tests, que QUEREMOS instrumentar para verificar).
  try {
    const env = (globalThis as any)?.process?.env;
    if (env && typeof env.NODE_ENV === "string") {
      return env.NODE_ENV !== "production";
    }
  } catch { /* ignore */ }
  // Default conservador: si no se puede determinar, asumir DEV para no
  // perder telemetría en entornos exóticos. Production sale por las dos
  // primeras vías arriba.
  return true;
}

/**
 * Lazy-init del store. Lo creamos solo si vamos a usarlo (DEV), y lo
 * exponemos en `window` (browser) o `globalThis` (tests/node) para que sea
 * inspectable desde DevTools.
 */
function getStore(): PricingDebugStore | null {
  if (!isDevBuild()) return null;
  const root = (typeof globalThis !== "undefined" ? globalThis : ({} as any)) as any;
  const key = "__TPTECH_PRICING_DEBUG__";
  if (!root[key]) {
    const store: PricingDebugStore = {
      counts: Object.create(null),
      firstSeen: Object.create(null),
      lastContext: Object.create(null),
      silent: false,
      reset() {
        this.counts = Object.create(null);
        this.firstSeen = Object.create(null);
        this.lastContext = Object.create(null);
      },
    };
    Object.defineProperty(root, key, {
      value: store,
      writable: false,
      configurable: true,
    });
  }
  return root[key] as PricingDebugStore;
}

/**
 * Registra que un path legacy se disparó. En producción es no-op.
 *
 * @param pathName  Identificador canónico del fallback (ver `LegacyPathName`).
 * @param opts.context  String opcional con el origen (ej. "PricingSimulator card metal").
 *                       Útil para distinguir qué pantalla disparó el fallback.
 *
 * Comportamiento:
 *   - En DEV, el primer hit por path emite `console.warn` con el contexto.
 *   - Hits posteriores solo incrementan el contador (no spamean consola).
 *   - Contadores accesibles en `window.__TPTECH_PRICING_DEBUG__.counts`.
 *   - `silent = true` suprime los warns sin afectar contadores.
 */
export function trackLegacyPricingPath(
  pathName: LegacyPathName,
  opts?: { context?: string },
): void {
  const store = getStore();
  if (!store) return;   // production no-op.

  const isFirstHit = store.counts[pathName] === undefined
                  || store.counts[pathName] === 0;

  store.counts[pathName] = (store.counts[pathName] ?? 0) + 1;
  if (isFirstHit) {
    store.firstSeen[pathName] = Date.now();
  }
  if (opts?.context !== undefined) {
    store.lastContext[pathName] = opts.context;
  }

  // Warn solo en el primer hit por path (dedup), y solo cuando no está silent.
  if (isFirstHit && !store.silent) {
    // Usamos console.warn deliberadamente (no log/error): el operador
    // puede silenciarlo via filter de DevTools sin afectar errores reales.
    // eslint-disable-next-line no-console
    console.warn(
      `[TPTech-pricing-legacy] ${pathName}`,
      opts?.context ? `\n  context: ${opts.context}` : "",
      "\n  (siguientes hits silenciados; ver window.__TPTECH_PRICING_DEBUG__.counts)",
    );
  }
}

/**
 * Snapshot de los contadores actuales. Útil para tests y para enviar
 * manualmente a un log si fuera necesario en el futuro. Devuelve null en
 * producción.
 */
export function getPricingLegacyCounts(): Record<string, number> | null {
  const store = getStore();
  if (!store) return null;
  // Copia defensiva — el caller no puede mutar el store.
  return { ...store.counts };
}
