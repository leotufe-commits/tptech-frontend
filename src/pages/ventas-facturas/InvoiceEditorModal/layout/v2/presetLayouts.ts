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
//      = h * 32 + (h - 1) * 12
//
//   h=4  → 152 px  (card minima — TPCard header + textarea colapsado)
//   h=5  → 196 px  (account-impact con 1 linea de balance)
//   h=6  → 240 px  (cupon, account-impact con breakdown)
//   h=7  → 284 px  (descuento global, envio — input + label + radio)
//   h=8  → 328 px  (descuento con razon larga, payments con 2 metodos)
//   h=9  → 372 px  (payments con 3 metodos)
//   h=10 → 416 px
//   h=12 → 504 px  (totals con monetary breakdown)
//   h=16 → 680 px  (totals con metales)
//   h=17 → 724 px  (totals + balance mode + breakdown + status)
//
// Las alturas estan calibradas para que el CONTENIDO REAL de cada card
// entre sin necesidad de scroll vertical en cualquiera de los 3
// breakpoints objetivo (1366 / 1600 / 1920). El usuario sigue pudiendo
// achicar via resize manual — los `minH` evitan que se pueda colapsar
// debajo del contenido critico (input bloqueado por su propia altura).
// =============================================================================

// ─── Metricas centralizadas — cards SECUNDARIOS (densidad uniforme) ──────────
// Producto pidio reducir el "aire vertical" de los cards secundarios
// (discount, shipping, coupon, payments, account-impact) que tenian
// mucho espacio vacio entre los inputs y el borde inferior. La altura
// base baja de 7 (~284px) a 5 (~196px), suficiente para 1 header + 2-3
// inputs sin scrollbar. El motor de auto-grow crece automaticamente si
// algun card concreto necesita mas (ej. discount con razon larga).
//
// Total mantiene altura hero. Observations mantiene altura propia para
// dejar lugar a textarea + tabs + adjuntos.
// Alturas BASE compactas (calibradas para el caso comun, sin aire
// excesivo). El motor auto-grow las crece automaticamente cuando el
// contenido las desborda (ej. Cobro con varios pagos, Total con
// metales, Observaciones con texto largo).
//
// Calibracion 2026-05-25 (post-reduccion ROW=32→20):
// los `h` se expresan ahora en filas de 20 px (antes 32). Para que el
// tamano visual sea similar al previo (o levemente mas compacto donde
// el contenido lo permite) hay que multiplicar `h` por ~1.6:
//
//   SECONDARY:    px = h*20 + (h-1)*8 → h=7 → 188 px (~ 1 header + 2 inputs)
//   OBSERVATIONS: px = h*20 + (h-1)*8 → h=9 → 244 px (~ textarea colapsada)
//   TOTAL:        px = h*20 + (h-1)*8 → h=13 → 356 px (~ header grande +
//                                                       total + breakdown
//                                                       + selector + status)
//
// `MIN_H` se sube proporcionalmente. Estos floors evitan que el operador
// achique las cards por debajo del contenido critico (input cortado,
// header sin body, total recortado).
const SECONDARY_H = 7;
const SECONDARY_MIN_H = 4;
const OBSERVATIONS_H = 9;
const OBSERVATIONS_MIN_H = 5;
// 2026-05-25 — Recalibracion Total (pedido producto "cierre layout fino"):
// con ROW=20 los valores previos (h=13 → 356 px) quedaban cortos para el
// contenido real (header grande + total + breakdown + selector modo +
// status). Subimos a h=17 (~460 px) y elevamos el piso a 13 (~356 px) para
// que el operador no pueda comprimir el card principal por debajo de su
// contenido base, manteniendo jerarquia visual estable entre los 3
// presets (CLASSIC / COMPACT / ONE_LINE).
const TOTAL_H = 17;
const TOTAL_MIN_H = 13;

// ─── CLASSIC ─────────────────────────────────────────────────────────────────
// ERP tradicional. Aside derecho ancho (x=7, w=5). Tipografia mas grande
// pero misma densidad de cards secundarios que el resto de presets.
const CLASSIC: PresetGeometry = {
  asideX: 7,
  asideW: 5,
  cards: {
    "discount":       { h: SECONDARY_H,    minW: 4, minH: SECONDARY_MIN_H },
    "shipping":       { h: SECONDARY_H,    minW: 4, minH: SECONDARY_MIN_H },
    "coupon":         { h: SECONDARY_H,    minW: 4, minH: SECONDARY_MIN_H },
    "totals":         { h: TOTAL_H,        minW: 4, minH: TOTAL_MIN_H },
    "payments":       { h: SECONDARY_H,    minW: 4, minH: SECONDARY_MIN_H },
    "account-impact": { h: SECONDARY_H,    minW: 4, minH: SECONDARY_MIN_H },
    "observations":   { h: OBSERVATIONS_H, minW: 4, minH: OBSERVATIONS_MIN_H },
  },
};

// ─── COMPACT ─────────────────────────────────────────────────────────────────
// Operativa rapida. Aside angosto (x=8, w=4). Densidad uniforme entre
// cards operativos — el unico hero es Total.
const COMPACT: PresetGeometry = {
  asideX: 8,
  asideW: 4,
  cards: {
    "discount":       { h: SECONDARY_H,    minW: 3, minH: SECONDARY_MIN_H },
    "shipping":       { h: SECONDARY_H,    minW: 3, minH: SECONDARY_MIN_H },
    "coupon":         { h: SECONDARY_H,    minW: 3, minH: SECONDARY_MIN_H },
    "totals":         { h: TOTAL_H,        minW: 3, minH: TOTAL_MIN_H },
    "payments":       { h: SECONDARY_H,    minW: 3, minH: SECONDARY_MIN_H },
    "account-impact": { h: SECONDARY_H,    minW: 3, minH: SECONDARY_MIN_H },
    "observations":   { h: OBSERVATIONS_H, minW: 3, minH: OBSERVATIONS_MIN_H },
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
    "discount":       { h: SECONDARY_H,    minW: 6, minH: SECONDARY_MIN_H },
    "shipping":       { h: SECONDARY_H,    minW: 6, minH: SECONDARY_MIN_H },
    "coupon":         { h: SECONDARY_H,    minW: 6, minH: SECONDARY_MIN_H },
    "totals":         { h: TOTAL_H,        minW: 6, minH: TOTAL_MIN_H },
    "payments":       { h: SECONDARY_H,    minW: 6, minH: SECONDARY_MIN_H },
    "account-impact": { h: SECONDARY_H,    minW: 6, minH: SECONDARY_MIN_H },
    "observations":   { h: OBSERVATIONS_H, minW: 6, minH: OBSERVATIONS_MIN_H },
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
