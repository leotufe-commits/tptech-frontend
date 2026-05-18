// src/lib/pricing/format.ts
// ============================================================================
// Formatters compartidos del dominio comercial.
//
// REGLA CRÍTICA: estas funciones NO calculan valores económicos. Solo dan
// formato visual. Cualquier valor que reciben ya viene resuelto por el motor
// (`pricing-engine`).
//
// Centraliza patrones que estaban duplicados en:
//   - PricingSimulator.tsx (fm2, fmGr inline)
//   - TPBalanceBreakdownKpis.tsx (fmtGrams)
//   - InventarioMovimientos.tsx, EntityDetail.tsx, etc. (5 copias de fmtGrams)
// ============================================================================

import { fmtMoney } from "../format";
import {
  formatFixedLocale,
  formatNumber,
  getActiveNumberFormatConfig,
  getNumberFormatConfig,
  type FormatOptions,
  type NumberFormatType,
} from "../number-format";

/** Decimales configurados por el tenant para un tipo (preset, NO hardcode). */
function presetDecimals(type: NumberFormatType): number {
  return getNumberFormatConfig(type, getActiveNumberFormatConfig()).decimals;
}

/**
 * Formateador CANÓNICO type-driven. Resuelve TODO desde el preset del tenant
 * (decimales, ceros finales, prefijo/sufijo, separadores). Es la vía correcta
 * para cualquier valor con un TIPO conocido (MONEY, TAX_PERCENT, MERMA_PERCENT,
 * MARGIN_PERCENT, PURITY, METAL_GRAMS, FX_RATE, QUANTITY, INTEGER, DECIMAL…).
 * NO hardcodear decimales: pasar el `type` y dejar que el preset mande.
 */
export function formatByType(
  value: number | string | null | undefined,
  type: NumberFormatType,
  options?: FormatOptions,
): string {
  return formatNumber(value, type, getActiveNumberFormatConfig(), options);
}

// Estos helpers son la fuente única de formato del dominio comercial. Ahora
// delegan en el MOTOR central usando la config activa del tenant (región /
// separadores). Mantienen exactamente su API y semántica (decimales por
// parámetro, "—" para nullish, sufijo "%", manejo de signo): con la región
// por defecto (AR) el resultado es idéntico al es-AR previo; al cambiar la
// región, todos los consumidores reflejan el nuevo formato sin más cambios.

/**
 * Formatea gramos con N decimales fijos según la región configurada.
 *
 * Default 2 decimales (estándar comercial). Para mayor precisión visual en
 * factores de pureza/merma, usar 3 (`formatGrams(v, 3)`).
 */
export function formatGrams(v: number | null | undefined, fractionDigits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return formatFixedLocale(v, fractionDigits, getActiveNumberFormatConfig());
}

/**
 * Formatea un valor monetario aplicando conversión de moneda de display.
 *
 * `value` está en la moneda base del motor; se divide por `displayRate` para
 * obtener el monto en la moneda mostrada. Esto NO es lógica comercial — la
 * tasa la provee el motor (o el usuario en el simulador) y el resultado es
 * solo visual.
 *
 * Equivalente al `fm2` inline que vivía en PricingSimulator.tsx:4322.
 */
export function formatMoneyDisplay(
  value: number,
  displayRate: number,
  displaySymbol: string,
): string {
  const n = value / displayRate;
  if (!isFinite(n)) return "—";
  return displaySymbol + formatFixedLocale(n, 2, getActiveNumberFormatConfig());
}

/**
 * Formatea un porcentaje en formato es-AR.
 *
 * @param fractionDigits — cantidad de decimales mínima y máxima (default 2)
 * @param withSign — si true, antepone "+" o "−" según signo (default false)
 */
export function formatPercent(
  v: number | null | undefined,
  fractionDigits = 2,
  withSign = false,
): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  const formatted = formatFixedLocale(abs, fractionDigits, getActiveNumberFormatConfig());
  if (withSign) {
    if (v < 0) return `−${formatted}%`;
    if (v > 0) return `+${formatted}%`;
  }
  return `${v < 0 ? "−" : ""}${formatted}%`;
}

/**
 * Monto monetario config-aware. Mismo contrato que `fmtMoney` de lib/format
 * (símbolo + número, "—" para nullish/no-finito, 2 decimales) pero respetando
 * la región del tenant. Pensado para reemplazar el `fmtMoney` global en
 * superficies de pricing SIN tocar cada call-site (se importa aliasado).
 */
export function formatMoneyAmount(
  v: string | number | null | undefined,
  sym = "$",
): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "—";
  return sym + formatFixedLocale(n, presetDecimals("MONEY"), getActiveNumberFormatConfig());
}

/**
 * Número decimal "pelado" (sin símbolo) con N decimales y separadores de la
 * región. Para porcentajes/factores/márgenes donde el símbolo o la unidad ya
 * viven en el JSX adyacente (no los duplicamos acá). Delega en el motor:
 * cero lógica de formato nueva, cero toFixed/toLocaleString inline.
 */
export function formatDecimal(
  v: number | null | undefined,
  fractionDigits = 2,
): string {
  if (v == null || !isFinite(v)) return "—";
  return formatFixedLocale(v, fractionDigits, getActiveNumberFormatConfig());
}

/**
 * Número decimal region-aware con HASTA N decimales (recorta ceros finales).
 * Equivalente region-aware de `toLocaleString(..., { maximumFractionDigits:N })`:
 * preserva el mismo comportamiento visual (1,6 / 3) en vez de forzar decimales.
 */
export function formatDecimalUpTo(
  v: number | null | undefined,
  maxFractionDigits = 2,
): string {
  if (v == null || !isFinite(v)) return "—";
  return formatFixedLocale(v, maxFractionDigits, getActiveNumberFormatConfig(), true);
}

// ───────────────────────────────────────────────────────────────────────────
// Equivalentes config-aware de los helpers "smart" de lib/format. MISMA API y
// semántica (—" para nullish, smart >=1 vs <1, símbolo opcional) pero usando
// la región del tenant. Las superficies scoped (valuation/Comparador) cambian
// SOLO el import path (lib/format → acá); lib/format global queda intacto, así
// el resto de la app no migra todavía. Cero lógica de formato nueva: delegan
// en el motor (formatFixedLocale) y en parseNumberInput.
// ───────────────────────────────────────────────────────────────────────────

import { parseNumberInput } from "../number-format";

function toNumLoose(n: unknown): number | null {
  if (typeof n === "number") return Number.isFinite(n) ? n : null;
  return parseNumberInput(n, getActiveNumberFormatConfig());
}

/** Tipo de cambio inteligente: ≥1 → 2 dec; <1 → hasta 10 dec sin rellenar. */
export function fmtRateSmart(n: unknown): string {
  const v = toNumLoose(n);
  if (v === null) return "—";
  const cfg = getActiveNumberFormatConfig();
  return Math.abs(v) >= 1
    ? formatFixedLocale(v, 2, cfg)
    : formatFixedLocale(v, 10, cfg, true);
}

/** Dinero inteligente con símbolo opcional (precios de variantes/quotes). */
export function fmtMoneySmart(symbol: string, n: unknown): string {
  const v = toNumLoose(n);
  if (v === null) return "—";
  const s = String(symbol || "").trim();
  const cfg = getActiveNumberFormatConfig();
  const num = Math.abs(v) >= 1
    ? formatFixedLocale(v, 2, cfg)
    : formatFixedLocale(v, 10, cfg, true);
  return s ? `${s} ${num}` : num;
}

/** Dinero con símbolo opcional, 2 decimales fijos. Equiv. de `fmtMoney2`. */
export function fmtMoney2(symbol: string, n: unknown): string {
  const v = toNumLoose(n);
  if (v === null) return "—";
  const s = String(symbol || "").trim();
  const num = formatFixedLocale(v, presetDecimals("MONEY"), getActiveNumberFormatConfig());
  return s ? `${s} ${num}` : num;
}

/** Número smart genérico (sin símbolo). */
export function fmtNumberSmart(n: unknown): string {
  const v = toNumLoose(n);
  if (v === null) return "—";
  const cfg = getActiveNumberFormatConfig();
  return Math.abs(v) >= 1
    ? formatFixedLocale(v, 2, cfg)
    : formatFixedLocale(v, 10, cfg, true);
}

/** 2 decimales fijos (region-aware). Equiv. de `fmtNumber2`. */
export function fmtNumber2(n: unknown): string {
  const v = toNumLoose(n);
  if (v === null) return "—";
  return formatFixedLocale(v, 2, getActiveNumberFormatConfig());
}

/** Pureza / Ley: 3 decimales fijos (region-aware). Equiv. de `fmtPurity3`. */
export function fmtPurity3(purity: unknown): string {
  const v = toNumLoose(purity);
  if (v === null) return "—";
  return formatFixedLocale(v, presetDecimals("PURITY"), getActiveNumberFormatConfig());
}

/** Pureza / Ley: 4 decimales fijos (region-aware). Equiv. de `fmtPurity2`. */
export function fmtPurity2(purity: unknown): string {
  const v = toNumLoose(purity);
  if (v === null) return "—";
  return formatFixedLocale(v, 4, getActiveNumberFormatConfig());
}

/**
 * Equivalente config-aware de `fmtMoney` de lib/document-helpers: SIN símbolo
 * por defecto (número pelado), con `currency` opcional separado por espacio,
 * "—" para no-finito. Para superficies scoped que usaban ese helper.
 */
export function formatMoneyDoc(n: number, currency?: string): string {
  if (!Number.isFinite(n)) return "—";
  const num = formatFixedLocale(n, presetDecimals("MONEY"), getActiveNumberFormatConfig());
  return currency ? `${currency} ${num}` : num;
}

/**
 * Equivalente config-aware de `fmtQty` de lib/document-helpers: cantidad con
 * hasta 3 decimales (recorta ceros), "—" para no-finito. Mismo contrato.
 */
export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return formatFixedLocale(n, 3, getActiveNumberFormatConfig(), true);
}

/** Factor multiplicador → "+10%" / "−5%" (region-aware en la parte decimal). */
export function fmtFactor(factor: number): string {
  const pct = Math.round((factor - 1) * 10000) / 100;
  const sign = pct > 0 ? "+" : "";
  const body = pct % 1 === 0
    ? formatFixedLocale(pct, 0, getActiveNumberFormatConfig())
    : formatFixedLocale(pct, 2, getActiveNumberFormatConfig());
  return `${sign}${body}%`;
}

// Re-export para conveniencia del barrel.
export { fmtMoney };
