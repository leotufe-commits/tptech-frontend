// src/pages/InventarioAlmacenes/warehouses.api.ts
import { apiFetch } from "../../lib/api";
import type { WarehouseAttachment, WarehouseDraft, WarehouseRow } from "./types";

export type ArticleStockRow = {
  id: string;
  quantity: string | number;
  reservedQty: string | number;
  updatedAt: string;
  article: {
    id: string;
    name: string;
    code: string;
    sku: string;
    weight: string | number | null;
    reorderPoint: string | number | null;
    isActive: boolean;
  };
  variant: {
    id: string;
    name: string;
    code: string;
    sku: string;
    weightOverride: string | number | null;
    reorderPoint: string | number | null;
    isActive: boolean;
  } | null;
};

export const warehousesApi = {
  list: () =>
    apiFetch("/warehouses", { method: "GET" }) as Promise<WarehouseRow[]>,

  create: (d: Omit<WarehouseDraft, "code">) =>
    apiFetch("/warehouses", { method: "POST", body: d }) as Promise<WarehouseRow>,

  update: (id: string, d: Omit<WarehouseDraft, "code">) =>
    apiFetch(`/warehouses/${id}`, { method: "PUT", body: d }) as Promise<WarehouseRow>,

  toggle: (id: string) =>
    apiFetch(`/warehouses/${id}/toggle`, { method: "PATCH" }) as Promise<WarehouseRow>,

  remove: (id: string) =>
    apiFetch(`/warehouses/${id}`, { method: "DELETE" }) as Promise<any>,

  favorite: (id: string) =>
    apiFetch(`/warehouses/${id}/favorite`, { method: "PATCH" }) as Promise<{
      ok: true;
      favoriteWarehouseId: string;
    }>,

  getMovements: (id: string) =>
    apiFetch(`/movimientos?warehouseId=${encodeURIComponent(id)}&pageSize=5`, {
      method: "GET",
    }) as Promise<{ rows: any[]; total: number }>,

  getArticleStock: (id: string) =>
    apiFetch(`/warehouses/${encodeURIComponent(id)}/article-stock`, {
      method: "GET",
    }) as Promise<ArticleStockRow[]>,

  getArticleMovements: (id: string) =>
    apiFetch(`/article-movements?warehouseId=${encodeURIComponent(id)}&pageSize=8`, {
      method: "GET",
    }) as Promise<{ rows: any[]; total: number }>,

  getAttachments: (id: string) =>
    apiFetch(`/warehouses/${encodeURIComponent(id)}/attachments`, {
      method: "GET",
    }) as Promise<WarehouseAttachment[]>,

  uploadAttachment: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch(`/warehouses/${encodeURIComponent(id)}/attachments`, {
      method: "POST",
      body: fd as any,
      timeoutMs: 120_000,
    }) as Promise<WarehouseAttachment>;
  },

  deleteAttachment: (id: string, attachmentId: string) =>
    apiFetch(`/warehouses/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`, {
      method: "DELETE",
    }) as Promise<{ id: string }>,
};