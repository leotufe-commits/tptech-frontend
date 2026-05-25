// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/v2ToV1.ts
// ============================================================================
// v2ToV1 — proyección inversa de `migrateV1ToV2`. Toma un LayoutV2Config y
// devuelve un LayoutConfig V1 equivalente para back-compat con los consumidores
// que aún no entienden V2 (LayoutDndContext sortable, render de aside legacy,
// etc.).
//
// La proyección PIERDE los campos extendidos (z, sticky, collapsed, locked,
// visible, minW/H, maxW/H) — V1 no los soporta. Pero PRESERVA la información
// estructural necesaria para que la UI V1 siga funcionando idéntica:
//
//   · region → slot:  "header"→"top", "main"→"main", "aside"→"aside", "footer"→"bottom"
//   · y → order:      cards de la misma region/slot se ordenan por y, y se
//                     asigna order = índice en esa lista ordenada (0..N).
//   · w → width:      el bloque dimensional V2 (4-col aside / 12-col main+
//                     header+footer) se mapea al enum discreto V1 más cercano
//                     por debajo (via `v2WidthToV1Width`).
//
// Idempotente con migrateV1ToV2 para layouts canónicos:
//   v2ToV1(migrateV1ToV2(v1)) ≈ v1   (preserva ids/orden por slot/width canónico)
//
// La función NO muta el input. Pure / determinístico.
// ============================================================================

import type {
  CardId,
  LayoutCard,
  LayoutConfig,
  Slot,
  Width,
} from "../types";
import { CURRENT_LAYOUT_VERSION } from "../types";
import { v2WidthToV1Width } from "./migrateV1ToV2";
import type { LayoutCardV2, LayoutV2Config, LayoutV2Region } from "./types";

/** Mapeo inverso region → slot. El slot "footer" de V2 viaja al slot
 *  "bottom" histórico de V1 (alineado con la convención del módulo V1). */
function regionToSlot(region: LayoutV2Region): Slot {
  if (region === "header") return "top";
  if (region === "main")   return "main";
  if (region === "aside")  return "aside";
  if (region === "footer") return "bottom";
  return "aside"; // never (TS exhaustivo); defensa.
}

/** Convierte una lista V2 a V1, agrupando por region/slot y asignando
 *  `order` por el orden visual (sort por y ascendente). */
export function v2ToV1(v2: LayoutV2Config): LayoutConfig {
  // Agrupar por region preservando el orden por `y` (tiebreaker por `x` y
  // luego por id — mismo criterio que `getCardsByRegion`).
  const byRegion = new Map<LayoutV2Region, LayoutCardV2[]>();
  for (const c of v2.cards) {
    const arr = byRegion.get(c.region) ?? [];
    arr.push(c);
    byRegion.set(c.region, arr);
  }
  for (const arr of byRegion.values()) {
    arr.sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  const out: LayoutCard[] = [];
  for (const [region, arr] of byRegion.entries()) {
    const slot = regionToSlot(region);
    arr.forEach((v2card, idx) => {
      const width: Width = v2WidthToV1Width(v2card.w, region);
      out.push({
        id:    v2card.id as CardId,
        slot,
        order: idx,
        width,
      });
    });
  }

  return {
    version: CURRENT_LAYOUT_VERSION,
    cards:   out,
  };
}
