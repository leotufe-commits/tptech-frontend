// src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/compaction.ts
// ============================================================================
// compactCardsInRegion — "compaction básica" para layouts V2: mueve cards
// HACIA ARRIBA hasta que toquen otra card (o el techo de la region) sin
// generar overlap. Pensado para Etapa 4 (resize Pro): cuando una card se
// achica, el espacio que liberó debería poder ser ocupado por las cards de
// abajo automáticamente.
//
// Reglas:
//   · Pure / determinístico — NUNCA muta el input.
//   · Solo afecta cards de la `region` especificada. Las de otras regions
//     pasan inalteradas.
//   · Las cards `locked` NO se mueven (su Y queda fijo) pero ocupan espacio
//     y bloquean a las que intentan subir.
//   · Iteración en orden ascendente por Y (las más altas primero). Para cada
//     card no-locked, calcula el "Y libre mínimo" comparando contra todas
//     las cards anteriores ya colocadas + el techo (y=0).
//   · Tiebreaker estable por (x, id) para casos donde dos cards tienen el
//     mismo Y de destino.
//
// No-op cuando ya no hay gaps que cerrar (idempotente).
// ============================================================================

import type { LayoutCardV2, LayoutV2Region } from "./types";

/** Compact las cards de una region (mueve hacia arriba para llenar gaps).
 *  Devuelve un nuevo array — el input no se muta. Cards de otras regions
 *  se passthrough sin tocar. */
export function compactCardsInRegion(
  cards: ReadonlyArray<LayoutCardV2>,
  region: LayoutV2Region,
): LayoutCardV2[] {
  // Separar: cards de la region (a compactar) vs. otras (passthrough).
  const inRegion:    LayoutCardV2[] = [];
  const outOfRegion: LayoutCardV2[] = [];
  for (const c of cards) {
    if (c.region === region) inRegion.push(c);
    else outOfRegion.push(c);
  }

  // Ordenar la region por (y, x, id) — el orden de procesamiento determina
  // el comportamiento del compact (las cards más altas se procesan primero,
  // las de abajo las usan como referencia para subir).
  const sorted = inRegion.slice().sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const placed: LayoutCardV2[] = [];
  for (const card of sorted) {
    if (card.locked) {
      // Locked → posición fija (no se mueve). Solo entra al "placed" como
      // referencia para las cards no-locked siguientes.
      placed.push(card);
      continue;
    }
    // Calcular el Y mínimo libre para esta card: máximo (bottom) de cualquier
    // card ya colocada que tenga overlap horizontal con la card actual.
    let minY = 0;
    for (const prev of placed) {
      const overlapX = card.x < prev.x + prev.w && card.x + card.w > prev.x;
      if (!overlapX) continue;
      const bottom = prev.y + prev.h;
      if (bottom > minY) minY = bottom;
    }
    if (minY < card.y) {
      // Hay gap arriba — subir la card hasta `minY`.
      placed.push({ ...card, y: minY });
    } else {
      // Ya está en el tope posible (o más abajo, lo cual no debería pasar
      // si el layout estaba bien formado; defensivo).
      placed.push(card);
    }
  }

  return [...placed, ...outOfRegion];
}
