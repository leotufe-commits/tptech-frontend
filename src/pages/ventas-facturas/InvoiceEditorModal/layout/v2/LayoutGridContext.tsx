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

import React, { useCallback, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { GripVertical } from "lucide-react";
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
import {
  compactVerticallyByRegion,
  recalculateCardHeight,
  decideStabilityCommit,
  type StabilityTracker,
} from "./reflowLayout";

const ResponsiveGridLayout = WidthProvider(GridLayout);

// Constantes de spacing IMPORTADAS de `./spacing.ts` (SSOT). Cualquier
// ajuste de gap entre cards debe modificarse alli — los call-sites
// reciben el valor consistente.
// Valores actuales (post-recalibracion 2026-05-26):
//   ROW_HEIGHT = 20 px (granularidad fina de resize vertical)
//   MARGIN     = [6, 6] (gap compacto entre cards — colapsados se ven
//                        agrupados como un bloque, expandidos no se sienten
//                        cramped)
const ROW_HEIGHT = GRID_ROW_HEIGHT_PX;
const MARGIN = GRID_MARGIN;
const CONTAINER_PADDING = GRID_CONTAINER_PADDING;

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
  /**
   * Callback al commit del layout. Recibe el layout V2 completo + un flag
   * `opts.persist` que indica si el cambio es user-driven (drag/resize)
   * o cosmético (auto-grow/shrink del motor de reflow).
   *
   * - `opts.persist=true`  → cambio user-driven → padre persiste al backend.
   * - `opts.persist=false` → cambio cosmético → padre solo actualiza estado
   *                          local, no llama al backend. Default si
   *                          `opts` no se pasa: persist=true (back-compat).
   */
  onLayoutChange: (next: LayoutV2, opts?: { persist?: boolean }) => void;
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

  // ─── Auto-grow por contenido (RAF-throttled, sin lag percibido) ────────────
  //
  // Refactor 2026-05-26 (cierre overlap visual durante reflow):
  // antes habia un `setTimeout(80ms)` que se reiniciaba en cada evento del
  // ResizeObserver. Resultado: el commit solo disparaba DESPUES de que
  // TPCard terminaba SU PROPIA animacion (~220 ms) + 80 ms de silencio
  // = ~300 ms. Recien entonces el grid commiteaba la nueva h, react-grid-
  // layout iniciaba SU transicion de 220 ms → cards inferiores bajaban
  // CON RETARDO respecto al card expandido → overlap/montaje visible.
  //
  // Reemplazo: `requestAnimationFrame` throttle. Cada evento del RO
  // programa un UNICO RAF para el proximo frame (si no hay uno pendiente).
  // El callback corre a ~16 ms del primer evento, mide `scrollHeight`
  // actual, commitea el nuevo h, recompacta TODA la region.
  //
  // Resultado: durante la animacion del TPCard (0-220 ms), tenemos ~14
  // commits sucesivos (uno por frame). Cada commit dispara la transition
  // CSS del react-grid-item (220 ms) que CHASEA el target. La animacion
  // de los cards inferiores es continua y SINCRONIZADA con la del
  // TPCard — sin pausa visible, sin montaje.
  //
  // Anti-loop:
  //   · GROW_TOLERANCE_PX (= GAP del grid): cambios < tolerancia no
  //     disparan grow → ignora sub-pixel jitter.
  //   · Shrink gate en `recalculateCardHeight`: shrink solo si delta >= 1
  //     fila completa.
  //   · RAF throttle: maximo 1 commit por frame (16 ms).
  //   · Stability gate via `decideStabilityCommit` con REQUIRED=1: la 1ra
  //     medicion estable commitea (no espera observaciones repetidas).
  //
  // COOLDOWN eliminado: con RAF throttle el anti-storm es natural; el
  // COOLDOWN de 300 ms solo agregaba latencia entre acciones consecutivas
  // del operador (agregar pago, expand card, etc.).
  //
  // Reglas adicionales:
  //   · Respeta `manuallyResized=true` (solo bloquea shrink, NO grow:
  //     anti-corte de contenido).
  //   · Respeta `minH` del SSOT.

  /** Tolerancia px. Limitada al `margin vertical` del grid (= GAP = 6 px):
   *  desbordes > 6 px disparan grow → el slot crece y el scroll desaparece.
   *  Desbordes ≤ 6 px son sub-pixel inocuos. */
  const GROW_TOLERANCE_PX = MARGIN[1];
  /** Mediciones identicas consecutivas antes de comprometer. Con RAF
   *  throttle y commits continuos durante animaciones, 1 = la primera
   *  medicion commitea — sin esperar a una segunda que con animaciones
   *  CSS puede no llegar nunca (bug historico que dejaba el reflow
   *  colgado hasta proxima interaccion). */
  const STABILITY_REQUIRED = 1;

  const contentRefs = useRef<Map<CardId, HTMLDivElement | null>>(new Map());
  const observersRef = useRef<Map<CardId, ResizeObserver>>(new Map());
  /** RAF id pendiente — si != null hay un frame programado, no agendar otro
   *  (throttle natural: maximo 1 commit por frame). */
  const rafIdRef = useRef<number | null>(null);
  const stabilityRef = useRef<Map<CardId, StabilityTracker>>(new Map());
  /** Cards que ya pasaron por al menos un commit (usado por el first-
   *  measurement fast path). Sin papel de cooldown — RAF maneja el throttle. */
  const seenCardsRef = useRef<Set<CardId>>(new Set());
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  /** Programa una corrida de `maybeGrowFromContent` para el proximo frame.
   *  Si ya hay un RAF pendiente NO programa otro — el callback ya pendiente
   *  va a recoger el estado mas reciente del DOM. Resultado: maximo 1
   *  commit por frame, naturalmente coalesce events RO multiples del mismo
   *  frame. */
  const scheduleReflow = useCallback(() => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      maybeGrowFromContent();
    });
  }, []);

  const setContentRef = useCallback((id: CardId, el: HTMLDivElement | null) => {
    contentRefs.current.set(id, el);
    const prev = observersRef.current.get(id);
    if (prev) {
      prev.disconnect();
      observersRef.current.delete(id);
    }
    if (!el) return;
    const ro = new ResizeObserver(() => {
      scheduleReflow();
    });
    ro.observe(el);
    observersRef.current.set(id, ro);
  }, [scheduleReflow]);

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
    let changed = false;
    const nextCards = currentLayout.cards.map((c) => {
      if (c.region !== region) return c;
      // `manuallyResized` no bloquea el flow completo — solo el shrink
      // (en `recalculateCardHeight`). Si el operador agrando manualmente
      // pero el contenido crece mas alla del tamano manual, la card crece
      // para no recortar (anti-corte).
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

      // FIRST-MEASUREMENT FAST PATH:
      // En la primera medicion despues del mount aplicamos el cambio
      // inmediato (sin esperar al stability gate). Evita scrollbar
      // fantasma (en grow) y aire excesivo (en shrink) durante los
      // primeros ~16ms tras montar el modal.
      if (!seenCardsRef.current.has(c.id)) {
        changed = true;
        seenCardsRef.current.add(c.id);
        return { ...c, h: newH };
      }

      // Stability gate (mediciones subsiguientes): delegamos a la SSOT
      // (`decideStabilityCommit` en reflowLayout.ts) para que la decision
      // sea testeable en isolation. Con STABILITY_REQUIRED=1 la 1ra
      // medicion del nuevo `h` commitea inmediato — combinada con el
      // RAF throttle (1 commit por frame), durante una animacion CSS
      // de TPCard se generan ~14 commits sucesivos que mantienen al
      // grid en sync con el contenido (sin lag visible).
      const decision = decideStabilityCommit({
        newH,
        tracker: stabilityRef.current.get(c.id),
        stabilityRequired: STABILITY_REQUIRED,
      });
      if (!decision.commit) {
        stabilityRef.current.set(c.id, decision.nextTracker);
        return c;
      }

      // ✅ Estable.
      changed = true;
      stabilityRef.current.delete(c.id);
      seenCardsRef.current.add(c.id);
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

    // 2026-05-29 — Marcamos este commit como COSMÉTICO (persist=false).
    // El padre actualiza estado local pero NO llama al backend. Razón:
    // los `h` de auto-grow/shrink son derivables del contenido al
    // re-mount (el motor los recalcula), persistirlos genera ruido y
    // dispara "Error al guardar" fantasmas cuando el operador no hizo
    // nada. Drag y resize (user-driven) sí persisten via `handleChange`
    // y `handleResizeStop` más abajo.
    onLayoutChangeRef.current({ version: 2, cards: finalCards }, { persist: false });
  }

  // Cleanup observers + RAF + tracker al desmontar.
  useEffect(() => {
    return () => {
      observersRef.current.forEach((o) => o.disconnect());
      observersRef.current.clear();
      stabilityRef.current.clear();
      seenCardsRef.current.clear();
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // ─── Initial reflow + re-reflow post-hidratacion ──────────────────────────
  //
  // CAUSA RAIZ identificada 2026-05-28:
  // `useInvoiceLayout` hidrata el layoutV2 de forma ASINCRONA via
  // `userPreferencesApi.get()` (red). El flujo real es:
  //
  //   t=0      mount → useState(getDefaultLayoutForPreset("COMPACT"))
  //                    layout inicial con h=7/9/17 (preset, NO compacto)
  //   t=16ms   browser pinta layout default
  //   t=80ms+  useEffect hidratacion termina → setLayoutV2State(reconciled)
  //   t=96ms   segundo paint con layout reconciled (compactado por
  //            reconcileLayout.compactVerticallyByRegion)
  //
  // Hasta aca, todo bien. PERO: este `useLayoutEffect` dependia solo de
  // `visibleIdsKey` (set de IDs). El set NO cambia entre el default
  // y el reconciled (mismas 7 cards) → useLayoutEffect NO se re-ejecuta
  // post-hidratacion → maybeGrowFromContent NUNCA mide scrollHeight
  // hasta que cualquier otro evento dispare el ResizeObserver (click,
  // hover, foco). De ahi el bug "se acomoda recien al hacer click".
  //
  // Fix: re-correr cuando cambia el ARRAY de cards (no solo IDs). Una
  // hidratacion crea un cards array nuevo (reconcileLayout devuelve
  // objeto nuevo); un drag/resize tambien crea uno nuevo. En ambos
  // casos queremos re-medir.
  //
  // Anti-loop: maybeGrowFromContent llama onLayoutChange → padre setState
  // → layout.cards cambia REFERENCIA → useLayoutEffect re-corre. Segunda
  // iteracion mide scrollHeight (ya estable) → geometryChanged=false →
  // no emit. Loop termina en 2 iteraciones max.
  //
  // scheduleReflow (RAF) tambien se llama como red de seguridad para
  // captar contenido que cargue async despues del primer paint (fuentes
  // web, imagenes del logo, datos del preview). Idempotente.
  useLayoutEffect(() => {
    // SYNC measurement antes del primer paint del frame actual → el
    // browser nunca pinta el layout uncompactado de una hidratacion
    // reciente.
    maybeGrowFromContent();
    // RAF de respaldo para contenido async post-paint.
    scheduleReflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.cards]);

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
      // User-driven (drag completado por el operador) → persistir.
      onLayoutChange(fromGridLayout(layout, region, next, regionOriginX), { persist: true });
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
      // User-driven (resize manual completado) → persistir.
      onLayoutChangeRef.current({ version: 2, cards }, { persist: true });
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
        /* Resize handle MINIMALISTA — solo esquina SE (inferior-derecha).
           Los handles S y E (barras de borde) se eliminaron por ser
           visualmente invasivos. La esquina SE alcanza para ajustar tanto
           ancho como alto en un solo gesto. Diseño discreto: triangulo
           gris sutil que se oscurece al hover. */
        .tp-invoice-grid--edit .react-resizable-handle {
          background-image: none;
          z-index: 20;
        }
        .tp-invoice-grid--edit .react-resizable-handle-se {
          width: 14px;
          height: 14px;
          right: 3px;
          bottom: 3px;
          background-color: transparent;
          cursor: se-resize;
          opacity: 0.35;
          transition: opacity 120ms ease;
        }
        .tp-invoice-grid--edit .react-resizable-handle-se::after {
          content: "";
          position: absolute;
          right: 1px;
          bottom: 1px;
          width: 10px;
          height: 10px;
          border-right: 2px solid currentColor;
          border-bottom: 2px solid currentColor;
          border-radius: 0 0 3px 0;
        }
        .tp-invoice-grid--edit .react-resizable-handle-se:hover {
          opacity: 0.9;
        }
        /* Card activa (hover): outline sutil que indica que es interactivo.
           El cuerpo del card no cambia de color para no romper el TPCard. */
        .tp-invoice-grid--edit .react-grid-item:hover {
          outline: 1px solid rgb(var(--color-primary, 99 102 241) / 0.35);
          outline-offset: -1px;
          border-radius: 12px;
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
        // resizeHandles=["se"]: solo esquina inferior-derecha (2026-05-29).
        // Los handles de borde S y E se eliminaron por ser visualmente
        // invasivos (barras azules) sin agregar valor real — el operador
        // ajusta ancho y alto en un solo gesto con la esquina SE.
        resizeHandles={["se"]}
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
  // Modo edicion 2026-05-29 — handle minimalista:
  // Antes era una BARRA AZUL FULL-WIDTH "⋮⋮ arrastrar ⋮⋮" en el top
  // de cada card. Visualmente invasiva y poco profesional (parecia
  // un overlay de error / guia tecnica). Ahora es un icono `GripVertical`
  // pequeño en la esquina top-left del card, sutil pero visible. El
  // outline del card al hover (CSS de arriba) refuerza que es interactivo.
  return (
    <div className="relative h-full w-full">
      <button
        type="button"
        className="tp-card-drag-handle absolute left-1 top-1 z-10 flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-muted/70 transition-all hover:bg-primary/10 hover:text-primary active:cursor-grabbing"
        title="Arrastrá para mover esta tarjeta"
        aria-label="Arrastrar tarjeta"
        // Evitar que el click "tonto" (sin drag) se interprete como
        // submit/navegacion. El drag real lo maneja react-grid-layout
        // via mousedown sobre el className `tp-card-drag-handle`.
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical size={14} />
      </button>
      <div
        ref={props.contentRef}
        className="w-full overflow-x-hidden overflow-y-auto min-h-0"
      >
        {props.children}
      </div>
    </div>
  );
}
