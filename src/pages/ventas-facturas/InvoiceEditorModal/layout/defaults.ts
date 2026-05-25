// src/pages/ventas-facturas/InvoiceEditorModal/layout/defaults.ts
// ============================================================================
// DEFAULT_LAYOUT — distribución base de las cards del modal de Factura:
//
//   ┌──────────────────────────────────────────────────────┐
//   │ Header (InvoiceHeaderForm)                            │  ← slot: "top"
//   ├──────────────────────────────────────┬────────────────┤
//   │ Líneas (LinesEditorSection)          │ Descuento glob │
//   │                                       │ Envío          │
//   │      ← slot: "main"                   │ Cupón          │  ← slot: "aside"
//   │                                       │ Totales (Hero) │
//   │                                       │ Cobros         │
//   │                                       │ Impacto cta cte│
//   │                                       │ Observaciones  │
//   └──────────────────────────────────────┴────────────────┘
//
// Cuando el operador NO tiene preferencia guardada (o la persistida es
// inválida), el render usa este default. Observaciones forma parte del
// aside para participar del sistema drag/resize/persistencia igual que
// los demás cards (antes vivía hardcoded en `slot: "bottom"`, lo que la
// dejaba fuera del sistema configurable).
//
// IMPORTANTE: el orden de cada slot importa. Cambiarlo cambia la pantalla.
// Cualquier card nueva se agrega al final de su slot para preservar el orden
// percibido por usuarios existentes.
// ============================================================================

import type { LayoutConfig } from "./types";
import { CURRENT_LAYOUT_VERSION } from "./types";

export const DEFAULT_LAYOUT: LayoutConfig = {
  version: CURRENT_LAYOUT_VERSION,
  cards: [
    // Slot superior — solo el header del comprobante.
    { id: "header",       slot: "top",    order: 0, width: "full" },

    // Slot principal — editor de líneas (ocupa todo el ancho de su columna).
    { id: "lines",        slot: "main",   order: 0, width: "full" },

    // Slot aside — orden HOY:
    //   discount → shipping → coupon → totals → payments → account-impact
    //   → observations.
    // Observaciones se integra al aside (era slot="bottom") para participar
    // del sistema drag/resize/persistencia. Por defecto entra al final.
    { id: "discount",       slot: "aside",  order: 0, width: "full" },
    { id: "shipping",       slot: "aside",  order: 1, width: "full" },
    { id: "coupon",         slot: "aside",  order: 2, width: "full" },
    { id: "totals",         slot: "aside",  order: 3, width: "full" },
    { id: "payments",       slot: "aside",  order: 4, width: "full" },
    { id: "account-impact", slot: "aside",  order: 5, width: "full" },
    { id: "observations",   slot: "aside",  order: 6, width: "full" },
  ],
};
