// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/reconcileLayout.ts
//
// Reconcilia un layout V2 persistido contra el preset actual. Garantia:
//
//   1) Si el persistido es null/invalido -> usa el preset actual.
//   2) Si el persistido tiene cards conocidas (validas) -> las mantiene
//      con sus posiciones del usuario.
//   3) Si aparece una card NUEVA que no estaba en el persistido -> la
//      agrega en una posicion segura (debajo del bloque del aside, sin
//      pisar a las existentes).
//   4) Si el persistido tiene cards desconocidas (deprecated) -> las
//      descarta.
//
// Reglas adicionales:
//   - Acota x/y/w/h a la grilla (12 cols, sin negativos).
//   - Respeta minW/minH del preset.

import type { InvoiceViewPreset } from "../../../../lib/sales/invoiceViewPresets";
import type { CardId, CardRegion, LayoutV2, LayoutV2Card } from "./types";
import {
  ASIDE_CARD_IDS,
  GRID_COLS,
  MAIN_BELOW_LINES_BY_PRESET,
  cloneLayout,
  getAsideCardIdsForPreset,
  getDefaultLayoutForPreset,
} from "./v2/presetLayouts";
import { compactVerticallyByRegion } from "./v2/reflowLayout";
import { getCardConstraints } from "./v2/cardConstraints";

const VALID_IDS = new Set<CardId>(ASIDE_CARD_IDS);

function isCard(x: unknown): x is LayoutV2Card {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.id === "string"
    && VALID_IDS.has(c.id as CardId)
    && typeof c.x === "number" && Number.isFinite(c.x)
    && typeof c.y === "number" && Number.isFinite(c.y)
    && typeof c.w === "number" && Number.isFinite(c.w) && c.w >= 1
    && typeof c.h === "number" && Number.isFinite(c.h) && c.h >= 1
  );
}

/**
 * Tope maximo razonable de filas para una card del aside. Algunos
 * layouts persistidos quedaron con `h` desproporcionado (ej. >24 filas
 * = >1000 px) por bugs anteriores de auto-grow o resize manual
 * arrastrado. Si el persistido supera este tope, lo achicamos al
 * default del preset — el motor de auto-grow despues lo va a calibrar
 * al contenido real si hace falta.
 */
const MAX_REASONABLE_H = 24;

function clampCard(card: LayoutV2Card, defaultCard?: LayoutV2Card): LayoutV2Card {
  // Re-clamp 2026-05-26: el `minW`/`minH` del card se TOMA SIEMPRE del
  // SSOT (`CARD_CONSTRAINTS`), NO del valor persistido. Razon: layouts
  // viejos guardados antes de la recalibracion ROW=32→20 traen `minH`
  // altos (ej. `payments.minH=8` cuando el SSOT actual dice 2). Si los
  // preservaramos, el motor de auto-shrink no podria achicar el slot al
  // colapsar la card → aire vertical grande entre cards colapsados.
  // Forzar SSOT garantiza que layouts legacy se recalibran al cargar.
  const ssot = getCardConstraints(card.id);
  const minW = Math.max(1, ssot.minW);
  const minH = Math.max(1, ssot.minH);
  const w = Math.max(minW, Math.min(GRID_COLS, Math.floor(card.w)));
  // Normalizar h: si el persistido supera el tope, volver al default del
  // preset. Asi facturas con `totals.h=30` (heredado de bugs viejos) no
  // se ven con media pantalla en blanco; el auto-grow lo ajusta despues
  // segun el contenido real.
  const rawH = Math.floor(card.h);
  const hAfterCap = rawH > MAX_REASONABLE_H
    ? (defaultCard?.h ?? minH)
    : rawH;
  const h = Math.max(minH, hAfterCap);
  const x = Math.max(0, Math.min(GRID_COLS - w, Math.floor(card.x)));
  const y = Math.max(0, Math.floor(card.y));
  return {
    id: card.id,
    region: "aside",
    x,
    y,
    w,
    h,
    minW,
    minH,
    // Preservar manuallyResized del persistido (decision del operador
    // sobre dimensiones manuales — no se pisa en reconcile).
    ...(card.manuallyResized != null ? { manuallyResized: card.manuallyResized } : {}),
  };
}

/**
 * Coloca una card "nueva" debajo de todas las demas, alineada a la columna x
 * de la primera card del aside (mantiene la "columna del aside" coherente).
 */
function placeNewCardSafely(
  id: CardId,
  defaultCard: LayoutV2Card | undefined,
  existing: LayoutV2Card[],
): LayoutV2Card {
  const maxY = existing.reduce((m, c) => Math.max(m, c.y + c.h), 0);
  const baseX = existing.length > 0
    ? Math.min(...existing.map((c) => c.x))
    : (defaultCard?.x ?? 8);
  const w = defaultCard?.w ?? 4;
  const h = defaultCard?.h ?? 3;
  return clampCard({
    id,
    region: "aside",
    x: baseX,
    y: maxY,
    w,
    h,
    minW: defaultCard?.minW ?? 2,
    minH: defaultCard?.minH ?? 2,
  });
}

/**
 * Acepta cualquier valor (incluyendo null/undefined/objects raros) y devuelve
 * un layout V2 coherente alineado al `preset`. Nunca tira.
 */
export function reconcileLayout(
  raw: unknown,
  preset: InvoiceViewPreset,
): LayoutV2 {
  const defaultLayout = getDefaultLayoutForPreset(preset);

  // (1) Invalido o vacio -> default del preset.
  if (
    !raw
    || typeof raw !== "object"
    || (raw as { version?: unknown }).version !== 2
    || !Array.isArray((raw as { cards?: unknown }).cards)
  ) {
    return cloneLayout(defaultLayout);
  }

  const rawCards = (raw as { cards: unknown[] }).cards;

  // Default del preset para inferir region de cards legacy sin region.
  const defaultRegionById = new Map<CardId, CardRegion>(
    defaultLayout.cards.map((c) => [c.id, c.region]),
  );
  const mainBelowLinesDefault = new Set<CardId>(
    MAIN_BELOW_LINES_BY_PRESET[preset] ?? [],
  );

  // (2) Sanitizar region de cada card persistida:
  //   - Si tiene region valida ("aside" o "mainBelowLines"), respetar
  //     lo PERSISTIDO (el usuario o una vista guardada decidio donde
  //     vive).
  //   - Si tiene region invalida o no la tiene (layout legacy), inferir
  //     del default del preset: si esta en MAIN_BELOW_LINES_BY_PRESET
  //     del preset actual, va a "mainBelowLines"; si no, "aside".
  //   - Cards de "header"/"lines" no participan del layout V2 (filtramos).
  const cardsByDefault = new Map(defaultLayout.cards.map((c) => [c.id, c]));
  const validCards: LayoutV2Card[] = rawCards
    .filter(isCard)
    .map((c) => {
      const rawRegion = (c as { region?: string }).region;
      const isValidPersistedRegion =
        rawRegion === "aside" || rawRegion === "mainBelowLines";
      const region: CardRegion = isValidPersistedRegion
        ? (rawRegion as CardRegion)
        : (mainBelowLinesDefault.has(c.id)
            ? "mainBelowLines"
            : (defaultRegionById.get(c.id) ?? "aside"));
      if (region === "mainBelowLines") {
        // Cards de main-below-lines no van por grid — no clampamos
        // coords reales; solo preservamos `id`, `region` y `h/minH`
        // por si el render quiere usarlas para resize vertical.
        // minW/minH se toman del SSOT (`CARD_CONSTRAINTS`), no del
        // persistido — misma logica anti-stale-floor que `clampCard`.
        const ssot = getCardConstraints(c.id);
        return {
          id: c.id,
          region: "mainBelowLines" as const,
          x: 0,
          y: Math.max(0, Math.floor(c.y)),
          w: 12,
          h: Math.max(ssot.minH, Math.floor(c.h)),
          minW: ssot.minW,
          minH: ssot.minH,
          manuallyResized: (c as { manuallyResized?: boolean }).manuallyResized,
        };
      }
      return clampCard({ ...c, region: "aside" }, cardsByDefault.get(c.id));
    });

  // (3) Agregar cards faltantes (nuevas en el dominio que el persistido
  // no conoce todavia). Cada una se inserta en su region default del preset.
  const asideForPreset = getAsideCardIdsForPreset(preset);
  const present = new Set(validCards.map((c) => c.id));
  const missingAside = asideForPreset.filter((id) => !present.has(id));
  for (const id of missingAside) {
    const def = cardsByDefault.get(id);
    validCards.push(placeNewCardSafely(id, def, validCards.filter((c) => c.region === "aside")));
  }
  // main-below-lines faltantes: agregar al final con coords nominales.
  const missingMain = Array.from(mainBelowLinesDefault).filter((id) => !present.has(id));
  for (const id of missingMain) {
    const def = cardsByDefault.get(id);
    validCards.push({
      id,
      region: "mainBelowLines",
      x: 0,
      y: validCards.filter((c) => c.region === "mainBelowLines").length,
      w: 12,
      h: def?.h ?? 6,
      minW: def?.minW ?? 4,
      minH: def?.minH ?? 4,
    });
  }

  // (4) Si quedo vacio (todas eran invalidas) -> default.
  if (validCards.length === 0) {
    return cloneLayout(defaultLayout);
  }

  // (5) Compactacion vertical FINAL del aside — garantiza spacing
  // uniforme entre cards desde el primer render. Pedido producto
  // 2026-05-25: la distancia visual entre cards secundarios debe ser
  // identica en todas las plantillas, sin depender de `y` heredados
  // de drag manual o bugs viejos.
  //
  // Esto reordena los `y` para que cada card aside arranque
  // INMEDIATAMENTE despues de la anterior — el gap visual lo aporta
  // el `margin` del react-grid-layout (= CARD_GAP_Y_PX = 8 px).
  //
  // Side-effect: cualquier layout custom del operador con huecos
  // intencionales se normaliza al cargar. Se acepta por pedido
  // explicito de producto.
  const compactedCards = compactVerticallyByRegion(validCards, "aside");

  return { version: 2, cards: compactedCards };
}
