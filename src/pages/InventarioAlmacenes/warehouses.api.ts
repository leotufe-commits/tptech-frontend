// src/pages/InventarioAlmacenes/warehouses.api.ts
import { apiFetch } from "../../lib/api";
import type { WarehouseDraft, WarehouseRow } from "./types";

export const warehousesApi = {
  list: () =>
    apiFetch("/warehouses", { method: "GET" }) as Promise<WarehouseRow[]>,

  create: (d: WarehouseDraft) =>
    apiFetch("/warehouses", { method: "POST", body: d }) as Promise<WarehouseRow>,

  update: (id: string, d: WarehouseDraft) =>
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
};