// src/lib/document-helpers.ts
// ============================================================================
// Helpers de documentos comerciales (órdenes, facturas, pagos, cobros,
// presupuestos, recepciones, entregas, cuenta corriente).
//
// Son funciones puras sin dependencias del dominio: solo formateo, utilidades
// numéricas y generación de identificadores / números correlativos.
// ============================================================================

import type { DocumentLine } from "./document-types";
import { isPricingStrictV1Enabled } from "./featureFlags";

// ─────────────────────────────────────────────────────────────────────────────
// Identificadores y fechas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identificador local único para filas en memoria (líneas de documentos,
 * componentes de pago, etc.). NO se usa como PK persistida — el backend
 * genera sus propios ids cuando el draft se confirma.
 */
export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Fecha de hoy en formato ISO yyyy-mm-dd (compatible con `<input type="date">`). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formato numérico
// ─────────────────────────────────────────────────────────────────────────────

/** Redondeo a 2 decimales. Evita errores de punto flotante en totales. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Totales de una línea — fuente única de verdad para el render de la UI.
 *
 * ===========================================================================
 * F1.2 paso 5 — comportamiento condicional al flag tptech_pricing_strict_v1.
 *
 * Política:
 *   · Flag OFF (default): legacy idéntico — 3 ramas:
 *       1. Backend hidratado → respeta lineTotal/subtotal del backend.
 *       2. Optimista con unitTotalWithTax → qty × unitTotalWithTax.
 *       3. Fallback simple → qty × unitPrice − disc + taxAmount.
 *   · Flag ON:
 *       1. Backend hidratado → mismo passthrough que OFF (sin cambios).
 *       2 y 3 (cálculo optimista) → ELIMINADOS. Devuelve `subtotal=NaN,
 *          lineTotal=NaN, pending=true`. fmtMoney mapea NaN → "—" sin tocar
 *          consumers; comparaciones (>0, ===) fallan safe → bloquean
 *          confirmación cuando aún no hay pricing válido (correcto > rápido).
 *
 * Justificación POLICY:
 *   · POLICY.md §1 R1.4 — frontend NO calcula plata.
 *   · POLICY.md §4 R4.4 — campos sin valor del backend se muestran "—".
 *   · POLICY.md §4 R4.5 — cero cálculos comerciales en frontend.
 *
 * Por qué NaN (no 0):
 *   · `0` se renderiza como "$0,00" — visualmente confundible con un total
 *     legítimo de cero. Ocultaría el estado pending al operador.
 *   · `NaN` propaga: fmtMoney → "—"; sumatorias → NaN (también renderizado
 *     como "—"); comparaciones → false (Cobrar button queda deshabilitado).
 *   · Tipo TypeScript sigue siendo `number` — cero refactor en consumers.
 *
 * Por qué `pending: boolean`:
 *   · Consumers que quieran skeleton/shimmer (no solo "—") consultan el
 *     flag explícitamente. Por defecto, fmtMoney basta.
 *
 * UX hit aceptado:
 *   · ≤350ms mostrando "—" mientras debouncea el preview es preferible a
 *     un valor optimista incorrecto (especialmente con redondeo de lista).
 *
 * Pantalla afectada:
 *   · VentasFacturas.tsx — único consumer (5 call-sites: 2943, 3412, 3452,
 *     3462, 3665). Bajo flag ON, las líneas recién agregadas o editadas
 *     muestran "—" hasta que preview backend responde.
 *
 * Falla del preview backend:
 *   · Out of scope de esta función. La capa que llama a salesApi.preview
 *     debe manejar el error y NO marcar la línea como hidratada. La línea
 *     queda en estado pending y los botones de confirmación quedan
 *     bloqueados naturalmente por las comparaciones NaN.
 * ===========================================================================
 */
export function calcLineTotalsFromSnapshot(
  l: Pick<DocumentLine, "quantity" | "unitPrice" | "discountAmount"> &
    Partial<Pick<DocumentLine, "taxAmount" | "pricingMeta" | "subtotal" | "lineTotal">>,
): { subtotal: number; lineTotal: number; pending?: boolean } {
  // (1) Línea ya hidratada por el backend: respetar lo que vino tal cual.
  // Bajo AMBOS flags — el backend es la fuente de verdad. Sin cambios.
  const meta = l.pricingMeta;
  const backendHydrated =
    !!meta &&
    meta.partial === false &&
    typeof l.lineTotal === "number" &&
    Number.isFinite(l.lineTotal);
  if (backendHydrated) {
    const subtotal = typeof l.subtotal === "number" && Number.isFinite(l.subtotal)
      ? l.subtotal
      : round2(Math.max(0, (l.lineTotal as number) - (l.taxAmount ?? 0)));
    return { subtotal, lineTotal: l.lineTotal as number, pending: false };
  }

  // F1.2 paso 5 — bajo flag ON, NO calcular optimista. Estado pending.
  if (isPricingStrictV1Enabled()) {
    return { subtotal: NaN, lineTotal: NaN, pending: true };
  }

  // (2)+(3) Cálculo optimista LEGACY — flag OFF (default).
  // Bajo flag OFF, comportamiento idéntico al pre-paso 5.
  const qty   = Number.isFinite(l.quantity)       ? l.quantity       : 0;
  const price = Number.isFinite(l.unitPrice)      ? l.unitPrice      : 0;
  const disc  = Number.isFinite(l.discountAmount) ? l.discountAmount : 0;
  const subtotal = round2(Math.max(0, qty * price - disc));
  const unitWithTax = meta?.unitTotalWithTax;
  let lineTotal: number;
  if (typeof unitWithTax === "number" && Number.isFinite(unitWithTax)) {
    lineTotal = round2(Math.max(0, qty * unitWithTax));
  } else if (typeof l.taxAmount === "number" && Number.isFinite(l.taxAmount)) {
    lineTotal = round2(subtotal + Math.max(0, l.taxAmount));
  } else {
    lineTotal = subtotal;
  }
  return { subtotal, lineTotal, pending: false };
}

/**
 * Formatea una fecha ISO (yyyy-mm-dd) al formato local es-AR.
 * Devuelve "—" para valores vacíos y el valor crudo si no se puede parsear.
 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR");
}

/**
 * Formatea un monto monetario en es-AR con 2 decimales.
 * Si se pasa `currency`, se antepone (ej: "ARS 12.345,67").
 * Devuelve "—" para valores no finitos.
 */
export function fmtMoney(n: number, currency?: string): string {
  if (!Number.isFinite(n)) return "—";
  const formatted = n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

/**
 * Formatea una cantidad (sin decimales obligatorios, hasta 3 decimales).
 * Pensada para gramos, unidades y cantidades de líneas.
 */
export function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Numeración correlativa de documentos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el próximo número correlativo para un tipo de documento.
 *
 * @param prefix   Prefijo del documento: "OC", "OV", "FV", "FP", "PP", "CB", etc.
 * @param existing Colección existente de documentos (cada uno con `.number`).
 * @param pad      Cantidad de dígitos con zero-padding. Default: 4.
 *
 * El máximo se deriva buscando el sufijo numérico de cada `.number` ("OC-0001"
 * → 1, "FP-0123" → 123) y tomando el mayor + 1. Soporta prefijos vacíos y
 * números sin prefijo (devuelve "0001" si la colección está vacía).
 *
 * Este helper NO persiste — solo calcula el string a asignar al draft local.
 * El backend genera su propia numeración atómica (ReceiptSeries) cuando
 * el draft se confirma en Fase 5+.
 */
export function nextDocNumber(
  prefix: string,
  existing: ReadonlyArray<{ number: string }>,
  pad: number = 4,
): string {
  const max = existing.reduce((acc, doc) => {
    const m = doc.number?.match(/(\d+)$/);
    const n = m ? parseInt(m[1], 10) : 0;
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  const next = String(max + 1).padStart(pad, "0");
  return prefix ? `${prefix}-${next}` : next;
}
