import { apiFetch } from "../lib/api";

export type SalesChannelAdjustmentType = "PERCENTAGE" | "FIXED";

export type SalesChannelRow = {
  id:              string;
  jewelryId:       string;
  name:            string;
  code:            string;
  adjustmentType:  SalesChannelAdjustmentType;
  adjustmentValue: string;
  isActive:        boolean;
  isFavorite:      boolean;
  sortOrder:       number;
  notes:           string;
  deletedAt:       string | null;
  createdAt:       string;
  updatedAt:       string;
};

export type SalesChannelPayload = {
  name:            string;
  code?:           string;
  adjustmentType:  SalesChannelAdjustmentType;
  adjustmentValue: number;
  isFavorite?:     boolean;
  isActive?:       boolean;
  sortOrder?:      number;
  notes?:          string;
};

export const salesChannelsApi = {
  list:       (): Promise<SalesChannelRow[]>     => apiFetch("/sales-channels"),
  create:     (d: SalesChannelPayload)           => apiFetch("/sales-channels",      { method: "POST",   body: d }),
  update:     (id: string, d: SalesChannelPayload) => apiFetch(`/sales-channels/${id}`, { method: "PUT",    body: d }),
  toggle:     (id: string)                       => apiFetch(`/sales-channels/${id}/toggle`,   { method: "PATCH" }),
  favorite:   (id: string)                       => apiFetch(`/sales-channels/${id}/favorite`, { method: "PATCH" }),
  remove:     (id: string)                       => apiFetch(`/sales-channels/${id}`,  { method: "DELETE" }),
};
