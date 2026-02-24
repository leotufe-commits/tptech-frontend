// tptech-frontend/src/hooks/usersPage/usersPage.events.ts
import { PIN_EVENT, USER_AVATAR_EVENT } from "./usersPage.constants";

export function emitUserAvatarChanged(args: { userId: string; avatarUrl: string | null | undefined }) {
  try {
    window.dispatchEvent(
      new CustomEvent(USER_AVATAR_EVENT, {
        detail: {
          userId: String(args.userId || ""),
          avatarUrl: args.avatarUrl ?? "",
        },
      })
    );
  } catch {}
}

export function emitPinEvent(userId: string, patch: { hasQuickPin?: boolean; pinEnabled?: boolean }) {
  const id = String(userId || "").trim();
  if (!id) return;

  const hasQuickPin = typeof patch?.hasQuickPin === "boolean" ? patch.hasQuickPin : undefined;
  const pinEnabled = typeof patch?.pinEnabled === "boolean" ? patch.pinEnabled : undefined;

  if (hasQuickPin === undefined && pinEnabled === undefined) return;

  try {
    window.dispatchEvent(
      new CustomEvent(PIN_EVENT, {
        detail: {
          userId: id,
          ...(hasQuickPin !== undefined ? { hasQuickPin } : {}),
          ...(pinEnabled !== undefined ? { pinEnabled } : {}),
        },
      })
    );
  } catch {}
}