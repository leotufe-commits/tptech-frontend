// src/lib/document-helpers.ts
// ============================================================================
// Helpers de documentos comerciales (órdenes, facturas, pagos, cobros,
// presupuestos, recepciones, entregas, cuenta corriente).
//
// Son funciones puras sin dependencias del dominio: solo formateo, utilidades
// numéricas y generación de identificadores / números correlativos.
// ============================================================================

import type { DocumentLine } from "./document-types";

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
 * Reglas (en orden de prioridad):
 *   1. Si la línea ya viene HIDRATADA por el backend (`pricingMeta.partial === false`
 *      y `lineTotal/subtotal` numéricos), devolver esos valores tal cual.
 *      Estos PRESERVAN el redondeo de la lista de precios aplicado por el
 *      motor (ej. ARS 84.600,00 cuando la lista redondea a decena con
 *      `applyOn=TOTAL`). Reconstruir desde `qty × unitPrice` perdería el
 *      redondeo (ARS 84.609,68).
 *   2. Si la línea tiene `pricingMeta.unitTotalWithTax` (unitario REDONDEADO
 *      del motor), usar `qty × unitTotalWithTax`. Mantiene el redondeo
 *      cuando se cambia la cantidad antes de que el preview responda.
 *   3. Fallback simple: `qty × unitPrice − discount` + `taxAmount`. Solo
 *      durante el debounce (≤350ms) ANTES del primer preview, o cuando la
 *      línea no tiene `articleId` (placeholder).
 *
 * El frontend NO hace nuevos cálculos. Cuando el backend responde, los
 * importes se sobreescriben vía `applySalePreviewToDraft`.
 */
export function calcLineTotalsFromSnapshot(
  l: Pick<DocumentLine, "quantity" | "unitPrice" | "discountAmount"> &
    Partial<Pick<DocumentLine, "taxAmount" | "pricingMeta" | "subtotal" | "lineTotal">>,
): { subtotal: number; lineTotal: number } {
  // (1) Línea ya hidratada por el backend: respetar lo que vino tal cual.
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
    return { subtotal, lineTotal: l.lineTotal as number };
  }

  // (2)+(3) Cálculo optimista — durante el debounce o sin backend aún.
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
  return { subtotal, lineTotal };
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
