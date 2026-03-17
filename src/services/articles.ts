import { apiFetch } from "../lib/api";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type ArticleStatus = "DRAFT" | "ACTIVE" | "DISCONTINUED" | "ARCHIVED";
export type StockMode = "NO_STOCK" | "BY_ARTICLE" | "BY_MATERIAL";
export type HechuraPriceMode = "FIXED" | "PER_GRAM";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ArticleComposition = {
  id: string;
  variantId: string;
  grams: string;
  isBase: boolean;
  sortOrder: number;
  metalVariant: {
    id: string;
    name: string;
    sku: string;
    purity: string;
    metal: { id: string; name: string };
  };
};

export type ArticleVariant = {
  id: string;
  code: string;
  name: string;
  weightOverride: string | null;
  hechuraPriceOverride: string | null;
  priceOverride: string | null;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

export type ArticleAttributeValue = {
  id: string;
  assignmentId: string;
  value: string;
  assignment: {
    id: string;
    isRequired: boolean;
    sortOrder: number;
    definition: {
      id: string;
      name: string;
      code: string;
      inputType: string;
      options: { id: string; label: string; value: string }[];
    };
  };
};

export type ArticleImage = {
  id: string;
  url: string;
  label: string;
  isMain: boolean;
  sortOrder: number;
};

export type ArticleStock = {
  id: string;
  variantId: string | null;
  warehouseId: string;
  quantity: string;
  updatedAt: string;
  variant: { id: string; code: string; name: string } | null;
  warehouse: { id: string; name: string; code: string };
};

export type ArticleRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  categoryId: string | null;
  status: ArticleStatus;
  stockMode: StockMode;
  hechuraPrice: string | null;
  hechuraPriceMode: HechuraPriceMode;
  mermaPercent: string | null;
  mainImageUrl: string;
  isFavorite: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
};

export type ArticleDetail = ArticleRow & {
  jewelryId: string;
  notes: string;
  compositions: ArticleComposition[];
  variants: ArticleVariant[];
  attributeValues: ArticleAttributeValue[];
  images: ArticleImage[];
};

export type ArticleListResponse = {
  rows: ArticleRow[];
  total: number;
  skip: number;
  take: number;
};

export type ArticlePayload = {
  name: string;
  code?: string;
  description?: string;
  categoryId?: string | null;
  status?: ArticleStatus;
  stockMode?: StockMode;
  hechuraPrice?: number | null;
  hechuraPriceMode?: HechuraPriceMode;
  mermaPercent?: number | null;
  isFavorite?: boolean;
  notes?: string;
};

export type CompositionPayload = {
  variantId: string;
  grams: number;
  isBase?: boolean;
  sortOrder?: number;
};

export type VariantPayload = {
  code: string;
  name: string;
  weightOverride?: number | null;
  hechuraPriceOverride?: number | null;
  priceOverride?: number | null;
  sortOrder?: number;
};

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  DISCONTINUED: "Discontinuado",
  ARCHIVED: "Archivado",
};

export const STOCK_MODE_LABELS: Record<StockMode, string> = {
  NO_STOCK: "Sin stock",
  BY_ARTICLE: "Por artículo / variante",
  BY_MATERIAL: "Por material (metal)",
};

export const HECHURA_MODE_LABELS: Record<HechuraPriceMode, string> = {
  FIXED: "Monto fijo",
  PER_GRAM: "Por gramo",
};

export const ARTICLE_STATUS_COLORS: Record<ArticleStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DISCONTINUED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ARCHIVED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export const articlesApi = {
  list: (params?: {
    q?: string;
    categoryId?: string;
    status?: string;
    stockMode?: string;
    isFavorite?: boolean;
    showInactive?: boolean;
    skip?: number;
    take?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.categoryId) qs.set("categoryId", params.categoryId);
    if (params?.status) qs.set("status", params.status);
    if (params?.stockMode) qs.set("stockMode", params.stockMode);
    if (params?.isFavorite) qs.set("isFavorite", "true");
    if (params?.showInactive) qs.set("showInactive", "true");
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.take != null) qs.set("take", String(params.take));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<ArticleListResponse>(`/articles${query}`, { method: "GET", on401: "throw" });
  },

  getOne: (id: string) =>
    apiFetch<ArticleDetail>(`/articles/${id}`, { method: "GET", on401: "throw" }),

  create: (data: ArticlePayload) =>
    apiFetch<ArticleDetail>("/articles", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: ArticlePayload) =>
    apiFetch<ArticleDetail>(`/articles/${id}`, { method: "PUT", body: data, on401: "throw" }),

  toggle: (id: string) =>
    apiFetch<ArticleRow>(`/articles/${id}/toggle`, { method: "PATCH", on401: "throw" }),

  favorite: (id: string) =>
    apiFetch<{ id: string; isFavorite: boolean }>(`/articles/${id}/favorite`, { method: "PATCH", on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/articles/${id}`, { method: "DELETE", on401: "throw" }),

  compositions: {
    list: (articleId: string) =>
      apiFetch<ArticleComposition[]>(`/articles/${articleId}/compositions`, { method: "GET", on401: "throw" }),
    upsert: (articleId: string, data: CompositionPayload) =>
      apiFetch<ArticleComposition>(`/articles/${articleId}/compositions`, { method: "PUT", body: data, on401: "throw" }),
    remove: (articleId: string, compositionId: string) =>
      apiFetch<{ id: string }>(`/articles/${articleId}/compositions/${compositionId}`, { method: "DELETE", on401: "throw" }),
  },

  variants: {
    list: (articleId: string) =>
      apiFetch<ArticleVariant[]>(`/articles/${articleId}/variants`, { method: "GET", on401: "throw" }),
    create: (articleId: string, data: VariantPayload) =>
      apiFetch<ArticleVariant>(`/articles/${articleId}/variants`, { method: "POST", body: data, on401: "throw" }),
    update: (articleId: string, variantId: string, data: Partial<VariantPayload>) =>
      apiFetch<ArticleVariant>(`/articles/${articleId}/variants/${variantId}`, { method: "PUT", body: data, on401: "throw" }),
    toggle: (articleId: string, variantId: string) =>
      apiFetch<ArticleVariant>(`/articles/${articleId}/variants/${variantId}/toggle`, { method: "PATCH", on401: "throw" }),
    remove: (articleId: string, variantId: string) =>
      apiFetch<{ id: string }>(`/articles/${articleId}/variants/${variantId}`, { method: "DELETE", on401: "throw" }),
  },

  attributes: {
    set: (articleId: string, values: { assignmentId: string; value: string }[]) =>
      apiFetch<ArticleAttributeValue[]>(`/articles/${articleId}/attributes`, { method: "PUT", body: { values }, on401: "throw" }),
  },

  images: {
    upload: (articleId: string, file: File, label?: string, isMain?: boolean) => {
      const fd = new FormData();
      fd.append("file", file);
      if (label) fd.append("label", label);
      if (isMain) fd.append("isMain", "true");
      return apiFetch<ArticleImage>(`/articles/${articleId}/images`, { method: "POST", body: fd, on401: "throw" });
    },
    setMain: (articleId: string, imageId: string) =>
      apiFetch<ArticleImage>(`/articles/${articleId}/images/${imageId}/set-main`, { method: "PATCH", on401: "throw" }),
    updateLabel: (articleId: string, imageId: string, label: string) =>
      apiFetch<ArticleImage>(`/articles/${articleId}/images/${imageId}`, { method: "PATCH", body: { label }, on401: "throw" }),
    remove: (articleId: string, imageId: string) =>
      apiFetch<{ id: string }>(`/articles/${articleId}/images/${imageId}`, { method: "DELETE", on401: "throw" }),
  },

  stock: {
    get: (articleId: string) =>
      apiFetch<ArticleStock[]>(`/articles/${articleId}/stock`, { method: "GET", on401: "throw" }),
    adjust: (articleId: string, data: { warehouseId: string; variantId?: string | null; quantity: number }) =>
      apiFetch<ArticleStock>(`/articles/${articleId}/stock`, { method: "PUT", body: data, on401: "throw" }),
  },
};
