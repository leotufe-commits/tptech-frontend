// src/components/sales/TotalDelComprobanteCard/hooks/useDesgloseOpen.ts
// =============================================================================
// Estado local del sub-toggle "Detalle financiero" del card maestro.
//
// Etapa UX-premium v3:
//   · El detalle financiero (descuentos, canal, base imponible, IVA, envío,
//     redondeo) es información SECUNDARIA — pasa a estar CERRADO por default
//     en cualquier modo (UNIFIED o BREAKDOWN). El operador lo abre solo si
//     quiere auditar.
//   · Los metales (Patrimonio metálico) viven en su propio bloque y siempre
//     son visibles cuando aplican — no dependen de este toggle.
//   · La preferencia es LOCAL del componente (no se persiste en draft/payload).
//
// Se conserva la firma con `mode` para back-compat con el caller, aunque
// ya no se usa para decidir el default. Si en el futuro hace falta una
// regla por modo, queda preparado el plumbing.
// =============================================================================

import { useState } from "react";
import type { BalanceMode } from "../types";

export function useDesgloseOpen(_mode: BalanceMode): {
  open:   boolean;
  toggle: () => void;
  setOpen: (next: boolean) => void;
} {
  // Default cerrado siempre — el detalle financiero es opt-in.
  const [open, setOpen] = useState<boolean>(false);

  return {
    open,
    toggle: () => setOpen((v) => !v),
    setOpen,
  };
}
