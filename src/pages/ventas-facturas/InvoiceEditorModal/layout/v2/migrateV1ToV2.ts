// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/migrateV1ToV2.ts
// ============================================================================
// migrateV1ToV2 — convierte un LayoutConfig V1 (slot + order + width discreto)
// a un LayoutV2Config (region + X/Y/W/H + metadatos extendidos).
//
// Garantías:
//   1. Pure / determinístico — NUNCA muta el input.
//   2. Cards estructurales (`header`, `lines`) reciben `locked: true`
//      independientemente del slot/width persistido.
//   3. Mapeo `slot → region`:
//        · "top"    → "header"
//        · "main"   → "main"
//        · "aside"  → "aside"
//        · "bottom" → "footer"
//   4. Mapeo `width → w`:
//        · region="aside"  (4-col block):  full=4, two-thirds=3, half=2, third=1
//        · resto (12-col block):           full=12, two-thirds=8, half=6, third=4
//   5. Posición Y derivada del `order` del slot, sumando el `h` de las cards
//      anteriores del mismo slot — emula el "stack vertical" del V1.
//   6. Defaults para campos nuevos (`z`, `sticky`, `collapsed`, `visible`,
//      `region`) tomados de `LAYOUT_V2_CARD_DEFAULTS`. Si DEFAULT_LAYOUT_V2
//      define un valor explícito para un id conocido (ej. `minW`/`minH`),
//      ese valor gana.
//
// Llamar a esta función con un `saved` que no es V1 es responsabilidad del
// caller (típicamente `reconcileLayoutV2`, que detecta version y despacha).
// ============================================================================

import type { CardId, LayoutCard, LayoutConfig, Slot, Width } from "../types";
import { DEFAULT_LAYOUT_V2 } from "./defaults";
import {
  LAYOUT_V2_VERSION,
  LAYOUT_V2_CARD_DEFAULTS,
  type LayoutCardV2,
  type LayoutV2Config,
  type LayoutV2Region,
} from "./types";

/** Cards estructurales — siempre `locked: true` en V2, sin importar lo que
 *  haya persistido el usuario en V1 (V1 no exponía `locked`). */
const STRUCTURAL_LOCKED_IDS: ReadonlySet<CardId> = new Set(["header", "lines"]);

/** Mapeo slot → region. El slot "bottom" se renombra a "footer" para
 *  alinear con la semántica del contrato V2 (header/main/aside/footer). */
function slotToRegion(slot: Slot): LayoutV2Region {
  if (slot === "top")    return "header";
  if (slot === "main")   return "main";
  if (slot === "aside")  return "aside";
  if (slot === "bottom") return "footer";
  return LAYOUT_V2_CARD_DEFAULTS.region; // never (TS exhaustivo); defensa.
}

/** Mapeo width discreto V1 → ancho en columnas V2. El ancho disponible
 *  depende de la región: "aside" usa un bloque de 4 columnas (el aside
 *  ocupa col-span 4/12 en el DEFAULT_LAYOUT_V2); el resto usa el ancho
 *  total de 12. */
function widthToColumns(width: Width, region: LayoutV2Region): number {
  if (region === "aside") {
    switch (width) {
      case "full":       return 4;
      case "two-thirds": return 3;
      case "half":       return 2;
      case "third":      return 1;
    }
  }
  // header / main / footer ocupan ancho completo.
  switch (width) {
    case "full":       return 12;
    case "two-thirds": return 8;
    case "half":       return 6;
    case "third":      return 4;
  }
}

/** Inversa de `widthToColumns` — toma un ancho en columnas V2 y devuelve
 *  el `Width` discreto V1 más cercano. Pensado para consumidores que
 *  iteran cards V2 pero pasan el width a componentes V1 (DraggableCard /
 *  ResizeHandle) sin perder fidelidad visual.
 *
 *  Si el W es un valor canónico (1/2/3/4 en aside, o 4/6/8/12 en otras
 *  regiones) la inversa es exacta. Si fuera un valor intermedio (ej. 5 en
 *  el main), snap al bucket de V1 más cercano por debajo. */
export function v2WidthToV1Width(w: number, region: LayoutV2Region): Width {
  if (region === "aside") {
    if (w >= 4) return "full";
    if (w >= 3) return "two-thirds";
    if (w >= 2) return "half";
    return "third";
  }
  if (w >= 12) return "full";
  if (w >= 8)  return "two-thirds";
  if (w >= 6)  return "half";
  return "third";
}

/** Index de cards default V2 por id — para tomar `minW/minH/h` y `x` base
 *  cuando el V1 no aporta esa información. */
const DEFAULT_V2_BY_ID: Map<CardId, LayoutCardV2> = new Map(
  DEFAULT_LAYOUT_V2.cards.map((c) => [c.id, c] as const),
);

/** X base por región. En aside arrancamos en columna 8 (col-span 4
 *  desde col 8 → cols 8,9,10,11). Las demás regiones empiezan en col 0. */
function regionBaseX(region: LayoutV2Region): number {
  return region === "aside" ? 8 : 0;
}

/** Migra un V1 LayoutConfig completo a V2. */
export function migrateV1ToV2(v1: LayoutConfig): LayoutV2Config {
  // Agrupamos por slot preservando el `order` del usuario para luego
  // emitir y/h en cascada (cada card hereda y = y_prev + h_prev del slot).
  const bySlot = new Map<Slot, LayoutCard[]>();
  for (const c of v1.cards) {
    const arr = bySlot.get(c.slot) ?? [];
    arr.push(c);
    bySlot.set(c.slot, arr);
  }
  // Estabilizamos el orden dentro de cada slot.
  for (const arr of bySlot.values()) {
    arr.sort((a, b) => a.order - b.order);
  }

  const out: LayoutCardV2[] = [];
  for (const [slot, arr] of bySlot.entries()) {
    const region = slotToRegion(slot);
    let cursorY = 0;
    for (const v1card of arr) {
      const def    = DEFAULT_V2_BY_ID.get(v1card.id);
      const w      = widthToColumns(v1card.width, region);
      const h      = def?.h ?? 4; // fallback minimal
      const minW   = def?.minW;
      const minH   = def?.minH;
      const maxW   = def?.maxW;
      const maxH   = def?.maxH;
      const locked = STRUCTURAL_LOCKED_IDS.has(v1card.id);
      out.push({
        id:        v1card.id,
        region,
        x:         regionBaseX(region),
        y:         cursorY,
        w,
        h,
        ...(minW != null ? { minW } : {}),
        ...(minH != null ? { minH } : {}),
        ...(maxW != null ? { maxW } : {}),
        ...(maxH != null ? { maxH } : {}),
        locked,
        visible:   LAYOUT_V2_CARD_DEFAULTS.visible,
        z:         LAYOUT_V2_CARD_DEFAULTS.z,
        sticky:    LAYOUT_V2_CARD_DEFAULTS.sticky,
        collapsed: LAYOUT_V2_CARD_DEFAULTS.collapsed,
      });
      cursorY += h;
    }
  }

  return {
    version:    LAYOUT_V2_VERSION,
    presetBase: DEFAULT_LAYOUT_V2.presetBase,
    grid:       DEFAULT_LAYOUT_V2.grid,
    cards:      out,
  };
}
