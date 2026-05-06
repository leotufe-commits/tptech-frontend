import { apiFetch } from "../lib/api";

export type PromotionType  = "FIXED" | "PERCENTAGE";
export type PromotionScope = "ALL" | "ARTICLE" | "VARIANT" | "CATEGORY" | "BRAND" | "GROUP" | "METALS";

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
  articles:      { articleId: string; article: { id: string; code: string; name: string } }[];
  variants:      { variantId: string; variant: { id: string; code: string; name: string; articleId: string; article: { id: string; code: string; name: string } | null } }[];
  categories:    { categoryId: string; category: { id: string; name: string } }[];
  brands:        { brand: string }[];
  groups:        { groupId: string; group: { id: string; name: string } }[];
  metalVariants?: { metalVariantId: string; metalVariant: { id: string; name: string; sku: string; purity: string } }[];
};

export type PromotionPayload = {
  name:          string;
  type:          PromotionType;
  value:         number;
  scope?:        PromotionScope;
  articleIds?:       string[];
  variantIds?:       string[];
  categoryIds?:      string[];
  brands?:           string[];
  groupIds?:         string[];
  metalVariantIds?:  string[];
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
  METALS:   "Metales",
};

/**
 * Normaliza el payload antes de enviarlo al backend.
 * El backend exige que `metalVariantIds` sea un array cuando `scope === "METALS"`
 * (validateMetalVariantIds rechaza con 400 si llega undefined/null). Garantizamos
 * el array acá para evitar el error si algún caller omite el campo.
 */
function normalizeMetalsScope<T extends Partial<PromotionPayload>>(data: T): T {
  if (data.scope === "METALS") {
    return {
      ...data,
      metalVariantIds: Array.isArray(data.metalVariantIds) ? data.metalVariantIds : [],
    };
  }
  return data;
}

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
    apiFetch<PromotionRow>("/promotions", { method: "POST", body: normalizeMetalsScope(data), on401: "throw" }),

  update: (id: string, data: Partial<PromotionPayload>) =>
    apiFetch<PromotionRow>(`/promotions/${id}`, { method: "PUT", body: normalizeMetalsScope(data), on401: "throw" }),

  /** Toggle de activo/inactivo. NO usa el validator de scope — ideal para
   *  promociones METALS que se pausan sin reabrir el modal completo. */
  toggle: (id: string) =>
    apiFetch<PromotionRow>(`/promotions/${id}/toggle`, { method: "PATCH", on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ ok: boolean }>(`/promotions/${id}`, { method: "DELETE", on401: "throw" }),
};
