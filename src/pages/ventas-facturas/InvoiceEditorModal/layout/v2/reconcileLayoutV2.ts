// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/reconcileLayoutV2.ts
//
// Alias de compatibilidad — re-exporta `reconcileLayout` desde la
// ubicacion historica `layout/v2/`. El nombre V2 viene del stash; el
// modulo canonico vive en `../reconcileLayout.ts`.
import { reconcileLayout } from "../reconcileLayout";
import type { LayoutV2Config } from "./types";
import { DEFAULT_LAYOUT_V2 } from "./defaults";

export { reconcileLayout };
export { reconcileLayout as reconcileLayoutAny };

/**
 * Variante "legacy" — un solo argumento. El stash original definia
 * `reconcileLayoutV2(raw)` sin segundo parametro (el preset estaba
 * embebido en `raw.presetBase`). Esta firma se conserva para que los
 * archivos legacy del stash (`presets.ts`, etc.) compilen. Internamente
 * delega al `reconcileLayout` canonico con `"COMPACT"` como fallback
 * (alineado con el default de producto del modal de Factura).
 */
export function reconcileLayoutV2(raw: unknown): LayoutV2Config {
  const reconciled = reconcileLayout(raw, "COMPACT");
  return {
    ...DEFAULT_LAYOUT_V2,
    version:    DEFAULT_LAYOUT_V2.version,
    presetBase: DEFAULT_LAYOUT_V2.presetBase,
    grid:       DEFAULT_LAYOUT_V2.grid,
    cards:      reconciled.cards as any,
  };
}
