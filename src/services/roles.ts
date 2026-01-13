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
  name: string; // nombre visible
  code?: string; // código técnico (OWNER, ADMIN, etc.)
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

export type RoleDetailResponse = { role: RoleDetail } | RoleDetail;

/* =========================
   Narrowing helpers
========================= */
function isObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object";
}

/* =========================
   Normalizers
========================= */
function normalizeRoles(resp: unknown): RoleLite[] {
  if (Array.isArray(resp)) return resp as RoleLite[];

  if (isObject(resp) && Array.isArray((resp as any).roles)) {
    return (resp as any).roles as RoleLite[];
  }

  return [];
}

function normalizeRole(resp: unknown): RoleLite {
  if (!isObject(resp)) throw new Error("Respuesta inválida del servidor");

  const anyResp = resp as any;
  return (anyResp.role ?? anyResp) as RoleLite;
}

export function extractPermissionIdsFromRoleDetail(resp: RoleDetailResponse): string[] {
  const role = (isObject(resp) && "role" in resp ? (resp as any).role : resp) as any;

  if (Array.isArray(role?.permissionIds)) {
    return role.permissionIds.filter((x: unknown) => typeof x === "string");
  }

  if (Array.isArray(role?.permissions)) {
    const ids = role.permissions
      .map((p: any) => p?.id)
      .filter((x: unknown) => typeof x === "string");
    return Array.from(new Set(ids));
  }

  return [];
}

/* =========================
   In-memory cache (perf)
========================= */
type ListCache = {
  ts: number;
  promise: Promise<RoleLite[]> | null;
  data: RoleLite[] | null;
};

const LIST_TTL_MS = 5_000; // anti-spam corto (5s)
const listCache: ListCache = { ts: 0, promise: null, data: null };

function now() {
  return Date.now();
}

/* =========================
   API
========================= */

/**
 * Listar roles del tenant
 * GET /roles
 *
 * ✅ Cache corto para evitar doble request (StrictMode / remount)
 * - Si querés forzar, usá listRoles({ force: true })
 */
export async function listRoles(opts?: { force?: boolean }): Promise<RoleLite[]> {
  const force = Boolean(opts?.force);

  if (!force) {
    // si hay data fresca, devolvé
    if (listCache.data && now() - listCache.ts < LIST_TTL_MS) {
      return listCache.data;
    }

    // si hay request en vuelo, compartilo
    if (listCache.promise) return listCache.promise;
  }

  const p = (async () => {
    const resp = await apiFetch("/roles", { method: "GET" });
    const roles = normalizeRoles(resp);

    // guardamos data
    listCache.data = roles;
    listCache.ts = now();
    return roles;
  })();

  listCache.promise = p;

  try {
    return await p;
  } finally {
    // liberar el “in-flight”
    listCache.promise = null;
  }
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
 *
 * Nota: el backend puede aceptar permissionIds opcionalmente.
 * ✅ Invalida cache de lista
 */
export async function createRole(name: string, permissionIds: string[] = []): Promise<RoleLite> {
  const resp = await apiFetch("/roles", {
    method: "POST",
    body: { name, permissionIds },
  });

  // invalida cache
  listCache.data = null;
  listCache.ts = 0;

  return normalizeRole(resp);
}

/**
 * Renombrar rol
 * PATCH /roles/:id
 * ✅ Invalida cache de lista
 */
export async function renameRole(roleId: string, name: string): Promise<RoleLite> {
  const resp = await apiFetch(`/roles/${roleId}`, {
    method: "PATCH",
    body: { name },
  });

  // invalida cache
  listCache.data = null;
  listCache.ts = 0;

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
 * ✅ Invalida cache de lista
 */
export async function deleteRole(roleId: string): Promise<void> {
  await apiFetch(`/roles/${roleId}`, { method: "DELETE" });

  // invalida cache
  listCache.data = null;
  listCache.ts = 0;
}
