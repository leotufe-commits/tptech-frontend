// src/lib/number-format/index.ts
// Barrel del motor central de formato numérico. Importar SIEMPRE desde acá.
export type {
  NumberFormatType,
  RegionId,
  LocaleConfig,
  PresetConfig,
  NumberFormatConfig,
} from "./types";
export {
  REGION_LOCALES,
  DEFAULT_CUSTOM_LOCALE,
  DEFAULT_PRESETS,
  DEFAULT_NUMBER_FORMAT_CONFIG,
  PRESET_LABELS,
  PRESET_ORDER,
} from "./defaults";
export {
  getLocaleConfig,
  getNumberFormatConfig,
  normalizeNumberInput,
  parseNumberInput,
  formatNumber,
  formatFixedLocale,
  setActiveNumberFormatConfig,
  getActiveNumberFormatConfig,
  type FormatOptions,
} from "./engine";
