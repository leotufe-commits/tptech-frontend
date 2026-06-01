// src/components/sales/SaleCompositionEditableGrid/parts/EmptyState.tsx
// =============================================================================
// Placeholder cuando no hay componentes para editar.
// Extraído sin cambios — el wrapper visual y el copy permanecen idénticos.
// =============================================================================

import type { ReactElement } from "react";

export function EmptyState(): ReactElement {
  return (
    <div className="rounded-md border border-dashed border-border/50 bg-card/40 px-3 py-6 text-center text-[11px] italic text-muted/70">
      Sin componentes para editar.
    </div>
  );
}
