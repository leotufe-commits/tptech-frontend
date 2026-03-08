// src/pages/InventarioAlmacenes/types.ts

export type WarehouseRow = {
  id: string;
  name: string;
  code?: string;

  phoneCountry?: string;
  phoneNumber?: string;
  email?: string;

  attn?: string;
  street?: string;
  number?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;

  location?: string;
  notes?: string;

  isActive: boolean;
  isFavorite?: boolean;

  stockGrams?: number;
  stockPieces?: number;

  deletedAt?: string | null;
};

export type WarehouseDraft = {
  id?: string;
  name: string;
  code: string;

  phoneCountry: string;
  phoneNumber: string;
  email: string;

  attn: string;
  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;

  location: string;
  notes: string;

  isActive: boolean;
};

export type SortKey =
  | "name"
  | "code"
  | "location"
  | "isActive"
  | "stockGrams"
  | "stockPieces";

export type SortDir = "asc" | "desc";