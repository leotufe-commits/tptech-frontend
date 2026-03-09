// src/services/categories.ts
import { apiFetch } from "../lib/api";

export type CategoryRow = {
  id: string;
  jewelryId: string;
  parentId: string | null;
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  parent: { id: string; name: string } | null;
  childrenCount: number;
};

export type CategoryPayload = {
  name: string;
  parentId?: string | null;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
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
};
