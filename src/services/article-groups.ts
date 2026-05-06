// src/services/article-groups.ts
import { apiFetch } from "../lib/api";

export type ArticleGroupImage = {
  id: string;
  url: string;
  isMain: boolean;
  sortOrder: number;
  createdAt: string;
};

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
  _count: { items: number };
};

/** Item vendible dentro del grupo (variante o artículo simple) */
export type ArticleGroupMember = {
  id: string;               // ArticleGroupItem.id (usado en todas las ops)
  itemType: "ARTICLE" | "VARIANT";
  refId: string;            // variantId o articleId según itemType
  code: string;
  sku: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
  groupOrder: number;
  groupSelectorValue: string;
  stockTotal: number;
  resolvedSalePrice: string | null;
  resolvedSalePriceWithTax: string | null;
  article: {
    id: string;
    name: string;
    code: string;
    mainImageUrl: string;
    status: string;
    salePrice: string | null;
    category: { id: string; name: string } | null;
  };
};

export type ArticleGroupDetail = ArticleGroupRow & {
  items: ArticleGroupMember[];
  images: ArticleGroupImage[];
};

/** Item disponible para agregar al grupo (resultado del buscador) */
export type ArticleGroupAvailableItem = {
  itemType: "ARTICLE" | "VARIANT";
  id: string;       // variantId o articleId
  code: string;
  sku: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
  groupId: string | null;
  group: { id: string; name: string } | null;
  article: {
    id: string;
    name: string;
    code: string;
    mainImageUrl: string;
    status: string;
  };
};

export type ArticleTreeVariantNode = {
  variantId: string;
  name: string;
  code: string;
  sku: string;
  imageUrl: string;
  isActive: boolean;
  alreadyInGroup: boolean;
  inOtherGroup: boolean;
  otherGroupName: string | null;
};

export type ArticleTreeNode = {
  articleId: string;
  name: string;
  code: string;
  mainImageUrl: string;
  isActive: boolean;
  hasVariants: boolean;
  variants: ArticleTreeVariantNode[];
  alreadyInGroup: boolean;
  inOtherGroup: boolean;
  otherGroupName: string | null;
};

export type BatchAddItem = {
  itemType: "ARTICLE" | "VARIANT";
  refId: string;
  selectorValue?: string;
};

export type BatchAddResult = {
  added: number;
  skipped: number;
  items: Array<{ id: string; groupId: string; groupOrder: number; groupSelectorValue: string; itemType: string }>;
};

export type ArticleVariantGroupState = {
  id: string;
  name: string;
  code: string;
  sku: string;
  imageUrl: string;
  isActive: boolean;
  itemId: string | null;
  groupId: string | null;
  groupName: string | null;
};

export type ArticleGroupState = {
  hasVariants: boolean;
  articleItemId: string | null;
  articleGroupId: string | null;
  articleGroupName: string | null;
  variants: ArticleVariantGroupState[];
};

export type GroupBatchChange = {
  type: "ARTICLE" | "VARIANT";
  id: string;
  groupId: string | null;
};

export type ArticleGroupPayload = {
  name: string;
  slug?: string;
  description?: string;
  mainImageUrl?: string;
  selectorLabel?: string;
  isActive?: boolean;
};

/** Opción enriquecida de grupo para TPComboMulti / TPComboFixed */
export type GroupComboOption = {
  value: string;
  label: string;
  imageUrl: string;
  sublabel?: string;
};

/**
 * Convierte una lista de grupos en opciones ricas para TPComboMulti o TPComboFixed.
 * Incluye imagen, nombre y metadata (selectorLabel + cantidad de ítems).
 * Filtra grupos inactivos o eliminados.
 */
export function groupsToComboOptions(groups: ArticleGroupRow[]): GroupComboOption[] {
  return groups
    .filter(g => g.isActive && !g.deletedAt)
    .map(g => {
      const parts: string[] = [];
      if (g.selectorLabel) parts.push(g.selectorLabel);
      if (g._count.items > 0) parts.push(`${g._count.items} ítem${g._count.items !== 1 ? "s" : ""}`);
      return {
        value:    g.id,
        label:    g.name,
        imageUrl: g.mainImageUrl,
        sublabel: parts.length > 0 ? parts.join(" · ") : undefined,
      };
    });
}

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

  // ── Items del grupo ────────────────────────────────────────────────────────

  searchAvailable: (groupId: string, q: string) =>
    apiFetch<ArticleGroupAvailableItem[]>(
      `/article-groups/${groupId}/available-items?q=${encodeURIComponent(q)}`,
      { method: "GET", on401: "throw" },
    ),

  searchAvailableTree: (groupId: string, q: string) =>
    apiFetch<ArticleTreeNode[]>(
      `/article-groups/${groupId}/available-items/tree?q=${encodeURIComponent(q)}`,
      { method: "GET", on401: "throw" },
    ),

  addItemsBatch: (groupId: string, items: BatchAddItem[]) =>
    apiFetch<BatchAddResult>(
      `/article-groups/${groupId}/items/batch`,
      { method: "POST", body: { items }, on401: "throw" },
    ),

  addItem: (
    groupId: string,
    itemType: "ARTICLE" | "VARIANT",
    refId: string,
    selectorValue?: string,
  ) =>
    apiFetch<{ id: string; groupId: string; groupOrder: number; groupSelectorValue: string; itemType: string }>(
      `/article-groups/${groupId}/items`,
      { method: "POST", body: { itemType, refId, selectorValue: selectorValue ?? "" }, on401: "throw" },
    ),

  updateSelectorValue: (groupId: string, itemId: string, value: string) =>
    apiFetch<{ id: string; groupSelectorValue: string }>(
      `/article-groups/${groupId}/items/${itemId}/selector-value`,
      { method: "PATCH", body: { value }, on401: "throw" },
    ),

  removeItem: (groupId: string, itemId: string) =>
    apiFetch<{ id: string; groupId: string }>(
      `/article-groups/${groupId}/items/${itemId}`,
      { method: "DELETE", on401: "throw" },
    ),

  reorderItems: (groupId: string, orderedIds: string[]) =>
    apiFetch<{ ok: boolean }>(
      `/article-groups/${groupId}/items/reorder`,
      { method: "PUT", body: { orderedIds }, on401: "throw" },
    ),

  // ── Imágenes ───────────────────────────────────────────────────────────────

  listImages: (groupId: string) =>
    apiFetch<ArticleGroupImage[]>(`/article-groups/${groupId}/images`, { method: "GET", on401: "throw" }),

  uploadImage: (groupId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<ArticleGroupImage>(
      `/article-groups/${groupId}/images`,
      { method: "POST", body: form, on401: "throw" },
    );
  },

  setMainImage: (groupId: string, imageId: string) =>
    apiFetch<ArticleGroupImage[]>(
      `/article-groups/${groupId}/images/${imageId}/set-main`,
      { method: "PATCH", on401: "throw" },
    ),

  removeImage: (groupId: string, imageId: string) =>
    apiFetch<{ id: string }>(
      `/article-groups/${groupId}/images/${imageId}`,
      { method: "DELETE", on401: "throw" },
    ),

  // ── Asignación directa desde contexto de artículo ─────────────────────────

  assignToArticle: (articleId: string, groupId: string | null) =>
    apiFetch<{ ok: boolean; groupId: string | null }>(
      `/articles/${articleId}/group`,
      { method: "PATCH", body: { groupId }, on401: "throw" },
    ),

  getArticleGroupState: (articleId: string) =>
    apiFetch<ArticleGroupState>(
      `/articles/${articleId}/group-state`,
      { method: "GET", on401: "throw" },
    ),

  applyArticleGroupBatch: (articleId: string, changes: GroupBatchChange[]) =>
    apiFetch<{ ok: boolean }>(
      `/articles/${articleId}/group-batch`,
      { method: "PATCH", body: { changes }, on401: "throw" },
    ),
};
