import { apiFetch } from "../lib/api";

// ---------------------------------------------------------------------------
// Enums (mirror del schema Prisma)
// ---------------------------------------------------------------------------
export type EntityType = "PERSON" | "COMPANY";
export type BalanceType = "UNIFIED" | "BREAKDOWN";
export type EntitySourceType = "MANUAL" | "IMPORT_CSV" | "MIGRATION" | "API";
export type AddressType = "BILLING" | "SHIPPING" | "FISCAL" | "COMMERCIAL" | "OTHER";
export type CommercialRuleScope = "GLOBAL" | "METAL" | "VARIANT" | "CATEGORY";
export type CommercialRuleType = "DISCOUNT" | "BONUS" | "SURCHARGE";
export type CommercialValueType = "PERCENTAGE" | "FIXED_AMOUNT";
export type CommercialApplyOn = "TOTAL" | "METAL" | "HECHURA" | "METAL_Y_HECHURA";
export type TaxOverrideMode = "INHERIT" | "EXEMPT" | "CUSTOM_RATE";
export type BalanceEntryType = "INVOICE" | "PAYMENT" | "CREDIT_NOTE" | "DEBIT_NOTE" | "ADJUSTMENT";
export type EntityRole = "CLIENT" | "SUPPLIER";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type EntityAddress = {
  id: string;
  type: AddressType;
  label: string;
  street: string;
  streetNumber: string;
  floor: string;
  apartment: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
  createdAt: string;
};

export type EntityContact = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  phone: string;
  whatsapp: string;
  isPrimary: boolean;
  receivesDocuments: boolean;
  receivesPaymentsOrCollections: boolean;
  portalAccess: boolean;
  notes: string;
  createdAt: string;
};

export type EntityCommercialRule = {
  id: string;
  scope: CommercialRuleScope;
  metalId: string | null;
  variantId: string | null;
  categoryId: string | null;
  ruleType: CommercialRuleType;
  valueType: CommercialValueType;
  value: string;
  applyOn: CommercialApplyOn;
  minQuantity: string | null;
  validFrom: string | null;
  validTo: string | null;
  notes: string;
  isActive: boolean;
  sortOrder: number;
};

export type EntityTaxOverride = {
  id: string;
  taxId: string;
  overrideMode: TaxOverrideMode;
  customRate: string | null;
  applyOn: string | null;
  notes: string;
  isActive: boolean;
};

export type EntityAttachment = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  label: string;
  createdAt: string;
};

// Row — used for list view (no heavy relations)
export type EntityRow = {
  id: string;
  jewelryId: string;
  code: string;
  displayName: string;
  entityType: EntityType;
  isClient: boolean;
  isSupplier: boolean;
  firstName: string;
  lastName: string;
  companyName: string;
  tradeName: string;
  email: string;
  phone: string;
  documentType: string;
  documentNumber: string;
  ivaCondition: string;
  avatarUrl: string;
  balanceType: BalanceType;
  priceListId: string | null;
  currencyId: string | null;
  isActive: boolean;
  sourceType: EntitySourceType;
  mergedIntoEntityId: string | null;
  createdAt: string;
  updatedAt: string;
};

// Detail — full entity with all relations
export type EntityDetail = EntityRow & {
  creditLimitClient: string | null;
  creditLimitSupplier: string | null;
  notes: string;
  deletedAt: string | null;
  addresses: EntityAddress[];
  contacts: EntityContact[];
  commercialRules: EntityCommercialRule[];
  taxOverrides: EntityTaxOverride[];
  attachments: EntityAttachment[];
};

// List response (paginated)
export type EntityListResponse = {
  rows: EntityRow[];
  total: number;
  skip: number;
  take: number;
};

// Payloads for sub-resources
export type EntityAddressPayload = {
  type: AddressType;
  label?: string;
  street?: string;
  streetNumber?: string;
  floor?: string;
  apartment?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  isDefault?: boolean;
};

export type EntityContactPayload = {
  firstName?: string;
  lastName?: string;
  position?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  isPrimary?: boolean;
  receivesDocuments?: boolean;
  receivesPaymentsOrCollections?: boolean;
  notes?: string;
};

export type EntityCommercialRulePayload = {
  scope: CommercialRuleScope;
  metalId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  ruleType: CommercialRuleType;
  valueType: CommercialValueType;
  value: string;
  applyOn: CommercialApplyOn;
  minQuantity?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  notes?: string;
  sortOrder?: number;
};

export type EntityTaxOverridePayload = {
  taxId: string;
  overrideMode: TaxOverrideMode;
  customRate?: string | null;
  applyOn?: string | null;
  notes?: string;
};

// Payload for create/update
export type EntityPayload = {
  entityType: EntityType;
  isClient: boolean;
  isSupplier: boolean;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  tradeName?: string;
  email?: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  ivaCondition?: string;
  balanceType?: BalanceType;
  priceListId?: string | null;
  currencyId?: string | null;
  creditLimitClient?: string | null;
  creditLimitSupplier?: string | null;
  notes?: string;
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export const commercialEntitiesApi = {
  list: (params?: {
    role?: "client" | "supplier" | "all";
    q?: string;
    skip?: number;
    take?: number;
    showInactive?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set("role", params.role);
    if (params?.q) qs.set("q", params.q);
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.showInactive) qs.set("showInactive", "true");
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<EntityListResponse>(`/commercial-entities${query}`, {
      method: "GET",
      on401: "throw",
    });
  },

  getOne: (id: string) =>
    apiFetch<EntityDetail>(`/commercial-entities/${id}`, {
      method: "GET",
      on401: "throw",
    }),

  create: (data: EntityPayload) =>
    apiFetch<EntityDetail>("/commercial-entities", {
      method: "POST",
      body: data,
      on401: "throw",
    }),

  update: (id: string, data: EntityPayload) =>
    apiFetch<EntityDetail>(`/commercial-entities/${id}`, {
      method: "PUT",
      body: data,
      on401: "throw",
    }),

  toggle: (id: string) =>
    apiFetch<EntityRow>(`/commercial-entities/${id}/toggle`, {
      method: "PATCH",
      on401: "throw",
    }),

  remove: (id: string) =>
    apiFetch<{ id: string }>(`/commercial-entities/${id}`, {
      method: "DELETE",
      on401: "throw",
    }),

  // Avatar
  avatar: {
    update: (id: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiFetch<{ id: string; avatarUrl: string }>(`/commercial-entities/${id}/avatar`, {
        method: "PATCH",
        body: fd,
        on401: "throw",
      });
    },
  },

  // Addresses
  addresses: {
    list: (entityId: string) =>
      apiFetch<EntityAddress[]>(`/commercial-entities/${entityId}/addresses`, { method: "GET", on401: "throw" }),
    create: (entityId: string, data: EntityAddressPayload) =>
      apiFetch<EntityAddress>(`/commercial-entities/${entityId}/addresses`, { method: "POST", body: data, on401: "throw" }),
    update: (entityId: string, addressId: string, data: EntityAddressPayload) =>
      apiFetch<EntityAddress>(`/commercial-entities/${entityId}/addresses/${addressId}`, { method: "PUT", body: data, on401: "throw" }),
    remove: (entityId: string, addressId: string) =>
      apiFetch<{ id: string }>(`/commercial-entities/${entityId}/addresses/${addressId}`, { method: "DELETE", on401: "throw" }),
    setDefault: (entityId: string, addressId: string) =>
      apiFetch<EntityAddress>(`/commercial-entities/${entityId}/addresses/${addressId}/set-default`, { method: "PATCH", on401: "throw" }),
  },

  // Contacts
  contacts: {
    list: (entityId: string) =>
      apiFetch<EntityContact[]>(`/commercial-entities/${entityId}/contacts`, { method: "GET", on401: "throw" }),
    create: (entityId: string, data: EntityContactPayload) =>
      apiFetch<EntityContact>(`/commercial-entities/${entityId}/contacts`, { method: "POST", body: data, on401: "throw" }),
    update: (entityId: string, contactId: string, data: EntityContactPayload) =>
      apiFetch<EntityContact>(`/commercial-entities/${entityId}/contacts/${contactId}`, { method: "PUT", body: data, on401: "throw" }),
    remove: (entityId: string, contactId: string) =>
      apiFetch<{ id: string }>(`/commercial-entities/${entityId}/contacts/${contactId}`, { method: "DELETE", on401: "throw" }),
    setPrimary: (entityId: string, contactId: string) =>
      apiFetch<EntityContact>(`/commercial-entities/${entityId}/contacts/${contactId}/set-primary`, { method: "PATCH", on401: "throw" }),
  },

  // Attachments
  attachments: {
    list: (entityId: string) =>
      apiFetch<EntityAttachment[]>(`/commercial-entities/${entityId}/attachments`, { method: "GET", on401: "throw" }),
    upload: (entityId: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiFetch<EntityAttachment>(`/commercial-entities/${entityId}/attachments`, { method: "POST", body: fd, on401: "throw" });
    },
    updateLabel: (entityId: string, attachmentId: string, label: string) =>
      apiFetch<EntityAttachment>(`/commercial-entities/${entityId}/attachments/${attachmentId}`, { method: "PATCH", body: { label }, on401: "throw" }),
    remove: (entityId: string, attachmentId: string) =>
      apiFetch<{ id: string }>(`/commercial-entities/${entityId}/attachments/${attachmentId}`, { method: "DELETE", on401: "throw" }),
  },

  // Commercial Rules
  rules: {
    list: (entityId: string) =>
      apiFetch<EntityCommercialRule[]>(`/commercial-entities/${entityId}/rules`, { method: "GET", on401: "throw" }),
    create: (entityId: string, data: EntityCommercialRulePayload) =>
      apiFetch<EntityCommercialRule>(`/commercial-entities/${entityId}/rules`, { method: "POST", body: data, on401: "throw" }),
    update: (entityId: string, ruleId: string, data: EntityCommercialRulePayload) =>
      apiFetch<EntityCommercialRule>(`/commercial-entities/${entityId}/rules/${ruleId}`, { method: "PUT", body: data, on401: "throw" }),
    toggle: (entityId: string, ruleId: string) =>
      apiFetch<EntityCommercialRule>(`/commercial-entities/${entityId}/rules/${ruleId}/toggle`, { method: "PATCH", on401: "throw" }),
    remove: (entityId: string, ruleId: string) =>
      apiFetch<{ id: string }>(`/commercial-entities/${entityId}/rules/${ruleId}`, { method: "DELETE", on401: "throw" }),
  },

  // Tax Overrides
  taxOverrides: {
    list: (entityId: string) =>
      apiFetch<EntityTaxOverride[]>(`/commercial-entities/${entityId}/tax-overrides`, { method: "GET", on401: "throw" }),
    upsert: (entityId: string, data: EntityTaxOverridePayload) =>
      apiFetch<EntityTaxOverride>(`/commercial-entities/${entityId}/tax-overrides`, { method: "PUT", body: data, on401: "throw" }),
    remove: (entityId: string, overrideId: string) =>
      apiFetch<{ id: string }>(`/commercial-entities/${entityId}/tax-overrides/${overrideId}`, { method: "DELETE", on401: "throw" }),
  },
};

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------
export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  BILLING: "Facturación",
  SHIPPING: "Envío",
  FISCAL: "Fiscal",
  COMMERCIAL: "Comercial",
  OTHER: "Otra",
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  PERSON: "Persona física",
  COMPANY: "Empresa",
};

export const BALANCE_TYPE_LABELS: Record<BalanceType, string> = {
  UNIFIED: "Unificado",
  BREAKDOWN: "Separado (cliente / proveedor)",
};

export const COMMERCIAL_RULE_TYPE_LABELS: Record<CommercialRuleType, string> = {
  DISCOUNT: "Descuento",
  BONUS: "Bonificación",
  SURCHARGE: "Recargo",
};

export const COMMERCIAL_APPLY_ON_LABELS: Record<CommercialApplyOn, string> = {
  TOTAL: "Total",
  METAL: "Precio metal",
  HECHURA: "Solo hechura",
  METAL_Y_HECHURA: "Precio metal y hechura",
};
