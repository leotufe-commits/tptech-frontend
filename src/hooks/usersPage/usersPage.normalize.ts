// src/hooks/usersPage/usersPage.normalize.ts

import type {
  UserDetail,
  UserListItem,
  Override,
  UserAttachment,
} from "../../services/users";

/* =========================================================
   USER LIST
========================================================= */

export function normalizeUserListItem(raw: any): UserListItem {
  return {
    ...raw,
    id: String(raw?.id || ""),
    name: raw?.name ?? "",
    email: raw?.email ?? "",
    status: raw?.status ?? "ACTIVE",
    roles: Array.isArray(raw?.roles) ? raw.roles : [],
    hasQuickPin: Boolean(raw?.hasQuickPin),
    pinEnabled: Boolean(raw?.pinEnabled),
  } as UserListItem;
}

/* =========================================================
   USER DETAIL
========================================================= */

export function normalizeUserDetail(raw: any): UserDetail {
  return {
    ...raw,
    id: String(raw?.id || ""),
    name: raw?.name ?? "",
    email: raw?.email ?? "",
    status: raw?.status ?? "ACTIVE",

    roles: Array.isArray(raw?.roles) ? raw.roles : [],

    permissionOverrides: Array.isArray(raw?.permissionOverrides)
      ? (raw.permissionOverrides as Override[])
      : [],

    attachments: Array.isArray(raw?.attachments)
      ? (raw.attachments as UserAttachment[])
      : [],

    hasQuickPin: Boolean(raw?.hasQuickPin),
    pinEnabled: Boolean(raw?.pinEnabled),
  } as UserDetail;
}