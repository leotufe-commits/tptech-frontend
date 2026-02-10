// tptech-frontend/src/components/users/users.data.ts
import { apiFetch } from "../../lib/api";
import type { UserDetail, Role } from "../../services/users";
import { fetchRoles } from "../../services/roles";
import { fetchPermissions, type Permission } from "../../services/permissions";

// ✅ FIX: NO usar "@/..." si tu alias @ no está configurado en Vite/TS
import {
  uploadMyUserAttachments,
  uploadUserAttachments,
  deleteMyUserAttachment,
  deleteUserAttachment,
} from "../../lib/users.api";

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

/**
 * ✅ NUEVO:
 * Cuando vamos a mutar algo sensible (PIN, roles, overrides, etc.),
 * cortamos cualquier fetch en vuelo y subimos la generación para
 * que NO pueda re-cachear un snapshot viejo.
 */
function beginUserMutation(userId: string) {
  if (!userId) return;
  bumpGen(userId);
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
      /**
       * ✅ CRÍTICO:
       * - dedupe:false + cache-buster
       * - on401:"throw" (no logout global)
       */
      const resp = await apiFetch<any>(`/users/${userId}?_ts=${Date.now()}`, {
        method: "GET",
        dedupe: false,
        on401: "throw",
        timeoutMs: 20_000,
      });

      const d: UserDetail = (resp as any)?.user ?? (resp as any);

      // ✅ si invalidaron/mutaron mientras estaba en vuelo, NO cachear
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

/**
 * ✅ Firma usada por Users.tsx (ADMIN):
 * uploadUserAttachmentsInstant(userId, files)
 */
export async function uploadUserAttachmentsInstant(userId: string, files: File[]): Promise<{
  omitted: string[];
  user: UserDetail | null;
}>;
/**
 * ✅ Firma opcional (ME vs ADMIN):
 * uploadUserAttachmentsInstant(actorId, userId, files)
 */
export async function uploadUserAttachmentsInstant(actorId: string, userId: string, files: File[]): Promise<{
  omitted: string[];
  user: UserDetail | null;
}>;
export async function uploadUserAttachmentsInstant(a: string, b: any, c?: any) {
  const isTwoArgs = Array.isArray(b);
  const actorId = isTwoArgs ? null : String(a || "");
  const userId = isTwoArgs ? String(a || "") : String(b || "");
  const files: File[] = (isTwoArgs ? (b as File[]) : (c as File[])) ?? [];

  const arr = files ?? [];
  if (!userId || arr.length === 0) return { omitted: [], user: null };

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

  // ✅ Si lo llaman con 2 args, asumimos ADMIN (Users.tsx).
  // ✅ Si lo llaman con 3 args, hacemos ME vs ADMIN.
  const resp = actorId && userId === actorId ? await uploadMyUserAttachments(fd) : await uploadUserAttachments(userId, fd);

  const updated: UserDetail | null = (resp as any)?.user ?? null;

  if (updated) {
    mergeUserDetailCache(userId, updated);
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

/**
 * ✅ Firma usada por Users.tsx (ADMIN):
 * deleteUserAttachmentInstant(userId, attachmentId)
 */
export async function deleteUserAttachmentInstant(userId: string, attachmentId: string): Promise<{ user: UserDetail | null }>;
/**
 * ✅ Firma opcional (ME vs ADMIN):
 * deleteUserAttachmentInstant(actorId, userId, attachmentId)
 */
export async function deleteUserAttachmentInstant(
  actorId: string,
  userId: string,
  attachmentId: string
): Promise<{ user: UserDetail | null }>;
export async function deleteUserAttachmentInstant(a: string, b: any, c?: any) {
  const isTwoArgs = typeof c === "undefined";
  const actorId = isTwoArgs ? null : String(a || "");
  const userId = isTwoArgs ? String(a || "") : String(b || "");
  const attachmentId = isTwoArgs ? String(b || "") : String(c || "");

  if (!userId || !attachmentId) return { user: userDetailCache.get(userId)?.data ?? null };

  // ✅ optimistic update cache
  const prev = userDetailCache.get(userId)?.data as any;
  const prevAttachments = (prev?.attachments as any[]) ?? null;

  if (prev && Array.isArray(prevAttachments)) {
    const next = {
      ...(prev as any),
      attachments: prevAttachments.filter((x) => String(x?.id) !== String(attachmentId)),
    } as UserDetail;
    userDetailCache.set(userId, { ts: now(), data: next });
  }

  try {
    // ✅ 2 args => ADMIN (Users.tsx)
    // ✅ 3 args => ME vs ADMIN
    if (actorId && userId === actorId) {
      await deleteMyUserAttachment(attachmentId);
    } else {
      await deleteUserAttachment(userId, attachmentId);
    }

    return { user: userDetailCache.get(userId)?.data ?? null };
  } catch (e) {
    invalidateUserDetail(userId);
    const d = await prefetchUserDetail(userId);
    return { user: d };
  }
}

/* =========================
   ✅ QUICK PIN (ADMIN) helpers
========================= */

export type HasSpecialPermissionsError = {
  status: 409;
  code: "HAS_SPECIAL_PERMISSIONS";
  message: string;
  overridesCount: number;
  requireConfirmRemoveOverrides: true;
};

/**
 * ✅ FIX OWNER:
 * Si el backend marca targetIsOwner=true, NO corresponde pedir confirmación
 * de borrado de overrides.
 */
function isHasSpecialPermissionsError(e: any): e is HasSpecialPermissionsError {
  const status = Number((e as any)?.status ?? (e as any)?.response?.status ?? NaN);
  const data = (e as any)?.data ?? (e as any)?.response?.data ?? (e as any)?.body ?? null;

  if (status !== 409 || !data) return false;

  const code = String((data as any).code || "");
  const needsConfirm = Boolean((data as any).requireConfirmRemoveOverrides) === true;
  const targetIsOwner = Boolean((data as any).targetIsOwner) === true;

  if (targetIsOwner) return false;

  return code === "HAS_SPECIAL_PERMISSIONS" && needsConfirm;
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
    // ignore
  }
}

function pickOptionalBool(obj: any, key: string): boolean | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  if (!(key in obj)) return undefined;
  const v = (obj as any)[key];
  return typeof v === "boolean" ? v : undefined;
}

/**
 * PATCH /users/:id/quick-pin/enabled
 * ✅ IMPORTANTE: este endpoint puede NO devolver hasQuickPin.
 * No hay que pisar el cache con false si viene undefined.
 */
export async function setUserQuickPinEnabledAdmin(
  userId: string,
  enabled: boolean,
  opts?: { confirmRemoveOverrides?: boolean }
) {
  if (!userId) throw new Error("userId requerido.");

  beginUserMutation(userId);

  try {
    const resp = await apiFetch(`/users/${userId}/quick-pin/enabled`, {
      method: "PATCH",
      body: {
        enabled: Boolean(enabled),
        ...(opts?.confirmRemoveOverrides ? { confirmRemoveOverrides: true } : {}),
      },
      on401: "throw",
      timeoutMs: 12_000,
    });

    const hasQuickPinOpt = pickOptionalBool(resp, "hasQuickPin");
    const pinEnabledOpt = pickOptionalBool(resp, "pinEnabled");

    const overridesCleared = Boolean((resp as any)?.overridesCleared);
    const overridesCount = Number((resp as any)?.overridesCount ?? NaN);
    const targetIsOwner = (resp as any)?.targetIsOwner;
    const targetIsOwnerOpt = typeof targetIsOwner === "boolean" ? targetIsOwner : undefined;

    applyPinPatchToCache(
      userId,
      {
        ...(hasQuickPinOpt !== undefined ? ({ hasQuickPin: hasQuickPinOpt } as any) : {}),
        ...(pinEnabledOpt !== undefined ? ({ pinEnabled: pinEnabledOpt } as any) : {}),
        ...(overridesCleared ? { permissionOverrides: [] as any } : {}),
        ...(Number.isFinite(overridesCount)
          ? ({ overridesCount, hasSpecialPermissions: overridesCount > 0 } as any)
          : {}),
        ...(targetIsOwnerOpt !== undefined ? ({ targetIsOwner: targetIsOwnerOpt } as any) : {}),
      } as any
    );

    return resp as any;
  } catch (e: any) {
    if (isHasSpecialPermissionsError(e)) throwAsHasSpecialPermissions(e);
    throw e;
  }
}

/**
 * DELETE /users/:id/quick-pin
 */
export async function removeUserQuickPinAdmin(userId: string, opts?: { confirmRemoveOverrides?: boolean }) {
  if (!userId) throw new Error("userId requerido.");

  beginUserMutation(userId);

  try {
    const resp = await apiFetch(`/users/${userId}/quick-pin`, {
      method: "DELETE",
      body: opts?.confirmRemoveOverrides ? { confirmRemoveOverrides: true } : undefined,
      on401: "throw",
      timeoutMs: 12_000,
    });

    const hasQuickPinOpt = pickOptionalBool(resp, "hasQuickPin");
    const pinEnabledOpt = pickOptionalBool(resp, "pinEnabled");

    const overridesCleared = Boolean((resp as any)?.overridesCleared);
    const overridesCount = Number((resp as any)?.overridesCount ?? NaN);
    const targetIsOwner = (resp as any)?.targetIsOwner;
    const targetIsOwnerOpt = typeof targetIsOwner === "boolean" ? targetIsOwner : undefined;

    applyPinPatchToCache(
      userId,
      {
        ...(hasQuickPinOpt !== undefined ? ({ hasQuickPin: hasQuickPinOpt } as any) : {}),
        ...(pinEnabledOpt !== undefined ? ({ pinEnabled: pinEnabledOpt } as any) : {}),
        ...(overridesCleared ? { permissionOverrides: [] as any } : {}),
        ...(Number.isFinite(overridesCount)
          ? ({ overridesCount, hasSpecialPermissions: overridesCount > 0 } as any)
          : {}),
        ...(targetIsOwnerOpt !== undefined ? ({ targetIsOwner: targetIsOwnerOpt } as any) : {}),
      } as any
    );

    return resp as any;
  } catch (e: any) {
    if (isHasSpecialPermissionsError(e)) throwAsHasSpecialPermissions(e);
    throw e;
  }
}

/* =========================
   ✅ QUICK PIN (ME)
========================= */

function only4Digits(pin: string) {
  const s = String(pin || "").replace(/\D/g, "").slice(0, 4);
  if (!/^\d{4}$/.test(s)) throw new Error("El PIN debe tener 4 dígitos.");
  return s;
}

export async function setMyQuickPin(pin: string, currentPin?: string) {
  const body: any = { pin: only4Digits(pin) };

  if (currentPin !== undefined) {
    body.currentPin = only4Digits(currentPin);
  }

  return apiFetch(`/users/me/quick-pin`, {
    method: "PUT",
    body,
    timeoutMs: 12_000,
  });
}

export async function removeMyQuickPin(currentPin?: string) {
  const has = currentPin !== undefined && String(currentPin).trim() !== "";

  return apiFetch(`/users/me/quick-pin`, {
    method: "DELETE",
    body: has ? { currentPin: only4Digits(currentPin as string) } : undefined,
    timeoutMs: 12_000,
  });
}

/**
 * ✅ QUICK PIN (ADMIN) SET PIN
 */
export async function setUserQuickPinAdmin(userId: string, pin: string) {
  if (!userId) throw new Error("userId requerido.");

  beginUserMutation(userId);

  const only4DigitsLocal = (v: string) => {
    const s = String(v || "").replace(/\D/g, "").slice(0, 4);
    if (!/^\d{4}$/.test(s)) throw new Error("El PIN debe tener 4 dígitos.");
    return s;
  };

  const resp = await apiFetch(`/users/${userId}/quick-pin?_ts=${Date.now()}`, {
    method: "PUT",
    body: { pin: only4DigitsLocal(pin) },
    dedupe: false,
    on401: "throw",
    timeoutMs: 12_000,
  });

  const hasQuickPinOpt = pickOptionalBool(resp, "hasQuickPin");
  const pinEnabledOpt = pickOptionalBool(resp, "pinEnabled");
  const quickPinUpdatedAt = (resp as any)?.quickPinUpdatedAt ?? null;

  applyPinPatchToCache(
    userId,
    {
      ...(hasQuickPinOpt !== undefined ? ({ hasQuickPin: hasQuickPinOpt } as any) : { hasQuickPin: true as any }),
      ...(pinEnabledOpt !== undefined ? ({ pinEnabled: pinEnabledOpt } as any) : {}),
      quickPinUpdatedAt,
    } as any
  );

  // ✅ refresh fuerte
  invalidateUserDetail(userId);
  await prefetchUserDetail(userId);

  return resp as any;
}
