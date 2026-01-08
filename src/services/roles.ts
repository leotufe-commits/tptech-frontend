import { apiFetch } from "../lib/api";

/* =========================
   Types (front)
========================= */
export type RoleLite = {
  id: string;
  name: string;
  isSystem?: boolean;
};

export type RoleDetail = {
  id: string;
  name: string;
  isSystem?: boolean;
  permissions?: Array<{
    id: string; // rolePermission id o permission id (depende backend)
    permission?: { id: string; module: string; action: string };
    module?: string;
    action?: string;
  }>;
};

export type ListRolesResponse = { roles: RoleLite[] } | RoleLite[];

/* =========================
   Helpers
========================= */
function normalizeRoles(resp: any): RoleLite[] {
  if (Array.isArray(resp)) return resp;
  if (resp && Array.isArray(resp.roles)) return resp.roles;
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

export async function createRole(name: string): Promise<RoleLite> {
  // backend: POST /roles  body: { name }
  const resp = await apiFetch<{ role?: RoleLite } & any>("/roles", {
    method: "POST",
    body: { name },
  });

  // soporte flexible
  return resp.role ?? resp;
}

export async function renameRole(roleId: string, name: string): Promise<RoleLite> {
  // backend: PATCH /roles/:id  body: { name }
  const resp = await apiFetch<{ role?: RoleLite } & any>(`/roles/${roleId}`, {
    method: "PATCH",
    body: { name },
  });

  return resp.role ?? resp;
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
