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

function toStr(v: any) {
  return String(v ?? "").trim();
}

function isLikelyTechCode(s: string) {
  // "OWNER", "ADMIN", "WAREHOUSE_MANAGER", etc.
  // evita tomar displayName tipo "Propietario" / "Administrador"
  if (!s) return false;
  const t = s.trim();
  if (t.length < 3) return false;
  // mayormente mayúsculas, números y _-
  return /^[A-Z0-9_-]+$/.test(t);
}

function normalizeRoleLite(raw: any): RoleLite | null {
  if (!raw) return null;
  const id = toStr(raw.id);
  const name = toStr(raw.name);
  if (!id || !name) return null;

  const codeRaw = toStr(raw.code);
  const code = codeRaw
    ? codeRaw
    : isLikelyTechCode(toStr(raw.name))
      ? toStr(raw.name)
      : undefined;

  return {
    id,
    name,
    code,
    isSystem: Boolean(raw.isSystem),
    usersCount: typeof raw.usersCount === "number" ? raw.usersCount : undefined,
    permissions: Array.isArray(raw.permissions) ? raw.permissions : undefined,
  };
}

/* =========================
   Normalizers
========================= */
function normalizeRoles(resp: unknown): RoleLite[] {
  const rows: any[] = [];

  if (Array.isArray(resp)) rows.push(...resp);
  else if (isObject(resp) && Array.isArray((resp as any).roles)) rows.push(...((resp as any).roles as any[]));

  return rows.map(normalizeRoleLite).filter(Boolean) as RoleLite[];
}

function normalizeRole(resp: unknown): RoleLite {
  if (!isObject(resp)) throw new Error("Respuesta inválida del servidor");

  const anyResp = resp as any;
  const raw = anyResp.role ?? anyResp;
  const r = normalizeRoleLite(raw);
  if (!r) throw new Error("Respuesta inválida del servidor");
  return r;
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
   Role helpers (para lógica)
========================= */
export function roleTechCode(role?: Pick<RoleLite, "code" | "name"> | null) {
  // siempre devolvé algo usable para comparaciones (owner/admin)
  const c = toStr((role as any)?.code);
  if (c) return c.toLowerCase();
  return toStr((role as any)?.name).toLowerCase();
}

export function isOwnerRole(role?: Pick<RoleLite, "code" | "name"> | null) {
  return roleTechCode(role) === "owner";
}

export function isAdminRole(role?: Pick<RoleLite, "code" | "name"> | null) {
  const c = roleTechCode(role);
  return c === "admin" || c === "owner";
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

function invalidateRolesCache() {
  listCache.data = null;
  listCache.ts = 0;
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
    if (listCache.data && now() - listCache.ts < LIST_TTL_MS) {
      return listCache.data;
    }
    if (listCache.promise) return listCache.promise;
  }

  const p = (async () => {
    const resp = await apiFetch("/roles", { method: "GET" });
    const roles = normalizeRoles(resp);
    listCache.data = roles;
    listCache.ts = now();
    return roles;
  })();

  listCache.promise = p;

  try {
    return await p;
  } finally {
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

  invalidateRolesCache();
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

  invalidateRolesCache();
  return normalizeRole(resp);
}

/**
 * Reemplazar permisos del rol (bulk)
 * PATCH /roles/:id/permissions
 *
 * Backend puede devolver:
 * - { ok: true }
 * - { ok: true, roleId, permissionIds }
 */
export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<{ ok: true; roleId?: string; permissionIds?: string[] }> {
  return apiFetch<{ ok: true; roleId?: string; permissionIds?: string[] }>(`/roles/${roleId}/permissions`, {
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
  invalidateRolesCache();
}
