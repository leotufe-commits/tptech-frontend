// src/services/purchases.ts
import { apiFetch } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PurchaseStatus = "DRAFT" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export type PurchaseLineRow = {
  id: string;
  articleId: string | null;
  variantId: string | null;
  articleName: string;
  variantName: string;
  sku: string;
  barcode: string;
  quantity: string;
  unitCost: string;
  lineTotal: string;
  breakdownSnapshot: unknown | null;
  sortOrder: number;
};

export type PaymentComponentRow = {
  id: string;
  componentType: "MONEY" | "METAL";
  amount: string | null;
  currency: string;
  metalId: string | null;
  variantId: string | null;
  gramsOriginal: string | null;
  purity: string | null;
  gramsPure: string | null;
};

export type PurchasePaymentRow = {
  id: string;
  paymentDate: string;
  note: string;
  createdAt: string;
  components: PaymentComponentRow[];
};

export type PurchaseRow = {
  id: string;
  code: string;
  status: PurchaseStatus;
  purchaseDate: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  paidAmount: string;
  notes: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  supplier: { id: string; displayName: string; code: string };
  createdBy: { id: string; name: string | null; firstName: string; lastName: string } | null;
  _count: { lines: number };
};

export type PurchaseDetail = PurchaseRow & {
  supplierSnapshot: unknown | null;
  cancelNote: string;
  confirmedById: string | null;
  cancelledById: string | null;
  lines: PurchaseLineRow[];
  payments: PurchasePaymentRow[];
};

export type CreatePurchaseLineInput = {
  articleId?: string | null;
  variantId?: string | null;
  quantity: number;
  unitCost: number;
  discountPct?: number;
};

export type CreatePurchaseInput = {
  supplierId: string;
  purchaseDate?: string;
  notes?: string;
  lines: CreatePurchaseLineInput[];
};

export type MoneyComponentInput = {
  componentType: "MONEY";
  amount: number;
  currency?: string;
};

export type MetalComponentInput = {
  componentType: "METAL";
  metalId: string;
  variantId: string;
  gramsOriginal: number;
  purity: number;
  gramsPure: number;
};

export type PaymentComponentInput = MoneyComponentInput | MetalComponentInput;

export type RegisterPaymentInput = {
  purchaseId?: string | null;
  paymentDate?: string;
  note?: string;
  components: PaymentComponentInput[];
};

export type MetalReturnInput = {
  purchaseId?: string | null;
  paymentDate?: string;
  note?: string;
  metalId: string;
  variantId: string;
  gramsOriginal: number;
  purity: number;
  gramsPure: number;
};

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const purchasesService = {
  list: (params?: {
    supplierId?: string;
    status?: string;
    q?: string;
    skip?: number;
    take?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.supplierId) qs.set("supplierId", params.supplierId);
    if (params?.status)     qs.set("status", params.status);
    if (params?.q)          qs.set("q", params.q);
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.take != null) qs.set("take", String(params.take));
    const query = qs.toString() ? `?${qs}` : "";
    return apiFetch<{ items: PurchaseRow[]; total: number; skip: number; take: number }>(
      `/purchases${query}`,
      { method: "GET", on401: "throw" }
    );
  },

  get: (id: string) =>
    apiFetch<PurchaseDetail>(`/purchases/${id}`, { method: "GET", on401: "throw" }),

  create: (body: CreatePurchaseInput) =>
    apiFetch<PurchaseDetail>("/purchases", { method: "POST", body: JSON.stringify(body), on401: "throw" }),

  confirm: (id: string) =>
    apiFetch<PurchaseDetail>(`/purchases/${id}/confirm`, { method: "POST", on401: "throw" }),

  cancel: (id: string, cancelNote?: string) =>
    apiFetch<PurchaseRow>(`/purchases/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancelNote: cancelNote || "" }),
      on401: "throw",
    }),

  registerPayment: (supplierId: string, body: RegisterPaymentInput) =>
    apiFetch(`/purchases/suppliers/${supplierId}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
      on401: "throw",
    }),

  registerMetalReturn: (supplierId: string, body: MetalReturnInput) =>
    apiFetch(`/purchases/suppliers/${supplierId}/metal-returns`, {
      method: "POST",
      body: JSON.stringify(body),
      on401: "throw",
    }),

  listPayments: (supplierId: string, purchaseId?: string) => {
    const qs = purchaseId ? `?purchaseId=${purchaseId}` : "";
    return apiFetch<{ items: any[]; total: number }>(
      `/purchases/suppliers/${supplierId}/payments${qs}`,
      { method: "GET", on401: "throw" }
    );
  },

  voidPayment: (paymentId: string, reason?: string) =>
    apiFetch(`/purchases/payments/${paymentId}/void`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "" }),
      on401: "throw",
    }),

  applyCredit: (supplierId: string, body: RegisterPaymentInput) =>
    apiFetch(`/purchases/suppliers/${supplierId}/apply-credit`, {
      method: "POST",
      body: JSON.stringify(body),
      on401: "throw",
    }),
};
