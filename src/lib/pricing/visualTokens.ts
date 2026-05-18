// src/lib/pricing/visualTokens.ts
// ============================================================================
// Tokens visuales del dominio pricing (Factura, Simulador, Comparador).
//
// REGLA DE ORO: estos tokens son SOLO strings de Tailwind. NO introducen
// matemática, NO definen lógica, NO traen estilos nuevos — consolidan los
// patrones que ya existían dispersos en `parts/*.tsx`.
//
// Origen del audit: FASE 6 — auditoría exhaustiva detectó drifts MEDIO/ALTO
// en colores muted/X, tamaños del total final, y separators (border-border/X).
// Estos tokens fijan la VARIANTE DOMINANTE encontrada y eliminan las
// desviaciones.
//
// Cómo usar:
//   import { vt } from "../../../lib/pricing/visualTokens";
//   <span className={vt.amount.discount}>−$100,00</span>
//   <div className={vt.row.separator}>...</div>
//
// Reglas para mantener:
//   - Si necesitás un patrón nuevo → primero agregalo acá, NO inline.
//   - Si encontrás drift en un sub-componente → reemplazalo por el token.
//   - Cambios en tokens afectan los 3 consumidores (Factura/Simulador/Comparador)
//     en simultáneo — esto es deseable, así garantiza paridad visual.
// ============================================================================

// ─── COLORES SEMÁNTICOS ────────────────────────────────────────────────────

export const colors = {
  /** Descuentos (cliente, qty, promo, cupón). Texto en rojo. */
  discount:        "text-red-500 dark:text-red-400",
  /** Recargo aplicado por el motor (positivo). Texto en amber. */
  surcharge:       "text-amber-600 dark:text-amber-400",
  /** Bonificación aplicada por el motor (negativo en magnitud). Texto en emerald. */
  bonus:           "text-emerald-600 dark:text-emerald-400",
  /** Ajuste de redondeo positivo (sumamos al precio). Solo se usa en el
   *  banner informativo de "Redondeo por artículo / lista". */
  roundingPositive: "text-emerald-500",
  /** Ajuste de redondeo negativo (restamos al precio). */
  roundingNegative: "text-amber-500",

  /** Color de label estándar (campos descriptivos: "Total producto", "Subtotal", etc.). */
  label:           "text-muted",
  /** Color de label más sutil (nombre de impuestos, sub-categorías). */
  labelSoft:       "text-muted/70",

  /** Texto auxiliar / fórmula en una fila (ej: "Base: $X × Y%"). */
  formula:         "text-muted/60",
  /** Texto auxiliar más sutil (anotaciones de baja prioridad). */
  formulaFaint:    "text-muted/45",

  /** Subtotal interno en cards (Hechura, MetalEquiv) — texto principal del subtotal. */
  subtotal:        "text-foreground/70",
  /** Subtotal "fuerte" — totales destacados en cards de cierre. */
  subtotalStrong:  "text-foreground/80",

  /** Texto principal — totales generales y header de cards. */
  text:            "text-text",
  /** Acento primary para "Total a pagar" y elementos de máxima jerarquía. */
  primary:         "text-primary",
  /** Texto sobre superficies muteadas (ej: nombre del metal padre en card). */
  cardName:        "text-foreground/60",
} as const;

// ─── TIPOGRAFÍA ────────────────────────────────────────────────────────────

export const text = {
  /** Total final más fuerte de toda la pantalla ("Total a pagar" en Factura/Simulador).
   *  Usar SOLO una vez por bloque. */
  totalGrand:    "text-base font-extrabold tabular-nums",
  /** Total intermedio destacado ("Total con pago", "Precio ajustado"). */
  total:         "text-[15px] font-bold tabular-nums",
  /** Total de cierre de un card (ej: "Total costo", "Total producto"). */
  totalCard:     "text-sm font-bold tabular-nums",
  /** Subtotal interno en cards (Subtotal, Subtotal hechura, etc.). */
  subtotalRow:   "text-xs font-bold tabular-nums",
  /** Monto por fila de detalle (líneas de hechura, descuentos, recargos). */
  rowAmount:     "text-[11px] font-bold tabular-nums",
  /** Monto pequeño (impuestos, ajustes finos). */
  rowAmountFine: "text-xs tabular-nums",

  /** Label estándar de fila ("Subtotal", "Total"). */
  label:         "text-xs",
  /** Label de subtítulo ("Origen", grupos). */
  subLabel:      "text-[11px]",
  /** Etiqueta de grupo en mayúsculas ("Metales", "Hechura / Otros"). */
  groupLabel:    "text-[9px] font-semibold uppercase tracking-widest",
  /** Título de card ("Costo unitario", "Cálculo del precio"). */
  cardTitle:     "text-[11px] font-semibold uppercase tracking-wider",
  /** Nombre grande de un componente en card (ej: "Oro", "Hechura"). */
  cardName:      "text-base font-bold uppercase tracking-wider leading-none",

  /** Fórmula auxiliar inline ("$X × Y% = $Z"). Mono + tabular. */
  formula:       "text-[10px] font-mono tabular-nums leading-snug",
  /** Fórmula compacta dentro de cards (gramos × precio/gr). */
  formulaCompact: "text-[11px] font-mono tabular-nums leading-tight",
  /** Anotación muy fina (merma, factor de pureza). */
  hint:          "text-[9px] font-mono",

  // ── Tri-vista de línea de costo (base / merma-ajuste / total) ──
  // Compartidos por CostCompositionBlock y SaleCompositionEditableGrid para
  // que Simulador y Factura muestren la MISMA jerarquía visual.
  /** Costo unit. — valor base unitario (dato principal de la columna 1). */
  baseUnit:      "text-[11px] font-bold tabular-nums",
  /** Costo unit. — sub-línea equivalente ("≈ AR$ … / unidad"). */
  baseEquiv:     "text-[9px] italic leading-tight tabular-nums",
  /** Merma/Ajuste — nivel A: valor INGRESADO (dato principal de la columna 2). */
  adjInput:      "text-[11px] font-semibold tabular-nums leading-tight",
  /** Merma/Ajuste — nivel B: impacto monetario calculado (secundario). */
  adjImpact:     "text-[10px] tabular-nums leading-tight",
} as const;

// ─── SPACING / SEPARATORS ──────────────────────────────────────────────────

export const row = {
  /** Separator de fila default (entre líneas de un mismo grupo). */
  separator:       "border-t border-border/30 pt-1.5 mt-0.5",
  /** Separator tenue (sub-divisores dentro de un card). */
  separatorTenue:  "border-t border-border/20 pt-1.5",
  /** Separator fuerte (cierre de bloque, "Total costo"). */
  separatorStrong: "border-t border-border/40 pt-2 mt-1.5",
  /** Separator de cierre adicional. */
  separatorCierre: "border-t border-border/30 pt-1 mt-0.5",

  /** Fila base flex con label izquierda / monto derecha. */
  flexBetween:     "flex justify-between items-baseline gap-2",
  /** Fila flex centered (totales con borde). */
  flexCenter:      "flex justify-between items-center gap-2",
} as const;

// ─── CARDS Y SURFACES ──────────────────────────────────────────────────────

export const card = {
  /** Card principal (outer wrapper). */
  outer:    "rounded-xl border border-border bg-card px-4 py-3",
  /** Card interna (MetalEquiv, HechuraEquiv). */
  inner:    "rounded-lg border border-border/40 bg-muted/15 px-4 py-3 space-y-2 shadow-sm",
  /** Banner informativo (Redondeo por lista, alerts). */
  info:     "rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 space-y-1",
  /** Pill destacada para subtotales internos. */
  pill:     "bg-muted/20 px-2 py-1 rounded",
  /** Total destacado (Total a pagar) — superficie fuerte. */
  totalAccent: "bg-primary/5 border-t-2 border-primary/20 px-2 py-1 rounded mt-1",
} as const;

// ─── BARREL ────────────────────────────────────────────────────────────────

/**
 * Barrel namespaced — usar como `vt.colors.discount`, `vt.text.total`, etc.
 *
 * Preferir esta forma sobre destructuring para que el código sea grep-able
 * y los reviews vean fácil cuál es el rol semántico de cada className.
 */
export const vt = { colors, text, row, card } as const;

export type VisualTokens = typeof vt;
