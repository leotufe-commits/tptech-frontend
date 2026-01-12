// tptech-frontend/src/services/roles.ts
import { apiFetch } from "../lib/api";

/* =========================
   Types (frontend)
========================= */
export type RolePermission = {
  id: string; // permissionId
  module?: string;
  action?: string;
};

export type RoleLite = {
  id: string;
  name: string;          // nombre visible
  code?: string;         // código técnico (OWNER, ADMIN, etc.)
  isSystem?: boolean;
  usersCount?: number;
  permissions?: RolePermission[];
};

/**
 * Respuesta de GET /roles/:id
 * Backend recomendado:
 * {
 *   role: {
 *     id,
 *     name,
 *     code,
 *     isSystem,
 *     usersCount,
 *     permissionIds: string[]
 *   }
 * }
 */
export type RoleDetail = {
  id: string;
  name: string;
  code?: string;
  isSystem?: boolean;
  usersCount?: number;
  permissionIds?: string[];
  permissions?: Array<{ id: string; module: string; action: string }>;
};

export type RoleDetailResponse =
  | { role: RoleDetail }
  | RoleDetail;

/* =========================
   Helpers
========================= */
function normalizeRoles(resp: unknown): RoleLite[] {
  if (Array.isArray(resp)) return resp as RoleLite[];

  if (resp && typeof resp === "object") {
    const anyResp = resp as any;
    if (Array.isArray(anyResp.roles)) return anyResp.roles as RoleLite[];
  }

  return [];
}

function normalizeRole(resp: unknown): RoleLite {
  if (resp && typeof resp === "object") {
    const anyResp = resp as any;
    return (anyResp.role ?? anyResp) as RoleLite;
  }
  throw new Error("Respuesta inválida del servidor");
}

export function extractPermissionIdsFromRoleDetail(
  resp: RoleDetailResponse
): string[] {
  const role = (resp as any)?.role ?? resp;

  if (Array.isArray(role?.permissionIds)) {
    return role.permissionIds.filter((x: unknown) => typeof x === "string");
  }

  if (Array.isArray(role?.permissions)) {
    return Array.from(
      new Set(
        role.permissions
          .map((p: any) => p?.id)
          .filter((x: unknown) => typeof x === "string")
      )
    );
  }

  return [];
}

/* =========================
   API
========================= */

/**
 * Listar roles del tenant
 * GET /roles
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
 * GET /roles/:id
 */
export async function fetchRole(roleId: string): Promise<RoleDetailResponse> {
  return apiFetch<RoleDetailResponse>(`/roles/${roleId}`, { method: "GET" });
}

/**
 * Crear rol custom
 * POST /roles
 */
export async function createRole(
  name: string,
  permissionIds: string[] = []
): Promise<RoleLite> {
  const resp = await apiFetch("/roles", {
    method: "POST",
    body: { name, permissionIds },
  });

  return normalizeRole(resp);
}

/**
 * Renombrar rol
 * PATCH /roles/:id
 */
export async function renameRole(
  roleId: string,
  name: string
): Promise<RoleLite> {
  const resp = await apiFetch(`/roles/${roleId}`, {
    method: "PATCH",
    body: { name },
  });

  return normalizeRole(resp);
}

/**
 * Reemplazar permisos del rol (bulk)
 * PATCH /roles/:id/permissions
 */
export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/roles/${roleId}/permissions`, {
    method: "PATCH",
    body: { permissionIds },
  });
}

/**
 * Eliminar rol (solo custom)
 * DELETE /roles/:id
 */
export async function deleteRole(roleId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/roles/${roleId}`, { method: "DELETE" });
}
