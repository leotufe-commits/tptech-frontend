import { apiFetch } from "../lib/api";

export type CouponDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type CouponScope = "ALL" | "CLIENT" | "CATEGORY" | "ARTICLE" | "GROUP" | "BRAND" | "METALS";

export type CouponRow = {
  id:              string;
  jewelryId:       string;
  name:            string;
  code:            string;
  description:     string;
  discountType:    CouponDiscountType;
  discountValue:   string;
  validFrom:       string | null;
  validTo:         string | null;
  maxUsesTotal:    number | null;
  maxUsesPerClient: number | null;
  applyScope:      CouponScope;
  isActive:        boolean;
  notes:           string;
  deletedAt:       string | null;
  createdAt:       string;
  updatedAt:       string;
  _count?: { redemptions: number };
  articles?:      { article:   { id: string; name: string } }[];
  variants?:      { variant:   { id: string; code: string; name: string; articleId: string; article: { id: string; name: string } } }[];
  categories?:    { category:  { id: string; name: string } }[];
  groups?:        { group:     { id: string; name: string } }[];
  clients?:       { client:    { id: string; displayName: string } }[];
  brands?:        { brandName: string }[];
  metalVariants?: { metalVariantId: string; metalVariant: { id: string; name: string; sku: string; purity: string } }[];
};

export type CouponPayload = {
  name:              string;
  code?:             string;
  description?:      string;
  discountType:      CouponDiscountType;
  discountValue:     number;
  validFrom?:        string | null;
  validTo?:          string | null;
  maxUsesTotal?:     number | null;
  maxUsesPerClient?: number | null;
  applyScope?:       CouponScope;
  isActive?:         boolean;
  notes?:            string;
  articleIds?:       string[];
  variantIds?:       string[];
  categoryIds?:      string[];
  groupIds?:         string[];
  clientIds?:        string[];
  brandNames?:       string[];
  metalVariantIds?:  string[];
};

export type ValidateCouponResult = {
  id:            string;
  code:          string;
  name:          string;
  discountType:  CouponDiscountType;
  discountValue: number;
  valid:         boolean;
  reason?:       string;
};

export const COUPON_DISCOUNT_TYPE_LABELS: Record<CouponDiscountType, string> = {
  PERCENTAGE:   "Porcentaje (%)",
  FIXED_AMOUNT: "Monto fijo ($)",
};

export const COUPON_SCOPE_LABELS: Record<CouponScope, string> = {
  ALL:      "Todos los artículos",
  CLIENT:   "Clientes específicos",
  GROUP:    "Grupos de artículos",
  CATEGORY: "Categorías de artículos",
  BRAND:    "Marcas de artículos",
  ARTICLE:  "Artículos y servicios específicos",
  METALS:   "Variantes de metal",
};

export const couponsApi = {
  list: (opts?: { skip?: number; take?: number; q?: string }) => {
    const qs = new URLSearchParams();
    if (opts?.skip != null) qs.set("skip", String(opts.skip));
    if (opts?.take != null) qs.set("take", String(opts.take));
    if (opts?.q)            qs.set("q",    opts.q);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<{ data: CouponRow[]; total: number }>(`/coupons${query}`);
  },
  getOne:   (id: string) =>
    apiFetch<CouponRow>(`/coupons/${id}`),
  create:   (d: CouponPayload) =>
    apiFetch("/coupons", { method: "POST", body: d }),
  update:   (id: string, d: CouponPayload) =>
    apiFetch(`/coupons/${id}`, { method: "PUT", body: d }),
  toggle:   (id: string) =>
    apiFetch(`/coupons/${id}/toggle`, { method: "PATCH" }),
  remove:   (id: string) =>
    apiFetch(`/coupons/${id}`, { method: "DELETE" }),
  validate: (code: string, opts?: { clientId?: string; articleId?: string; categoryId?: string; groupId?: string }) => {
    const qs = new URLSearchParams({ code });
    if (opts?.clientId)   qs.set("clientId",   opts.clientId);
    if (opts?.articleId)  qs.set("articleId",  opts.articleId);
    if (opts?.categoryId) qs.set("categoryId", opts.categoryId);
    if (opts?.groupId)    qs.set("groupId",    opts.groupId);
    return apiFetch<ValidateCouponResult>(`/coupons/validate?${qs.toString()}`);
  },
};
