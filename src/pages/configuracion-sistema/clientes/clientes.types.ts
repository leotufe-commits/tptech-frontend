import type { EntityType, BalanceType, EntityRole } from "../../../services/commercial-entities";

/** Override de merma guardado localmente durante el CREATE del modal (antes de tener entityId). */
export type MermaOverrideDraft = {
  _localId: string;
  variantId: string;
  role: EntityRole;
  mermaPercent: number;
  notes: string;
  isActive: boolean;
  // Datos de display enriquecidos al momento de agregar (evita re-fetch)
  _metalName: string;
  _variantName: string;
  _sku: string;
  _purity: string;
  _isFavorite: boolean;
};

export type SortKey = "displayName" | "code" | "email" | "createdAt" | "updatedAt";

export type EntityDraft = {
  entityType: EntityType;
  isClient: boolean;
  isSupplier: boolean;
  // Person
  firstName: string;
  lastName: string;
  // Company
  companyName: string;
  tradeName: string;
  // Contact
  email: string;
  phone: string;
  // Fiscal
  documentType: string;
  documentNumber: string;
  ivaCondition: string;
  // Balance
  balanceType: BalanceType;
  creditLimitClient: number | null;
  creditLimitSupplier: number | null;
  // Other
  notes: string;
};
