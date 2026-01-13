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
};

/* =========================
   RESPONSES
========================= */
export type UsersListResponse = { users: UserListItem[] };
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

/* =========================
   Helpers
========================= */
function assertImageFile(file: File) {
  if (!file) throw new Error("Seleccioná un archivo");
  if (!file.type?.startsWith("image/")) throw new Error("El archivo debe ser una imagen");

  const MAX = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX) throw new Error("La imagen supera el máximo permitido (5MB)");
}

function normalizeAvatarResponse(
  resp: unknown
): { ok: true; avatarUrl: string | null; user?: UserListItem } {
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

/* =========================
   API calls
========================= */

/**
 * Crear usuario
 * POST /users
 */
export async function createUser(body: CreateUserBody): Promise<CreateUserResponse> {
  return apiFetch<CreateUserResponse>("/users", { method: "POST", body });
}

/**
 * Lista de usuarios (tabla)
 * GET /users
 */
export async function fetchUsers(): Promise<UsersListResponse> {
  return apiFetch<UsersListResponse>("/users", { method: "GET" });
}

/**
 * Detalle de un usuario (modal editor)
 * GET /users/:id
 */
export async function fetchUser(userId: string): Promise<UserDetailResponse> {
  return apiFetch<UserDetailResponse>(`/users/${userId}`, { method: "GET" });
}

/**
 * Cambiar estado (activar / bloquear)
 * PATCH /users/:id/status
 */
export async function updateUserStatus(
  userId: string,
  status: Extract<UserStatus, "ACTIVE" | "BLOCKED">
): Promise<OkResponse<{ user?: UserListItem }>> {
  return apiFetch<OkResponse<{ user?: UserListItem }>>(`/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

/**
 * Asignar roles
 * PUT /users/:id/roles
 */
export async function assignRolesToUser(userId: string, roleIds: string[]): Promise<OkResponse> {
  return apiFetch<OkResponse>(`/users/${userId}/roles`, { method: "PUT", body: { roleIds } });
}

/**
 * Crear / actualizar override (uno)
 * POST /users/:id/overrides
 */
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

/**
 * Eliminar override (uno)
 * DELETE /users/:id/overrides/:permissionId
 */
export async function removeUserOverride(userId: string, permissionId: string): Promise<OkResponse> {
  return apiFetch<OkResponse>(`/users/${userId}/overrides/${permissionId}`, { method: "DELETE" });
}

/* =========================
   AVATAR (ME) multipart/form-data
========================= */

/**
 * Subir/actualizar avatar del usuario logueado
 * PUT /users/me/avatar
 */
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

/**
 * Quitar avatar del usuario logueado
 * DELETE /users/me/avatar
 */
export async function removeMyAvatar(): Promise<{ ok: true; avatarUrl: string | null; user?: UserListItem }> {
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
