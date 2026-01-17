// tptech-frontend/src/services/users.ts
import { apiFetch } from "../lib/api";

/* =========================
   TYPES (frontend)
========================= */
export type Role = { id: string; name: string; isSystem?: boolean };

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
};

/** (Existe en Prisma, hoy no lo devolvés en getUser, pero queda listo) */
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

  /** ✅ NUEVO: habilitar/deshabilitar acceso por PIN (sin exponer el pin) */
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

// Avatar (respuestas posibles)
export type UpdateAvatarResponse = {
  ok?: true;
  avatarUrl?: string | null;
  user?: UserListItem;
};

// ⭐ Favorite warehouse (respuestas posibles)
export type UpdateFavoriteWarehouseResponse = {
  ok?: true;
  favoriteWarehouseId?: string | null;
  user?: UserListItem;
};

// ✅ Update profile (para modal "Editar usuario")
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

/* =========================
   ✅ QUICK PIN (clave rápida)
   Alineado con backend: { ok, hasQuickPin, quickPinUpdatedAt, user? }
========================= */
export type QuickPinState = {
  ok?: true;
  hasQuickPin: boolean;
  quickPinUpdatedAt?: string | null;
  pinEnabled?: boolean;
  user?: UserListItem;
};

function assertPin4(pin: string) {
  const s = String(pin ?? "").trim();
  if (!/^\d{4}$/.test(s)) throw new Error("El PIN debe tener 4 dígitos.");
  return s;
}

/* =========================
   Helpers
========================= */
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
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    sp.set("limit", String(limit));
  }

  const qs = sp.toString();
  return qs ? `/users?${qs}` : "/users";
}

/* =========================
   API calls
========================= */

export async function createUser(body: CreateUserBody): Promise<CreateUserResponse> {
  return apiFetch<CreateUserResponse>("/users", { method: "POST", body });
}

export async function deleteUser(userId: string): Promise<OkResponse> {
  return apiFetch<OkResponse>(`/users/${userId}`, { method: "DELETE" });
}

export async function fetchUsers(params?: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<UsersListResponse> {
  const url = buildUsersQuery(params);
  return apiFetch<UsersListResponse>(url, { method: "GET" });
}

export async function fetchUser(userId: string): Promise<UserDetailResponse> {
  return apiFetch<UserDetailResponse>(`/users/${userId}`, { method: "GET" });
}

export async function updateUserProfile(
  userId: string,
  body: UpdateUserProfileBody
): Promise<OkResponse<{ user?: UserDetail }>> {
  return apiFetch<OkResponse<{ user?: UserDetail }>>(`/users/${userId}`, {
    method: "PATCH",
    body,
  });
}

export async function updateUserStatus(
  userId: string,
  status: Extract<UserStatus, "ACTIVE" | "BLOCKED">
): Promise<OkResponse<{ user?: UserListItem }>> {
  return apiFetch<OkResponse<{ user?: UserListItem }>>(`/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function assignRolesToUser(userId: string, roleIds: string[]): Promise<OkResponse> {
  return apiFetch<OkResponse>(`/users/${userId}/roles`, { method: "PUT", body: { roleIds } });
}

export async function setUserOverride(
  userId: string,
  permissionId: string,
  effect: OverrideEffect
): Promise<OkResponse<{ override?: Override }>> {
  return apiFetch<OkResponse<{ override?: Override }>>(`/users/${userId}/overrides`, {
    method: "POST",
    body: { permissionId, effect },
  });
}

export async function removeUserOverride(userId: string, permissionId: string): Promise<OkResponse> {
  return apiFetch<OkResponse>(`/users/${userId}/overrides/${permissionId}`, { method: "DELETE" });
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
  const resp = await apiFetch<UpdateFavoriteWarehouseResponse>(
    `/users/${userId}/favorite-warehouse`,
    {
      method: "PATCH",
      body: { warehouseId },
    }
  );

  return normalizeFavoriteWarehouseResponse(resp);
}

/* =========================
   AVATAR (ME) multipart/form-data
========================= */

export async function updateUserAvatar(
  file: File
): Promise<{ ok: true; avatarUrl: string | null; user?: UserListItem }> {
  assertImageFile(file);

  const form = new FormData();
  form.append("avatar", file);

  const resp = await apiFetch<UpdateAvatarResponse>("/users/me/avatar", {
    method: "PUT",
    body: form,
  });

  return normalizeAvatarResponse(resp);
}

export async function removeMyAvatar(): Promise<{
  ok: true;
  avatarUrl: string | null;
  user?: UserListItem;
}> {
  const resp = await apiFetch<UpdateAvatarResponse>("/users/me/avatar", { method: "DELETE" });
  return normalizeAvatarResponse(resp);
}

// Alias útil (por si en el UI lo importaste con otro nombre)
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
  });

  return normalizeAvatarResponse(resp);
}

export async function removeAvatarForUser(
  userId: string
): Promise<{ ok: true; avatarUrl: string | null; user?: UserListItem }> {
  const resp = await apiFetch<UpdateAvatarResponse>(`/users/${userId}/avatar`, {
    method: "DELETE",
  });

  return normalizeAvatarResponse(resp);
}

/* =========================
   ✅ QUICK PIN (ME)
========================= */

export async function setMyQuickPin(pin: string): Promise<QuickPinState> {
  const clean = assertPin4(pin);
  return apiFetch<QuickPinState>("/users/me/quick-pin", {
    method: "PUT",
    body: { pin: clean },
  });
}

export async function removeMyQuickPin(currentPin: string): Promise<QuickPinState> {
  const cur = assertPin4(currentPin);
  return apiFetch<QuickPinState>("/users/me/quick-pin", {
    method: "DELETE",
    body: { currentPin: cur },
  });
}

/* =========================
   ✅ QUICK PIN (ADMIN)
========================= */

export async function setUserQuickPin(userId: string, pin: string): Promise<QuickPinState> {
  const clean = assertPin4(pin);
  return apiFetch<QuickPinState>(`/users/${userId}/quick-pin`, {
    method: "PUT",
    body: { pin: clean },
  });
}

/** Alias explícito para “reset” (mismo endpoint PUT, cambia el pin por uno nuevo) */
export async function resetUserQuickPin(userId: string, pin: string): Promise<QuickPinState> {
  return setUserQuickPin(userId, pin);
}

export async function removeUserQuickPin(userId: string): Promise<QuickPinState> {
  return apiFetch<QuickPinState>(`/users/${userId}/quick-pin`, { method: "DELETE" });
}

/* =========================
   ✅ PIN ENABLED (ADMIN)
   Ruta sugerida (la armamos en backend):
   PATCH /users/:id/quick-pin/enabled  { enabled: boolean }
========================= */

export async function setUserPinEnabled(userId: string, enabled: boolean): Promise<QuickPinState> {
  return apiFetch<QuickPinState>(`/users/${userId}/quick-pin/enabled`, {
    method: "PATCH",
    body: { enabled },
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
