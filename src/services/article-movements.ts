import { apiFetch } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ArticleMovementKind = "IN" | "OUT" | "TRANSFER" | "ADJUST" | "OPENING";

/** Desglose por variante de metal en una línea de movimiento.
 *  Calculado por el backend (NO recalcular en frontend). */
export type MovementLineMetal = {
  metalVariantId: string | null;
  name: string;
  gramsUnit: number;   // gramos por unidad para esta variante de metal
  gramsTotal: number;  // gramsUnit × abs(quantity)
};

export type ArticleMovementLine = {
  id: string;
  articleId: string;
  variantId: string | null;
  quantity: string;
  weightPerUnit: string | null;  // gramos totales por unidad (snapshot al crear)
  totalWeight: string | null;    // quantity.abs() × weightPerUnit (snapshot al crear)
  article: { id: string; code: string; name: string; sku: string; mainImageUrl: string } | null;
  variant:  { id: string; code: string; name: string; sku: string; imageUrl: string } | null;
  /** Desglose por variante de metal — viene del backend, NO calcular en frontend. */
  metals: MovementLineMetal[];
};

export type MovementStatus = "DRAFT" | "CONFIRMED" | "VOIDED";

export type ArticleMovementRow = {
  id: string;
  kind: ArticleMovementKind;
  status: MovementStatus;
  code: string;
  note: string;
  effectiveAt: string;
  createdAt: string;
  voidedAt: string | null;
  voidedNote: string | null;
  hasNegativeStock?: boolean;
  warehouse?:     { id: string; name: string; code: string } | null;
  fromWarehouse?: { id: string; name: string; code: string } | null;
  toWarehouse?:   { id: string; name: string; code: string } | null;
  createdBy?: { id: string; name: string | null; email: string } | null;
  voidedBy?:  { id: string; name: string | null; email: string } | null;
  lines: ArticleMovementLine[];
};

export type ArticleMovementListResult = {
  rows: ArticleMovementRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ArticleMovementFilters = {
  page?: number;
  pageSize?: number;
  q?: string;
  kind?: ArticleMovementKind | "";
  warehouseId?: string | null;
  articleId?: string | null;
  variantId?: string | null;
  from?: string | null;
  to?: string | null;
};

export type CreateMovementLine = {
  articleId: string;
  variantId?: string | null;
  quantity: number;
  weightPerUnit?: number | null;  // peso real por unidad (g); null si no aplica
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export const articleMovementsApi = {
  list(filters: ArticleMovementFilters): Promise<ArticleMovementListResult> {
    return apiFetch("/article-movements/list", { method: "POST", body: filters });
  },

  create(body: {
    kind: Exclude<ArticleMovementKind, "TRANSFER">;
    warehouseId: string;
    effectiveAt: string;
    note?: string;
    lines: CreateMovementLine[];
  }): Promise<ArticleMovementRow> {
    return apiFetch("/article-movements", { method: "POST", body });
  },

  transfer(body: {
    fromWarehouseId: string;
    toWarehouseId: string;
    effectiveAt: string;
    note?: string;
    lines: CreateMovementLine[];
  }): Promise<ArticleMovementRow> {
    return apiFetch("/article-movements/transfer", { method: "POST", body });
  },

  voidMovement(id: string, note?: string): Promise<ArticleMovementRow> {
    return apiFetch(`/article-movements/${id}/void`, { method: "POST", body: { note } });
  },
};
