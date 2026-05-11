// src/components/ui/FactorBreakdownHint.tsx
// ============================================================================
// Fase 4.2 — componente reutilizable para mostrar el desglose visual del
// factor de venta cuando difiere del margen bruto de la lista.
//
// JSX EXTRAÍDO IDÉNTICO al que vivía duplicado en:
//   · PricingSimulator.tsx (6 sitios: bloques "Composición del precio",
//     "Cálculo del precio" y Card "Hechura" expandido).
//   · TPPriceCompositionKpis.tsx (2 sitios: METAL y HECHURA en view="sale").
//
// Contrato:
//   - Recibe `compactLine` y `hasDivergence` desde `buildFactorBreakdown`
//     (helper en `src/lib/pricing-factor-display.ts`).
//   - NO ejecuta lógica: si `hasDivergence === false` o `compactLine == null`,
//     devuelve `null` y no renderiza nada.
//   - Cero matemática nueva, cero formateo nuevo: solo presentación.
//
// Tono visual: ámbar (warning suave) — coherente con el render previo,
// que indica "factor efectivo difiere del bruto debido a ajustes del motor".
// `className` opcional permite a callers override puntual (ej. ajustar
// indentación o margen) sin reescribir el componente.
// ============================================================================

import React from "react";
import { cn } from "./tp";

export type FactorBreakdownHintProps = {
  /** Línea compacta lista para render. Ej. "lista +50% · ajuste −25% · efectivo 1,13".
   *  Producida por `buildFactorBreakdown(...).compactLine`. */
  compactLine?: string | null;
  /** Flag de `buildFactorBreakdown(...).hasDivergence`. Cuando false, el
   *  componente devuelve null (no renderiza nada). */
  hasDivergence?: boolean;
  /** Clases CSS extra opcionales (ej. ajustes de margen/indentación). Se
   *  concatenan a las clases default. */
  className?: string;
};

/**
 * Renderiza el desglose visual del factor cuando difiere del bruto.
 *
 * Devuelve `null` cuando no hay divergencia o cuando `compactLine` es nulo —
 * esto permite usarlo directamente en JSX sin envolver en condicionales:
 *
 * ```tsx
 * <FactorBreakdownHint
 *   hasDivergence={fb.hasDivergence}
 *   compactLine={fb.compactLine}
 * />
 * ```
 */
export default function FactorBreakdownHint({
  compactLine,
  hasDivergence,
  className,
}: FactorBreakdownHintProps): React.ReactElement | null {
  if (!hasDivergence || !compactLine) return null;
  return (
    <div
      className={cn(
        "text-[10px] text-amber-600 dark:text-amber-400 font-mono leading-tight",
        className,
      )}
    >
      ({compactLine})
    </div>
  );
}
