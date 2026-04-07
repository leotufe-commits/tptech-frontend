import type { TPColDef } from "../../../components/ui/TPTableKit";
import type { EntityDraft, SortKey } from "./clientes.types";

export const CLIENT_COL_LS_KEY = "tptech_col_clientes";
export const SUPPLIER_COL_LS_KEY = "tptech_col_proveedores";

export const ENTITY_COLS: TPColDef[] = [
  { key: "nombre",   label: "Nombre",           canHide: false, sortKey: "displayName" },
  { key: "roles",    label: "Rol" },
  { key: "documento", label: "CUIT / DNI" },
  { key: "contacto", label: "Contacto",          sortKey: "email" },
  { key: "iva",      label: "Cond. IVA",         visible: false },
  { key: "termino",  label: "Término de pago",   visible: false },
  { key: "regla",    label: "Regla comercial",   visible: false },
  { key: "exento",   label: "Exento IVA",        visible: false },
  { key: "estado",   label: "Estado" },
  { key: "acciones", label: "Acciones",          canHide: false, align: "right" },
];

export const EMPTY_DRAFT: EntityDraft = {
  entityType: "PERSON",
  isClient: true,
  isSupplier: false,
  firstName: "",
  lastName: "",
  companyName: "",
  tradeName: "",
  email: "",
  phone: "",
  documentType: "",
  documentNumber: "",
  ivaCondition: "",
  balanceType: "UNIFIED",
  creditLimitClient: null,
  creditLimitSupplier: null,
  notes: "",
};

export const EMPTY_SUPPLIER_DRAFT: EntityDraft = {
  ...EMPTY_DRAFT,
  isClient: false,
  isSupplier: true,
};


export const SORT_KEYS: SortKey[] = ["displayName", "code", "email", "createdAt"];
