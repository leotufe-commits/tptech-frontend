// src/lib/pricing/component-type-colors.ts
// =============================================================================
// FASE F1.3 G4.x #10-D — fuente única de verdad de colores semánticos por
// tipo de componente.
//
// Reemplaza maps duplicados que vivían en:
//   · `src/pages/article-detail/CostRow.tsx`  (Composición de costo del artículo)
//   · `src/components/ui/LineAdvancedOverridesPanel.tsx`  (Composición del precio de venta)
//   · futuros consumers (Simulador, Comparador, etc.)
//
// Mapeo aprobado por el usuario (consistencia visual cross-TPTech):
//   · METAL    → amber
//   · HECHURA  → blue
//   · PRODUCT  → violet
//   · SERVICE  → green
//
// Tailwind tokens explícitos (no se usa CSS-vars porque las clases con
// `/N` opacity necesitan escapar al JIT — Tailwind requiere literal strings
// en el código). Cualquier cambio de tonalidad debe hacerse acá y propaga
// automáticamente a todos los consumers.
// =============================================================================

export type ComponentTypeKey = "METAL" | "HECHURA" | "PRODUCT" | "SERVICE";

/** Tono semántico Tailwind por componente — base de todas las variantes. */
export const COMPONENT_TYPE_TONE: Record<ComponentTypeKey, string> = {
  METAL:   "amber",
  HECHURA: "blue",
  PRODUCT: "violet",
  SERVICE: "green",
};

/**
 * Chip/badge "pill" — fondo suave con texto coloreado.
 * Uso típico: `<span className={componentTypeChip("METAL")}>Metal</span>`.
 */
export const COMPONENT_TYPE_CHIP_CLS: Record<ComponentTypeKey, string> = {
  METAL:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  HECHURA: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PRODUCT: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  SERVICE: "bg-green-500/15 text-green-600 dark:text-green-400",
};

/** Background row — sutil con hover. Usado en filas editables y accordions. */
export const COMPONENT_TYPE_ROW_BG: Record<ComponentTypeKey, string> = {
  METAL:   "bg-amber-500/5  hover:bg-amber-500/10",
  HECHURA: "bg-blue-500/5   hover:bg-blue-500/10",
  PRODUCT: "bg-violet-500/5 hover:bg-violet-500/10",
  SERVICE: "bg-green-500/5  hover:bg-green-500/10",
};

/** Border-left coloreado (cinta de identificación lateral en filas). */
export const COMPONENT_TYPE_BORDER_LEFT: Record<ComponentTypeKey, string> = {
  METAL:   "border-l-amber-400/60",
  HECHURA: "border-l-blue-400/60",
  PRODUCT: "border-l-violet-400/60",
  SERVICE: "border-l-green-400/60",
};

/** Color de texto/icono únicamente — para subtotales, iconos sueltos, etc. */
export const COMPONENT_TYPE_TEXT: Record<ComponentTypeKey, string> = {
  METAL:   "text-amber-600 dark:text-amber-400",
  HECHURA: "text-blue-600 dark:text-blue-400",
  PRODUCT: "text-violet-600 dark:text-violet-400",
  SERVICE: "text-green-600 dark:text-green-400",
};

/**
 * Combinación icon+ring+bg para badges cuadrados (ERP financiero).
 * Usado en el header del accordion de la Factura
 * (`LineAdvancedOverridesPanel`).
 */
export type ComponentTypeBadgeClasses = {
  /** Color del SVG del ícono. */
  icon: string;
  /** Ring del badge (1px ring tinted). */
  ring: string;
  /** Background del badge (10% del color base). */
  bg:   string;
};

export const COMPONENT_TYPE_BADGE: Record<ComponentTypeKey, ComponentTypeBadgeClasses> = {
  METAL:   {
    icon: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
    bg:   "bg-amber-500/10",
  },
  HECHURA: {
    icon: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/20",
    bg:   "bg-blue-500/10",
  },
  PRODUCT: {
    icon: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/20",
    bg:   "bg-violet-500/10",
  },
  SERVICE: {
    icon: "text-green-600 dark:text-green-400",
    ring: "ring-green-500/20",
    bg:   "bg-green-500/10",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers funcionales (azúcar para casos comunes)
// ─────────────────────────────────────────────────────────────────────────────

export function componentTypeChip(key: ComponentTypeKey): string {
  return COMPONENT_TYPE_CHIP_CLS[key];
}

export function componentTypeRowBg(key: ComponentTypeKey): string {
  return COMPONENT_TYPE_ROW_BG[key];
}

export function componentTypeBorderLeft(key: ComponentTypeKey): string {
  return COMPONENT_TYPE_BORDER_LEFT[key];
}

export function componentTypeText(key: ComponentTypeKey): string {
  return COMPONENT_TYPE_TEXT[key];
}

export function componentTypeBadge(key: ComponentTypeKey): ComponentTypeBadgeClasses {
  return COMPONENT_TYPE_BADGE[key];
}
