import type { WarehouseDraft, WarehouseRow } from "./types";

export const TPTECH_WAREHOUSES_CHANGED = "tptech:warehouses-changed";

export const s = (v: any) => String(v ?? "").trim();

export const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function isRowActive(r: WarehouseRow) {
  return !!r.isActive && !r.deletedAt;
}

export function emitWarehousesChanged() {
  window.dispatchEvent(new CustomEvent(TPTECH_WAREHOUSES_CHANGED));
}

export const EMPTY_DRAFT: WarehouseDraft = {
  name: "",
  code: "",

  phoneCountry: "",
  phoneNumber: "",

  attn: "",
  street: "",
  number: "",
  city: "",
  province: "",
  postalCode: "",
  country: "",

  location: "",
  notes: "",
  isActive: true,
};

export function rowToDraft(r: WarehouseRow): WarehouseDraft {
  return {
    id: r.id,
    name: s(r.name),
    code: s(r.code),

    phoneCountry: s((r as any).phoneCountry),
    phoneNumber: s((r as any).phoneNumber),

    attn: s(r.attn),
    street: s(r.street),
    number: s(r.number),
    city: s(r.city),
    province: s(r.province),
    postalCode: s(r.postalCode),
    country: s(r.country),

    location: s(r.location),
    notes: s(r.notes),
    isActive: !!r.isActive,
  };
}

export function draftPayload(d: WarehouseDraft): WarehouseDraft {
  return {
    name: s(d.name),
    code: s(d.code),

    phoneCountry: s((d as any).phoneCountry),
    phoneNumber: s((d as any).phoneNumber),

    attn: s(d.attn),
    street: s(d.street),
    number: s(d.number),
    city: s(d.city),
    province: s(d.province),
    postalCode: s(d.postalCode),
    country: s(d.country),

    location: s(d.location),
    notes: s(d.notes),

    isActive: !!d.isActive,
  };
}

export function cmpStr(a: any, b: any) {
  const A = s(a).toLowerCase();
  const B = s(b).toLowerCase();
  if (A < B) return -1;
  if (A > B) return 1;
  return 0;
}