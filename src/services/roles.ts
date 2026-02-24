import { apiFetch } from "../lib/api";

/* =========================
   Types
========================= */
export type RolePermission = {
  id: string;
  module?: string;
  action?: string;
};

export type RoleLite = {
  id: string;
  name: string;
  code?: string;
  isSystem?: boolean;
  usersCount?: number;
  permissions?: RolePermission[];
};

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
   Helpers
========================= */
function isObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object";
}

function toStr(v: any) {
  return String(v ?? "").trim();
}

function isLikelyTechCode(s: string) {
  if (!s) return false;
  return /^[A-Z0-9_-]+$/.test(s);
}

function normalizeRoleLite(raw: any): RoleLite | null {
  if (!raw) return null;

  const id = toStr(raw.id);
  const name = toStr(raw.name);
  if (!id || !name) return null;

  const codeRaw = toStr(raw.code);
  const code = codeRaw
    ? codeRaw
    : isLikelyTechCode(name)
      ? name
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

  if (Array.isArray(resp)) {
    rows.push(...resp);
  } else if (isObject(resp)) {
    if (Array.isArray((resp as any).items)) {
      rows.push(...((resp as any).items as any[]));
    } else if (Array.isArray((resp as any).roles)) {
      rows.push(...((resp as any).roles as any[]));
    }
  }

  return rows.map(normalizeRoleLite).filter(Boolean) as RoleLite[];
}

function normalizeRole(resp: unknown): RoleLite {
  if (!isObject(resp)) throw new Error("Respuesta inválida del servidor");

  const raw = (resp as any).role ?? resp;
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
    return role.permissions
      .map((p: any) => p?.id)
      .filter((x: unknown) => typeof x === "string");
  }

  return [];
}

/* =========================
   Cache
========================= */
type ListCache = {
  ts: number;
  promise: Promise<RoleLite[]> | null;
  data: RoleLite[] | null;
};

const LIST_TTL_MS = 5_000;
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

export const fetchRoles = listRoles;

export async function fetchRole(roleId: string): Promise<RoleDetailResponse> {
  return apiFetch<RoleDetailResponse>(`/roles/${roleId}`, { method: "GET" });
}

export async function createRole(name: string, permissionIds: string[] = []): Promise<RoleLite> {
  const resp = await apiFetch("/roles", {
    method: "POST",
    body: { name, permissionIds },
  });

  invalidateRolesCache();
  return normalizeRole(resp);
}

export async function renameRole(roleId: string, name: string): Promise<RoleLite> {
  const resp = await apiFetch(`/roles/${roleId}`, {
    method: "PATCH",
    body: { name },
  });

  invalidateRolesCache();
  return normalizeRole(resp);
}

export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<{ ok: true; roleId?: string; permissionIds?: string[] }> {
  return apiFetch(`/roles/${roleId}/permissions`, {
    method: "PATCH",
    body: { permissionIds },
  });
}

export async function deleteRole(roleId: string): Promise<void> {
  await apiFetch(`/roles/${roleId}`, { method: "DELETE" });
  invalidateRolesCache();
}