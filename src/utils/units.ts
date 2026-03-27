// src/utils/units.ts
// Conversión de unidades para el motor de etiquetas.
// Regla: px = (mm × dpi) / 25.4
// 96 dpi = pantalla estándar HTML/CSS. 203 dpi = impresoras térmicas típicas.

export const SCREEN_DPI = 96;

export function mmToPx(mm: number, dpi = SCREEN_DPI): number {
  return (mm * dpi) / 25.4;
}

export function pxToMm(px: number, dpi = SCREEN_DPI): number {
  return (px * 25.4) / dpi;
}
