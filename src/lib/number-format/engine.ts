// src/lib/number-format/engine.ts
// =============================================================================
// MOTOR de formato/parseo. Único lugar autorizado a decidir cómo se ven y cómo
// se leen los números. Los componentes NO usan toFixed / Intl / toLocaleString:
// llaman a `formatNumber` / `parseNumberInput` desde acá.
//
// Garantías:
//   · NO altera valores de cálculo: formatNumber recibe un number y devuelve
//     string; parseNumberInput recibe string y devuelve number puro.
//   · Decimal-safe en el redondeo de display (epsilon antes de cortar).
//   · Tolerante en input: acepta coma o punto sin importar la región.
// =============================================================================

import {
  DEFAULT_NUMBER_FORMAT_CONFIG,
  DEFAULT_PRESETS,
  REGION_LOCALES,
} from "./defaults";
import type {
  LocaleConfig,
  NumberFormatConfig,
  NumberFormatType,
  PresetConfig,
} from "./types";

const MINUS = "−"; // − signo menos tipográfico (consistente con la UI)

/** Locale efectivo (separadores) según región o custom. */
export function getLocaleConfig(
  config: NumberFormatConfig = DEFAULT_NUMBER_FORMAT_CONFIG,
): LocaleConfig {
  if (config.region === "CUSTOM") return config.custom;
  return REGION_LOCALES[config.region] ?? REGION_LOCALES.AR;
}

/** Preset resuelto (default + overrides del tenant) para un tipo de dato. */
export function getNumberFormatConfig(
  type: NumberFormatType,
  config: NumberFormatConfig = DEFAULT_NUMBER_FORMAT_CONFIG,
): PresetConfig {
  const base = DEFAULT_PRESETS[type];
  const override = config.presets?.[type];
  if (!override) return base;
  return {
    decimals:
      typeof override.decimals === "number"
        ? Math.max(0, Math.min(12, Math.floor(override.decimals)))
        : base.decimals,
    trimTrailingZeros:
      typeof override.trimTrailingZeros === "boolean"
        ? override.trimTrailingZeros
        : base.trimTrailingZeros,
    prefix: override.prefix ?? base.prefix,
    suffix: override.suffix ?? base.suffix,
    signDisplay: override.signDisplay ?? base.signDisplay,
  };
}

/**
 * Normaliza una entrada de usuario a string con punto decimal y sin miles.
 * Acepta coma O punto en cualquier región (requisito del spec). Cuando hay
 * ambos separadores, el ÚLTIMO es el decimal (15.000,25 → "15000.25" y
 * 15,000.25 → "15000.25"). No redondea ni recorta: preserva la precisión que
 * tipeó el usuario mientras edita.
 */
export function normalizeNumberInput(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : "";

  const s = String(raw).trim();
  if (!s) return "";

  const neg = /^-/.test(s) || s.includes(MINUS);
  const compact = s.replace(/\s/g, "").replace(/[−-]/g, "");

  const hasComma = compact.includes(",");
  const hasDot = compact.includes(".");

  let body: string;
  if (hasComma && hasDot) {
    body =
      compact.lastIndexOf(",") > compact.lastIndexOf(".")
        ? compact.replace(/\./g, "").replace(",", ".") // 15.000,25
        : compact.replace(/,/g, ""); //                   15,000.25
  } else if (hasComma) {
    body = compact.replace(",", "."); // 15000,25 → 15000.25
  } else {
    body = compact; // ya tiene punto o es entero
  }

  body = body.replace(/[^\d.]/g, "");
  if (body === "" || body === ".") return "";
  return (neg ? "-" : "") + body;
}

/**
 * Parsea entrada de usuario → number puro (o null si vacío/ inválido).
 * Es lo que se manda a onChange / cálculo. Nunca devuelve string.
 */
export function parseNumberInput(
  raw: unknown,
  _config: NumberFormatConfig = DEFAULT_NUMBER_FORMAT_CONFIG,
): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const norm = normalizeNumberInput(raw);
  if (norm === "" || norm === "-") return null;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** Redondeo decimal-safe (half away from zero) sin drift de float. */
function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const p = 10 ** decimals;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * p)) / p;
}

/** Inserta el separador de miles cada 3 dígitos en la parte entera. */
function groupThousands(intDigits: string, sep: string): string {
  if (!sep) return intDigits;
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Núcleo de formato: redondea (decimal-safe), agrupa miles y aplica los
 * separadores de la región. NO agrega prefijo/sufijo ni fuerza signo "+".
 * El signo negativo se muestra como "−". Reutilizado por `formatNumber` y por
 * los helpers centrales (lib/pricing/format.ts) → única fuente de verdad.
 */
export function formatFixedLocale(
  value: number,
  decimals: number,
  config: NumberFormatConfig = DEFAULT_NUMBER_FORMAT_CONFIG,
  trimTrailingZeros = false,
): string {
  if (!Number.isFinite(value)) return "";
  const locale = getLocaleConfig(config);
  const d = Math.max(0, Math.min(12, Math.floor(decimals)));
  const rounded = roundTo(value, d);
  const isNeg = rounded < 0 && Math.abs(rounded) >= Number.EPSILON;

  const digits = Math.abs(rounded).toFixed(d);
  let intPart = digits;
  let fracPart = "";
  const dot = digits.indexOf(".");
  if (dot >= 0) {
    intPart = digits.slice(0, dot);
    fracPart = digits.slice(dot + 1);
  }
  if (trimTrailingZeros && fracPart) fracPart = fracPart.replace(/0+$/, "");

  let body = groupThousands(intPart, locale.thousands);
  if (fracPart) body += locale.decimal + fracPart;
  return (isNeg ? MINUS : "") + body;
}

// ── Config activa en runtime ────────────────────────────────────────────────
// Puente entre el Context (React) y los helpers PUROS (lib/*) que no pueden
// usar hooks. `NumberFormatProvider` la actualiza; los helpers la leen. Es la
// pieza que hace que TODA la app respete la config sin tocar cada call-site.
let _activeConfig: NumberFormatConfig = DEFAULT_NUMBER_FORMAT_CONFIG;

export function setActiveNumberFormatConfig(c: NumberFormatConfig | null | undefined): void {
  _activeConfig = c ?? DEFAULT_NUMBER_FORMAT_CONFIG;
}

export function getActiveNumberFormatConfig(): NumberFormatConfig {
  return _activeConfig;
}

export interface FormatOptions {
  /** Texto a devolver si el valor es null/undefined/NaN. Default "—". */
  blank?: string;
  /** Fuerza ocultar prefijo/sufijo (ej. dentro de un input editable). */
  bare?: boolean;
}

/**
 * Formatea un número para DISPLAY según el preset del tipo y la región.
 * No muta nada; solo produce el string visible.
 */
export function formatNumber(
  value: number | string | null | undefined,
  type: NumberFormatType,
  config: NumberFormatConfig = DEFAULT_NUMBER_FORMAT_CONFIG,
  options: FormatOptions = {},
): string {
  const blank = options.blank ?? "—";

  let n: number | null;
  if (typeof value === "number") n = Number.isFinite(value) ? value : null;
  else if (typeof value === "string") n = parseNumberInput(value, config);
  else n = null;
  if (n === null) return blank;

  const preset = getNumberFormatConfig(type, config);
  const locale = getLocaleConfig(config);

  const rounded = roundTo(n, preset.decimals);
  const isNeg = rounded < 0 && Math.abs(rounded) >= Number.EPSILON;

  // toFixed acá es legítimo: ESTE es el único lugar central de formato.
  let digits = Math.abs(rounded).toFixed(preset.decimals);

  let intPart = digits;
  let fracPart = "";
  const dotIdx = digits.indexOf(".");
  if (dotIdx >= 0) {
    intPart = digits.slice(0, dotIdx);
    fracPart = digits.slice(dotIdx + 1);
  }

  if (preset.trimTrailingZeros && fracPart) {
    fracPart = fracPart.replace(/0+$/, "");
  }

  let body = groupThousands(intPart, locale.thousands);
  if (fracPart) body += locale.decimal + fracPart;

  let sign = "";
  if (isNeg) sign = MINUS;
  else if (preset.signDisplay === "always" && rounded !== 0) sign = "+";

  if (options.bare) return sign + body;
  return preset.prefix + sign + body + preset.suffix;
}
