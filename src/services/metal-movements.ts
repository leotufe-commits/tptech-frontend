// src/services/metal-movements.ts
import { apiFetch } from "../lib/api";

export type MetalMovementKind = "IN" | "OUT" | "TRANSFER" | "ADJUST";

export type MetalMovementLine = {
  id: string;
  variantId: string;
  grams: string; // Decimal devuelto como string por Prisma
  variant: {
    id: string;
    name: string;
    sku: string;
    metal: { id: string; name: string } | null;
  } | null;
};

export type MetalMovementRow = {
  id: string;
  kind: MetalMovementKind;
  code: string;
  note: string;
  effectiveAt: string;
  createdAt: string;
  voidedAt: string | null;
  voidedNote: string | null;
  deletedAt: string | null;
  warehouse?:     { id: string; name: string; code: string } | null;
  fromWarehouse?: { id: string; name: string; code: string } | null;
  toWarehouse?:   { id: string; name: string; code: string } | null;
  createdBy?: { id: string; name: string | null; email: string } | null;
  voidedBy?:  { id: string; name: string | null; email: string } | null;
  lines: MetalMovementLine[];
};

export type MetalMovementListResult = {
  rows: MetalMovementRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type MetalMovementFilters = {
  page?: number;
  pageSize?: number;
  q?: string;
  kind?: MetalMovementKind | "";
  warehouseId?: string | null;
  from?: string | null;
  to?: string | null;
};

export type CreateMetalLine = {
  variantId: string;
  grams: number;
};

export const metalMovementsApi = {
  list(filters: MetalMovementFilters): Promise<MetalMovementListResult> {
    return apiFetch("/movimientos/list", { method: "POST", body: filters });
  },

  create(body: {
    warehouseId: string;
    effectiveAt: string;
    note?: string;
    lines: CreateMetalLine[];
  }): Promise<MetalMovementRow> {
    return apiFetch("/movimientos/create", { method: "POST", body });
  },

  createOut(body: {
    warehouseId: string;
    effectiveAt: string;
    note?: string;
    lines: CreateMetalLine[];
  }): Promise<MetalMovementRow> {
    return apiFetch("/movimientos/out", { method: "POST", body });
  },

  transfer(body: {
    fromWarehouseId: string;
    toWarehouseId: string;
    effectiveAt: string;
    note?: string;
    lines: CreateMetalLine[];
  }): Promise<MetalMovementRow> {
    return apiFetch("/movimientos/transfer", { method: "POST", body });
  },

  adjust(body: {
    warehouseId: string;
    effectiveAt: string;
    note?: string;
    lines: CreateMetalLine[];
  }): Promise<MetalMovementRow> {
    return apiFetch("/movimientos/adjust", { method: "POST", body });
  },

  voidMovement(id: string, note?: string): Promise<MetalMovementRow> {
    return apiFetch(`/movimientos/${id}/void`, { method: "POST", body: { note } });
  },
};
