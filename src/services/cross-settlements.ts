// src/services/cross-settlements.ts
import { apiFetch } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CrossSettlementComponentType = "MONEY" | "METAL";

export type CrossSettlementStatus = "CONFIRMED" | "VOIDED";

export type CrossSettlementFromInput = {
  componentType: CrossSettlementComponentType;
  currency?: string;
  amount?: number;
  metalId?: string;
  variantId?: string;
  gramsOriginal?: number;
  purity?: number;
  gramsPure?: number;
};

export type CrossSettlementInput = {
  supplierId?: string;
  targetPurchaseId?: string | null;
  from: CrossSettlementFromInput;
  to: CrossSettlementFromInput;
  conversion: {
    fxRate?: number;
    metalQuotePerGram?: number;
    quoteCurrency?: string;
  };
  notes?: string;
};

export type CrossSettlementRow = {
  id: string;
  supplierId: string;
  targetPurchaseId: string | null;
  status: CrossSettlementStatus;
  fromComponentType: CrossSettlementComponentType;
  fromCurrency: string | null;
  fromMetalId: string | null;
  fromVariantId: string | null;
  fromGramsOriginal: string | null;
  fromPurity: string | null;
  fromGramsPure: string | null;
  fromAmount: string | null;
  toComponentType: CrossSettlementComponentType;
  toCurrency: string | null;
  toMetalId: string | null;
  toVariantId: string | null;
  toGramsOriginal: string | null;
  toPurity: string | null;
  toGramsPure: string | null;
  toAmount: string | null;
  fxRate: string | null;
  metalQuotePerGram: string | null;
  quoteCurrency: string | null;
  notes: string;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string;
};

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const crossSettlementsService = {
  list: (
    supplierId: string,
    params?: { skip?: number; take?: number; includeVoided?: boolean }
  ) => {
    const qs = new URLSearchParams();
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.includeVoided) qs.set("includeVoided", "true");
    const query = qs.toString() ? `?${qs}` : "";
    return apiFetch<{ items: CrossSettlementRow[]; total: number }>(
      `/cross-settlements/suppliers/${supplierId}/cross-settlements${query}`,
      { method: "GET", on401: "throw" }
    );
  },

  create: (supplierId: string, body: CrossSettlementInput) =>
    apiFetch<CrossSettlementRow>(
      `/cross-settlements/suppliers/${supplierId}/cross-settlements`,
      { method: "POST", body: JSON.stringify(body), on401: "throw" }
    ),

  void: (id: string, reason?: string) =>
    apiFetch<CrossSettlementRow>(
      `/cross-settlements/cross-settlements/${id}/void`,
      { method: "POST", body: JSON.stringify({ reason: reason || "" }), on401: "throw" }
    ),
};
