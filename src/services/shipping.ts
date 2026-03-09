// src/services/shipping.ts
import { apiFetch } from "../lib/api";

/* =========================================================
   Tipos
========================================================= */
export type ShippingCalcMode = "FIXED" | "BY_WEIGHT" | "BY_ZONE";

export type ShippingRate = {
  id?: string;
  name: string;
  zone: string;
  calculationMode: ShippingCalcMode;
  fixedPrice: string | null;
  pricePerKg: string | null;
  minWeight: string | null;
  maxWeight: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type ShippingCarrierRow = {
  id: string;
  jewelryId: string;
  name: string;
  code: string;
  logoUrl: string;
  trackingUrl: string;
  freeShippingThreshold: string | null;
  isFavorite: boolean;
  isActive: boolean;
  sortOrder: number;
  notes: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rates: ShippingRate[];
};

export type ShippingCarrierPayload = {
  name: string;
  code?: string;
  logoUrl?: string;
  trackingUrl?: string;
  freeShippingThreshold?: number | null;
  isFavorite?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
  rates?: Array<{
    id?: string;
    name: string;
    zone: string;
    calculationMode: ShippingCalcMode;
    fixedPrice?: number | null;
    pricePerKg?: number | null;
    minWeight?: number | null;
    maxWeight?: number | null;
    isActive: boolean;
    sortOrder: number;
  }>;
};

/* =========================================================
   API
========================================================= */
export const shippingApi = {
  list: () =>
    apiFetch<ShippingCarrierRow[]>("/shipping", { method: "GET", on401: "throw" }),

  create: (data: ShippingCarrierPayload) =>
    apiFetch<ShippingCarrierRow>("/shipping", {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  clone: (id: string) =>
    apiFetch<ShippingCarrierRow>(`/shipping/${id}/clone`, {
      method: "POST",
      on401: "throw",
    }),

  update: (id: string, data: ShippingCarrierPayload) =>
    apiFetch<ShippingCarrierRow>(`/shipping/${id}`, {
      method: "PUT",
      body: data,
      on401: "throw",
    }),

  toggle: (id: string) =>
    apiFetch<ShippingCarrierRow>(`/shipping/${id}/toggle`, {
      method: "PATCH",
      on401: "throw",
    }),

  favorite: (id: string) =>
    apiFetch<ShippingCarrierRow>(`/shipping/${id}/favorite`, {
      method: "PATCH",
      on401: "throw",
    }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/shipping/${id}`, {
      method: "DELETE",
      on401: "throw",
    }),
};
