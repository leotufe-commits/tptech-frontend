// tptech-frontend/src/services/roles.ts
import { apiFetch } from "../lib/api";

/* =========================
   Types (front)
========================= */
export type RolePermission = {
  id: string; // permissionId
  module?: string;
  action?: string;
  permission?: { id: string; module: string; action: string };
};

export type RoleLite = {
  id: string;
  name: string;
  isSystem?: boolean;
  usersCount?: number;

  // ✅ tu backend en GET /roles ya devuelve permissions: [{ id, module, action }]
  permissions?: RolePermission[];
};

// ✅ Alias por compatibilidad (muchas pantallas usan `Role`)
export type Role = RoleLite;

/**
 * Respuesta de GET /roles/:id (backend nuevo)
 */
export type RoleDetailResponse = {
  role: {
    id: string;
    name: string;
    isSystem?: boolean;
    usersCount?: number;
    permissionIds: string[];
    permissions?: Array<{ id: string; module: string; action: string }>;
  };
};

export type ListRolesResponse = { roles: RoleLite[] } | RoleLite[];

/* =========================
   Helpers
========================= */
function normalizeRoles(resp: unknown): RoleLite[] {
  if (Array.isArray(resp)) return resp as RoleLite[];
  if (resp && typeof resp === "object" && Array.isArray((resp as any).roles)) {
    return (resp as any).roles as RoleLite[];
  }
  return [];
}

/* =========================
   API
========================= */
export async function listRoles(): Promise<RoleLite[]> {
  const resp = await apiFetch<ListRolesResponse>("/roles", { method: "GET" });
  return normalizeRoles(resp);
}

/**
 * ✅ Alias por compatibilidad: algunas pantallas importan fetchRoles
 */
export const fetchRoles = listRoles;

/**
 * ✅ Detalle: GET /roles/:id
 * Devuelve permissionIds para pre-marcar permisos en el modal.
 */
export async function fetchRole(roleId: string): Promise<RoleDetailResponse> {
  return apiFetch<RoleDetailResponse>(`/roles/${roleId}`, { method: "GET" });
}

export async function createRole(name: string): Promise<RoleLite> {
  const resp = await apiFetch<{ role?: RoleLite } & any>("/roles", {
    method: "POST",
    body: { name },
  });
  return resp.role ?? (resp as RoleLite);
}

export async function renameRole(roleId: string, name: string): Promise<RoleLite> {
  const resp = await apiFetch<{ role?: RoleLite } & any>(`/roles/${roleId}`, {
    method: "PATCH",
    body: { name },
  });
  return resp.role ?? (resp as RoleLite);
}

/**
 * Reemplaza permisos del rol.
 * backend: PATCH /roles/:id/permissions  body: { permissionIds: string[] }
 */
export async function updateRolePermissions(roleId: string, permissionIds: string[]) {
  return apiFetch(`/roles/${roleId}/permissions`, {
    method: "PATCH",
    body: { permissionIds },
  });
}

/**
 * Elimina un rol (si backend permite).
 * backend: DELETE /roles/:id
 */
export async function deleteRole(roleId: string) {
  return apiFetch(`/roles/${roleId}`, { method: "DELETE" });
}
