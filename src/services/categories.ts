import { apiFetch } from "../lib/api";

export type CategoryRow = {
  id: string;
  jewelryId: string;
  parentId: string | null;
  defaultPriceListId: string | null;
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  parent: { id: string; name: string } | null;
  defaultPriceList: { id: string; name: string; code: string } | null;
  childrenCount: number;
  attributeCount: number;
  attributePreview: string[];
};

export type CategoryPayload = {
  name: string;
  parentId?: string | null;
  defaultPriceListId?: string | null;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type CategoryAttribute = {
  id: string;           // ArticleCategoryAttribute.id (assignmentId)
  isRequired: boolean;
  isVariantAxis: boolean;
  sortOrder: number;
  definition: {
    id: string;
    name: string;
    code: string;
    inputType: string;
    options: { id: string; label: string; value: string; codeExtension?: string }[];
  };
};

export const categoriesApi = {
  list: () =>
    apiFetch<CategoryRow[]>("/categories", { method: "GET", on401: "throw" }),

  create: (data: CategoryPayload) =>
    apiFetch<CategoryRow>("/categories", {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  update: (id: string, data: CategoryPayload) =>
    apiFetch<CategoryRow>(`/categories/${id}`, {
      method: "PUT",
      body: data,
      on401: "throw",
    }),

  toggle: (id: string) =>
    apiFetch<CategoryRow>(`/categories/${id}/toggle`, {
      method: "PATCH",
      on401: "throw",
    }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/categories/${id}`, {
      method: "DELETE",
      on401: "throw",
    }),

  reorder: (data: { parentId: string | null; orderedIds: string[] }) =>
    apiFetch<{ ok: boolean }>("/categories/reorder", {
      method: "PATCH",
      body: data,
      on401: "throw",
    }),

  attributes: {
    getEffective: (categoryId: string) =>
      apiFetch<CategoryAttribute[]>(`/categories/${categoryId}/attributes/effective`, { method: "GET", on401: "throw" }),
  },
};