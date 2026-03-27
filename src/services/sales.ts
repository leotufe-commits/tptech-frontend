import { apiFetch } from "../lib/api";

// ─── Enums ───────────────────────────────────────────────────────────────────
export type SaleStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED";

// ─── Sub-types ────────────────────────────────────────────────────────────────

/** Fuente del precio BASE (antes de descuentos). */
export type BasePriceSource =
  | "VARIANT_OVERRIDE"
  | "PRICE_LIST"
  | "MANUAL_OVERRIDE"
  | "MANUAL_FALLBACK"
  | "NONE";

/** Fuente efectiva final (última capa que modificó el precio). */
export type SalePriceSource =
  | "VARIANT_OVERRIDE"
  | "PRICE_LIST"
  | "MANUAL_OVERRIDE"
  | "MANUAL_FALLBACK"
  | "QUANTITY_DISCOUNT"
  | "PROMOTION"
  | "NONE";

export type SalePriceResult = {
  /** Precio final después de todos los descuentos. */
  unitPrice: string | null;
  /** Precio base antes de descuentos por cantidad y promoción. */
  basePrice: string | null;
  /** Descuento aplicado por cantidad (null si no aplica). */
  quantityDiscountAmount: string | null;
  /** Descuento aplicado por promoción (null si no aplica). */
  promotionDiscountAmount: string | null;
  /** Total descontado (qty + promo). */
  discountAmount: string | null;
  /** Fuente efectiva final (última capa que modificó el precio). */
  priceSource: SalePriceSource;
  /** Fuente del precio base (antes de descuentos). */
  baseSource: BasePriceSource;
  appliedPriceListId: string | null;
  appliedPriceListName: string | null;
  appliedPromotionId: string | null;
  appliedPromotionName: string | null;
  appliedDiscountId: string | null;
  /** true si el precio base es parcial (lista sin datos suficientes). */
  partial: boolean;
  /** Costo unitario real calculado con el motor oficial. Null si no disponible. */
  unitCost: string | null;
  /** Margen unitario = unitPrice − unitCost. Null si sin costo. */
  unitMargin: string | null;
  /** Margen % sobre precio de venta. Null si sin costo. */
  marginPercent: string | null;
  /** true cuando el costo no pudo resolverse completamente. */
  costPartial: boolean;
  /** MANUAL | MULTIPLIER | METAL_MERMA_HECHURA | COST_LINES | NONE */
  costMode: string;
};

export type SaleLineRow = {
  id: string;
  articleId: string;
  variantId: string | null;
  articleName: string;
  variantName: string;
  sku: string;
  barcode: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  lineTotal: string;
  priceSource: string;
  appliedPriceListId: string | null;
  appliedPromotionId: string | null;
  appliedDiscountId: string | null;
  unitCost: string | null;
  totalCost: string | null;
  unitMargin: string | null;
  totalMargin: string | null;
  marginPercent: string | null;
  sortOrder: number;
  article: { id: string; code: string; name: string; mainImageUrl: string } | null;
  variant: { id: string; code: string; name: string } | null;
};

export type SalePaymentRow = {
  id: string;
  paymentMethodId: string | null;
  paymentMethodName: string;
  amount: string;
  installments: number;
  reference: string;
  paidAt: string;
  createdAt: string;
  paymentMethod: { id: string; name: string; type: string } | null;
};

export type SaleRow = {
  id: string;
  code: string;
  status: SaleStatus;
  saleDate: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  paidAmount: string;
  notes: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  client: { id: string; displayName: string; code: string } | null;
  seller: { id: string; firstName: string; lastName: string; displayName: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  createdBy: { id: string; name: string | null; firstName: string; lastName: string } | null;
  _count: { lines: number };
};

export type SaleTotals = {
  revenue: string;
  cost: string;
  margin: string;
  marginPercent: string;
  linesWithoutCost: number;
};

export type SaleDetail = SaleRow & {
  clientSnapshot: Record<string, unknown> | null;
  cancelNote: string;
  lines: SaleLineRow[];
  payments: SalePaymentRow[];
  saleTotals: SaleTotals | null;
};

// ─── Payloads ─────────────────────────────────────────────────────────────────
export type SaleLineInput = {
  articleId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  priceSource?: string;
  appliedPriceListId?: string | null;
  appliedPromotionId?: string | null;
  appliedDiscountId?: string | null;
};

export type CreateSalePayload = {
  clientId?: string | null;
  sellerId?: string | null;
  warehouseId?: string | null;
  notes?: string;
  lines: SaleLineInput[];
};

export type AddPaymentPayload = {
  paymentMethodId?: string | null;
  amount: number;
  installments?: number;
  reference?: string;
};

// ─── List response ────────────────────────────────────────────────────────────
export type SaleListResult = {
  data: SaleRow[];
  total: number;
  skip: number;
  take: number;
};

// ─── Labels ───────────────────────────────────────────────────────────────────
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  PAID: "Pagada",
  PARTIALLY_PAID: "Pago parcial",
  CANCELLED: "Anulada",
};

export const SALE_STATUS_COLORS: Record<SaleStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-600",
};

// ─── Caja ─────────────────────────────────────────────────────────────────────
export type CajaPaymentRow = {
  id: string;
  saleId: string;
  saleCode: string;
  saleStatus: string;
  paymentMethodId: string | null;
  paymentMethodName: string;
  amount: string;
  installments: number;
  reference: string;
  paidAt: string;
};

export type CajaMethodSummary = {
  paymentMethodId: string | null;
  paymentMethodName: string;
  amount: number;
  count: number;
};

export type CajaDaySummary = {
  date: string;
  salesCount: number;
  totalSalesAmount: number;
  totalPaid: number;
  totalPending: number;
  paymentsByMethod: CajaMethodSummary[];
  payments: CajaPaymentRow[];
};

// ─── API ──────────────────────────────────────────────────────────────────────
export const salesApi = {
  list: (params?: {
    skip?: number;
    take?: number;
    status?: string;
    clientId?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.skip !== undefined) qs.set("skip", String(params.skip));
    if (params?.take !== undefined) qs.set("take", String(params.take));
    if (params?.status) qs.set("status", params.status);
    if (params?.clientId) qs.set("clientId", params.clientId);
    if (params?.q) qs.set("q", params.q);
    if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params?.dateTo) qs.set("dateTo", params.dateTo);
    return apiFetch<SaleListResult>(`/sales?${qs}`, { on401: "throw" });
  },

  getOne: (id: string) =>
    apiFetch<SaleDetail>(`/sales/${id}`, { on401: "throw" }),

  create: (data: CreateSalePayload) =>
    apiFetch<SaleDetail>("/sales", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: Partial<CreateSalePayload>) =>
    apiFetch<SaleDetail>(`/sales/${id}`, { method: "PUT", body: data, on401: "throw" }),

  confirm: (id: string) =>
    apiFetch<SaleDetail>(`/sales/${id}/confirm`, { method: "POST", on401: "throw" }),

  addPayment: (id: string, data: AddPaymentPayload) =>
    apiFetch<SaleDetail>(`/sales/${id}/payments`, { method: "POST", body: data, on401: "throw" }),

  cancel: (id: string, note?: string) =>
    apiFetch<SaleDetail>(`/sales/${id}/cancel`, {
      method: "PATCH",
      body: { note: note ?? "" },
      on401: "throw",
    }),

  caja: (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiFetch<CajaDaySummary>(`/sales/caja${qs}`, { on401: "throw" });
  },
};
