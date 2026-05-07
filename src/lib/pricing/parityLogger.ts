// src/lib/pricing/parityLogger.ts
// ============================================================================
// FASE 1 — Logger de paridad Simulador ↔ Factura.
//
// Objetivo: detectar — manual y automáticamente — cualquier divergencia entre
// `articles/pricing-preview` (Simulador) y `sales/preview` (Factura) cuando el
// operador usa los MISMOS inputs.
//
// Fase 1.0 (PR2) agregó **detección automática**: cada vez que ambos
// snapshots están en el registro, se compara `documentTotals` y si algún
// campo difiere > 0.01 se emite `console.error("[PARITY:auto] …")`. Esto
// reemplaza al diff manual con `__tptechParity.diff()` (que sigue disponible).
//
// Uso desde código:
//   logParity("simulator", { payload, normalized });
//   logParity("invoice",   { payload, normalized });
//   // Si ambos están presentes, se compara automáticamente.
//
// Uso desde DevTools:
//   __tptechParity.diff()       imprime la tabla de diferencias
//   __tptechParity.simulator    último snapshot del simulador
//   __tptechParity.invoice      último snapshot de la factura
//
// Activo solo cuando `import.meta.env.DEV === true` o
// `import.meta.env.MODE !== "production"`. En producción es no-op.
// ============================================================================

import type { NormalizedPricingResult } from "./contract";

type ParityScope = "simulator" | "invoice";

type ParitySnapshot = {
  scope:      ParityScope;
  at:         string;
  payload:    unknown;
  normalized: NormalizedPricingResult;
};

declare global {
  interface Window {
    __tptechParity?: {
      simulator: ParitySnapshot | null;
      invoice:   ParitySnapshot | null;
      diff:      () => void;
    };
  }
}

const DOCUMENT_TOTALS_KEYS: Array<keyof NormalizedPricingResult["documentTotals"]> = [
  "subtotalBeforeDiscounts",
  "lineDiscountAmount",
  "subtotalAfterLineDiscounts",
  "channelAdjustmentAmount",
  "couponDiscountAmount",
  "paymentAdjustmentAmount",
  "shippingAmount",
  "globalDiscountAmount",
  "taxableBase",
  "taxAmount",
  "roundingAdjustment",
  "totalBeforeTax",
  "totalWithTax",
  "total",
];

/** Umbral en moneda base — un campo se considera divergente si |delta| >= 0.01. */
export const PARITY_DELTA_THRESHOLD = 0.01;

export type ParityDiffRow = {
  field:    keyof NormalizedPricingResult["documentTotals"];
  a:        number;
  b:        number;
  delta:    number;
  matches:  boolean;
};

export type ParityDiffReport = {
  rows:        ParityDiffRow[];
  broken:      ParityDiffRow[];
  brokenCount: number;
  matched:     boolean;
};

const isDevOrStaging = (): boolean => {
  try {
    const env = (import.meta as any)?.env;
    if (!env) return false;
    if (env.DEV === true) return true;
    if (env.MODE && env.MODE !== "production") return true;
    return false;
  } catch {
    return false;
  }
};

/**
 * Compara `documentTotals` de dos snapshots normalizados y reporta cada
 * campo con `{ a, b, delta, matches }`. Función pura: testeable sin DOM.
 */
export function compareDocumentTotals(
  a: NormalizedPricingResult | null | undefined,
  b: NormalizedPricingResult | null | undefined,
): ParityDiffReport {
  const dtA = a?.documentTotals;
  const dtB = b?.documentTotals;
  const rows: ParityDiffRow[] = DOCUMENT_TOTALS_KEYS.map((field) => {
    const av = Number(dtA?.[field] ?? 0);
    const bv = Number(dtB?.[field] ?? 0);
    const delta = Math.round((bv - av) * 100) / 100;
    return {
      field,
      a:       av,
      b:       bv,
      delta,
      matches: Math.abs(delta) < PARITY_DELTA_THRESHOLD,
    };
  });
  const broken = rows.filter((r) => !r.matches);
  return {
    rows,
    broken,
    brokenCount: broken.length,
    matched:     broken.length === 0,
  };
}

function ensureRegistry() {
  if (typeof window === "undefined") return null;
  if (!window.__tptechParity) {
    window.__tptechParity = {
      simulator: null,
      invoice:   null,
      diff:      diffSnapshots,
    };
  }
  return window.__tptechParity;
}

/**
 * Loguea un snapshot de paridad y lo guarda para comparación posterior.
 *
 * Si ambos snapshots (simulator + invoice) están presentes, dispara una
 * comparación automática: si algún campo difiere ≥ 0.01, emite
 * `console.error("[PARITY:auto] …")` con la lista de campos divergentes.
 */
export function logParity(
  scope: ParityScope,
  data: { payload: unknown; normalized: NormalizedPricingResult },
): void {
  if (!isDevOrStaging()) return;
  const reg = ensureRegistry();
  if (!reg) return;
  const snap: ParitySnapshot = {
    scope,
    at:         new Date().toISOString(),
    payload:    data.payload,
    normalized: data.normalized,
  };
  reg[scope] = snap;
  const tag = scope === "simulator" ? "[PARITY:simulator]" : "[PARITY:invoice]";
  // eslint-disable-next-line no-console
  console.groupCollapsed(`${tag} preview total=${data.normalized.documentTotals?.total ?? "?"}`);
  // eslint-disable-next-line no-console
  console.log("payload:",    data.payload);
  // eslint-disable-next-line no-console
  console.log("normalized:", data.normalized);
  // eslint-disable-next-line no-console
  console.log("Compará con: __tptechParity.diff()");
  // eslint-disable-next-line no-console
  console.groupEnd();

  // Comparación automática — si ambos snapshots están presentes y los inputs
  // se asumen equivalentes (responsabilidad del caller), reportamos delta.
  if (reg.simulator && reg.invoice) {
    autoCompareAndWarn(reg.simulator, reg.invoice);
  }
}

/**
 * Si la comparación detecta delta ≥ 0.01 en cualquier campo de
 * `documentTotals`, emite `console.error` con la lista de campos rotos.
 * En verde (matched=true) no emite nada para no contaminar la consola.
 */
function autoCompareAndWarn(sim: ParitySnapshot, inv: ParitySnapshot): void {
  const report = compareDocumentTotals(sim.normalized, inv.normalized);
  if (report.matched) return;
  const summary = report.broken
    .map((r) => `${r.field}: sim=${r.a} factura=${r.b} delta=${r.delta}`)
    .join(" | ");
  // eslint-disable-next-line no-console
  console.error(
    `[PARITY:auto] DIVERGENCIA DETECTADA — ${report.brokenCount} campo(s) ` +
    `con delta ≥ ${PARITY_DELTA_THRESHOLD}: ${summary}`,
  );
}

/**
 * Compara los snapshots actuales y reporta los campos del documentTotals que
 * difieren más allá de 1 centavo. Versión interactiva (DevTools).
 */
function diffSnapshots(): void {
  const reg = ensureRegistry();
  if (!reg) return;
  const sim = reg.simulator;
  const inv = reg.invoice;
  if (!sim || !inv) {
    // eslint-disable-next-line no-console
    console.warn("[PARITY] Faltan snapshots:", {
      simulator: !!sim,
      invoice:   !!inv,
    });
    return;
  }
  const report = compareDocumentTotals(sim.normalized, inv.normalized);
  // Mantengo el shape histórico de la tabla para que la herramienta visual no cambie.
  const rows = report.rows.map((r) => ({
    campo:        r.field,
    simulador:    r.a,
    factura:      r.b,
    delta:        r.delta,
    "¿coincide?": r.matches ? "✓" : "✗",
  }));
  // eslint-disable-next-line no-console
  console.group("[PARITY] Simulador ↔ Factura — documentTotals");
  // eslint-disable-next-line no-console
  console.table(rows);
  if (report.matched) {
    // eslint-disable-next-line no-console
    console.log("✅ Todos los campos coinciden.");
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `✗ ${report.brokenCount} campo(s) divergen:`,
      report.broken.map((r) => r.field),
    );
  }
  // eslint-disable-next-line no-console
  console.log("Snapshots completos:", { simulator: sim, invoice: inv });
  // eslint-disable-next-line no-console
  console.groupEnd();
}
