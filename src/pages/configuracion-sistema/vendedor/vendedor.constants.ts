import type { ColPickerDef } from "../../../components/ui/TPColumnPicker";
import type { CommissionBase, CommissionType } from "../../../services/sellers";
import type { SellerDraft } from "./vendedor.types";

export const COL_DEFS: ColPickerDef[] = [
  { key: "nombre", label: "Nombre", canHide: false },
  { key: "documento", label: "Documento" },
  { key: "contacto", label: "Email / Teléfono" },
  { key: "comision", label: "Comisión" },
  { key: "almacenes", label: "Almacenes" },
  { key: "estado", label: "Estado" },
  { key: "acciones", label: "Acciones", canHide: false },
];

export const COL_LS_KEY = "tptech_col_vendedores_v3";

export const COMMISSION_LABELS: Record<CommissionType, string> = {
  NONE: "Sin comisión",
  PERCENTAGE: "Porcentaje (%)",
  FIXED_AMOUNT: "Monto fijo ($)",
};

export const COMMISSION_BASE_LABELS: Record<CommissionBase, string> = {
  TOTAL:                   "Total de venta (antes de impuestos)",
  TOTAL_AFTER_DISCOUNTS:   "Total después de descuentos",
  TOTAL_AFTER_PAYMENT:     "Total después de forma de pago",
  METAL:                   "Componente metal",
  HECHURA:                 "Componente hechura",
  METAL_Y_HECHURA:         "Metal + hechura",
  HECHURA_AFTER_DISCOUNTS: "Hechura después de descuentos",
};

export const EMPTY_DRAFT: SellerDraft = {
  firstName: "",
  lastName: "",
  displayName: "",
  documentType: "",
  documentNumber: "",
  email: "",
  phoneCountry: "",
  phoneNumber: "",
  street: "",
  streetNumber: "",
  city: "",
  province: "",
  country: "",
  postalCode: "",
  commissionType: "NONE",
  commissionValue: null,
  commissionBase: "TOTAL",
  isActive: true,
  isFavorite: false,
  notes: "",
  warehouseIds: [],
  userId: null,
  contactName: "",
  contactPhone: "",
  contactEmail: "",
};