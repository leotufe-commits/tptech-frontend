import type { EntityType, BalanceType } from "../../../services/commercial-entities";

export type SortKey = "displayName" | "code" | "email" | "createdAt";

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
