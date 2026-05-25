// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/types.ts
// ============================================================================
// Layout V2 — contrato "Pro" para Factura de ventas.
//
// Este módulo introduce un contrato más expresivo que el V1 (`../types.ts`):
//
//   · Posicionamiento absoluto sobre una grilla (X/Y/W/H) en vez de slot +
//     order + width discreto. Soporta drag/resize 2D y guías visuales.
//   · Region semántica (`header | main | aside | footer`) para layouts
//     híbridos: el motor puede colocar cards por coordenadas dentro de su
//     región, y caer a un fallback regional en mobile/responsive sin
//     reescribir el layout.
//   · Min/Max W/H por card — anti-overlap y resize Pro respetan estos
//     límites.
//   · `locked` — cards estructurales (header/lines) no se mueven ni se
//     redimensionan, aunque participan del layout.
//   · `visible` — espejo del toggle `visibleCards` del UI preferences
//     existente. Permite ocultar sin perder posición persistida.
//   · `z` — z-index lógico para overlays/widgets flotantes futuros.
//   · `sticky` — marca cards que deben permanecer visibles al hacer scroll
//     (Total del comprobante, Cobro, Cuenta corriente). UI lo activa en
//     fases siguientes.
//   · `collapsed` — estado colapsado persistente por usuario (no solo en
//     memoria). Habilita vistas compactas reales.
//
// IMPORTANTE: este archivo SOLO define el contrato. La UI sigue usando V1
// hasta que las fases 3 (drag/resize XY) y 4 (resize Pro) integren V2.
//
// COMPATIBILIDAD: el contrato V1 (`../types.ts`) NO se toca. Otros
// consumidores (Presupuestos/Órdenes/Compras) siguen usando V1 sin riesgo.
// La migración v1→v2 vive en `./migrateV1ToV2.ts`; el reconcile defensivo
// en `./reconcileLayoutV2.ts`.
// ============================================================================

import type { CardId } from "../types";

// Re-exportamos `CardId` para que los consumidores V2 NO tengan que
// importar del módulo V1 si solo necesitan tipos V2.
export type { CardId };

/** Versión del contrato V2. Bumpear si el formato cambia incompat. */
export const LAYOUT_V2_VERSION = 2 as const;

/** Region semántica de la card dentro del modal. Aunque el render final
 *  usa X/Y absolutos, la `region` permite:
 *    · Fallback regional en mobile/responsive (todas las cards de la
 *      misma region apiladas vertical sin respetar X/Y).
 *    · Presets que reorganizan por region (ej. "asignar todo a main"
 *      o "mover totals a footer") sin tocar X/Y.
 *    · Validación: locked-by-region (header/lines locked por convención).
 *    · Render selectivo: una capa puede iterar solo cards de su region. */
export type LayoutV2Region = "header" | "main" | "aside" | "footer";

/** Conjunto de regions válidas — usado por `reconcileLayoutV2` para
 *  normalizar cards con region inválida (cae a "main"). */
export const VALID_LAYOUT_V2_REGIONS: ReadonlySet<LayoutV2Region> = new Set([
  "header", "main", "aside", "footer",
]);

/** Una card V2 — posicionada sobre la grilla, con metadatos extendidos. */
export type LayoutCardV2 = {
  /** Id estable de la card. Re-usa el enum del V1 para que la migración
   *  y la coexistencia sean directas (mismas 9 cards hoy). */
  id: CardId;

  /** Region semántica. Default sugerido: "main". */
  region: LayoutV2Region;

  /** Posición — columna inicial (0..grid.columns - 1). */
  x: number;
  /** Posición — fila inicial (0..N). */
  y: number;
  /** Ancho en columnas (1..grid.columns). */
  w: number;
  /** Alto en filas (cada fila = grid.rowHeight px). */
  h: number;

  /** Ancho mínimo en columnas — el resize Pro lo respeta. */
  minW?: number;
  /** Alto mínimo en filas. */
  minH?: number;
  /** Ancho máximo en columnas. */
  maxW?: number;
  /** Alto máximo en filas. */
  maxH?: number;

  /** Card bloqueada — no se puede mover ni redimensionar. Las cards
   *  estructurales (header/lines) son `locked: true` por convención. */
  locked?: boolean;

  /** Visible en pantalla. Default true. Espejo del toggle `visibleCards`
   *  del UI preferences — al ocultar desde Configuración se persiste tanto
   *  acá como en `invoiceUiPreferences.visibleCards` para mantener la
   *  posición XY cuando vuelve a habilitarse. */
  visible?: boolean;

  /** z-index lógico para stacking (overlays, widgets flotantes). Default 0.
   *  Sin uso visual en Etapa 1; el contrato queda preparado para
   *  fases que introduzcan cards flotantes/superpuestas. */
  z?: number;

  /** Sticky-on-scroll. Default false. Las cards marcadas se quedan
   *  pegadas al borde superior/derecho de su region durante el scroll
   *  del contenido. Pensado para Total del comprobante / Cobro /
   *  Impacto en cuenta corriente. Sin uso visual en Etapa 1. */
  sticky?: boolean;

  /** Estado colapsado persistente. Default false. Cuando es `true`, la
   *  card se renderea en versión compacta (solo header, sin body).
   *  Persiste por usuario — distinto del toggle `open/close` en memoria
   *  que ya existe en TPCard. Sin uso visual en Etapa 1. */
  collapsed?: boolean;
};

/** Configuración de la grilla. */
export type LayoutV2Grid = {
  /** Cantidad de columnas. Default 12 (estilo dashboard). */
  columns:   number;
  /** Alto de cada fila en píxeles. Default 16. */
  rowHeight: number;
  /** Gap entre cards en píxeles. Default 12. */
  gap:       number;
};

/** Preset BASE de vista. Ortogonal al layout XY: el preset define
 *  asideMin/MaxPx + layoutMode, el layout V2 define posiciones por card. */
export type LayoutV2PresetBase =
  | "BALANCED"
  | "COMPACT"
  | "CLASSIC"
  | "SINGLE_COLUMN"
  | "CUSTOM";

/** Conjunto válido de presets base. */
export const VALID_LAYOUT_V2_PRESET_BASES: ReadonlySet<LayoutV2PresetBase> = new Set([
  "BALANCED", "COMPACT", "CLASSIC", "SINGLE_COLUMN", "CUSTOM",
]);

/** Config completa V2. */
export type LayoutV2Config = {
  /** Identifica el formato como V2 — el dispatcher de reconcile usa
   *  este campo para elegir entre rama V1 (legacy) y V2 (nueva). */
  version:    typeof LAYOUT_V2_VERSION;
  /** Preset BASE desde el que se derivó el layout. Permite "Restablecer
   *  layout" volver al sistema-default correspondiente. */
  presetBase: LayoutV2PresetBase;
  /** Grilla de referencia. */
  grid:       LayoutV2Grid;
  /** Cards activas. */
  cards:      LayoutCardV2[];
};

/** Defaults de la grilla (12-col, 16px row, 12px gap). */
export const LAYOUT_V2_GRID_DEFAULT: LayoutV2Grid = {
  columns:   12,
  rowHeight: 16,
  gap:       12,
};

/** Defaults de los campos opcionales de card. Centralizados acá para
 *  que `reconcileLayoutV2` y `migrateV1ToV2` apliquen exactamente los
 *  mismos valores cuando un campo viene undefined. */
export const LAYOUT_V2_CARD_DEFAULTS = {
  region:    "main" as LayoutV2Region,
  z:         0,
  sticky:    false,
  collapsed: false,
  locked:    false,
  visible:   true,
} as const;
