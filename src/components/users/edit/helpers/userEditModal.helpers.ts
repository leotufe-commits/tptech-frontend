// tptech-frontend/src/components/users/edit/helpers/userEditModal.helpers.ts

import type { TabKey } from "../../users.ui";

/* =========================
   AUTO PIN FLAG (legacy)
========================= */
export const AUTO_PIN_KEY = "tptech_users_autopin_v1";

export function shouldHidePinMsg(msg?: string | null) {
  const m = String(msg || "").toLowerCase();
  if (!m) return true;
  return m.includes("sesión expirada") || m.includes("sesion expirada");
}

export function safeReadAutoPin(): { userId?: string; jewelryId?: string } | null {
  try {
    const raw = sessionStorage.getItem(AUTO_PIN_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object") return null;
    return {
      userId: j.userId ? String(j.userId) : undefined,
      jewelryId: j.jewelryId ? String(j.jewelryId) : undefined,
    };
  } catch {
    return null;
  }
}

export function safeClearAutoPin() {
  try {
    sessionStorage.removeItem(AUTO_PIN_KEY);
  } catch {
    // ignore
  }
}

export function draftKeyOfFile(f: File) {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

export function parseTabParam(v: string | null): TabKey | null {
  const s = String(v || "").trim().toUpperCase();
  if (s === "DATA") return "DATA";
  if (s === "CONFIG") return "CONFIG";
  return null;
}
