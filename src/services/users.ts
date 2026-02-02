// tptech-frontend/src/services/users.ts
import { apiFetch } from "../lib/api";

/* =========================
   TYPES (frontend)
========================= */
export type Role = {
  id: string;
  name: string;
  // ✅ tolerancias: a veces el backend manda code / displayName
  code?: string;
  displayName?: string;
  isSystem?: boolean;
};

export type OverrideEffect = "ALLOW" | "DENY";

export type Override = {
  permissionId: string;
  effect: OverrideEffect;
};

export type UserStatus = "ACTIVE" | "PENDING" | "BLOCKED";

export type UserListItem = {
  id: string;
  email: string;
  name?: string | null;
  status: UserStatus;
  avatarUrl?: string | null;
  favoriteWarehouseId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  roles?: Role[];

  /** ✅ para LockScreen / UX (si lo devolvés en list) */
  pinEnabled?: boolean;
  hasQuickPin?: boolean;

  /** ✅ tolerancias para “conteos” si el backend los manda */
  overridesCount?: number;
  permissionOverridesCount?: number;
  attachmentsCount?: number;
  attachmentCount?: number;
  hasAttachments?: boolean;
  hasSpecialPermissions?: boolean;
};

export type UserAttachment = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt?: string;
};

export type UserDetail = {
  id: string;
  email: string;
  name?: string | null;
  status: UserStatus;
  avatarUrl?: string | null;
  favoriteWarehouseId?: string | null;

  createdAt?: string;
  updatedAt?: string;

  roles: Role[];
  permissionOverrides: Override[];

  tokenVersion?: number;

  phoneCountry?: string;
  phoneNumber?: string;
  documentType?: string;
  documentNumber?: string;

  street?: string;
  number?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;

  notes?: string;

  attachments?: UserAttachment[];

  /** ✅ QUICK PIN state (NO hash) */
  hasQuickPin?: boolean;
  quickPinUpdatedAt?: string | null;

  /** ✅ habilitar/deshabilitar acceso por PIN */
  pinEnabled?: boolean;
};

/* =========================
   RESPONSES
========================= */
export type UsersListResponse =
  | { users: UserListItem[] }
  | { users: UserListItem[]; total?: number; page?: number; limit?: number };

export type UserDetailResponse = { user: UserDetail };

export type CreateUserBody = {
  email: string;
  name?: string | null;
  password?: string;
  roleIds?: string[];
  status?: Extract<UserStatus, "ACTIVE" | "BLOCKED">;
};

export type CreateUserResponse = { user: UserListItem };

export type OkResponse<T extends object = {}> = { ok?: true } & T;

export type UpdateAvatarResponse = {
  ok?: true;
  avatarUrl?: string | null;
  user?: UserListItem;
};

export type UpdateFavoriteWarehouseResponse = {
  ok?: true;
  favoriteWarehouseId?: string | null;
  user?: UserListItem;
};

export type UpdateUserProfileBody = {
  name?: string | null;

  phoneCountry?: string;
  phoneNumber?: string;
  documentType?: string;
  documentNumber?: string;

  street?: string;
  number?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;

  notes?: string;
};

export type QuickPinState = {
  ok?: true;
  hasQuickPin: boolean;
  quickPinUpdatedAt?: string | null;
  pinEnabled?: boolean;
  user?: UserListItem;
};

/* =========================
   Helpers
========================= */
function isObj(v: any) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/**
 * ✅ Normaliza respuestas del backend:
 * - { user: {...} }
 * - { ok:true, user:{...} }
 * - { data:{ user:{...} } }
 * - {...camposDelUser} (user “plano”)
 */
function pickUserFromUnknown(resp: any): any | null {
  if (!resp) return null;

  // 1) wrapper clásico
  if (isObj(resp) && isObj((resp as any).user)) return (resp as any).user;

  // 2) wrapper data.user
  if (isObj(resp) && isObj((resp as any).data) && isObj((resp as any).data.user)) return (resp as any).data.user;

  // 3) si el “resp” ya parece user (tiene id + email)
  if (isObj(resp) && ("id" in resp || "email" in resp)) return resp;

  return null;
}

function pickUsersListFromUnknown(resp: any): { users: any[]; total?: number; page?: number; limit?: number } {
  const empty = { users: [] as any[] };

  if (!resp) return empty;

  // { users: [] }
  if (isObj(resp) && Array.isArray((resp as any).users)) {
    const r: any = resp;
    return { users: r.users ?? [], total: r.total, page: r.page, limit: r.limit };
  }

  // { data: { users: [] } }
  if (isObj(resp) && isObj((resp as any).data) && Array.isArray((resp as any).data.users)) {
    const r: any = (resp as any).data;
    return { users: r.users ?? [], total: r.total, page: r.page, limit: r.limit };
  }

  // { ok:true, users: [] }
  if (isObj(resp) && Array.isArray((resp as any).users)) {
    const r: any = resp;
    return { users: r.users ?? [], total: r.total, page: r.page, limit: r.limit };
  }

  return empty;
}

function assertPin4(pin: string) {
  const s = String(pin ?? "").trim();
  if (!/^\d{4}$/.test(s)) throw new Error("El PIN debe tener 4 dígitos.");
  return s;
}

function assertImageFile(file: File) {
  if (!file) throw new Error("Seleccioná un archivo");
  if (!file.type?.startsWith("image/")) throw new Error("El archivo debe ser una imagen");

  const MAX = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX) throw new Error("La imagen supera el máximo permitido (5MB)");
}

function normalizeAvatarResponse(resp: unknown): {
  ok: true;
  avatarUrl: string | null;
  user?: UserListItem;
} {
  const r = (resp && typeof resp === "object" ? (resp as any) : null) as any;

  const avatarUrl =
    (r && "avatarUrl" in r ? r.avatarUrl : undefined) ??
    (r?.user?.avatarUrl != null ? r.user.avatarUrl : undefined) ??
    null;

  return {
    ok: true,
    avatarUrl: avatarUrl ?? null,
    user: r?.user,
  };
}

function normalizeFavoriteWarehouseResponse(resp: unknown): {
  ok: true;
  favoriteWarehouseId: string | null;
  user?: UserListItem;
} {
  const r = (resp && typeof resp === "object" ? (resp as any) : null) as any;

  const favoriteWarehouseId =
    (r && "favoriteWarehouseId" in r ? r.favoriteWarehouseId : undefined) ??
    (r?.user?.favoriteWarehouseId != null ? r.user.favoriteWarehouseId : undefined) ??
    null;

  return {
    ok: true,
    favoriteWarehouseId: favoriteWarehouseId ?? null,
    user: r?.user,
  };
}

function buildUsersQuery(params?: { q?: string; page?: number; limit?: number }) {
  const q = params?.q?.trim();
  const page = params?.page;
  const limit = params?.limit;

  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (typeof page === "number" && Number.isFinite(page) && page > 0) sp.set("page", String(page));
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) sp.set("limit", String(limit));

  const qs = sp.toString();
  return qs ? `/users?${qs}` : "/users";
}

/**
 * ✅ Política de 401 para acciones ADMIN:
 * no forzar logout global, que el UI muestre el error
 */
const ADMIN_401 = { on401: "throw" as const };

/* =========================
   API calls
========================= */

export async function createUser(body: CreateUserBody): Promise<CreateUserResponse> {
  const resp = await apiFetch<any>("/users", { method: "POST", body, ...ADMIN_401 });

  // tolerancias: { user }, { ok,user }, etc.
  const u = pickUserFromUnknown(resp);
  if (!u) return resp as CreateUserResponse;

  return { user: u as UserListItem };
}

export async function deleteUser(userId: string): Promise<OkResponse> {
  return apiFetch<OkResponse>(`/users/${userId}`, { method: "DELETE", ...ADMIN_401 });
}

export async function fetchUsers(params?: { q?: string; page?: number; limit?: number }): Promise<UsersListResponse> {
  const url = buildUsersQuery(params);
  const resp = await apiFetch<any>(url, { method: "GET" });

  // ✅ normaliza a { users, total?, page?, limit? }
  const norm = pickUsersListFromUnknown(resp);
  return norm as UsersListResponse;
}

export async function fetchUser(userId: string): Promise<UserDetailResponse> {
  const resp = await apiFetch<any>(`/users/${userId}`, { method: "GET" });

  const u = pickUserFromUnknown(resp);
  if (!u) {
    // fallback: resp ya viene tipado, o backend cambió, devolvemos lo que haya para no romper
    return resp as UserDetailResponse;
  }

  return { user: u as UserDetail };
}

export async function updateUserProfile(
  userId: string,
  body: UpdateUserProfileBody
): Promise<OkResponse<{ user?: UserDetail }>> {
  const resp = await apiFetch<any>(`/users/${userId}`, { method: "PATCH", body, ...ADMIN_401 });

  // tolerancias: puede venir { user }, { ok,user }, o user plano
  const u = pickUserFromUnknown(resp);
  if (u) return { ...(resp as any), user: u as UserDetail };

  return resp as OkResponse<{ user?: UserDetail }>;
}

export async function updateUserStatus(
  userId: string,
  status: Extract<UserStatus, "ACTIVE" | "BLOCKED">
): Promise<OkResponse<{ user?: UserListItem }>> {
  const resp = await apiFetch<any>(`/users/${userId}/status`, { method: "PATCH", body: { status }, ...ADMIN_401 });

  const u = pickUserFromUnknown(resp);
  if (u) return { ...(resp as any), user: u as UserListItem };

  return resp as OkResponse<{ user?: UserListItem }>;
}

export async function assignRolesToUser(userId: string, roleIds: string[]): Promise<OkResponse> {
  return apiFetch<OkResponse>(`/users/${userId}/roles`, { method: "PUT", body: { roleIds }, ...ADMIN_401 });
}

export async function setUserOverride(
  userId: string,
  permissionId: string,
  effect: OverrideEffect
): Promise<OkResponse<{ override?: Override }>> {
  return apiFetch<OkResponse<{ override?: Override }>>(`/users/${userId}/overrides`, {
    method: "POST",
    body: { permissionId, effect },
    ...ADMIN_401,
  });
}

export async function removeUserOverride(userId: string, permissionId: string): Promise<OkResponse> {
  return apiFetch<OkResponse>(`/users/${userId}/overrides/${permissionId}`, { method: "DELETE", ...ADMIN_401 });
}

/* =========================
   ⭐ FAVORITE WAREHOUSE
========================= */

export async function updateMyFavoriteWarehouse(
  warehouseId: string | null
): Promise<{ ok: true; favoriteWarehouseId: string | null; user?: UserListItem }> {
  const resp = await apiFetch<UpdateFavoriteWarehouseResponse>("/users/me/favorite-warehouse", {
    method: "PATCH",
    body: { warehouseId },
  });

  return normalizeFavoriteWarehouseResponse(resp);
}

export async function updateFavoriteWarehouseForUser(
  userId: string,
  warehouseId: string | null
): Promise<{ ok: true; favoriteWarehouseId: string | null; user?: UserListItem }> {
  const resp = await apiFetch<UpdateFavoriteWarehouseResponse>(`/users/${userId}/favorite-warehouse`, {
    method: "PATCH",
    body: { warehouseId },
    ...ADMIN_401,
  });

  return normalizeFavoriteWarehouseResponse(resp);
}

/* =========================
   AVATAR (ME) multipart/form-data
========================= */

export async function updateUserAvatar(file: File): Promise<{ ok: true; avatarUrl: string | null; user?: UserListItem }> {
  assertImageFile(file);

  const form = new FormData();
  form.append("avatar", file);

  const resp = await apiFetch<UpdateAvatarResponse>("/users/me/avatar", {
    method: "PUT",
    body: form,
    on401: "throw",
  });

  return normalizeAvatarResponse(resp);
}

export async function removeMyAvatar(): Promise<{ ok: true; avatarUrl: string | null; user?: UserListItem }> {
  const resp = await apiFetch<UpdateAvatarResponse>("/users/me/avatar", { method: "DELETE", on401: "throw" });
  return normalizeAvatarResponse(resp);
}

export const removeUserAvatar = removeMyAvatar;

/* =========================
   AVATAR (ADMIN) multipart/form-data
========================= */

export async function updateUserAvatarForUser(
  userId: string,
  file: File
): Promise<{ ok: true; avatarUrl: string | null; user?: UserListItem }> {
  assertImageFile(file);

  const form = new FormData();
  form.append("avatar", file);

  const resp = await apiFetch<UpdateAvatarResponse>(`/users/${userId}/avatar`, {
    method: "PUT",
    body: form,
    on401: "throw",
  });

  return normalizeAvatarResponse(resp);
}

export async function removeAvatarForUser(
  userId: string
): Promise<{ ok: true; avatarUrl: string | null; user?: UserListItem }> {
  const resp = await apiFetch<UpdateAvatarResponse>(`/users/${userId}/avatar`, {
    method: "DELETE",
    on401: "throw",
  });

  return normalizeAvatarResponse(resp);
}

/* =========================
   ✅ QUICK PIN (ME)
========================= */

export async function setMyQuickPin(pin: string): Promise<QuickPinState> {
  const clean = assertPin4(pin);
  return apiFetch<QuickPinState>("/users/me/quick-pin", { method: "PUT", body: { pin: clean } });
}

export async function removeMyQuickPin(currentPin: string): Promise<QuickPinState> {
  const cur = assertPin4(currentPin);
  return apiFetch<QuickPinState>("/users/me/quick-pin", { method: "DELETE", body: { currentPin: cur } });
}

/* =========================
   ✅ QUICK PIN (ADMIN)
========================= */

export async function setUserQuickPin(userId: string, pin: string): Promise<QuickPinState> {
  const clean = assertPin4(pin);
  return apiFetch<QuickPinState>(`/users/${userId}/quick-pin`, { method: "PUT", body: { pin: clean }, ...ADMIN_401 });
}

export async function resetUserQuickPin(userId: string, pin: string): Promise<QuickPinState> {
  return setUserQuickPin(userId, pin);
}

export async function removeUserQuickPin(userId: string): Promise<QuickPinState> {
  return apiFetch<QuickPinState>(`/users/${userId}/quick-pin`, { method: "DELETE", ...ADMIN_401 });
}

/* =========================
   ✅ PIN ENABLED (ADMIN)
========================= */

export async function setUserPinEnabled(userId: string, enabled: boolean): Promise<QuickPinState> {
  return apiFetch<QuickPinState>(`/users/${userId}/quick-pin/enabled`, {
    method: "PATCH",
    body: { enabled },
    ...ADMIN_401,
  });
}

/* =========================
   ✅ COMPAT: nombres usados por UserEditModal (para que compile)
========================= */
export async function setUserPinForUser(userId: string, pin: string): Promise<QuickPinState> {
  return setUserQuickPin(userId, pin);
}

export async function resetUserPinForUser(userId: string, pin: string): Promise<QuickPinState> {
  return resetUserQuickPin(userId, pin);
}

export async function setUserPinEnabledForUser(userId: string, enabled: boolean): Promise<QuickPinState> {
  return setUserPinEnabled(userId, enabled);
}

/* =========================
   ✅ USER ATTACHMENTS (ADMIN)
========================= */

export async function uploadUserAttachmentsInstant(
  userId: string,
  files: File[]
): Promise<OkResponse<{ attachments?: UserAttachment[]; user?: UserDetail }>> {
  if (!files?.length) return { ok: true };

  const form = new FormData();
  for (const f of files) form.append("attachments", f);

  return apiFetch<OkResponse<{ attachments?: UserAttachment[]; user?: UserDetail }>>(`/users/${userId}/attachments`, {
    method: "PUT",
    body: form,
    on401: "throw",
  });
}

export async function deleteUserAttachmentInstant(userId: string, attachmentId: string): Promise<OkResponse> {
  return apiFetch<OkResponse>(`/users/${userId}/attachments/${attachmentId}`, { method: "DELETE", ...ADMIN_401 });
}
