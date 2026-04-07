import { apiFetch } from "../lib/api";

export type PromotionType  = "FIXED" | "PERCENTAGE";
export type PromotionScope = "ALL" | "ARTICLE" | "VARIANT" | "CATEGORY" | "BRAND" | "GROUP";

export type PromotionRow = {
  id:           string;
  name:         string;
  type:         PromotionType;
  value:        string;
  scope:        PromotionScope;
  validFrom:    string | null;
  validTo:      string | null;
  untilStockEnd: boolean;
  priority:     number;
  isStackable:  boolean;
  isActive:     boolean;
  notes:        string;
  deletedAt:    string | null;
  createdAt:    string;
  articles:   { articleId: string; article: { id: string; code: string; name: string } }[];
  variants:   { variantId: string; variant: { id: string; code: string; name: string; articleId: string; article: { id: string; code: string; name: string } | null } }[];
  categories: { categoryId: string; category: { id: string; name: string } }[];
  brands:     { brand: string }[];
  groups:     { groupId: string; group: { id: string; name: string } }[];
};

export type PromotionPayload = {
  name:          string;
  type:          PromotionType;
  value:         number;
  scope?:        PromotionScope;
  articleIds?:   string[];
  variantIds?:   string[];
  categoryIds?:  string[];
  brands?:       string[];
  groupIds?:     string[];
  validFrom?:    string | null;
  validTo?:      string | null;
  untilStockEnd?: boolean;
  priority?:     number;
  isStackable?:  boolean;
  isActive?:     boolean;
  notes?:        string;
};

export type PromotionListResult = {
  data:  PromotionRow[];
  total: number;
  skip:  number;
  take:  number;
};

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  FIXED:      "Monto fijo",
  PERCENTAGE: "Porcentaje",
};

export const PROMOTION_SCOPE_LABELS: Record<PromotionScope, string> = {
  ALL:      "Todos los artículos",
  ARTICLE:  "Artículos",
  VARIANT:  "Variantes",
  CATEGORY: "Categorías",
  BRAND:    "Marcas",
  GROUP:    "Grupos",
};

export const promotionsApi = {
  list: (params?: { skip?: number; take?: number; q?: string; active?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.skip  != null) qs.set("skip",   String(params.skip));
    if (params?.take  != null) qs.set("take",   String(params.take));
    if (params?.q)             qs.set("q",      params.q);
    if (params?.active != null) qs.set("active", String(params.active));
    return apiFetch<PromotionListResult>(`/promotions?${qs}`, { on401: "throw" });
  },

  create: (data: PromotionPayload) =>
    apiFetch<PromotionRow>("/promotions", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: Partial<PromotionPayload>) =>
    apiFetch<PromotionRow>(`/promotions/${id}`, { method: "PUT", body: data, on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ ok: boolean }>(`/promotions/${id}`, { method: "DELETE", on401: "throw" }),
};
