// src/components/sales/TotalDelComprobanteCard/parts/BalanceModeInline.tsx
// =============================================================================
// Etapa B — Wrapper inline del selector de Balance Mode.
//
// Reusa `TPBalanceModeSelector` (sin reescribirlo) y lo integra como pieza
// del header del card maestro. La integración es solo visual: ajustamos
// className para que se vea limpio dentro del header en vez de flotando.
// =============================================================================

import type { ReactElement } from "react";
import { TPBalanceModeSelector } from "../../TPBalanceModeSelector";
import type { BalanceMode } from "../types";

export interface BalanceModeInlineProps {
  effectiveMode?: BalanceMode;
  source?:        string;
  override?:      BalanceMode | null;
  disabled?:      boolean;
  onChange:       (next: BalanceMode | null) => void;
}

export function BalanceModeInline({
  effectiveMode,
  source,
  override,
  disabled,
  onChange,
}: BalanceModeInlineProps): ReactElement | null {
  if (!effectiveMode) return null;
  return (
    <TPBalanceModeSelector
      effectiveMode={effectiveMode}
      source={source}
      override={override ?? null}
      disabled={disabled}
      onOverrideChange={onChange}
    />
  );
}

export default BalanceModeInline;
