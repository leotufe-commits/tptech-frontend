import { apiFetch } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ArticleMovementKind = "IN" | "OUT" | "TRANSFER" | "ADJUST" | "OPENING";

export type ArticleMovementLine = {
  id: string;
  articleId: string;
  variantId: string | null;
  quantity: string;
  article: { id: string; code: string; name: string } | null;
  variant:  { id: string; code: string; name: string } | null;
};

export type ArticleMovementRow = {
  id: string;
  kind: ArticleMovementKind;
  code: string;
  note: string;
  effectiveAt: string;
  createdAt: string;
  voidedAt: string | null;
  voidedNote: string | null;
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
  from?: string | null;
  to?: string | null;
};

export type CreateMovementLine = {
  articleId: string;
  variantId?: string | null;
  quantity: number;
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
