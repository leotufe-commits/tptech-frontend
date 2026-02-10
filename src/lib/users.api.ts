// tptech-frontend/src/lib/users.api.ts
import { apiFetch } from "./api";

/* =========================
   EVENTS (UI SYNC)
   - Sidebar escucha esto para refrescar avatar instantáneo
========================= */
export const USER_AVATAR_EVENT = "tptech:user_avatar_changed";

function emitUserAvatarChanged(args: { userId: string; avatarUrl: string | null | undefined }) {
  try {
    window.dispatchEvent(
      new CustomEvent(USER_AVATAR_EVENT, {
        detail: {
          userId: String(args.userId || ""),
          avatarUrl: args.avatarUrl ?? "",
        },
      })
    );
  } catch {
    // ignore
  }
}

/* =========================
   TYPES
========================= */
export type RoleLite = {
  id: string;
  name: string;
  isSystem?: boolean;
};

export type UserLite = {
  id: string;
  email: string;
  name?: string | null;
  status: "ACTIVE" | "BLOCKED" | string;
  avatarUrl?: string | null;
  favoriteWarehouseId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  roles: RoleLite[];
};

/* =========================
   USERS
========================= */
export async function listUsers() {
  return apiFetch<{ users: UserLite[] }>("/users", {
    method: "GET",
  });
}

export async function listRoles() {
  return apiFetch<{ roles?: RoleLite[] } | RoleLite[]>("/roles", {
    method: "GET",
  });
}

export async function updateUserStatus(userId: string, status: "ACTIVE" | "BLOCKED") {
  return apiFetch<{ user: any }>(`/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function assignUserRoles(userId: string, roleIds: string[]) {
  return apiFetch<{ ok: true }>(`/users/${userId}/roles`, {
    method: "PUT",
    body: { roleIds },
  });
}

/* =========================
   USER ATTACHMENTS (ME)
   ✅ IMPORTANTE: NO forzar Bearer.
   - Autenticación principal: cookie httpOnly (credentials: include)
========================= */
export async function uploadMyUserAttachments(formData: FormData) {
  const res = await apiFetch<{
    ok: true;
    createdCount: number;
    user: any;
  }>("/users/me/attachments", {
    method: "PUT",
    body: formData,
    on401: "throw",
    // ✅ NO forceBearer: evita choque Bearer (viejo) vs cookie (válida)
  });

  // ✅ Si el backend devolvió el user actualizado, avisamos al Sidebar
  try {
    const u = res?.user;
    const userId = String(u?.id || "");
    if (userId) {
      emitUserAvatarChanged({ userId, avatarUrl: u?.avatarUrl });
    }
  } catch {
    // ignore
  }

  return res;
}

export async function deleteMyUserAttachment(attachmentId: string) {
  const res = await apiFetch<{ ok: true; user?: any }>(`/users/me/attachments/${attachmentId}`, {
    method: "DELETE",
    on401: "throw",
    // ✅ NO forceBearer
  });

  // ✅ Si el backend devolvió el user actualizado, avisamos al Sidebar
  // (Si borraste el avatar, avatarUrl puede quedar vacío)
  try {
    const u = (res as any)?.user;
    const userId = String(u?.id || "");
    if (userId) {
      emitUserAvatarChanged({ userId, avatarUrl: u?.avatarUrl });
    }
  } catch {
    // ignore
  }

  return res;
}

/* =========================
   USER ATTACHMENTS (ADMIN)
   ✅ También usamos cookie httpOnly (no mezclar auth)
========================= */
export async function uploadUserAttachments(userId: string, formData: FormData) {
  const res = await apiFetch<{
    ok: true;
    createdCount: number;
    user: any;
  }>(`/users/${userId}/attachments`, {
    method: "PUT",
    body: formData,
    on401: "throw",
    // ✅ NO forceBearer
  });

  // ✅ Solo dispara update si el backend devolvió el user y es el userId afectado
  // (Sidebar se auto-filtra por myId, pero igual enviamos el evento)
  try {
    const u = res?.user;
    const id = String(u?.id || userId || "");
    if (id) {
      emitUserAvatarChanged({ userId: id, avatarUrl: u?.avatarUrl });
    }
  } catch {
    // ignore
  }

  return res;
}

export async function deleteUserAttachment(userId: string, attachmentId: string) {
  const res = await apiFetch<{ ok: true; user?: any }>(`/users/${userId}/attachments/${attachmentId}`, {
    method: "DELETE",
    on401: "throw",
    // ✅ NO forceBearer
  });

  // ✅ si el delete impactó el avatar, avisamos
  try {
    const u = (res as any)?.user;
    const id = String(u?.id || userId || "");
    if (id) {
      emitUserAvatarChanged({ userId: id, avatarUrl: u?.avatarUrl });
    }
  } catch {
    // ignore
  }

  return res;
}

/* ======================================================
   DOWNLOAD HELPERS (Blob + Cookie httpOnly)
   ✅ NO Authorization Bearer
   ✅ credentials: include (cookie httpOnly)
====================================================== */
function apiBaseNoApi(): string {
  // VITE_API_URL puede ser "/api" (dev proxy) o "http://localhost:3001" / "https://host"
  // Para descargas:
  // - si es "/api" => usamos misma origin (base "")
  // - si es absoluta => quitamos /api si viniera, y luego armamos /api/...
  const raw = (import.meta as any).env?.VITE_API_URL || "/api";
  const s = String(raw || "").trim();
  if (!s) return "";

  if (s.startsWith("/")) return ""; // proxy /api => misma origin

  const noTrail = s.replace(/\/+$/, "");
  return noTrail.replace(/\/api$/i, "");
}

function contentDispositionFilename(cd: string): string {
  const s = String(cd || "");
  // filename*=UTF-8''...
  const m1 = s.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (m1?.[1]) {
    const raw = m1[1].trim().replace(/^UTF-8''/i, "");
    try {
      return decodeURIComponent(raw.replace(/^"|"$/g, ""));
    } catch {
      return raw.replace(/^"|"$/g, "");
    }
  }

  // filename="..."
  const m2 = s.match(/filename="?([^"]+)"?/i);
  if (m2?.[1]) return m2[1].trim();

  return "";
}

async function downloadWithCookie(path: string, filename?: string) {
  const base = apiBaseNoApi();

  const url = base
    ? `${base}${path.startsWith("/") ? path : `/${path}`}`
    : `${path.startsWith("/") ? path : `/${path}`}`;

  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Error descargando (${resp.status}). ${txt.slice(0, 180)}`);
  }

  const blob = await resp.blob();

  let finalName = filename || "archivo";
  try {
    const cd = resp.headers.get("content-disposition") || "";
    const fromHeader = contentDispositionFilename(cd);
    if (fromHeader) finalName = fromHeader;
  } catch {
    // ignore
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

/* =========================
   ✅ DOWNLOAD ATTACHMENT (ADMIN) - Cookie
========================= */
export async function downloadUserAttachmentFile(userId: string, attachmentId: string, filename?: string) {
  // backend está bajo /api (createApp: app.use("/api", routes))
  return downloadWithCookie(`/api/users/${userId}/attachments/${attachmentId}/download`, filename);
}
