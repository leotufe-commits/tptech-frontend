// tptech-frontend/src/services/users.ts
import { apiFetch } from "../lib/api";

/* =========================
   TYPES (frontend)
========================= */
export type Role = { id: string; name: string; isSystem?: boolean };

export type Override = {
  permissionId: string;
  effect: "ALLOW" | "DENY";
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
  status?: "ACTIVE" | "BLOCKED";
};
export type CreateUserResponse = { user: UserListItem };

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

/**
 * Normaliza respuestas "ok/user/avatarUrl" para que el UI tenga un contrato estable.
 */
function normalizeAvatarResponse(resp: any): { ok: true; avatarUrl: string | null; user?: UserListItem } {
  const avatarUrl =
    (resp && typeof resp === "object" && "avatarUrl" in resp ? (resp.avatarUrl as any) : undefined) ??
    (resp && typeof resp === "object" && resp.user?.avatarUrl != null ? resp.user.avatarUrl : undefined) ??
    null;

  return {
    ok: true,
    avatarUrl: avatarUrl ?? null,
    user: resp?.user,
  };
}

/* =========================
   API calls
========================= */

/**
 * Crear usuario
 * POST /users
 */
export async function createUser(body: CreateUserBody) {
  return apiFetch<CreateUserResponse>("/users", {
    method: "POST",
    body,
  });
}

/**
 * Lista de usuarios (tabla)
 * GET /users
 */
export async function fetchUsers() {
  return apiFetch<UsersListResponse>("/users");
}

/**
 * Detalle de un usuario (modal editor)
 * GET /users/:id
 */
export async function fetchUser(userId: string) {
  return apiFetch<UserDetailResponse>(`/users/${userId}`);
}

/**
 * Cambiar estado (activar / bloquear)
 * PATCH /users/:id/status
 */
export async function updateUserStatus(userId: string, status: "ACTIVE" | "BLOCKED") {
  return apiFetch<{ ok?: true; user?: UserListItem }>(`/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

/**
 * Asignar roles
 * PUT /users/:id/roles
 */
export async function assignRolesToUser(userId: string, roleIds: string[]) {
  return apiFetch<{ ok: true }>(`/users/${userId}/roles`, {
    method: "PUT",
    body: { roleIds },
  });
}

/**
 * Crear / actualizar override
 * POST /users/:id/overrides
 */
export async function setUserOverride(userId: string, permissionId: string, effect: "ALLOW" | "DENY") {
  return apiFetch<{ ok?: true; override?: Override }>(`/users/${userId}/overrides`, {
    method: "POST",
    body: { permissionId, effect },
  });
}

/**
 * Eliminar override
 * DELETE /users/:id/overrides/:permissionId
 */
export async function removeUserOverride(userId: string, permissionId: string) {
  return apiFetch<{ ok: true }>(`/users/${userId}/overrides/${permissionId}`, {
    method: "DELETE",
  });
}

/* =========================
   AVATAR (ME) multipart/form-data
   Backend esperado:
   - PUT    /users/me/avatar   (field: avatar)
   - DELETE /users/me/avatar
========================= */

/**
 * Subir/actualizar avatar del usuario logueado
 * PUT /users/me/avatar
 */
export async function updateUserAvatar(file: File) {
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
export async function removeMyAvatar() {
  const resp = await apiFetch<UpdateAvatarResponse>("/users/me/avatar", {
    method: "DELETE",
  });

  return normalizeAvatarResponse(resp);
}

// Alias útil (por si en el UI lo importaste con otro nombre)
export const removeUserAvatar = removeMyAvatar;

/* =========================
   AVATAR (ADMIN) multipart/form-data
   Requiere backend:
   - PUT /users/:id/avatar (field: avatar)
   - DELETE /users/:id/avatar
========================= */

export async function updateUserAvatarForUser(userId: string, file: File) {
  assertImageFile(file);

  const form = new FormData();
  form.append("avatar", file);

  const resp = await apiFetch<UpdateAvatarResponse>(`/users/${userId}/avatar`, {
    method: "PUT",
    body: form,
  });

  return normalizeAvatarResponse(resp);
}

export async function removeAvatarForUser(userId: string) {
  const resp = await apiFetch<UpdateAvatarResponse>(`/users/${userId}/avatar`, {
    method: "DELETE",
  });

  return normalizeAvatarResponse(resp);
}
