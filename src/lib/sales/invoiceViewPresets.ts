// tptech-frontend/src/lib/sales/invoiceViewPresets.ts
//
// Plantillas de vista del modal de Factura de ventas. Cada preset
// describe la IDENTIDAD VISUAL del modal (layoutMode, densidad, anchura
// del aside, enfasis del total linea, sticky actions). El layout
// granular de cards (x/y/w/h) vive en `layout/v2/presetLayouts.ts`,
// que toma el preset como entrada.
//
// Solo precarga UI. NO afecta pricing-engine ni calculos.

import type { CSSProperties } from "react";

/**
 * Set oficial de plantillas de vista. Las 3 representan flujos
 * distintos del operador:
 *
 *   · CLASSIC  → ERP tradicional. Aside ancho y apilado.
 *   · COMPACT  → Vista operativa rapida. Aside compacto, pares
 *                lado a lado donde el contenido entra.
 *   · ONE_LINE → POS / carga ultra-horizontal. Aside reducido al
 *                minimo, prioridad maxima a las lineas.
 *
 * Las plantillas legacy `BALANCED` y `FINANCIAL` quedaron retiradas.
 * Los valores persistidos en DB se migran a `COMPACT` en el resolver.
 */
export type InvoiceViewPreset = "CLASSIC" | "COMPACT" | "ONE_LINE";

export type InvoiceLayoutMode =
  | "TWO_COLS_FROM_TOP"
  | "STACKED_FULL_WIDTH"
  | "SINGLE_COLUMN";

export type LineTotalEmphasis = "STANDARD" | "EMPHASIZED";

export type ResolvedInvoiceViewPreset = {
  preset: InvoiceViewPreset;
  layoutMode: InvoiceLayoutMode;
  /** Si true, el modal omite la grid de 2 columnas (forzado mobile/SINGLE). */
  forceSingleColumn: boolean;
  /** Anchura del aside en css. Ej: "360px" o "minmax(320px, 28%)". */
  asideColumnCss: string;
  /** Enfasis del "Total linea" en la tabla. CLASSIC lo agranda. */
  lineTotalEmphasis: LineTotalEmphasis;
  /** Si false, las acciones de la fila pierden el sticky-right. */
  stickyLineActions: boolean;
};

// Anchos del aside — calibrados por la identidad de cada preset:
//
//   · CLASSIC  → aside ancho (5 cols del grid 12) para inputs comodos
//                + Total con breakdown. Layout STACKED — lineas
//                full-width arriba, aside debajo.
//   · COMPACT  → aside medio (4 cols), denso. Pares discount+shipping,
//                account-impact+observations lado a lado donde entra.
//   · ONE_LINE → aside angosto (3 cols, ~280-320 px). Lineas dominan
//                el ancho. Total sticky arriba del aside; resto chico.
const PRESET_TABLE: Record<InvoiceViewPreset, ResolvedInvoiceViewPreset> = {
  CLASSIC: {
    // ERP tradicional STACKED — shape pedido por producto (2026-05-25):
    //   · Fila 1: Datos de la factura — full width arriba.
    //   · Fila 2: Lineas — full width debajo de Datos.
    //   · Fila 3: Observaciones (izquierda, full ancho del area main)
    //             + cards secundarios (aside derecho), empezando a la
    //             MISMA altura.
    // El render principal (`VentasFacturas.tsx`) detecta
    // `layoutMode === "STACKED_FULL_WIDTH"` y aplica `lg:col-span-2`
    // a la col-izq para que ocupe toda la fila superior; Observaciones
    // + aside caen automaticamente a la fila 2 alineados arriba.
    preset: "CLASSIC",
    layoutMode: "STACKED_FULL_WIDTH",
    forceSingleColumn: false,
    asideColumnCss: "minmax(460px, 540px)",
    lineTotalEmphasis: "STANDARD",
    stickyLineActions: true,
  },
  COMPACT: {
    preset: "COMPACT",
    layoutMode: "TWO_COLS_FROM_TOP",
    forceSingleColumn: false,
    asideColumnCss: "minmax(380px, 440px)",
    lineTotalEmphasis: "STANDARD",
    stickyLineActions: true,
  },
  ONE_LINE: {
    preset: "ONE_LINE",
    // SINGLE_COLUMN + forceSingleColumn = todo apilado vertical en una
    // sola columna full-width. Los cards del aside se renderean DEBAJO
    // de las lineas, con el MISMO ancho que las lineas — no hay aside
    // angosto a la derecha. Pensado para carga ultra-horizontal estilo
    // POS donde el operador necesita maximo ancho disponible.
    layoutMode: "SINGLE_COLUMN",
    forceSingleColumn: true,
    asideColumnCss: "1fr",
    lineTotalEmphasis: "EMPHASIZED",
    stickyLineActions: true,
  },
};

export const ALL_PRESETS: ReadonlyArray<InvoiceViewPreset> = [
  "CLASSIC",
  "COMPACT",
  "ONE_LINE",
];

export const PRESET_LABELS: Record<InvoiceViewPreset, string> = {
  CLASSIC: "Clásica",
  COMPACT: "Compacto",
  ONE_LINE: "Una línea",
};

export const PRESET_DESCRIPTIONS: Record<InvoiceViewPreset, string> = {
  CLASSIC:
    "Factura tradicional ERP. Datos arriba, líneas anchas, aside apilado vertical. Pensado para escritorio grande.",
  COMPACT:
    "Operativa rápida — aside compacto con cards densos. Algunos pares lado a lado donde entra. Default recomendado.",
  ONE_LINE:
    "Tipo POS — el aside se reduce al mínimo, todo el ancho va a las líneas. Pensado para carga masiva.",
};

/**
 * Migra valores legacy persistidos en DB a los presets oficiales del set
 * actual. Esto evita romper a usuarios con un `BALANCED` o `FINANCIAL`
 * guardado: ambos cuelgan automaticamente a `COMPACT`.
 */
export function migrateLegacyPreset(
  raw: string | null | undefined,
): InvoiceViewPreset | null {
  if (!raw) return null;
  if (raw === "CLASSIC" || raw === "COMPACT" || raw === "ONE_LINE") return raw;
  // Legacy → COMPACT (decision producto).
  if (raw === "BALANCED" || raw === "FINANCIAL") return "COMPACT";
  return null;
}

export function resolveInvoiceViewPreset(
  preset: InvoiceViewPreset | string | null | undefined,
): ResolvedInvoiceViewPreset {
  const migrated = migrateLegacyPreset(typeof preset === "string" ? preset : null);
  const safe: InvoiceViewPreset = migrated ?? "COMPACT";
  return PRESET_TABLE[safe];
}

/**
 * Devuelve el style inline que setea la variable CSS del ancho del aside.
 * VentasFacturas la consume en el wrapper de la grid principal.
 */
export function asideColumnGridStyle(
  resolved: ResolvedInvoiceViewPreset,
): CSSProperties {
  return {
    ["--invoice-aside-col" as any]: resolved.asideColumnCss,
  };
}
