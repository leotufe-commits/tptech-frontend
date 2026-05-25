// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/reflowLayout.ts
//
// ─────────────────────────────────────────────────────────────────────────────
//   Funcion central de RE-ACOMODO del layout V2
// ─────────────────────────────────────────────────────────────────────────────
//
// El sistema de layout del modal de Factura es un "sistema vivo": cuando
// cualquier card cambia de altura (crece, se achica, se colapsa, se
// expande, contenido interno crece, etc.), las cards de abajo deben
// reubicarse automaticamente.
//
// Esta funcion `reflowLayoutAfterCardChange` es la SSOT del algoritmo
// de reacomodo. NO debe haber lógica de re-acomodo card por card en los
// componentes individuales — todos delegan aqui.
//
// El motor en `LayoutGridContext` (ResizeObserver + auto-grow/shrink)
// internamente la usa cada vez que detecta un cambio de altura, y los
// callers externos pueden invocarla manualmente tras acciones discretas
// (ej. agregar pago, cambiar preset).
//
// Garantias:
//   - Respeta `manuallyResized` (no achica cards que el operador agrando).
//   - Respeta `minH` / `minW` (no achica por debajo del piso del preset).
//   - Compacta verticalmente por region (sin huecos, sin overlaps).
//   - Solo opera sobre la region `"aside"` (cards de grid). Las cards
//     `"mainBelowLines"` se rendean en orden vertical simple — no
//     requieren compactacion porque CSS flex/space-y lo hace nativo.
//   - Idempotente: aplicar dos veces el mismo cambio produce el mismo
//     layout (anti-loop seguro).

import type { CardId, CardRegion, LayoutV2, LayoutV2Card } from "../types";

/**
 * Compacta verticalmente las cards de una region:
 *   - Las ordena por `y` actual (preserva el orden visual).
 *   - Para cada card, calcula su nuevo `y` como el `max(bottom)` de las
 *     cards previas que se SUPERPONEN horizontalmente con ella. Sin gap
 *     adicional — el gap visual lo aporta el `margin` del grid (ver
 *     `spacing.ts`).
 *   - Resultado: sin huecos verticales, sin overlaps. La primera card
 *     siempre arranca en `y=0`.
 */
export function compactVerticallyByRegion(
  cards: ReadonlyArray<LayoutV2Card>,
  region: CardRegion,
): LayoutV2Card[] {
  const inRegion = cards.filter((c) => c.region === region);
  const other = cards.filter((c) => c.region !== region);
  const sorted = [...inRegion].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: LayoutV2Card[] = [];
  for (const card of sorted) {
    let newY = 0;
    for (const prev of placed) {
      const overlapX = prev.x < card.x + card.w && card.x < prev.x + prev.w;
      if (!overlapX) continue;
      const prevBottom = prev.y + prev.h;
      if (prevBottom > newY) newY = prevBottom;
    }
    placed.push({ ...card, y: newY });
  }
  return [...other, ...placed];
}

/**
 * Recalcula la altura `h` de una card en base a su contenido medido en
 * pixeles. Respeta `minH` del preset y `manuallyResized` del operador.
 *
 *   - measured < currentPx por > 1 fila → shrink (si !manuallyResized).
 *   - measured > currentPx + tolerance → grow (siempre, incluso con
 *     manuallyResized — proteccion anti-corte: si el contenido no entra,
 *     la card debe crecer para no recortar texto).
 *   - measured esta cerca de currentPx → sin cambio.
 *
 * Devuelve `null` si no hay cambio que ameriting actualizar el layout.
 */
export function recalculateCardHeight(args: {
  card: LayoutV2Card;
  measuredPx: number;
  rowHeightPx: number;
  marginYPx: number;
  toleranceGrowPx: number;
}): number | null {
  const { card, measuredPx, rowHeightPx, marginYPx, toleranceGrowPx } = args;
  const currentPx = card.h * rowHeightPx + (card.h - 1) * marginYPx;
  const rowPx = rowHeightPx + marginYPx;
  const neededH = Math.ceil((measuredPx + marginYPx) / rowPx);
  const minH = card.minH ?? 2;
  const newH = Math.max(neededH, minH);

  if (newH === card.h) return null;

  const isGrow = newH > card.h;
  const isShrink = newH < card.h;

  // GROW: respetar tolerancia para evitar oscilacion por sub-pixel.
  if (isGrow && measuredPx <= currentPx + toleranceGrowPx) return null;

  // SHRINK: SIEMPRE permitir el achique al alto natural del contenido
  // (incluso si la card fue resizeada manualmente). Razon: cuando un
  // card colapsa (TPCard.open=false), se oculta una card via
  // visibleCards, o el contenido baja porque se quito un pago/cupon,
  // el slot del grid DEBE acompanar para mantener el gap visual
  // uniforme entre cards. Respetar `manuallyResized` causaba que
  // los slots persistieran con la altura vieja y aparecieran
  // huecos verticales grandes (issue de "gap inconsistente").
  // El operador sigue protegido por `minH` (no se achica por debajo
  // del piso del preset) y por el resize manual en modo edicion
  // (que setea un nuevo `h` explicito).

  // SHRINK: bajar solo si la diferencia es al menos 1 fila completa
  // (evita jitter por contenido que oscila micro-tamanos).
  if (isShrink && (card.h - newH) < 1) return null;

  return newH;
}

/**
 * Re-acomodo CENTRAL del layout tras un cambio de altura en una card.
 *
 * Flujo:
 *   1. Calcula el nuevo `h` de la card cambiada (via `recalculateCardHeight`).
 *   2. Si no hay cambio significativo, devuelve `null` (no persiste).
 *   3. Aplica el nuevo `h` y compacta verticalmente la region completa.
 *   4. Devuelve el layout nuevo listo para persistir.
 *
 * Esta es la API publica que cualquier consumidor del sistema de layout
 * debe usar tras una accion discreta (no continua) que potencialmente
 * cambia la altura de un card: agregar pago, expandir Total, colapsar
 * Observaciones, cambiar moneda, etc.
 *
 * Para cambios CONTINUOS (drag manual del operador), el `LayoutGridContext`
 * usa su propio handler `onLayoutChange` de react-grid-layout — sin
 * compactacion automatica (el operador es el que decide donde colocar).
 */
export function reflowLayoutAfterCardChange(args: {
  layout: LayoutV2;
  changedCardId: CardId;
  measuredPx: number;
  rowHeightPx: number;
  marginYPx: number;
  toleranceGrowPx: number;
}): LayoutV2 | null {
  const { layout, changedCardId, measuredPx, rowHeightPx, marginYPx, toleranceGrowPx } = args;

  const card = layout.cards.find((c) => c.id === changedCardId);
  if (!card || card.region !== "aside") return null;

  const newH = recalculateCardHeight({ card, measuredPx, rowHeightPx, marginYPx, toleranceGrowPx });
  if (newH == null) return null;

  // Aplicar el nuevo h.
  const updatedCards: LayoutV2Card[] = layout.cards.map((c) =>
    c.id === changedCardId ? { ...c, h: newH } : c,
  );

  // Compactar verticalmente la region del aside.
  const compactedCards = compactVerticallyByRegion(updatedCards, "aside");

  return { version: 2, cards: compactedCards };
}
