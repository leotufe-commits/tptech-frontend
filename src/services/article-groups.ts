// src/services/article-groups.ts
import { apiFetch } from "../lib/api";

export type ArticleGroupRow = {
  id: string;
  jewelryId: string;
  name: string;
  slug: string;
  description: string;
  mainImageUrl: string;
  selectorLabel: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _count: { articles: number };
};

export type ArticleGroupMember = {
  id: string;
  code: string;
  sku: string | null;
  name: string;
  mainImageUrl: string;
  isActive: boolean;
  status: string;
  salePrice: string | null;
  costPrice: string | null;
  groupOrder: number;
  stockTotal: number;
  category: { id: string; name: string } | null;
};

export type ArticleGroupDetail = ArticleGroupRow & {
  articles: ArticleGroupMember[];
};

export type ArticleGroupAvailableArticle = {
  id: string;
  code: string;
  sku: string | null;
  name: string;
  mainImageUrl: string;
  isActive: boolean;
  status: string;
  salePrice: string | null;
  category: { id: string; name: string } | null;
};

export type ArticleGroupPayload = {
  name: string;
  slug?: string;
  description?: string;
  mainImageUrl?: string;
  selectorLabel?: string;
  isActive?: boolean;
};

export const articleGroupsApi = {
  list: () =>
    apiFetch<ArticleGroupRow[]>("/article-groups", { method: "GET", on401: "throw" }),

  get: (id: string) =>
    apiFetch<ArticleGroupDetail>(`/article-groups/${id}`, { method: "GET", on401: "throw" }),

  create: (data: ArticleGroupPayload) =>
    apiFetch<ArticleGroupRow>("/article-groups", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: ArticleGroupPayload) =>
    apiFetch<ArticleGroupRow>(`/article-groups/${id}`, { method: "PUT", body: data, on401: "throw" }),

  toggle: (id: string) =>
    apiFetch<ArticleGroupRow>(`/article-groups/${id}/toggle`, { method: "PATCH", on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/article-groups/${id}`, { method: "DELETE", on401: "throw" }),

  // Gestión de artículos dentro del grupo
  searchAvailable: (groupId: string, q: string) =>
    apiFetch<ArticleGroupAvailableArticle[]>(
      `/article-groups/${groupId}/available-articles?q=${encodeURIComponent(q)}`,
      { method: "GET", on401: "throw" },
    ),

  addArticle: (groupId: string, articleId: string) =>
    apiFetch<{ id: string; groupId: string; groupOrder: number }>(
      `/article-groups/${groupId}/articles`,
      { method: "POST", body: { articleId }, on401: "throw" },
    ),

  removeArticle: (groupId: string, articleId: string) =>
    apiFetch<{ id: string; groupId: string | null }>(
      `/article-groups/${groupId}/articles/${articleId}`,
      { method: "DELETE", on401: "throw" },
    ),

  reorderArticles: (groupId: string, orderedIds: string[]) =>
    apiFetch<{ ok: boolean }>(
      `/article-groups/${groupId}/articles/reorder`,
      { method: "PUT", body: { orderedIds }, on401: "throw" },
    ),
};
