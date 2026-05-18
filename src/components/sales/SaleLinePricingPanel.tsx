// src/components/sales/SaleLinePricingPanel.tsx
// ============================================================================
// Panel de pricing para UNA línea de Factura (modo compact).
//
// Renderiza, expandible:
//   - <CostCompositionBlock variant="compact" detailMode="UNIFICADO">
//   - <PricingStepsBreakdown variant="compact">
//
// Reglas:
//   - Read-only — solo muestra; no edita.
//   - LAZY: si no está expandido, NO se renderizan los hijos y NO se ejecuta
//     el adapter (clave para performance en docs con muchas líneas).
//   - MEMOIZA: el output del adapter `saleSnapshotToNormalized` vive en
//     useMemo([pricingMeta]) — solo recalcula cuando la línea cambia.
//   - Adapters PUROS: cero matemática nueva (POLICY R6).
// ============================================================================

import React, { useMemo, useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../ui/tp";
import { CostCompositionBlock } from "../pricing";
import { PricingStepsBreakdown } from "../pricing";
import { PriceCompositionCards } from "../pricing";
import { saleSnapshotToNormalized } from "../../lib/pricing/adapters/saleSnapshotToNormalized";
import { vt } from "../../lib/pricing/visualTokens";
import type { SalePreviewLine } from "../../services/sales";

export type SaleLinePricingPanelProps = {
  /** Pricing metadata hidratada en la línea — passthrough del backend.
   *  Cuando es null/undefined, el panel no renderiza nada (degradación). */
  pricingMeta: SalePreviewLine | null | undefined;

  /** Cantidad de la línea (de la línea de factura, no del pricingMeta). */
  quantity?: number;

  /** Símbolo de moneda para mostrar. Default "$". */
  currencySymbol?: string;

  /** Tasa de conversión de display. Default 1. */
  displayRate?: number;

  /** Estado de expansión controlado por el padre (Set/Map de IDs).
   *  Cuando true, los hijos se renderizan; cuando false, retorna null body. */
  expanded?: boolean;

  /** Callback cuando el usuario toca el header del panel. */
  onToggle?: () => void;

  /** Si true, no muestra el header colapsable propio — solo el contenido.
   *  Útil cuando el padre ya provee su propio toggle (ej: TPRowExpansion). */
  hideHeader?: boolean;

  /** Estado inicial cuando NO es controlado por el padre. Default false.
   *  En Factura conviene `true`: al expandir la línea, el vendedor ya ve el
   *  detalle sin clic adicional. */
  defaultExpanded?: boolean;
};

/**
 * Componente NO controla su propio estado por default — espera que el padre
 * (VentasFacturas / TPDocumentLineAdvancedEditor) maneje qué líneas están
 * expandidas. Si `expanded` se omite, mantiene estado local (útil para
 * standalone).
 */
export function SaleLinePricingPanel(props: SaleLinePricingPanelProps): React.ReactElement | null {
  const {
    pricingMeta,
    quantity = 1,
    currencySymbol = "$",
    displayRate = 1,
    expanded: expandedProp,
    onToggle,
    hideHeader = false,
    defaultExpanded = false,
  } = props;

  // Estado local de fallback cuando el padre no controla expansión.
  const [localExpanded, setLocalExpanded] = useState<boolean>(defaultExpanded);
  const expanded = expandedProp ?? localExpanded;
  const handleToggle = useCallback(() => {
    if (onToggle) { onToggle(); return; }
    setLocalExpanded(prev => !prev);
  }, [onToggle]);

  const display = useMemo(
    () => ({ rate: displayRate, symbol: currencySymbol }),
    [displayRate, currencySymbol],
  );

  // ── LAZY: el adapter NO corre si el panel está colapsado ────────────────
  // Esto es crítico para docs con muchas líneas: solo las expandidas pagan
  // el costo del mapeo. La normalización es O(n_steps_sintéticos) pero
  // mejor evitarla cuando no se ve.
  const adapted = useMemo(() => {
    if (!expanded || !pricingMeta) return null;
    return saleSnapshotToNormalized(pricingMeta);
  }, [expanded, pricingMeta]);

  if (!pricingMeta) return null;

  // ── Header colapsable opcional ──────────────────────────────────────────
  // FASE 10.1 — QW5: header un punto más sutil (labelSoft en vez de label) y
  // padding vertical más ajustado (py-1 vs py-1.5). El bloque debe sentirse
  // "auditoría avanzada", no parte del flujo principal.
  const header = !hideHeader ? (
    <button
      type="button"
      onClick={handleToggle}
      className={cn("w-full flex items-center justify-between gap-2 px-3 py-1 hover:text-text transition-colors",
        vt.text.cardTitle, vt.colors.labelSoft)}
    >
      <span>Ver composición y flujo de precio</span>
      <ChevronDown size={14} className={cn(vt.colors.formula, "transition-transform", expanded && "rotate-180")} />
    </button>
  ) : null;

  return (
    <div className="w-full">
      {header}
      {expanded && adapted && (
        // FASE 10.1 — QW3: gaps más ajustados entre los 3 bloques internos.
        // De space-y-3 pt-2 → space-y-2 pt-1.5.
        <div className="space-y-2 pt-1.5">
          {/* Composición del costo del artículo (read-only desde snapshot v6) */}
          <CostCompositionBlock
            steps={adapted.steps}
            line={adapted.line}
            display={display}
            variant="compact"
            detailMode="UNIFICADO"
          />
          {/* Flujo de construcción del precio (read-only desde snapshot v6 +
              steps sintéticos del adapter). En compact arranca expandido. */}
          <PricingStepsBreakdown
            steps={adapted.steps}
            line={adapted.line}
            result={null}
            quantity={quantity}
            display={display}
            variant="compact"
            whatIfActive={false}
          />
          {/* FASE 8.1 — Cards de composición del precio (Metal + Hechura).
              variant="compact" → grid 1-col + padding reducido para no saturar
              el modal de Factura. result={null} → el cierre del producto
              (cupón/canal/pago/envío) no se muestra acá (eso vive en el hero
              de totales del documento). Cada card arranca colapsado; el
              vendedor expande la que le interese. */}
          <PriceCompositionCards
            steps={adapted.steps}
            line={adapted.line}
            result={null}
            quantity={quantity}
            display={display}
            variant="compact"
            whatIfActive={false}
          />
        </div>
      )}
    </div>
  );
}

export default SaleLinePricingPanel;
