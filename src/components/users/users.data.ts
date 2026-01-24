// tptech-frontend/src/components/users/users.data.ts
import { apiFetch } from "../../lib/api";
import { fetchUser, type UserDetail, type Role } from "../../services/users";
import { fetchRoles } from "../../services/roles";
import { fetchPermissions, type Permission } from "../../services/permissions";

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
    const detail = rejected
      .map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`)
      .join(", ");
    throw new Error(
      rejected.length
        ? `No se pudieron adjuntar los archivos: ${detail}. Máximo permitido: 20 MB por archivo.`
        : "No se recibió ningún archivo."
    );
  }

  const fd = new FormData();
  filtered.forEach((f) => fd.append("attachments", f));

  await apiFetch(`/users/${userId}/attachments`, { method: "PUT", body: fd as any });

  return { omitted: rejected.map((x) => x.name) };
}

export async function deleteUserAttachmentInstant(userId: string, attachmentId: string) {
  if (!userId || !attachmentId) return;
  await apiFetch(`/users/${userId}/attachments/${attachmentId}`, { method: "DELETE" });
}

/* =========================
   Cache + Prefetch
========================= */
type UserCacheEntry = { ts: number; data: UserDetail };

const USER_TTL_MS = 10_000;
const ROLES_TTL_MS = 20_000;
const PERMS_TTL_MS = 20_000;

const userDetailCache = new Map<string, UserCacheEntry>();
const userDetailInFlight = new Map<string, Promise<UserDetail>>();

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

export async function prefetchUserDetail(userId: string) {
  if (!userId) return;

  const cached = userDetailCache.get(userId);
  if (cached && now() - cached.ts < USER_TTL_MS) return cached.data;

  const inflight = userDetailInFlight.get(userId);
  if (inflight) return inflight;

  const p = (async () => {
    const resp = await fetchUser(userId);
    const d: UserDetail = (resp as any)?.user ?? (resp as any);
    userDetailCache.set(userId, { ts: now(), data: d });
    return d;
  })();

  userDetailInFlight.set(userId, p);

  try {
    return await p;
  } finally {
    userDetailInFlight.delete(userId);
  }
}

export function invalidateUserDetail(userId: string) {
  if (!userId) return;
  userDetailCache.delete(userId);
  userDetailInFlight.delete(userId);
}
