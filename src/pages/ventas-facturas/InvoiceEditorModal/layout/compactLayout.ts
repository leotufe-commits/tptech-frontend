// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/compactLayout.ts
//
// Compactacion vertical del layout V2 ante cambios de visibilidad.
//
// El problema: el grid usa `compactType=null` (preserva la posicion exacta
// que el operador elige al arrastrar). Al ocultar una card desde el modal
// de Configuracion, la card desaparece visualmente pero su "hueco" queda
// — las otras cards mantienen su Y original. Cuando el operador la
// vuelve a mostrar, puede chocar con otra card que ahora ocupa su
// columna.
//
// Solucion: cada vez que cambia el set de cards VISIBLES, recompactamos
// SOLO las visibles cerrando los huecos verticales (manteniendo el
// orden relativo por Y). Las cards ocultas conservan su geometria
// (x/y/w/h) para cuando se vuelvan a mostrar; pero al mostrarlas, se
// reposicionan al final via `markCardsForReplay`.
//
// Reglas de la compactacion:
//   · No cambia X ni W (preserva ancho y columna).
//   · Reasigna Y stack-by-column: cada card se ubica en el menor Y
//     posible donde no haya overlap horizontal con las ya colocadas.
//   · Respeta `minH` y `minW` (no los cambia, solo los pasa adelante).
//   · Respeta `manuallyResized` (no lo pierde).
//   · Cards ocultas se devuelven intactas — el operador puede
//     re-mostrarlas y caeran al final del stack via auto-grow + drag.

import type { CardId, LayoutV2, LayoutV2Card } from "./types";

/** Set de ids de cards visibles segun `invoiceUiPreferences.visibleCards`. */
export type VisibleCardSet = ReadonlySet<CardId>;

/** Mapa de claves del `visibleCards` (camelCase) -> CardId (kebab). */
const VC_KEY_TO_CARD_ID: Record<string, CardId> = {
  discount:      "discount",
  shipping:      "shipping",
  coupon:        "coupon",
  totals:        "totals",
  payments:      "payments",
  accountImpact: "account-impact",
  observations:  "observations",
};

export function buildVisibleCardSet(visibleCards: Record<string, boolean>): VisibleCardSet {
  const visible = new Set<CardId>();
  for (const [key, value] of Object.entries(visibleCards)) {
    const id = VC_KEY_TO_CARD_ID[key];
    if (id && value) visible.add(id);
  }
  return visible;
}

/**
 * Recompacta verticalmente las cards visibles del aside cerrando los
 * huecos dejados por las ocultas. Mantiene el orden relativo por Y
 * original. Las cards ocultas (no presentes en `visibleSet`) se devuelven
 * tal cual.
 *
 * @param layout layout V2 actual
 * @param visibleSet ids de cards aside que estan visibles
 * @param newlyShownIds ids que acaban de pasar de oculta -> visible
 *                      (se colocan al final del stack)
 */
export function compactLayoutByVisibility(
  layout: LayoutV2,
  visibleSet: VisibleCardSet,
  newlyShownIds: ReadonlySet<CardId> = new Set(),
): LayoutV2 {
  // Particion: aside-visible / aside-oculta / no-aside (header, lines, etc.).
  const asideVisible: LayoutV2Card[] = [];
  const asideHidden: LayoutV2Card[] = [];
  const otherRegions: LayoutV2Card[] = [];

  for (const c of layout.cards) {
    if (c.region !== "aside") {
      otherRegions.push(c);
    } else if (visibleSet.has(c.id)) {
      asideVisible.push(c);
    } else {
      asideHidden.push(c);
    }
  }

  // Para cards recien mostradas, las "elevamos" a y=Number.MAX para que
  // el sort las ponga al final del stack visible.
  const adjusted = asideVisible.map((c) => {
    if (newlyShownIds.has(c.id)) return { ...c, y: Number.MAX_SAFE_INTEGER };
    return c;
  });

  // Sort estable por y, despues por x (para empates).
  const sorted = [...adjusted].sort((a, b) => a.y - b.y || a.x - b.x);

  // Stack-by-column: cada card se ubica en el menor y donde no haya
  // overlap horizontal con las ya colocadas.
  const placed: LayoutV2Card[] = [];
  for (const card of sorted) {
    let y = 0;
    for (const p of placed) {
      const overlapX = card.x < p.x + p.w && p.x < card.x + card.w;
      if (overlapX) {
        y = Math.max(y, p.y + p.h);
      }
    }
    placed.push({ ...card, y });
  }

  return {
    version: 2,
    cards: [...otherRegions, ...placed, ...asideHidden],
  };
}
