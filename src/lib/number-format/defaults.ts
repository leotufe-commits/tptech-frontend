// src/lib/number-format/defaults.ts
// =============================================================================
// Defaults del motor de formato. Cambiar acá = cambiar el comportamiento por
// defecto de TODO el sistema (los overrides del tenant se mergean encima).
// =============================================================================

import type {
  LocaleConfig,
  NumberFormatConfig,
  NumberFormatType,
  PresetConfig,
  RegionId,
} from "./types";

/** Separadores por región preconfigurada. */
export const REGION_LOCALES: Record<Exclude<RegionId, "CUSTOM">, LocaleConfig> = {
  // Español / Argentina → 1.000,00
  AR: { thousands: ".", decimal: "," },
  // Inglés / USA → 1,000.00
  US: { thousands: ",", decimal: "." },
};

/** Locale por defecto para CUSTOM (arranca como AR hasta que el usuario lo cambie). */
export const DEFAULT_CUSTOM_LOCALE: LocaleConfig = { thousands: ".", decimal: "," };

/**
 * Preset por defecto de cada tipo. `prefix` queda vacío para MONEY/AJUSTE_AMOUNT
 * a propósito: el símbolo de moneda es dinámico (depende del documento) y lo
 * anteponen los callers, no el preset. Los ejemplos "AR$ 1.250,00" del spec
 * ilustran el resultado final (símbolo + número), no el prefix del preset.
 */
export const DEFAULT_PRESETS: Record<NumberFormatType, PresetConfig> = {
  MONEY:          { decimals: 2, trimTrailingZeros: false, prefix: "", suffix: "",   signDisplay: "auto" },
  MONEY_EXTENDED: { decimals: 4, trimTrailingZeros: false, prefix: "", suffix: "",   signDisplay: "auto" },
  QUANTITY:       { decimals: 2, trimTrailingZeros: false, prefix: "", suffix: "",   signDisplay: "auto" },
  METAL_GRAMS:    { decimals: 3, trimTrailingZeros: false, prefix: "", suffix: " g", signDisplay: "auto" },
  MERMA_PERCENT:  { decimals: 2, trimTrailingZeros: false, prefix: "", suffix: " %", signDisplay: "auto" },
  MERMA_GRAMS:    { decimals: 3, trimTrailingZeros: false, prefix: "", suffix: " g", signDisplay: "auto" },
  AJUSTE_PERCENT: { decimals: 2, trimTrailingZeros: false, prefix: "", suffix: " %", signDisplay: "always" },
  AJUSTE_AMOUNT:  { decimals: 2, trimTrailingZeros: false, prefix: "", suffix: "",   signDisplay: "always" },
  PERCENT:        { decimals: 2, trimTrailingZeros: false, prefix: "", suffix: " %", signDisplay: "auto" },
  MARGIN_PERCENT: { decimals: 2, trimTrailingZeros: false, prefix: "", suffix: " %", signDisplay: "auto" },
  TAX_PERCENT:    { decimals: 2, trimTrailingZeros: false, prefix: "", suffix: " %", signDisplay: "auto" },
  FX_RATE:        { decimals: 6, trimTrailingZeros: false, prefix: "", suffix: "",   signDisplay: "auto" },
  PURITY:         { decimals: 3, trimTrailingZeros: false, prefix: "", suffix: "",   signDisplay: "auto" },
  WEIGHT:         { decimals: 3, trimTrailingZeros: false, prefix: "", suffix: " g", signDisplay: "auto" },
  DIMENSION:      { decimals: 2, trimTrailingZeros: false, prefix: "", suffix: " mm", signDisplay: "auto" },
  INTEGER:        { decimals: 0, trimTrailingZeros: false, prefix: "", suffix: "",   signDisplay: "auto" },
};

/** Config inicial de un tenant que nunca tocó la pantalla (Argentina). */
export const DEFAULT_NUMBER_FORMAT_CONFIG: NumberFormatConfig = {
  region: "AR",
  custom: DEFAULT_CUSTOM_LOCALE,
  presets: {},
};

/** Orden y etiquetas para la UI de configuración. */
export const PRESET_LABELS: Record<NumberFormatType, string> = {
  MONEY:          "Dinero",
  MONEY_EXTENDED: "Dinero (extendido)",
  QUANTITY:       "Cantidad",
  METAL_GRAMS:    "Gramos de metal",
  MERMA_PERCENT:  "Merma (%)",
  MERMA_GRAMS:    "Merma (gramos)",
  AJUSTE_PERCENT: "Ajuste (%)",
  AJUSTE_AMOUNT:  "Ajuste (monto)",
  PERCENT:        "Porcentaje",
  MARGIN_PERCENT: "Margen (%)",
  TAX_PERCENT:    "Impuesto (%)",
  FX_RATE:        "Tipo de cambio",
  PURITY:         "Pureza",
  WEIGHT:         "Peso",
  DIMENSION:      "Dimensión",
  INTEGER:        "Entero",
};

export const PRESET_ORDER: NumberFormatType[] = [
  "MONEY", "MONEY_EXTENDED", "AJUSTE_AMOUNT",
  "QUANTITY", "INTEGER",
  "PERCENT", "MARGIN_PERCENT", "TAX_PERCENT", "AJUSTE_PERCENT", "MERMA_PERCENT",
  "METAL_GRAMS", "MERMA_GRAMS", "WEIGHT", "PURITY", "DIMENSION",
  "FX_RATE",
];
