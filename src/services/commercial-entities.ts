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
export type EntityRelationType = "CLIENT_OF" | "SUPPLIES_TO" | "SAME_GROUP" | "RELATED_COMPANY" | "REFERRED_BY" | "OTHER";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type EntityAddress = {
  id: string;
  type: AddressType;
  label: string;
  attn: string;
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
  phonePrefix: string;
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
  paymentTerm: string;
  commercialApplyOn: CommercialApplyOn | null;
  commercialRuleType: CommercialRuleType | null;
  commercialValueType: CommercialValueType | null;
  commercialValue: string | null;
  taxExempt: boolean;
  taxApplyOnOverride: string | null;
  isActive: boolean;
  sourceType: EntitySourceType;
  mergedIntoEntityId: string | null;
  hasRelations: boolean;
  createdAt: string;
  updatedAt: string;
};

// Balance types
export type AggregatedBalanceUnified = {
  mode: "UNIFIED";
  amount: number;
  currency: string;
};
export type AggregatedBalanceBreakdown = {
  mode: "BREAKDOWN";
  metals: { metalId: string; gramsPure: number }[];
  /** Saldo de hechura agrupado por moneda. Positivo = deuda, negativo = saldo a favor. */
  hechura: { byCurrency: Record<string, number> };
};
export type AggregatedBalance = AggregatedBalanceUnified | AggregatedBalanceBreakdown;

export type StatementBalance = {
  metal: Record<string, number>;
  hechura: Record<string, number>;
};

export type StatementMovement = {
  id: string;
  date: string;
  entryType: string;
  typeLabel: string;
  reference: string;
  description: string;
  isVoided: boolean;
  metalDelta: Record<string, number>;
  hechuraDelta: Record<string, number>;
  runningMetal: Record<string, number>;
  runningHechura: Record<string, number>;
};

export type AccountStatement = {
  entity: {
    id: string;
    displayName: string;
    code: string;
    documentNumber: string;
    email: string;
    balanceType: string;
  };
  period: {
    from: string | null;
    to: string | null;
    generatedAt: string;
  };
  openingBalance: StatementBalance;
  movements: StatementMovement[];
  closingBalance: StatementBalance;
};

export type BalanceEntryRow = {
  id: string;
  role: string;
  entryType: string;
  amount: string;
  currency: string;
  documentRef: string;
  notes: string;
  createdAt: string;
  voidedAt: string | null;
  breakdownSnapshot: unknown;
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
  balance: AggregatedBalance | null;
  balanceEntries: BalanceEntryRow[];
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
  attn?: string;
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
  phonePrefix?: string;
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
  commercialApplyOn?: CommercialApplyOn | null;
  commercialRuleType?: CommercialRuleType | null;
  commercialValueType?: CommercialValueType | null;
  commercialValue?: string | null;
  paymentTerm?: string;
  creditLimitClient?: string | null;
  creditLimitSupplier?: string | null;
  taxExempt?: boolean;
  taxApplyOnOverride?: string | null;
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
    sortKey?: string;
    sortDir?: "asc" | "desc";
  }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set("role", params.role);
    if (params?.q) qs.set("q", params.q);
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.showInactive) qs.set("showInactive", "true");
    if (params?.sortKey) qs.set("sortKey", params.sortKey);
    if (params?.sortDir) qs.set("sortDir", params.sortDir);
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

  bulkDelete: (ids: string[]) =>
    apiFetch<{ deleted: number; blocked: number; skipped: number }>(
      "/commercial-entities/bulk-delete",
      { method: "POST", body: { ids }, on401: "throw" }
    ),

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

  // Account Statement
  getAccountStatement: (entityId: string, params: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<AccountStatement>(`/commercial-entities/${entityId}/account-statement${query}`, { method: "GET", on401: "throw" });
  },

  emailStatement: (entityId: string, body: { recipientEmail: string; from?: string; to?: string }) =>
    apiFetch(`/commercial-entities/${entityId}/account-statement/email`, {
      method: "POST",
      body: JSON.stringify(body),
      on401: "throw",
    }),
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

export const ENTITY_RELATION_TYPE_LABELS: Record<EntityRelationType, string> = {
  CLIENT_OF:       "Es cliente de",
  SUPPLIES_TO:     "Provee a",
  SAME_GROUP:      "Mismo grupo / holding",
  RELATED_COMPANY: "Empresa relacionada",
  REFERRED_BY:     "Referido por",
  OTHER:           "Otra relación",
};

// ---------------------------------------------------------------------------
// New types
// ---------------------------------------------------------------------------
export type EntityMermaOverride = {
  id: string;
  variantId: string;
  role: EntityRole;
  mermaPercent: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  variant: {
    id: string;
    name: string;
    sku: string;
    purity: string;
    isFavorite: boolean;
    isActive: boolean;
    metal: { id: string; name: string; symbol: string };
  };
};

export type EntityRelationRow = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: EntityRelationType;
  notes: string;
  isActive: boolean;
  createdAt: string;
  fromEntity: { id: string; displayName: string; code: string; avatarUrl: string; isClient: boolean; isSupplier: boolean };
  toEntity:   { id: string; displayName: string; code: string; avatarUrl: string; isClient: boolean; isSupplier: boolean };
};

export type MergePreview = {
  source: { id: string; displayName: string; code: string; avatarUrl: string };
  target: { id: string; displayName: string; code: string; avatarUrl: string };
  impact: { addresses: number; contacts: number; attachments: number; rules: number; balanceEntries: number };
};

export type BulkImportRowResult = {
  row: number;
  displayName: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
  id?: string;
};

export type BulkImportResponse = {
  results: BulkImportRowResult[];
  summary: { created: number; updated: number; skipped: number; errors: number };
};

// Import v2
export type ImportPreviewRow = {
  index:       number;
  displayName: string;
  status:      "valid" | "existing" | "error";
  errors:      string[];
  existingId?: string;
};

export type ImportPreviewResponse = {
  total:    number;
  valid:    number;
  errors:   number;
  new:      number;
  existing: number;
  rows:     ImportPreviewRow[];
};

export type ImportCommitRow = {
  row:         number;
  displayName: string;
  status:      "created" | "updated" | "skipped" | "error";
  errors?:     string[];
  message?:    string;
  id?:         string;
};

export type ImportCommitResponse = {
  results: ImportCommitRow[];
  summary: { created: number; updated: number; skipped: number; errors: number };
};

// ---------------------------------------------------------------------------
// Extended API
// ---------------------------------------------------------------------------
export const commercialEntitiesExtApi = {
  // Merma overrides
  merma: {
    list: (entityId: string) =>
      apiFetch<EntityMermaOverride[]>(`/commercial-entities/${entityId}/merma-overrides`, { method: "GET", on401: "throw" }),
    upsert: (entityId: string, data: { variantId: string; role: EntityRole; mermaPercent: number; notes?: string; isActive?: boolean }) =>
      apiFetch<EntityMermaOverride>(`/commercial-entities/${entityId}/merma-overrides`, { method: "PUT", body: data, on401: "throw" }),
    remove: (entityId: string, overrideId: string) =>
      apiFetch<{ id: string }>(`/commercial-entities/${entityId}/merma-overrides/${overrideId}`, { method: "DELETE", on401: "throw" }),
  },

  // Relations
  relations: {
    list: (entityId: string) =>
      apiFetch<EntityRelationRow[]>(`/commercial-entities/${entityId}/relations`, { method: "GET", on401: "throw" }),
    add: (entityId: string, data: { targetEntityId: string; relationType?: EntityRelationType; notes?: string }) =>
      apiFetch<EntityRelationRow>(`/commercial-entities/${entityId}/relations`, { method: "POST", body: data, on401: "throw" }),
    remove: (entityId: string, relationId: string) =>
      apiFetch<{ id: string }>(`/commercial-entities/${entityId}/relations/${relationId}`, { method: "DELETE", on401: "throw" }),
  },

  // Merge
  merge: {
    preview: (sourceId: string, targetId: string) =>
      apiFetch<MergePreview>(`/commercial-entities/merge-preview/${sourceId}/${targetId}`, { method: "GET", on401: "throw" }),
    execute: (sourceId: string, targetId: string) =>
      apiFetch<{ ok: boolean; sourceId: string; targetId: string; mergedAt: string }>(
        `/commercial-entities/merge-into/${sourceId}/${targetId}`,
        { method: "POST", on401: "throw" }
      ),
  },

  // Bulk import (legacy)
  bulkImport: (data: {
    rows: Record<string, string>[];
    dryRun: boolean;
    mode: "create" | "update" | "upsert";
    role: "client" | "supplier" | "both";
    matchBy: "documentNumber" | "email" | "displayName";
  }) =>
    apiFetch<BulkImportResponse>("/commercial-entities/bulk-import", { method: "POST", body: data, on401: "throw" }),

  // Export
  downloadExport: async (type: "clients" | "suppliers", format: "csv" | "xlsx"): Promise<void> => {
    const { API_URL } = await import("../lib/api");
    const url = `${API_URL}/commercial-entities/export?type=${type}&format=${format}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let msg = `Error ${res.status}`;
      try { msg = (JSON.parse(text) as any)?.message ?? msg; } catch {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    const date  = new Date().toISOString().slice(0, 10);
    const defaultName = `${type === "clients" ? "clientes" : "proveedores"}-${date}.${format}`;
    const filename = match?.[1] ?? defaultName;
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl; a.download = filename; a.click();
    URL.revokeObjectURL(objUrl);
  },

  // Import v2
  importPreview: (data: {
    rows: Record<string, string>[];
    role: "client" | "supplier" | "both";
  }) =>
    apiFetch<ImportPreviewResponse>("/commercial-entities/import/preview", { method: "POST", body: data, on401: "throw" }),

  importCommit: (data: {
    rows: Record<string, string>[];
    mode: "create" | "update" | "upsert";
    role: "client" | "supplier" | "both";
    matchBy: "documentNumber" | "email";
  }) =>
    apiFetch<ImportCommitResponse>("/commercial-entities/import/commit", { method: "POST", body: data, on401: "throw" }),
};
