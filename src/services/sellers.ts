// src/services/sellers.ts
import { apiFetch } from "../lib/api";

export type CommissionType = "NONE" | "PERCENTAGE" | "FIXED_AMOUNT";

export type SellerWarehouse = {
  warehouseId: string;
  warehouse: { id: string; name: string; isActive: boolean };
};

export type SellerRow = {
  id: string;
  jewelryId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  commissionType: CommissionType;
  commissionValue: string | null;
  userId: string | null;
  isFavorite: boolean;
  isActive: boolean;
  sortOrder: number;
  notes: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  warehouses: SellerWarehouse[];
};

export type SellerPayload = {
  firstName: string;
  lastName: string;
  displayName?: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  commissionType?: CommissionType;
  commissionValue?: string | null;
  isActive?: boolean;
  isFavorite?: boolean;
  notes?: string;
  warehouseIds?: string[];
};

export const sellersApi = {
  list: () =>
    apiFetch<SellerRow[]>("/sellers", { method: "GET", on401: "throw" }),

  create: (data: SellerPayload) =>
    apiFetch<SellerRow>("/sellers", {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  update: (id: string, data: SellerPayload) =>
    apiFetch<SellerRow>(`/sellers/${id}`, {
      method: "PUT",
      body: data,
      on401: "throw",
    }),

  toggle: (id: string) =>
    apiFetch<SellerRow>(`/sellers/${id}/toggle`, {
      method: "PATCH",
      on401: "throw",
    }),

  setFavorite: (id: string, isFavorite: boolean) =>
    apiFetch<SellerRow>(`/sellers/${id}/favorite`, {
      method: "PATCH",
      body: { isFavorite },
      on401: "throw",
    }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/sellers/${id}`, {
      method: "DELETE",
      on401: "throw",
    }),
};
