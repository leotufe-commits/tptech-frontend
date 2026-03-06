// tptech-frontend/src/context/auth.events.ts
// Constantes y funciones para los eventos globales de autenticación (CustomEvents en window).

/* =========================
   LOGO DE JOYERÍA
========================= */
export const JEWELRY_LOGO_EVENT = "tptech:jewelry_logo_changed";

export function readLogoFromEvent(ev: Event): string {
  const anyEv = ev as any;
  const d = anyEv?.detail ?? {};
  return String(d?.logoUrl ?? d?.url ?? "").trim();
}

/* =========================
   AVATAR DE USUARIO
========================= */
export const USER_AVATAR_EVENT = "tptech:user_avatar_changed";

export function readAvatarFromEvent(ev: Event): { userId: string; avatarUrl: string; updatedAt?: string } {
  const anyEv = ev as any;
  const d = anyEv?.detail ?? {};
  const userId = String(d?.userId ?? d?.id ?? "").trim();
  const avatarUrl = String(d?.avatarUrl ?? d?.url ?? "").trim();
  const updatedAtRaw = String(d?.avatarUpdatedAt ?? d?.updatedAt ?? "").trim();
  return { userId, avatarUrl, updatedAt: updatedAtRaw || undefined };
}

/* =========================
   QUICK SWITCH (abrir UI)
========================= */
export const QUICK_SWITCH_OPEN_EVENT = "tptech:open_quick_switch";

export function emitOpenQuickSwitch() {
  try {
    window.dispatchEvent(new CustomEvent(QUICK_SWITCH_OPEN_EVENT));
  } catch {
    // ignore
  }
}

/* =========================
   FLUJO PIN EN USUARIOS
   (para abrir modal de config PIN desde LockScreen)
========================= */
export const OPEN_PIN_FLOW_EVENT = "tptech:open-pin-flow";

export function emitOpenPinFlow(userId: string) {
  try {
    window.dispatchEvent(
      new CustomEvent(OPEN_PIN_FLOW_EVENT, { detail: { userId: String(userId || "") } })
    );
  } catch {
    // ignore
  }
}

/* =========================
   PIN ACTUALIZADO
   (sync estado del user en AuthContext)
========================= */
export const PIN_EVENT = "tptech:user-pin-updated";

export function readPinEvent(ev: Event): { userId: string; hasQuickPin?: boolean; pinEnabled?: boolean } {
  const anyEv = ev as any;
  const d = anyEv?.detail ?? {};
  const userId = String(d?.userId ?? d?.id ?? "").trim();
  const hasQuickPin = typeof d?.hasQuickPin === "boolean" ? (d.hasQuickPin as boolean) : undefined;
  const pinEnabled = typeof d?.pinEnabled === "boolean" ? (d.pinEnabled as boolean) : undefined;
  return { userId, hasQuickPin, pinEnabled };
}
