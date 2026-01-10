// tptech-frontend/src/services/roles.ts
import { apiFetch } from "../lib/api";

/* =========================
   Types (front)
========================= */
export type RolePermission = {
  id: string; // permissionId
  module?: string;
  action?: string;
};

export type RoleLite = {
  id: string;
  name: string; // ✅ nombre visible (displayName si existe, sino name)
  code?: string; // ✅ código técnico (OWNER/ADMIN/STAFF/READONLY o custom name)
  isSystem?: boolean;
  usersCount?: number;
  permissions?: RolePermission[];
};

/**
 * Respuesta de GET /roles/:id
 */
export type RoleDetailResponse = {
  role: {
    id: string;
    name: string; // ✅ nombre visible
    code?: string; // ✅ código técnico
    isSystem?: boolean;
    usersCount?: number;
    permissionIds: string[];
    permissions?: Array<{ id: string; module: string; action: string }>;
  };
};

/* =========================
   Helpers
========================= */
function normalizeRoles(resp: any): RoleLite[] {
  if (Array.isArray(resp)) return resp as RoleLite[];
  if (resp && Array.isArray(resp.roles)) return resp.roles as RoleLite[];
  return [];
}

/* =========================
   API
========================= */

/**
 * Lista roles del tenant
 */
export async function listRoles(): Promise<RoleLite[]> {
  const resp = await apiFetch("/roles", { method: "GET" });
  return normalizeRoles(resp);
}

/**
 * Alias por compatibilidad
 */
export const fetchRoles = listRoles;

/**
 * Detalle de un rol
 */
export async function fetchRole(roleId: string): Promise<RoleDetailResponse> {
  return apiFetch<RoleDetailResponse>(`/roles/${roleId}`, { method: "GET" });
}

/**
 * Crear rol custom
 * ✅ IMPORTANTE: tu backend actual (controller que pegaste) devuelve el rol directo,
 * no { role: ... }. Por eso devolvemos el payload tal cual.
 * Dejamos permissionIds opcional (no rompe aunque el backend lo ignore).
 */
export async function createRole(name: string, permissionIds: string[] = []): Promise<RoleLite> {
  const resp = await apiFetch<any>("/roles", {
    method: "POST",
    body: { name, permissionIds },
  });

  // ✅ tolera ambos formatos: {role: ...} o role directo
  return (resp?.role ?? resp) as RoleLite;
}

/**
 * Renombrar rol
 * ✅ IMPORTANTE: igual que create, toleramos {role} o directo.
 */
export async function renameRole(roleId: string, name: string): Promise<RoleLite> {
  const resp = await apiFetch<any>(`/roles/${roleId}`, {
    method: "PATCH",
    body: { name },
  });

  return (resp?.role ?? resp) as RoleLite;
}

/**
 * Reemplazar permisos del rol
 */
export async function updateRolePermissions(roleId: string, permissionIds: string[]): Promise<{ ok: true }> {
  return apiFetch(`/roles/${roleId}/permissions`, {
    method: "PATCH",
    body: { permissionIds },
  });
}

/**
 * Eliminar rol (solo custom)
 */
export async function deleteRole(roleId: string): Promise<void> {
  await apiFetch(`/roles/${roleId}`, { method: "DELETE" });
}
