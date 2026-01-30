// tptech-frontend/src/components/users/users.data.ts
import { apiFetch } from "../../lib/api";
import { fetchUser, type UserDetail, type Role } from "../../services/users";
import { fetchRoles } from "../../services/roles";
import { fetchPermissions, type Permission } from "../../services/permissions";

/* =========================
   Cache + Prefetch
========================= */
type UserCacheEntry = { ts: number; data: UserDetail };

const USER_TTL_MS = 10_000;
const ROLES_TTL_MS = 20_000;
const PERMS_TTL_MS = 20_000;

const userDetailCache = new Map<string, UserCacheEntry>();
const userDetailInFlight = new Map<string, Promise<UserDetail | null>>();

/**
 * ✅ Evita race-condition:
 * si invalidás mientras hay un fetch en vuelo, ese fetch NO debe re-cachear data vieja.
 */
const userDetailGen = new Map<string, number>();

let rolesCache: { ts: number; data: Role[] | null; promise: Promise<Role[]> | null } = {
  ts: 0,
  data: null,
  promise: null,
};

let permsCache: { ts: number; data: Permission[] | null; promise: Promise<Permission[]> | null } = {
  ts: 0,
  data: null,
  promise: null,
};

function now() {
  return Date.now();
}

function getGen(userId: string) {
  return userDetailGen.get(userId) ?? 0;
}

function bumpGen(userId: string) {
  userDetailGen.set(userId, getGen(userId) + 1);
}

export function invalidateUserDetail(userId: string) {
  if (!userId) return;
  bumpGen(userId);
  userDetailCache.delete(userId);
  userDetailInFlight.delete(userId);
}

export function invalidateRolesCache() {
  rolesCache.ts = 0;
  rolesCache.data = null;
  rolesCache.promise = null;
}

export function invalidatePermsCache() {
  permsCache.ts = 0;
  permsCache.data = null;
  permsCache.promise = null;
}

/**
 * ✅ Permite “mergear” un parche al detalle cacheado, sin pisar secciones que
 * quizá no vienen en una respuesta parcial (ej: update profile no devuelve attachments).
 */
export function mergeUserDetailCache(userId: string, patch: Partial<UserDetail>) {
  if (!userId) return;
  const prev = userDetailCache.get(userId)?.data;
  if (!prev) return;

  const next: UserDetail = {
    ...(prev as any),
    ...(patch as any),
    roles: (patch as any)?.roles ?? (prev as any)?.roles ?? [],
    permissionOverrides: (patch as any)?.permissionOverrides ?? (prev as any)?.permissionOverrides ?? [],
    attachments: (patch as any)?.attachments ?? (prev as any)?.attachments ?? [],
  };

  userDetailCache.set(userId, { ts: now(), data: next });
}

/* =========================
   Roles / Perms (cached)
========================= */
export async function getRolesCached() {
  if (rolesCache.data && now() - rolesCache.ts < ROLES_TTL_MS) return rolesCache.data;
  if (rolesCache.promise) return rolesCache.promise;

  rolesCache.promise = (async () => {
    const list = (await fetchRoles()) as Role[];
    rolesCache.data = list;
    rolesCache.ts = now();
    return list;
  })();

  try {
    return await rolesCache.promise;
  } finally {
    rolesCache.promise = null;
  }
}

export async function getPermsCached() {
  if (permsCache.data && now() - permsCache.ts < PERMS_TTL_MS) return permsCache.data;
  if (permsCache.promise) return permsCache.promise;

  permsCache.promise = (async () => {
    const list = await fetchPermissions();
    permsCache.data = list;
    permsCache.ts = now();
    return list;
  })();

  try {
    return await permsCache.promise;
  } finally {
    permsCache.promise = null;
  }
}

/* =========================
   User detail (cached + dedupe)
========================= */
export async function prefetchUserDetail(userId: string): Promise<UserDetail | null> {
  if (!userId) return null;

  const cached = userDetailCache.get(userId);
  if (cached && now() - cached.ts < USER_TTL_MS) return cached.data;

  const inflight = userDetailInFlight.get(userId);
  if (inflight) return inflight;

  const startGen = getGen(userId);

  const p: Promise<UserDetail | null> = (async () => {
    try {
      const resp = await fetchUser(userId);
      const d: UserDetail = (resp as any)?.user ?? (resp as any);

      // ✅ si invalidaron mientras estaba en vuelo, NO cachear
      if (getGen(userId) !== startGen) return d;

      userDetailCache.set(userId, { ts: now(), data: d });
      return d;
    } catch (err) {
      invalidateUserDetail(userId);
      throw err;
    }
  })();

  userDetailInFlight.set(userId, p);

  try {
    return await p;
  } finally {
    userDetailInFlight.delete(userId);
  }
}

/* =========================
   Adjuntos (API helpers)
========================= */
export async function uploadUserAttachmentsInstant(userId: string, files: File[]) {
  const arr = files ?? [];
  if (!userId || arr.length === 0) return;

  const MAX = 20 * 1024 * 1024; // 20MB por archivo
  const filtered = arr.filter((f) => f.size <= MAX);
  const rejected = arr.filter((f) => f.size > MAX);

  if (filtered.length === 0) {
    const detail = rejected.map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`).join(", ");
    throw new Error(
      rejected.length
        ? `No se pudieron adjuntar los archivos: ${detail}. Máximo permitido: 20 MB por archivo.`
        : "No se recibió ningún archivo."
    );
  }

  const fd = new FormData();
  filtered.forEach((f) => fd.append("attachments", f));

  // ✅ backend: PUT /users/:id/attachments => { ok, createdCount, user }
  const resp = await apiFetch(`/users/${userId}/attachments`, { method: "PUT", body: fd as any });

  const updated: UserDetail | null = (resp as any)?.user ?? null;

  // ✅ si viene user parcial, mergea; si viene completo, merge también sirve
  if (updated) {
    mergeUserDetailCache(userId, updated);
    // refresca timestamp por “instant update”
    const cur = userDetailCache.get(userId)?.data;
    if (cur) userDetailCache.set(userId, { ts: now(), data: cur });
    userDetailInFlight.delete(userId);
  } else {
    invalidateUserDetail(userId);
  }

  return {
    omitted: rejected.map((x) => x.name),
    user: updated,
  };
}

export async function deleteUserAttachmentInstant(userId: string, attachmentId: string) {
  if (!userId || !attachmentId) return;

  // ✅ Optimistic UX: lo ocultamos al toque (evita “lag” y requests extra)
  const prev = userDetailCache.get(userId)?.data as any;
  const prevAttachments = (prev?.attachments as any[]) ?? null;

  if (prev && Array.isArray(prevAttachments)) {
    const next = {
      ...(prev as any),
      attachments: prevAttachments.filter((a) => String(a?.id) !== String(attachmentId)),
    } as UserDetail;
    userDetailCache.set(userId, { ts: now(), data: next });
  }

  try {
    await apiFetch(`/users/${userId}/attachments/${attachmentId}`, { method: "DELETE" });
    // ✅ ya está actualizado localmente; si el backend tiene más cambios, el TTL lo refresca luego
    return { user: userDetailCache.get(userId)?.data ?? null };
  } catch (e) {
    // rollback: invalida y re-fetch
    invalidateUserDetail(userId);
    const d = await prefetchUserDetail(userId);
    return { user: d };
  }
}

/* =========================
   ✅ QUICK PIN (ADMIN) helpers (con confirmRemoveOverrides)
   - soporta 409 HAS_SPECIAL_PERMISSIONS
   - actualiza cache optimistamente si hay respuesta OK
========================= */

export type HasSpecialPermissionsError = {
  status: 409;
  code: "HAS_SPECIAL_PERMISSIONS";
  message: string;
  overridesCount: number;
  requireConfirmRemoveOverrides: true;
};

function isHasSpecialPermissionsError(e: any): e is HasSpecialPermissionsError {
  const status = Number((e as any)?.status ?? (e as any)?.response?.status ?? NaN);
  const data = (e as any)?.data ?? (e as any)?.response?.data ?? (e as any)?.body ?? null;

  return (
    status === 409 &&
    data &&
    String((data as any).code || "") === "HAS_SPECIAL_PERMISSIONS" &&
    Boolean((data as any).requireConfirmRemoveOverrides) === true
  );
}

function throwAsHasSpecialPermissions(e: any): never {
  const data = (e as any)?.data ?? (e as any)?.response?.data ?? (e as any)?.body ?? {};
  const err: HasSpecialPermissionsError = {
    status: 409,
    code: "HAS_SPECIAL_PERMISSIONS",
    message: String((data as any).message || "Este usuario tiene permisos especiales asignados."),
    overridesCount: Number((data as any).overridesCount ?? 0),
    requireConfirmRemoveOverrides: true,
  };
  throw err;
}

function applyPinPatchToCache(userId: string, patch: Partial<UserDetail>) {
  try {
    mergeUserDetailCache(userId, patch);
    const cur = userDetailCache.get(userId)?.data;
    if (cur) userDetailCache.set(userId, { ts: now(), data: cur });
  } catch {
    // si no hay cache, no pasa nada
  }
}

/**
 * PATCH /users/:id/quick-pin/enabled
 * body: { enabled: boolean, confirmRemoveOverrides?: boolean }
 */
export async function setUserQuickPinEnabledAdmin(
  userId: string,
  enabled: boolean,
  opts?: { confirmRemoveOverrides?: boolean }
) {
  if (!userId) throw new Error("userId requerido.");

  try {
    const resp = await apiFetch(`/users/${userId}/quick-pin/enabled`, {
      method: "PATCH",
      body: {
        enabled: Boolean(enabled),
        ...(opts?.confirmRemoveOverrides ? { confirmRemoveOverrides: true } : {}),
      },
      timeoutMs: 12000,
    });

    const hasQuickPin = Boolean((resp as any)?.hasQuickPin);
    const pinEnabled = Boolean((resp as any)?.pinEnabled);
    const overridesCleared = Boolean((resp as any)?.overridesCleared);

    applyPinPatchToCache(userId, {
      hasQuickPin,
      pinEnabled,
      ...(overridesCleared ? { permissionOverrides: [] as any } : {}),
    } as any);

    return resp as any;
  } catch (e: any) {
    if (isHasSpecialPermissionsError(e)) throwAsHasSpecialPermissions(e);
    throw e;
  }
}

/**
 * DELETE /users/:id/quick-pin
 * body: { confirmRemoveOverrides?: boolean }
 */
export async function removeUserQuickPinAdmin(userId: string, opts?: { confirmRemoveOverrides?: boolean }) {
  if (!userId) throw new Error("userId requerido.");

  try {
    const resp = await apiFetch(`/users/${userId}/quick-pin`, {
      method: "DELETE",
      body: opts?.confirmRemoveOverrides ? { confirmRemoveOverrides: true } : undefined,
      timeoutMs: 12000,
    });

    const hasQuickPin = Boolean((resp as any)?.hasQuickPin);
    const pinEnabled = Boolean((resp as any)?.pinEnabled);
    const overridesCleared = Boolean((resp as any)?.overridesCleared);

    applyPinPatchToCache(userId, {
      hasQuickPin,
      pinEnabled,
      ...(overridesCleared ? { permissionOverrides: [] as any } : {}),
    } as any);

    return resp as any;
  } catch (e: any) {
    if (isHasSpecialPermissionsError(e)) throwAsHasSpecialPermissions(e);
    throw e;
  }
}
