// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/LayoutGridContext.tsx
//
// Adapter sobre react-grid-layout. Es la SSOT del render del aside en
// AMBOS modos:
//   - readOnly=true  -> render absolute con x/y/w/h, sin handles ni DnD.
//   - readOnly=false -> drag XY libre + resize por esquina + snap.
//
// Carga las hojas de estilo de react-grid-layout (drag/resize handles) y
// expone un `regionOriginX` / `regionColumns` para que el aside use SOLO
// las columnas del aside (en vez de las 12 globales).
//
// Importante: NO calcula nada comercial. Solo posiciona cards. El render
// real de cada card viene de `renderCard(id)` provisto por el padre.

import React, { useCallback, useMemo, useRef, useEffect } from "react";
// CSS de react-grid-layout — necesario para que el drag/resize se vea bien.
// Import dinamico via side-effect; vite lo bundlea.
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import GridLayout, { type Layout, WidthProvider } from "react-grid-layout";

import type { CardId, CardRegion, LayoutV2, LayoutV2Card } from "../types";
import {
  GRID_ROW_HEIGHT_PX,
  GRID_MARGIN,
  GRID_CONTAINER_PADDING,
  CARD_GAP_Y_PX,
} from "./spacing";
import { compactVerticallyByRegion, recalculateCardHeight } from "./reflowLayout";

const ResponsiveGridLayout = WidthProvider(GridLayout);

// Constantes de spacing IMPORTADAS de `./spacing.ts` (SSOT). Cualquier
// ajuste de gap entre cards debe modificarse alli — los call-sites
// reciben el valor consistente.
const ROW_HEIGHT = GRID_ROW_HEIGHT_PX; // 32 px
const MARGIN = GRID_MARGIN;             // [12, 12]
const CONTAINER_PADDING = GRID_CONTAINER_PADDING; // [0, 0]

// 2026-05-25 — Whitelist de cards que el operador puede ocultar via
// "Personalizar layout". Si `renderCard(id)` devuelve null para una de
// estas ids, la card sale del grid (no reserva slot, no toma gap) y
// las demas se compactan ocupando su lugar.
//
// Cards FUERA de esta lista (header, lines, totals) NUNCA salen del
// flujo de compactacion: son estructurales o son el card hero. Su
// `renderCard` siempre debe devolver un nodo valido.
const HIDEABLE_CARD_IDS: ReadonlySet<CardId> = new Set<CardId>([
  "discount",
  "shipping",
  "coupon",
  "payments",
  "account-impact",
  "observations",
]);

export type LayoutGridContextProps = {
  /** Layout V2 actual (incluye todas las regiones). */
  layout: LayoutV2;
  /** Region del aside a renderear ("aside"). */
  region: CardRegion;
  /** Columna inicial absoluta del aside dentro de la grilla 12-col. */
  regionOriginX: number;
  /** Numero de columnas del aside (subset de las 12). */
  regionColumns: number;
  /** Callback al commit del DnD/resize. Recibe el layout V2 completo. */
  onLayoutChange: (next: LayoutV2) => void;
  /** Render por card (devuelve null para "no renderear"). */
  renderCard: (id: CardId) => React.ReactNode;
  /** Si true, sin handles ni DnD (modo lectura). */
  readOnly: boolean;
};

/**
 * Convierte LayoutV2Card (coords absolutas dentro de la grilla 12-col) a
 * Layout (coords locales del aside).
 */
function toGridLayout(
  cards: LayoutV2Card[],
  originX: number,
  columns: number,
): Layout[] {
  return cards.map((c) => {
    const localX = Math.max(0, c.x - originX);
    const w = Math.max(1, Math.min(columns, c.w));
    return {
      i: c.id,
      x: Math.min(columns - w, localX),
      y: c.y,
      w,
      h: c.h,
      minW: c.minW ?? 2,
      minH: c.minH ?? 2,
    };
  });
}

/**
 * Convierte el Layout local que devuelve react-grid-layout a coords absolutas
 * de LayoutV2 (sumando originX). Conserva las cards de OTRAS regiones que no
 * participan del aside.
 */
function fromGridLayout(
  fullLayout: LayoutV2,
  region: CardRegion,
  next: Layout[],
  originX: number,
): LayoutV2 {
  const byId = new Map(next.map((l) => [l.i, l]));
  const cards: LayoutV2Card[] = fullLayout.cards.map((c) => {
    if (c.region !== region) return c;
    const updated = byId.get(c.id);
    if (!updated) return c;
    return {
      ...c,
      x: updated.x + originX,
      y: updated.y,
      w: updated.w,
      h: updated.h,
    };
  });
  return { version: 2, cards };
}

export function LayoutGridContext(props: LayoutGridContextProps): React.ReactElement {
  const { layout, region, regionOriginX, regionColumns, onLayoutChange, renderCard, readOnly } = props;

  // Visibilidad por card: las hideables que devuelven null en `renderCard`
  // se consideran ocultas (whitelist arriba). Las no-hideables son siempre
  // visibles — no consultamos renderCard para evitar invocarlo extra.
  const isCardVisible = useCallback(
    (c: LayoutV2Card): boolean => {
      if (!HIDEABLE_CARD_IDS.has(c.id)) return true;
      return renderCard(c.id) != null;
    },
    [renderCard],
  );

  // Filtramos las cards del aside (ignoramos header/lines) y las ocultas
  // de la whitelist. El layout persistido conserva las ocultas (no se
  // pierde su geometria), simplemente no participan del grid actual.
  const asideCards = useMemo(
    () => layout.cards.filter((c) => c.region === region && isCardVisible(c)),
    [layout, region, isCardVisible],
  );

  const gridLayout = useMemo(
    () => toGridLayout(asideCards, regionOriginX, regionColumns),
    [asideCards, regionOriginX, regionColumns],
  );

  // ─── Auto-grow por contenido (anti-loop endurecido) ────────────────────────
  //
  // Cuatro capas de proteccion contra el loop visual del card de Total
  // del comprobante (y similares):
  //
  //   GATE 1 — Row-based check. `measuredRows = ceil(scrollHeight / rowPx)`.
  //            Si `measuredRows <= currentH`, ya entra → no crece. Esto
  //            evita "milimetros" provocando un grow (ej. variaciones de
  //            sub-pixel + bordes + paddings entre renders).
  //
  //   GATE 2 — Tolerance px (1 fila completa = 44 px). Si el desborde es
  //            menor que una fila, no se considera "claramente cortado".
  //
  //   GATE 3 — Stability counter. El mismo `newH` debe medirse N veces
  //            consecutivas (separadas por debounce) antes de commitear.
  //            Si las mediciones oscilan, nunca llegan al umbral.
  //
  //   GATE 4 — Per-card cooldown. Despues de un commit, esa card queda
  //            "bloqueada" por COOLDOWN_MS — ningun nuevo commit puede
  //            dispararse sobre ella en ese intervalo. Esto rompe
  //            cualquier loop tight que sobreviva a los gates anteriores.
  //
  // Reglas adicionales:
  //   · Solo CRECE — nunca achica automaticamente.
  //   · Respeta `manuallyResized=true` (el usuario decidio).
  //   · Respeta `minH` (no baja de ahi nunca).
  //   · Si la medicion alterna entre dos valores (contenido responsive),
  //     nunca alcanza estabilidad → no crece.

  /** Tolerancia px. Originalmente era 1 fila completa (44 px) — eso
   *  dejaba que sub-pixeles (1-3 px por bordes/paddings) generaran
   *  scrollbars fantasma sin disparar grow. Ahora la tolerancia se
   *  limita al `margin vertical` del grid (12 px): cualquier desborde
   *  > 12 px dispara grow → el slot crece y el scroll desaparece. Los
   *  desbordes < 12 px (verdadero sub-pixel) son inocuos visualmente. */
  const GROW_TOLERANCE_PX = MARGIN[1];
  /** Debounce entre mediciones. 80 ms es lo suficientemente corto para
   *  que el operador perciba el reflow como inmediato (1 frame extra
   *  sobre la animacion CSS de 220ms), pero lo suficientemente largo
   *  para absorber multiples eventos del ResizeObserver disparados
   *  en cascada (ej. layout reflows internos del browser). */
  const GROW_DEBOUNCE_MS = 80;
  /** Mediciones identicas consecutivas antes de comprometer. Bajado
   *  a 1 = la primera medicion estable commitea inmediato. El COOLDOWN
   *  + GROW_TOLERANCE_PX ya proveen suficiente anti-loop. */
  const STABILITY_REQUIRED = 1;
  /** Cooldown por card despues de un commit (ms). 300ms permite
   *  reaccionar a acciones consecutivas del operador (agregar 3-4
   *  pagos seguidos) con minima latencia entre cada reflow. */
  const COOLDOWN_MS = 300;

  const contentRefs = useRef<Map<CardId, HTMLDivElement | null>>(new Map());
  const observersRef = useRef<Map<CardId, ResizeObserver>>(new Map());
  const growTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stabilityRef = useRef<Map<CardId, { h: number; count: number }>>(new Map());
  const lastCommitAtRef = useRef<Map<CardId, number>>(new Map());
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  const setContentRef = useCallback((id: CardId, el: HTMLDivElement | null) => {
    contentRefs.current.set(id, el);
    const prev = observersRef.current.get(id);
    if (prev) {
      prev.disconnect();
      observersRef.current.delete(id);
    }
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (growTimerRef.current) clearTimeout(growTimerRef.current);
      growTimerRef.current = setTimeout(() => {
        maybeGrowFromContent();
      }, GROW_DEBOUNCE_MS);
    });
    ro.observe(el);
    observersRef.current.set(id, ro);
  }, []);

  // Callbacks de ref ESTABLES por id. El JSX antes pasaba un closure
  // inline `(el) => setContentRef(c.id, el)` que React detectaba como
  // funcion distinta en cada render → desmontaba y volvia a montar el
  // ResizeObserver. Eso podia perder eventos justo en el momento del
  // colapso (TPCard.open=false), dejando el slot sobredimensionado.
  // Con esta Map de callbacks por id, el ref es estable a lo largo de
  // la vida del componente y el RO sobrevive entre renders.
  const refCallbacksRef = useRef<Map<CardId, (el: HTMLDivElement | null) => void>>(new Map());
  function getContentRef(id: CardId): (el: HTMLDivElement | null) => void {
    let cb = refCallbacksRef.current.get(id);
    if (!cb) {
      cb = (el: HTMLDivElement | null) => setContentRef(id, el);
      refCallbacksRef.current.set(id, cb);
    }
    return cb;
  }

  // `compactVertically` movido a `./reflowLayout.ts` (SSOT del algoritmo
  // de reacomodo). Aca solo lo invocamos via `compactVerticallyByRegion`.

  function maybeGrowFromContent(): void {
    const currentLayout = layoutRef.current;
    const now = Date.now();
    let changed = false;
    const nextCards = currentLayout.cards.map((c) => {
      if (c.region !== region) return c;
      // `manuallyResized` ya no bloquea TODO el flow — solo el shrink
      // (lo maneja `recalculateCardHeight` en reflowLayout.ts). Asi,
      // si el operador agrando manualmente una card pero el contenido
      // crece mas alla del tamano manual, la card crece para no
      // recortar (proteccion anti-corte).
      // GATE 4: cooldown post-commit.
      const lastCommit = lastCommitAtRef.current.get(c.id) ?? 0;
      if (now - lastCommit < COOLDOWN_MS) {
        stabilityRef.current.delete(c.id);
        return c;
      }
      const el = contentRefs.current.get(c.id);
      if (!el) return c;
      const measured = el.scrollHeight;

      // Calculo de nuevo `h` via la SSOT central (`recalculateCardHeight`
      // en reflowLayout.ts). Devuelve `null` si no hay cambio que
      // justifique reflow.
      const newHOrNull = recalculateCardHeight({
        card: c,
        measuredPx: measured,
        rowHeightPx: ROW_HEIGHT,
        marginYPx: MARGIN[1],
        toleranceGrowPx: GROW_TOLERANCE_PX,
      });
      if (newHOrNull == null) {
        stabilityRef.current.delete(c.id);
        return c;
      }
      const newH = newHOrNull;

      // FIRST-MEASUREMENT FAST PATH (grow y shrink):
      // En la primera medicion de la card, aplicar el cambio
      // inmediato sin esperar estabilidad. Esto evita scrollbar
      // fantasma (en grow) y aire excesivo (en shrink) durante los
      // ~900 ms iniciales.
      const hasBeenSeen = lastCommitAtRef.current.has(c.id)
        || stabilityRef.current.has(c.id);
      if (!hasBeenSeen) {
        changed = true;
        lastCommitAtRef.current.set(c.id, now);
        return { ...c, h: newH };
      }

      // Stability gate (para mediciones subsiguientes): tenemos que
      // ver el mismo `newH` N veces consecutivas antes de commitear.
      const tracker = stabilityRef.current.get(c.id);
      if (!tracker || tracker.h !== newH) {
        stabilityRef.current.set(c.id, { h: newH, count: 1 });
        return c;
      }
      if (tracker.count + 1 < STABILITY_REQUIRED) {
        stabilityRef.current.set(c.id, { h: newH, count: tracker.count + 1 });
        return c;
      }

      // ✅ Estable.
      changed = true;
      stabilityRef.current.delete(c.id);
      lastCommitAtRef.current.set(c.id, now);
      return { ...c, h: newH };
    });

    // Compactacion vertical de la region — siempre, aunque `changed=false`,
    // porque puede haber cambiado la VISIBILIDAD de cards (hideables que
    // pasaron a null en renderCard) y eso obliga a reflowear Y aunque
    // ningun `h` se haya tocado.
    //
    // Separamos en 3 grupos:
    //   - visible-en-region: entra a la compactacion (toma slot).
    //   - hidden-en-region:  preserva geometria persistida pero NO toma
    //                        slot (se reincorpora al final, irrelevante
    //                        para el grid).
    //   - otras-regions:     passthrough sin tocar.
    const visibleInRegion: LayoutV2Card[] = [];
    const hiddenInRegion:  LayoutV2Card[] = [];
    const outOfRegion:     LayoutV2Card[] = [];
    for (const c of nextCards) {
      if (c.region !== region) { outOfRegion.push(c); continue; }
      if (isCardVisible(c))     visibleInRegion.push(c);
      else                      hiddenInRegion.push(c);
    }
    const compacted = compactVerticallyByRegion(
      [...visibleInRegion, ...outOfRegion],
      region,
    );
    const finalCards: LayoutV2Card[] = [...compacted, ...hiddenInRegion];

    // Commit solo si algo (h, x, y, w) realmente cambio para evitar
    // re-renders en cadena cuando la compactacion es idempotente.
    const geometryChanged = changed || finalCards.some((c) => {
      const orig = currentLayout.cards.find((o) => o.id === c.id);
      return !orig
        || orig.x !== c.x
        || orig.y !== c.y
        || orig.w !== c.w
        || orig.h !== c.h;
    });
    if (!geometryChanged) return;

    onLayoutChangeRef.current({ version: 2, cards: finalCards });
  }

  // Cleanup observers + timers + tracker al desmontar.
  useEffect(() => {
    return () => {
      observersRef.current.forEach((o) => o.disconnect());
      observersRef.current.clear();
      stabilityRef.current.clear();
      lastCommitAtRef.current.clear();
      if (growTimerRef.current) clearTimeout(growTimerRef.current);
    };
  }, []);

  // Primer measurement en mount + re-disparo cuando cambia el SET de
  // cards visibles (ocultar/mostrar Cobro, Cupon, etc.). Sin esto el
  // grid arranca con los `h` default del preset aunque el contenido
  // real sea mas chico → aire visual + gap inconsistente hasta el
  // primer evento del ResizeObserver. Con este RAF, el shrink (y la
  // recompactacion por visibility) ocurre en el primer frame.
  //
  // La firma del effect usa la lista de ids visibles como key: cualquier
  // cambio de visibilidad fuerza un re-disparo del measurement.
  const visibleIdsKey = useMemo(
    () => asideCards.map((c) => c.id).join("|"),
    [asideCards],
  );
  useEffect(() => {
    const raf = requestAnimationFrame(() => maybeGrowFromContent());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIdsKey]);

  const handleChange = useCallback(
    (next: Layout[]) => {
      if (readOnly) return;
      const same =
        next.length === asideCards.length
        && next.every((n) => {
          const existing = asideCards.find((c) => c.id === n.i);
          if (!existing) return false;
          return (
            existing.x - regionOriginX === n.x
            && existing.y === n.y
            && existing.w === n.w
            && existing.h === n.h
          );
        });
      if (same) return;
      onLayoutChange(fromGridLayout(layout, region, next, regionOriginX));
    },
    [layout, region, regionOriginX, asideCards, readOnly, onLayoutChange],
  );

  // onResizeStop — el usuario solto el handle. Marcamos la card como
  // `manuallyResized=true` para que el auto-grow ya no la toque.
  const handleResizeStop = useCallback(
    (_layoutArr: Layout[], _oldItem: Layout, newItem: Layout) => {
      if (readOnly) return;
      const id = newItem.i as CardId;
      const cards = layoutRef.current.cards.map((c) =>
        c.region === region && c.id === id
          ? { ...c, manuallyResized: true }
          : c,
      );
      onLayoutChangeRef.current({ version: 2, cards });
    },
    [readOnly, region],
  );

  // En modo lectura mostramos el grid sin handles ni clases de drag.
  return (
    <div
      className={
        readOnly
          ? "tp-invoice-grid tp-invoice-grid--read"
          : "tp-invoice-grid tp-invoice-grid--edit"
      }
      data-tp-invoice-grid-mode={readOnly ? "read" : "edit"}
    >
      {/* Transicion suave para el reflow programatico (auto-grow,
          auto-shrink, compactacion, colapso). En modo lectura los
          movimientos son siempre programaticos → animacion ON. En modo
          edicion la animacion se desactiva DURANTE el drag/resize
          activo (react-grid-layout agrega clase `react-draggable-dragging`
          / `resizing` al item arrastrado) para que el cursor del
          operador siga el item sin lag perceptible. */}
      <style>{`
        .tp-invoice-grid .react-grid-item {
          transition-property: transform, width, height;
          transition-duration: 220ms;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
        .tp-invoice-grid--edit .react-grid-item.react-draggable-dragging,
        .tp-invoice-grid--edit .react-grid-item.resizing {
          transition: none !important;
          z-index: 50;
        }
        /* Resize handles — react-resizable renderea hasta 8 handles
           segun la prop resizeHandles. Estilizamos los 3 que activamos
           en modo edicion (SE esquina, S borde inferior, E borde
           derecho) con afordancia clara y diferenciada. */
        .tp-invoice-grid--edit .react-resizable-handle {
          background-image: none;
          z-index: 20;
        }
        /* SE — esquina inferior-derecha: cuadrado azul con triangulo
           blanco. Mas obvio que el triangulo CSS default. */
        .tp-invoice-grid--edit .react-resizable-handle-se {
          width: 18px;
          height: 18px;
          right: 2px;
          bottom: 2px;
          background-color: rgb(var(--color-primary, 99 102 241) / 0.6);
          border: 1px solid rgb(var(--color-primary, 99 102 241) / 0.9);
          border-radius: 3px;
          cursor: se-resize;
        }
        .tp-invoice-grid--edit .react-resizable-handle-se::after {
          content: "";
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 8px;
          height: 8px;
          border-right: 2px solid white;
          border-bottom: 2px solid white;
        }
        /* E — borde derecho: barra vertical fina para resize horizontal
           (ancho por columnas). */
        .tp-invoice-grid--edit .react-resizable-handle-e {
          width: 6px;
          height: 50%;
          right: 0;
          top: 25%;
          background-color: rgb(var(--color-primary, 99 102 241) / 0.4);
          border-radius: 3px 0 0 3px;
          cursor: ew-resize;
        }
        /* S — borde inferior: barra horizontal fina para resize vertical
           (alto por filas). */
        .tp-invoice-grid--edit .react-resizable-handle-s {
          height: 6px;
          width: 50%;
          bottom: 0;
          left: 25%;
          background-color: rgb(var(--color-primary, 99 102 241) / 0.4);
          border-radius: 3px 3px 0 0;
          cursor: ns-resize;
        }
        .tp-invoice-grid--edit .react-resizable-handle:hover {
          background-color: rgb(var(--color-primary, 99 102 241) / 0.9);
        }
        /* En modo lectura los handles no se renderizan (isResizable=false),
           pero garantizamos que cualquier residuo css quede oculto. */
        .tp-invoice-grid--read .react-resizable-handle {
          display: none !important;
        }
        /* Cursor "move" en TODA la card en modo edicion para reforzar
           afordancia (el handle visible sigue siendo la franja superior
           con clase tp-card-drag-handle). */
        .tp-invoice-grid--edit .react-grid-item {
          cursor: default;
        }
      `}</style>
      <ResponsiveGridLayout
        className="layout"
        layout={gridLayout}
        cols={regionColumns}
        rowHeight={ROW_HEIGHT}
        margin={MARGIN}
        containerPadding={CONTAINER_PADDING}
        isDraggable={!readOnly}
        isResizable={!readOnly}
        draggableHandle=".tp-card-drag-handle"
        // compactType DINAMICO segun modo:
        //   · readOnly=true  (lectura) → "vertical" → cards compactadas
        //     hacia arriba, layout prolijo y sin huecos visuales.
        //   · readOnly=false (edicion) → null → el operador puede
        //     arrastrar cards hacia abajo y dejar huecos voluntarios
        //     (libertad tipo dashboard comercial). El padre compacta
        //     explicitamente al salir del modo edicion.
        compactType={readOnly ? "vertical" : null}
        // preventCollision=false: al arrastrar una card sobre otra, RGL
        // mueve la card destino fuera del camino en vez de bloquear el
        // drag. Con preventCollision=true el drag se "trababa" si no
        // habia un hueco libre del tamano exacto en la posicion destino —
        // el operador percibia que "no se podia mover".
        preventCollision={false}
        // isBounded: en edicion limita el drag al area del grid (no
        // permite arrastrar cards fuera). Sin esto las cards podian
        // escapar visualmente del aside al arrastrarlas hacia la izq/der.
        isBounded={!readOnly}
        // resizeHandles=["se","s","e"]: handles activos en esquina
        // SE (ambos), borde inferior (alto) y borde derecho (ancho).
        // Permite resize fino por columnas (e) y por filas (s) sin
        // tener que combinar ambos con la esquina.
        resizeHandles={["se", "s", "e"]}
        autoSize
        useCSSTransforms
        onLayoutChange={handleChange}
        onResizeStop={handleResizeStop}
      >
        {asideCards.map((c) => (
          // El wrapper <div> recibe las props (style, className, listeners
          // de drag/resize) que react-grid-layout inyecta a sus hijos
          // directos. `key={c.id}` debe matchear con `i` del layout.
          //
          // `contentRef={getContentRef(c.id)}` usa la callback ESTABLE
          // por id (Map de refs) para que el ResizeObserver no se
          // remonte en cada render del padre y no pierda eventos del
          // colapso/expand.
          <div key={c.id}>
            <CardShell
              editing={!readOnly}
              contentRef={getContentRef(c.id)}
            >
              {renderCard(c.id)}
            </CardShell>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}

/**
 * Wrapper de cada card.
 *
 * Reglas:
 *
 *   1. NUNCA `overflow-x: auto` — el scrollbar horizontal queda feo y
 *      delata cards mal dimensionadas.
 *   2. **Read mode: `overflow-visible`** (sin scrollbars). El card
 *      mide su altura natural y el motor de auto-grow / auto-shrink
 *      ajusta el slot del grid al contenido — sin barras intermedias.
 *   3. **Edit mode: `overflow-y: auto`** — durante drag/resize el
 *      operador puede dejar la card en estado transitorio con
 *      contenido mas alto que el slot; el scroll temporal permite
 *      verlo todo hasta que suelte.
 *   4. **NO `min-h-full`** en el hijo. El hijo (TPCard) tiene SU
 *      altura natural. Esto es crucial para que:
 *        - El collapse funcione: cuando el TPCard colapsa, su altura
 *          baja a "header only", el wrapper baja con el, el
 *          ResizeObserver capta el cambio y auto-shrink ajusta el
 *          slot del grid.
 *        - El operador vea cards "ajustadas al contenido" en lugar
 *          de cards infladas con aire vacio abajo.
 *      Sin `min-h-full`, si el slot fuera mas grande que el card,
 *      auto-shrink lo achicaria en la proxima medicion (1 frame).
 *      Si el card fuera mas grande que el slot, auto-grow lo crece
 *      (first-measurement fast path = inmediato).
 */
function CardShell(props: {
  editing: boolean;
  children: React.ReactNode;
  /**
   * Ref que el LayoutGridContext usa para medir contenido con
   * ResizeObserver. `scrollHeight` refleja el alto NATURAL del contenido
   * y es independiente del valor de `overflow`. El motor de auto-grow
   * / auto-shrink lo lee y decide si crecer o achicar `h` del slot.
   */
  contentRef?: (el: HTMLDivElement | null) => void;
}): React.ReactElement {
  if (!props.editing) {
    return (
      <div
        ref={props.contentRef}
        className="w-full overflow-visible"
      >
        {props.children}
      </div>
    );
  }
  // Modo edicion: handle SIEMPRE VISIBLE (antes era opacity-0 hover-only,
  // lo que daba la sensacion de que "Personalizar layout" no habilitaba
  // nada — el banner aparecia, pero los cards se veian identicos al modo
  // lectura porque el handle no se percibia hasta el hover). Ahora opaco
  // por default + leve oscurecimiento en hover para feedback de afordancia.
  return (
    <div className="relative h-full w-full">
      <div
        className="tp-card-drag-handle absolute left-0 right-0 top-0 z-10 flex h-5 cursor-move items-center justify-center rounded-t-md bg-primary/20 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary/30"
        title="Arrastra para mover esta tarjeta"
      >
        <span aria-hidden>⋮⋮ arrastrar ⋮⋮</span>
      </div>
      <div
        ref={props.contentRef}
        className="w-full overflow-x-hidden overflow-y-auto min-h-0 pt-6"
      >
        {props.children}
      </div>
    </div>
  );
}
