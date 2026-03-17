import { apiFetch } from "../lib/api";

export type CommissionType = "NONE" | "PERCENTAGE" | "FIXED_AMOUNT";
export type CommissionBase = "GROSS" | "NET" | "MARGIN";

export type SellerWarehouse = {
  warehouseId: string;
  warehouse: { id: string; name: string; isActive: boolean };
};

export type SellerAttachment = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
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
  avatarUrl: string;
  street: string;
  streetNumber: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;
  commissionType: CommissionType;
  commissionValue: string | null;
  commissionBase: CommissionBase;
  userId: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  isFavorite: boolean;
  isActive: boolean;
  sortOrder: number;
  notes: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  warehouses: SellerWarehouse[];
  attachments: SellerAttachment[];
};

export type SellerPayload = {
  firstName: string;
  lastName: string;
  displayName?: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  commissionType?: CommissionType;
  commissionValue?: string | null;
  commissionBase?: CommissionBase;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive?: boolean;
  isFavorite?: boolean;
  notes?: string;
  warehouseIds?: string[];
  userId?: string | null;
};

function normalizePayload(data: SellerPayload): SellerPayload {
  return {
    ...data,
    commissionValue:
      data.commissionType && data.commissionType !== "NONE" && data.commissionValue
        ? String(data.commissionValue)
        : null,
    commissionBase: data.commissionBase ?? "NET",
  };
}

export const sellersApi = {
  list: () =>
    apiFetch<SellerRow[]>("/sellers", {
      method: "GET",
      on401: "throw",
    }),

  create: (data: SellerPayload) =>
    apiFetch<SellerRow>("/sellers", {
      method: "POST",
      body: normalizePayload(data),
      on401: "throw",
    }),

  update: (id: string, data: SellerPayload) =>
    apiFetch<SellerRow>(`/sellers/${id}`, {
      method: "PUT",
      body: normalizePayload(data),
      on401: "throw",
    }),

  toggle: (id: string) =>
    apiFetch<SellerRow>(`/sellers/${id}/toggle`, {
      method: "PATCH",
      on401: "throw",
    }),

  setFavorite: (id: string) =>
    apiFetch<SellerRow>(`/sellers/${id}/favorite`, {
      method: "PATCH",
      on401: "throw",
    }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/sellers/${id}`, {
      method: "DELETE",
      on401: "throw",
    }),

  uploadAvatar: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);

    return apiFetch<SellerRow>(`/sellers/${id}/avatar`, {
      method: "PATCH",
      body: form,
      on401: "throw",
    });
  },

  addAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);

    return apiFetch<SellerAttachment>(`/sellers/${id}/attachments`, {
      method: "POST",
      body: form,
      on401: "throw",
    });
  },

  deleteAttachment: (id: string, attachmentId: string) =>
    apiFetch<{ id: string }>(`/sellers/${id}/attachments/${attachmentId}`, {
      method: "DELETE",
      on401: "throw",
    }),
};