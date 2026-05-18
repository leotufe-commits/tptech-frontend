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
import { formatFixedLocale, getActiveNumberFormatConfig } from "../number-format";

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
  return sym + formatFixedLocale(n, 2, getActiveNumberFormatConfig());
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

// Re-export para conveniencia del barrel.
export { fmtMoney };
