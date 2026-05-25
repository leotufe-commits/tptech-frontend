// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/defaults.ts
// ============================================================================
// DEFAULT_LAYOUT_V2 — distribución base sobre grilla 12-col.
//
// Desde la rediseñada de presets (BALANCED como default recomendado),
// `DEFAULT_LAYOUT_V2` es un ALIAS de `LAYOUT_V2_BALANCED`. La estructura
// histórica se mantiene documentada abajo como referencia, pero el
// objeto exportado proviene de `presetLayouts.ts` para que la fuente
// de verdad sea única (cambios en BALANCED se reflejan en el default).
//
//   ┌────────────────────────────────────────────────────────────┐
//   │ Header (full-width)                                         │  region: "header"
//   ├────────────────────────────────────────┬───────────────────┤
//   │                                         │ 1. Bonificación   │
//   │                                         │ 2. Envío          │
//   │ Líneas                                  │ 3. Cupón          │
//   │   (col-span 8/12)    region: "main"     │ ═══════════════   │  region: "aside"
//   │                                         │ 4. Total ★        │  (col-span 4/12)
//   │                                         │    (h=10 — card
//   │                                         │     principal)
//   │                                         │ ═══════════════   │
//   │                                         │ 5. Cobro          │
//   │                                         │ 6. Impacto CC     │
//   │                                         │    Observaciones  │
//   └────────────────────────────────────────┴───────────────────┘
//
// JERARQUÍA VISUAL DEL ASIDE (orden comercial/financiero canónico):
//   1. Ajustes comerciales:    Bonificación · Envío · Cupón
//   2. Resultado económico:     Total del comprobante  ← card principal
//   3. Ejecución:               Cobro
//   4. Impacto financiero:      Impacto en cuenta corriente
//   5. (al final)               Observaciones
//
// PROMINENCIA DE "TOTAL":
//   · h = 10 (las demás cards usan 4-6) — más alto visualmente, espacio
//     para mostrar moneda + breakdown completo sin scroll interno.
//   · minH = 6 — el operador no puede achicarlo a la mitad por accidente
//     (mantiene su rol de card principal incluso tras un resize).
//   · La altura extra crea naturalmente respiración antes y después,
//     separando "ajustes" de "ejecución" sin necesidad de un divider.
//
// Notas técnicas:
//   · `header` y `lines` son `locked: true` por convención — son estructurales.
//   · `h` × `rowHeight` (16px) da la altura mínima en píxeles. El contenido
//     real puede crecer en cards no-locked sin romper el layout.
//   · `z: 0`, `collapsed: false`, `sticky: false` para todas las cards.
//   · Cualquier layout YA PERSISTIDO por el usuario sobrevive intacto
//     vía `reconcileLayoutAny` — los defaults solo se aplican en "Restaurar
//     diseño" o cuando el operador nunca personalizó nada.
// ============================================================================

import { LAYOUT_V2_VERSION, type LayoutV2Config } from "./types";
import { LAYOUT_V2_BALANCED } from "./presetLayouts";

/** DEFAULT_LAYOUT_V2 = LAYOUT_V2_BALANCED. Cuando no hay preferencia
 *  persistida del usuario, el modal arranca con la vista recomendada
 *  (BALANCED). Cualquier ajuste a la geometría default se hace en
 *  `presetLayouts.ts` (única fuente de verdad).
 *
 *  Nota: `LAYOUT_V2_BALANCED` (en `presetLayouts.ts`) usa la forma simple
 *  `LayoutV2` (version + cards). Aca lo envolvemos con `presetBase` y
 *  `grid` para cumplir la firma `LayoutV2Config` que esperan los
 *  consumidores legacy. Las cards se castean a `any[]` porque el shape
 *  V2 elaborado (locked/visible/z/sticky/collapsed) es un superset
 *  estructural del V2 simple — esos campos quedan undefined y las
 *  cards funcionan como antes. */
export const DEFAULT_LAYOUT_V2: LayoutV2Config = {
  version:    LAYOUT_V2_VERSION,
  presetBase: "BALANCED",
  grid:       { columns: 12, rowHeight: 16, gap: 12 },
  cards:      LAYOUT_V2_BALANCED.cards as any,
};
