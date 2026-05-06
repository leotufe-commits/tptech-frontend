// src/pages/InventarioAlmacenes/types.ts

export type WarehouseAttachment = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt?: string;
};

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
  floor?: string;
  apartment?: string;
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

  attachments?: WarehouseAttachment[];
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
  floor: string;
  apartment: string;
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
  | "city"
  | "location"
  | "isActive"
  | "stockGrams"
  | "stockPieces";

export type SortDir = "asc" | "desc";