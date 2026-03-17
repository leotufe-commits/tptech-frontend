import type { CommissionBase, CommissionType } from "../../../services/sellers";

export type SellerDraft = {
  firstName: string;
  lastName: string;
  displayName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phoneCountry: string;
  phoneNumber: string;
  street: string;
  streetNumber: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;
  commissionType: CommissionType;
  commissionValue: number | null;
  commissionBase: CommissionBase;
  isActive: boolean;
  isFavorite: boolean;
  notes: string;
  warehouseIds: string[];
  userId: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

export type WarehouseOption = { id: string; name: string; isActive: boolean };

export type SortKey = "displayName" | "email" | "commissionType" | "createdAt";