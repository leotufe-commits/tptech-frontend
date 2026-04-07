import { apiFetch } from "../lib/api";
import type { PromotionType } from "./promotions";

export type QuantityDiscountTier = {
  id:     string;
  minQty: string;
  type:   PromotionType;
  value:  string;
};

export type QuantityDiscountEvaluationMode = "LINE" | "CATEGORY_TOTAL" | "BRAND_TOTAL" | "GROUP_TOTAL";

export type QuantityDiscountRow = {
  id:             string;
  articleId:      string | null;
  variantId:      string | null;
  categoryId:     string | null;
  brand:          string | null;
  groupId:        string | null;
  isActive:       boolean;
  isStackable:    boolean;
  evaluationMode: QuantityDiscountEvaluationMode;
  sortOrder:      number;
  deletedAt:      string | null;
  createdAt:      string;
  article:  { id: string; code: string; name: string } | null;
  variant:  { id: string; code: string; name: string } | null;
  category: { id: string; name: string } | null;
  group:    { id: string; name: string } | null;
  tiers:    QuantityDiscountTier[];
};

export type QuantityDiscountPayload = {
  articleId?:      string | null;
  variantId?:      string | null;
  categoryId?:     string | null;
  brand?:          string | null;
  groupId?:        string | null;
  isActive?:       boolean;
  isStackable?:    boolean;
  evaluationMode?: QuantityDiscountEvaluationMode;
  sortOrder?:      number;
  tiers:           { minQty: number; type: PromotionType; value: number }[];
};

export type QuantityDiscountListResult = {
  data:  QuantityDiscountRow[];
  total: number;
  skip:  number;
  take:  number;
};

export const quantityDiscountsApi = {
  list: (params?: { skip?: number; take?: number; articleId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.skip != null)  qs.set("skip",      String(params.skip));
    if (params?.take != null)  qs.set("take",      String(params.take));
    if (params?.articleId)     qs.set("articleId", params.articleId);
    return apiFetch<QuantityDiscountListResult>(`/quantity-discounts?${qs}`, { on401: "throw" });
  },

  create: (data: QuantityDiscountPayload) =>
    apiFetch<QuantityDiscountRow>("/quantity-discounts", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: Partial<QuantityDiscountPayload>) =>
    apiFetch<QuantityDiscountRow>(`/quantity-discounts/${id}`, { method: "PUT", body: data, on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ ok: boolean }>(`/quantity-discounts/${id}`, { method: "DELETE", on401: "throw" }),
};
