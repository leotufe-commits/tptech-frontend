// src/lib/number-format/types.ts
// =============================================================================
// Tipos del MOTOR CENTRAL de formato numérico (única fuente de verdad visual).
//
// REGLA DURA: este módulo SOLO formatea/parsea para DISPLAY e INPUT. Nunca
// calcula negocio, nunca redondea para persistir. La DB y el pricing-engine
// siguen usando números puros. Ver POLICY del pricing en el backend.
// =============================================================================

/** Tipos de dato con preset de formato propio. */
export type NumberFormatType =
  | "MONEY"
  | "MONEY_EXTENDED"
  | "QUANTITY"
  | "METAL_GRAMS"
  | "MERMA_PERCENT"
  | "MERMA_GRAMS"
  | "AJUSTE_PERCENT"
  | "AJUSTE_AMOUNT"
  | "PERCENT"
  | "MARGIN_PERCENT"
  | "TAX_PERCENT"
  | "FX_RATE"
  | "PURITY"
  | "WEIGHT"
  | "DIMENSION"
  | "INTEGER";

/** Región preconfigurada. CUSTOM habilita separadores libres. */
export type RegionId = "AR" | "US" | "CUSTOM";

/** Separadores de miles / decimal efectivos. */
export interface LocaleConfig {
  /** "." | "," | " " | "" (vacío = sin agrupar miles). */
  thousands: string;
  /** "," | "." */
  decimal: string;
}

/** Configuración de un preset por tipo de dato. */
export interface PresetConfig {
  /** Cantidad de decimales a mostrar (0–12). */
  decimals: number;
  /** true = oculta ceros finales (1,250 → 1,25). false = decimales fijos. */
  trimTrailingZeros: boolean;
  /** Texto antes del número (ej. símbolo de moneda lo manejan los callers). */
  prefix: string;
  /** Texto después del número (ej. " g", " %", " mm"). */
  suffix: string;
  /** "auto" = solo "−" en negativos. "always" = también "+" en positivos. */
  signDisplay: "auto" | "always";
}

/**
 * Config global por tenant. Persistida en `Jewelry.numberFormat` (JSON).
 * `presets` guarda SOLO overrides del usuario (parcial) — el resto sale de
 * los defaults en `defaults.ts`. Nunca se guardan strings formateados.
 */
export interface NumberFormatConfig {
  region: RegionId;
  /** Solo se usa cuando region === "CUSTOM". */
  custom: LocaleConfig;
  /** Overrides parciales por tipo (hoy la UI edita `decimals`). */
  presets: Partial<Record<NumberFormatType, Partial<PresetConfig>>>;
}
