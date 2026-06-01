// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/v2/presetLayouts.ts
//
// Layouts V2 por preset. Cada preset declara una geometria concreta de las
// cards del aside en una grilla de 12 columnas. Las cards `header` y
// `lines` no se posicionan por el grid (no participan del aside).
//
// La diferencia entre presets es DELIBERADA y visualmente significativa:
//   - CLASSIC : aside ancho de 5 cols (7..12), tipografia mas grande.
//   - COMPACT : aside angosto de 4 cols (8..12), cards mas chicas.
//   - ONE_LINE: stacked full-width (x=0, w=12) tipo POS.
//
// El usuario puede moverlas / agrandarlas / poner una al lado de otra:
// el preset es solo el PUNTO DE PARTIDA.
//
// ─────────────────────────────────────────────────────────────────────────────
//   FUENTES UNICAS DE VERDAD (SSOT)
// ─────────────────────────────────────────────────────────────────────────────
// (A) `ASIDE_CARD_IDS` — orden vertical canonico de las cards laterales.
//     Define el orden de presentacion para TODOS los presets (los presets
//     no duplican esta lista — solo declaran tamano por id).
//
// (B) `MAIN_BELOW_LINES_BY_PRESET` — por cada preset, ids que NO van al
//     aside sino DEBAJO de la zona de lineas (ancho completo, contenido
//     principal). Hoy aplica solo a COMPACT donde `observations` se
//     mueve fuera del aside.
//
// (C) `getAsideCardIdsForPreset(preset)` — orden del aside resultante
//     (ASIDE_CARD_IDS menos las ids que el preset mueve al main).
//
// Esto cumple la regla del proyecto: el frontend no calcula, solo
// renderiza layout. El orden comercial y la asignacion de regiones la
// decide producto, no cada componente.

import type { InvoiceViewPreset } from "../../../../../lib/sales/invoiceViewPresets";
import type { CardId, LayoutV2, LayoutV2Card } from "../types";
import { CARD_CONSTRAINTS } from "./cardConstraints";

/** Numero total de columnas de la grilla (estandar dashboard). */
export const GRID_COLS = 12;

/**
 * Orden vertical canonico de las cards del aside (SSOT).
 *
 * Acordado con producto (2026-05-25):
 *   1. Bonificacion (discount)
 *   2. Envio
 *   3. Cupon
 *   4. Total del comprobante (totals)
 *   5. Cobro (payments)
 *   6. Impacto en cuenta corriente (account-impact)
 *   7. Observaciones / terminos / adjuntos (observations)
 *
 * NOTA: este es el orden BASE. Algunos presets pueden mover ciertas ids
 * fuera del aside (ver `MAIN_BELOW_LINES_BY_PRESET`). Para conocer el
 * orden del aside CONCRETO de un preset usar `getAsideCardIdsForPreset`.
 */
export const ASIDE_CARD_IDS = [
  "discount",
  "shipping",
  "coupon",
  "totals",
  "payments",
  "account-impact",
  "observations",
] as const satisfies ReadonlyArray<CardId>;

/** Solo las ids del aside (excluye `header` / `lines`, que no van en grilla). */
type AsideCardId = (typeof ASIDE_CARD_IDS)[number];

/**
 * SSOT: cards que cada preset mueve FUERA del aside, hacia la region
 * "main below lines" (debajo de la zona de lineas, ancho completo).
 *
 * NOTA: hoy todos los presets dejan el set vacio porque el render
 * principal (`VentasFacturas.tsx`) todavia no monta una region
 * "main below lines". Cuando producto decida activar (ej. mover
 * Observaciones fuera del aside en COMPACT, o todos los secundarios
 * debajo de Lineas en CLASSIC), se agregan las ids aqui y el render
 * principal las muestra con ancho completo.
 */
export const MAIN_BELOW_LINES_BY_PRESET: Record<
  InvoiceViewPreset,
  ReadonlyArray<AsideCardId>
> = {
  // CLASSIC: Observations va debajo de Lineas con ancho completo
  // (igual que Datos y Lineas), no en el aside lateral.
  CLASSIC:  ["observations"],
  // COMPACT: las Observaciones/Terminos/Adjuntos viven como contenido
  // principal (debajo de Lineas, ancho completo), no como card lateral.
  COMPACT:  ["observations"],
  // ONE_LINE: todas las cards ya viven en el aside full-width debajo
  // de Lineas (via forceSingleColumn). No necesita main-below-lines.
  ONE_LINE: [],
};

/**
 * Devuelve el orden del aside para un preset concreto: `ASIDE_CARD_IDS`
 * menos las ids que el preset asigna a la region "main below lines".
 */
export function getAsideCardIdsForPreset(
  preset: InvoiceViewPreset,
): ReadonlyArray<AsideCardId> {
  const moved = new Set<AsideCardId>(MAIN_BELOW_LINES_BY_PRESET[preset] ?? []);
  return ASIDE_CARD_IDS.filter((id) => !moved.has(id));
}

/**
 * Devuelve las ids que van debajo de la zona de lineas para un preset.
 * El render principal de Factura monta estas cards con ancho completo,
 * en el orden devuelto.
 */
export function getMainBelowLinesCardIdsForPreset(
  preset: InvoiceViewPreset,
): ReadonlyArray<AsideCardId> {
  return MAIN_BELOW_LINES_BY_PRESET[preset] ?? [];
}

/** Tamano/min de una card individual en un preset (sin id ni posicion). */
type CardSize = {
  /** Alto en unidades de grilla. */
  h: number;
  minW: number;
  minH: number;
};

/**
 * Geometria de un preset. Define ancho del aside + tamano por card.
 * El orden vertical y el `x` se derivan de `ASIDE_CARD_IDS` + `asideX`.
 *
 * Las ids que el preset asigna a la region "main below lines" tambien
 * declaran un tamano aqui (para fines de defaults / fallback al cambiar
 * de preset), pero `buildLayout` no las emite al layout del aside.
 */
type PresetGeometry = {
  /** Columna izquierda del aside (0..11). */
  asideX: number;
  /** Ancho del aside en columnas (todas las cards comparten ancho). */
  asideW: number;
  /** Tamano por card. Debe declarar TODAS las ids de `ASIDE_CARD_IDS`. */
  cards: Record<AsideCardId, CardSize>;
};

/**
 * Arma un `LayoutV2` apilando verticalmente las cards segun
 * `getAsideCardIdsForPreset(preset)`. `y` se calcula acumulando la
 * altura de la card anterior — sin overlap, sin gaps.
 *
 * Las cards que el preset mueve a "main below lines" se omiten del
 * layout del aside (no aparecen en V2.cards) — el render principal las
 * monta aparte.
 */
function buildLayout(preset: InvoiceViewPreset, geom: PresetGeometry): LayoutV2 {
  // Cards del aside: posicionadas en grid 12-col con coords concretas.
  const asideIds = getAsideCardIdsForPreset(preset);
  let y = 0;
  const asideCards: LayoutV2Card[] = asideIds.map((id) => {
    const size = geom.cards[id];
    const card: LayoutV2Card = {
      id,
      region: "aside" as const,
      x: geom.asideX,
      y,
      w: geom.asideW,
      h: size.h,
      minW: size.minW,
      minH: size.minH,
    };
    y += size.h;
    return card;
  });

  // Cards de main-below-lines: NO van en grid (render simple full
  // width en orden). Persistimos coords nominales (x=0, w=12, y=index)
  // solo para mantener el shape `LayoutV2Card` consistente — el
  // render las usa por `region` + orden, no por coords reales.
  const mainBelowIds = getMainBelowLinesCardIdsForPreset(preset);
  const mainBelowCards: LayoutV2Card[] = mainBelowIds.map((id, idx) => {
    const size = geom.cards[id];
    return {
      id,
      region: "mainBelowLines" as const,
      x: 0,
      y: idx,
      w: 12,
      h: size.h,
      minW: size.minW,
      minH: size.minH,
    };
  });

  return { version: 2, cards: [...asideCards, ...mainBelowCards] };
}

// =============================================================================
// REFERENCIA — calculo de pixeles por unidad de grilla:
//   px = h * ROW_HEIGHT + (h - 1) * MARGIN_Y
//      = h * 20 + (h - 1) * 8       (post-recalibracion 2026-05-25)
//
//   h=2  →  48 px  (card colapsada — header only, sin body)
//   h=3  →  76 px
//   h=4  → 104 px  (account-impact con 1 linea de balance)
//   h=5  → 132 px  (cupon expandido con input + boton)
//   h=6  → 160 px  (descuento expandido — header + combo + monto)
//   h=7  → 188 px  (descuento global, envio — input + label + radio)
//   h=9  → 244 px  (observations expandida — textarea + tabs)
//   h=13 → 356 px  (totals — piso del hero)
//   h=17 → 460 px  (totals expandido con balance + breakdown + status)
//
// IMPORTANTE: distincion de dos conceptos:
//   · `h` (esta tabla)             = altura EXPANDIDA del card (con su
//                                    contenido natural visible).
//   · `minH` (cardConstraints.ts)  = floor de SHRINK = altura COLAPSADA
//                                    (header only, ~48 px). El motor de
//                                    auto-grow trae cada card a su h
//                                    natural en el primer render.
//
// El operador puede achicar via resize manual hasta `minH` (collapsed).
// El operador puede agrandar manualmente y eso se preserva via
// `manuallyResized=true` (auto-shrink lo respeta).
// =============================================================================

// ─── Metricas centralizadas — cards SECUNDARIOS (densidad uniforme) ──────────
// Alturas BASE compactas para el contenido EXPANDIDO de cards secundarios.
// El motor auto-grow las crece automaticamente cuando el contenido las
// desborda (ej. Cobro con varios pagos, Total con metales, Observaciones
// con texto largo). El motor auto-shrink las achica al `minH` del SSOT
// cuando el card se colapsa (TPCard.open=false).
//
// `MIN_H` se delega al SSOT (`CARD_CONSTRAINTS` en cardConstraints.ts) —
// una sola fuente de verdad de floors para que reconcileLayout (que
// re-clampa contra SSOT al cargar) y los presets emitan los mismos
// valores. Esto evita que layouts legacy con `minH` desactualizados
// queden con aire vertical post-colapso.
const SECONDARY_H = 7;
const OBSERVATIONS_H = 9;
const TOTAL_H = 17;

/**
 * Helper que mezcla altura expandida del preset con `minH` del SSOT.
 * Los presets solo declaran la altura DEFAULT EXPANDIDA — el floor de
 * shrink (`minH`) viene SIEMPRE del SSOT (`CARD_CONSTRAINTS`). El
 * `minW` del preset puede ser mas estricto que el SSOT (ej. CLASSIC con
 * aside ancho usa minW=4 aunque el SSOT diga 3 — el preset endurece).
 */
function sizeFor(id: CardId, h: number, presetMinW: number): CardSize {
  const ssot = CARD_CONSTRAINTS[id];
  return {
    h,
    minW: Math.max(presetMinW, ssot.minW),
    minH: ssot.minH,
  };
}

// ─── CLASSIC ─────────────────────────────────────────────────────────────────
// ERP tradicional. Aside derecho ancho (x=7, w=5). Tipografia mas grande
// pero misma densidad de cards secundarios que el resto de presets.
const CLASSIC: PresetGeometry = {
  asideX: 7,
  asideW: 5,
  cards: {
    "discount":       sizeFor("discount",       SECONDARY_H,    4),
    "shipping":       sizeFor("shipping",       SECONDARY_H,    4),
    "coupon":         sizeFor("coupon",         SECONDARY_H,    4),
    "totals":         sizeFor("totals",         TOTAL_H,        4),
    "payments":       sizeFor("payments",       SECONDARY_H,    4),
    "account-impact": sizeFor("account-impact", SECONDARY_H,    4),
    "observations":   sizeFor("observations",   OBSERVATIONS_H, 4),
  },
};

// ─── COMPACT ─────────────────────────────────────────────────────────────────
// Operativa rapida. Aside angosto (x=8, w=4). Densidad uniforme entre
// cards operativos — el unico hero es Total.
const COMPACT: PresetGeometry = {
  asideX: 8,
  asideW: 4,
  cards: {
    "discount":       sizeFor("discount",       SECONDARY_H,    3),
    "shipping":       sizeFor("shipping",       SECONDARY_H,    3),
    "coupon":         sizeFor("coupon",         SECONDARY_H,    3),
    "totals":         sizeFor("totals",         TOTAL_H,        3),
    "payments":       sizeFor("payments",       SECONDARY_H,    3),
    "account-impact": sizeFor("account-impact", SECONDARY_H,    3),
    "observations":   sizeFor("observations",   OBSERVATIONS_H, 3),
  },
};

// ─── ONE_LINE ────────────────────────────────────────────────────────────────
// Tipo POS. Layout STACKED full-width: TODAS las cards van DEBAJO de
// lineas, con el MISMO ancho que las lineas (x=0, w=12). No hay aside
// angosto a la derecha — el operador tiene maximo ancho disponible para
// cargar articulos en lineas. Orden definido por `ASIDE_CARD_IDS` (SSOT).
const ONE_LINE: PresetGeometry = {
  asideX: 0,
  asideW: 12,
  cards: {
    "discount":       sizeFor("discount",       SECONDARY_H,    6),
    "shipping":       sizeFor("shipping",       SECONDARY_H,    6),
    "coupon":         sizeFor("coupon",         SECONDARY_H,    6),
    "totals":         sizeFor("totals",         TOTAL_H,        6),
    "payments":       sizeFor("payments",       SECONDARY_H,    6),
    "account-impact": sizeFor("account-impact", SECONDARY_H,    6),
    "observations":   sizeFor("observations",   OBSERVATIONS_H, 6),
  },
};

const TABLE: Record<InvoiceViewPreset, PresetGeometry> = {
  CLASSIC,
  COMPACT,
  ONE_LINE,
};

export function getDefaultLayoutForPreset(preset: InvoiceViewPreset): LayoutV2 {
  const geom = TABLE[preset] ?? COMPACT;
  return buildLayout(preset, geom);
}

/** Clon profundo del layout — evita que un consumer mute el preset global. */
export function cloneLayout(layout: LayoutV2): LayoutV2 {
  return {
    version: 2,
    cards: layout.cards.map((c) => ({ ...c })),
  };
}

// ─── Aliases V2 legacy ───────────────────────────────────────────────────────
// Exports aditivos para que archivos legacy del stash que importan
// `LAYOUT_V2_*` compilen sin cambios. Los aliases de presets retirados
// (BALANCED, FINANCIAL, FOCUS) apuntan a COMPACT — alineado con la
// migracion `migrateLegacyPreset`.
export const LAYOUT_V2_CLASSIC:  LayoutV2 = buildLayout("CLASSIC",  CLASSIC);
export const LAYOUT_V2_COMPACT:  LayoutV2 = buildLayout("COMPACT",  COMPACT);
export const LAYOUT_V2_ONE_LINE: LayoutV2 = buildLayout("ONE_LINE", ONE_LINE);
/** @deprecated alias legacy — mapea a COMPACT. */
export const LAYOUT_V2_BALANCED:  LayoutV2 = buildLayout("COMPACT", COMPACT);
/** @deprecated alias legacy — mapea a COMPACT. */
export const LAYOUT_V2_FINANCIAL: LayoutV2 = buildLayout("COMPACT", COMPACT);
/** @deprecated alias historico ("FOCUS") — mapea a COMPACT. */
export const LAYOUT_V2_FOCUS:     LayoutV2 = buildLayout("COMPACT", COMPACT);
