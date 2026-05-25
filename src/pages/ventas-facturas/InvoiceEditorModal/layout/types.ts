// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/types.ts
//
// Tipos compartidos del sistema de layout V2 de la Factura de ventas.
//
// V2 = grid 12 cols con drag/resize XY (vs. V1 que solo permitia width
// discreto en una lista vertical). Cada card del aside vive en su propia
// region del layout (`region: "aside"`); cards del header/lines no se
// renderean por el grid (siguen en su slot fijo).

export type CardId =
  | "header"
  | "lines"
  | "discount"
  | "shipping"
  | "coupon"
  | "totals"
  | "payments"
  | "account-impact"
  | "observations";

/**
 * Region donde vive una card en el render del modal de Factura.
 *
 *   - `header`: cabecera del comprobante (fuera del grid).
 *   - `lines`:  zona de articulos (fuera del grid).
 *   - `aside`:  grid 12-col con drag/resize XY (cards laterales).
 *   - `mainBelowLines`: debajo de Lineas, ancho completo del area
 *     principal. Sin grid — se renderea en orden vertical simple.
 *     Hoy aplica a `observations` en COMPACT y CLASSIC; el SSOT del
 *     default por preset vive en `MAIN_BELOW_LINES_BY_PRESET`.
 */
export type CardRegion = "header" | "lines" | "aside" | "mainBelowLines";

export type LayoutV2Card = {
  id: CardId;
  region: CardRegion;
  /** Columna inicial (0-11 en una grilla de 12). */
  x: number;
  /** Fila inicial (0+). */
  y: number;
  /** Ancho en columnas (1-12). */
  w: number;
  /** Alto en filas (1+). El grid usa rowHeight fijo del context. */
  h: number;
  /** Ancho minimo permitido al resize. Default: 2. */
  minW?: number;
  /** Alto minimo permitido al resize. Default: 2. */
  minH?: number;
  /**
   * Si `true`, el operador redimensiono manualmente esta card y
   * el auto-grow por contenido NO la toca mas (respeta su decision).
   *
   * Reglas:
   *   · undefined/false → el card crece automaticamente cuando el
   *     contenido medido excede `h * rowHeight`.
   *   · true → el card mantiene su `h` actual aun si el contenido
   *     se desborda (gana el scroll-y interno como red de seguridad).
   *   · Resetear el card via "Restaurar diseño del preset" limpia
   *     el flag y vuelve al auto-grow.
   */
  manuallyResized?: boolean;
};

export type LayoutV2 = {
  version: 2;
  cards: LayoutV2Card[];
};

export type PersistenceStatus = "idle" | "pending" | "saving" | "saved" | "error";

/** Mis vistas — preset NOMBRADO guardado por el usuario sobre cualquier preset base. */
export type NamedLayoutPreset = {
  id: string;
  name: string;
  layoutV2: LayoutV2;
  isDefault?: boolean;
  createdAt?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Compatibilidad V1 — exports aditivos para que archivos legacy del stash
// (DraggableCard, LayoutDndContext, layoutMigration, defaults.ts,
// ResizeHandle, etc.) compilen. NO se usan en el render actual: el modal
// vivo arma todo desde el sistema V2 (LayoutGridContext + presetLayouts).
// Se conservan estos tipos para mantener back-compat sin tirar codigo
// historico recuperado del stash.
// ─────────────────────────────────────────────────────────────────────────────

/** Zona vertical del modal V1 — slot + order + width discreto. */
export type Slot = "top" | "main" | "aside" | "bottom";

/** Granularidad de ancho V1 — snap a 4 valores discretos. */
export type Width = "full" | "half" | "third" | "two-thirds";

/** Card V1 — id + slot + order + width. */
export type LayoutCard = {
  id:    CardId;
  slot:  Slot;
  order: number;
  width: Width;
};

/** Version del contrato V1. */
export const CURRENT_LAYOUT_VERSION = 1 as const;

/** Layout V1 completo. */
export type LayoutConfig = {
  version: number;
  cards:   LayoutCard[];
};

export const VALID_CARD_IDS: ReadonlySet<CardId> = new Set<CardId>([
  "header",
  "lines",
  "discount",
  "shipping",
  "coupon",
  "totals",
  "payments",
  "account-impact",
  "observations",
]);

export const VALID_SLOTS: ReadonlySet<Slot> = new Set<Slot>([
  "top", "main", "aside", "bottom",
]);

export const VALID_WIDTHS: ReadonlySet<Width> = new Set<Width>([
  "full", "half", "third", "two-thirds",
]);
