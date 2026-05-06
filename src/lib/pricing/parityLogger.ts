// src/lib/pricing/parityLogger.ts
// ============================================================================
// FASE 1 — Logger temporal de paridad Simulador ↔ Factura.
//
// Objetivo: detectar a ojo y desde la consola del navegador cualquier
// divergencia entre `articles/pricing-preview` (Simulador) y `sales/preview`
// (Factura) cuando el operador usa los MISMOS inputs.
//
// Uso desde código:
//   logParity("simulator", { payload, normalized });
//   logParity("invoice",   { payload, normalized });
//
// Uso desde DevTools (a mano):
//   __tptechParity.diff()       // imprime la tabla de diferencias
//   __tptechParity.simulator    // último snapshot del simulador
//   __tptechParity.invoice      // último snapshot de la factura
//
// Solo activo cuando `import.meta.env.DEV === true`. En producción es no-op.
// Marcar para eliminación cuando Fase 2/3 estén estables.
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

const isDev = (): boolean => {
  try {
    // Vite injects this; en tests/jest sale undefined → false.
    return Boolean((import.meta as any)?.env?.DEV);
  } catch {
    return false;
  }
};

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

/** Loguea un snapshot de paridad y lo guarda para comparación posterior. */
export function logParity(
  scope: ParityScope,
  data: { payload: unknown; normalized: NormalizedPricingResult },
): void {
  if (!isDev()) return;
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
}

/**
 * Compara los snapshots actuales y reporta los campos del documentTotals que
 * difieren más allá de 1 centavo. Solo útil cuando el usuario ya disparó AMBOS
 * previews con los mismos inputs.
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
  const a = sim.normalized.documentTotals;
  const b = inv.normalized.documentTotals;
  const keys: Array<keyof NormalizedPricingResult["documentTotals"]> = [
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
  const rows = keys.map((k) => {
    const av = Number(a?.[k] ?? 0);
    const bv = Number(b?.[k] ?? 0);
    const delta = Math.round((bv - av) * 100) / 100;
    return {
      campo:           k,
      simulador:       av,
      factura:         bv,
      delta,
      "¿coincide?":    Math.abs(delta) < 0.01 ? "✓" : "✗",
    };
  });
  // eslint-disable-next-line no-console
  console.group("[PARITY] Simulador ↔ Factura — documentTotals");
  // eslint-disable-next-line no-console
  console.table(rows);
  const broken = rows.filter((r) => r["¿coincide?"] === "✗");
  if (broken.length === 0) {
    // eslint-disable-next-line no-console
    console.log("✅ Todos los campos coinciden.");
  } else {
    // eslint-disable-next-line no-console
    console.warn(`✗ ${broken.length} campo(s) divergen:`, broken.map((r) => r.campo));
  }
  // eslint-disable-next-line no-console
  console.log("Snapshots completos:", { simulator: sim, invoice: inv });
  // eslint-disable-next-line no-console
  console.groupEnd();
}
