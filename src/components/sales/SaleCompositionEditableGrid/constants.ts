// src/components/sales/SaleCompositionEditableGrid/constants.ts
// =============================================================================
// Constantes top-level extraídas del monolito original. Cero lógica.
// =============================================================================

import type { ComponentTypeKey } from "../../../lib/pricing/component-type-colors";

/** Tolerancia numérica para comparaciones de overrides. */
export const EPS = 1e-6;

// ─────────────────────────────────────────────────────────────────────────────
// Layout — tabla compacta. Columnas: badge (24) · componente (1.6fr) ·
// cantidad (90) · unidad (60) · val.unit (95) · merma (75) · ajuste (130) ·
// val.venta (95) · total (105) · acciones (30).
// FASE 12.4 — vista única (sin switch). FASE F23 — columnas redimensionables.
// FASE F24 — Margen se reubica ENTRE "Costo Total" y "Costo de Venta".
// ─────────────────────────────────────────────────────────────────────────────

export const TABLE_COLS_CLS = "grid items-start gap-x-1.5";

/** Configuración de las columnas redimensionables (FASE F23).
 *  Cada entry describe una columna del medio (no icon ni acciones, que
 *  son fijos). El orden DEBE coincidir con el orden visual de la tabla. */
export const RESIZABLE_COLS = [
  { key: "componente",  label: "Componente",     def: 320, min: 220 },
  { key: "cantidad",    label: "Cantidad",       def: 110, min:  90 },
  { key: "unidad",      label: "Unidad",         def: 120, min:  90 },
  // Labels actualizados (UX): el usuario debe entender de un vistazo qué es
  // unitario y qué es total. "Costo unit." pasó a "Valor unitario", los
  // totales se nombran como "Costo total" / "Venta total" para reforzar la
  // distinción. Las `key` NO cambian — el storage de anchos sigue siendo
  // estable y los selectores internos continúan funcionando.
  { key: "costoUnit",   label: "Valor unitario", def: 160, min: 130 },
  { key: "mermaAjuste", label: "Merma / Ajuste", def: 150, min: 130 },
  // FASE F24 — Costo Total antes que Margen, y Margen antes que Costo Venta.
  { key: "costoTotal",  label: "Costo total",    def: 170, min: 140 },
  { key: "margen",      label: "Margen",         def: 150, min: 120 },
  { key: "costoVenta",  label: "Venta total",    def: 170, min: 140 },
] as const;

export const COL_WIDTHS_DEFAULTS = RESIZABLE_COLS.map((c) => c.def);
export const COL_WIDTHS_MINS     = RESIZABLE_COLS.map((c) => c.min);
// FASE F24 — bump a `v2` por reordenar columnas (Margen ↔ Costo Total).
// Persistencias `v1` quedan ignoradas → recae a defaults.
export const COL_WIDTHS_STORAGE  = "tptech.sales.costComposition.columnWidths.v2";

// FASE 12.13 — background muy suave por tipo (≈5% del color semántico) y
// label coloreado: refuerza la identificación visual del grupo sin saturar
// el contraste de las filas editables. Color tomado de la fuente única
// `COMPONENT_TYPE_TEXT` / `COMPONENT_TYPE_BADGE` (no se hardcodean tonos).
export const GROUP_HEADER_BG: Record<ComponentTypeKey, string> = {
  METAL:   "bg-amber-500/[0.06]",
  HECHURA: "bg-blue-500/[0.06]",
  PRODUCT: "bg-violet-500/[0.06]",
  SERVICE: "bg-green-500/[0.06]",
};

export const READ_ONLY_TOOLTIP = "Editar desde la ficha del artículo";
