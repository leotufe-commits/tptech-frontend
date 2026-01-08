// tptech-frontend/src/components/UserEditModal.tsx
import { useEffect, useMemo, useState } from "react";
import {
  assignRolesToUser,
  fetchUser,
  removeUserOverride,
  setUserOverride,
  updateUserAvatar,
  type Role,
  type UserDetail,
} from "../services/users";
import { fetchRoles } from "../services/roles";
import { fetchPermissions } from "../services/permissions";
import { RequirePermission } from "./RequirePermission";

/* =======================
   TYPES (locales del modal)
======================= */
type Permission = { id: string; module: string; action: string };

type Props = {
  userId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void; // refrescar tabla
};

type PermissionsResponse = { permissions: Permission[] };

function permLabel(p: Permission) {
  return `${p.module}:${p.action}`;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function isPermissionsResponse(x: unknown): x is PermissionsResponse {
  return typeof x === "object" && x !== null && Array.isArray((x as any).permissions);
}

/* =======================
   COMPONENT
======================= */
export default function UserEditModal({ userId, open, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [user, setUser] = useState<UserDetail | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Avatar UI
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const permsByModule = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const arr = map.get(p.module) ?? [];
      arr.push(p);
      map.set(p.module, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.action.localeCompare(b.action));
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  useEffect(() => {
    if (!open || !userId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [uRes, rRes, pRes] = await Promise.all([
          fetchUser(userId),
          fetchRoles(),
          fetchPermissions(),
        ]);

        if (cancelled) return;

        setUser(uRes.user);
        setAvatarPreview(uRes.user.avatarUrl ?? null);

        setRoles(Array.isArray(rRes) ? (rRes as Role[]) : []);
        setPermissions(isPermissionsResponse(pRes) ? pRes.permissions : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open || !userId) return null;

  if (loading || !user) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
        <div className="rounded-xl bg-card p-6 shadow-xl">Cargando usuario…</div>
      </div>
    );
  }

  // ✅ TS NARROW: de acá para abajo "u" es NO-null siempre
  const u = user;

  function getOverride(permissionId: string) {
    return u.permissionOverrides?.find((o) => o.permissionId === permissionId) ?? null;
  }

  async function toggleRole(roleId: string) {
    const key = `role:${roleId}`;
    setBusyKey(key);

    try {
      const currentIds = (u.roles ?? []).map((r) => r.id);
      const nextIds = currentIds.includes(roleId)
        ? currentIds.filter((id) => id !== roleId)
        : [...currentIds, roleId];

      await assignRolesToUser(u.id, nextIds);

      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          roles: roles.filter((r) => nextIds.includes(r.id)),
        };
      });

      onUpdated?.();
    } finally {
      setBusyKey(null);
    }
  }

  async function setOrClearOverride(permissionId: string, effect: "ALLOW" | "DENY") {
    const key = `ov:${permissionId}:${effect}`;
    setBusyKey(key);

    try {
      const existing = getOverride(permissionId);

      if (existing && existing.effect === effect) {
        await removeUserOverride(u.id, permissionId);

        setUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            permissionOverrides: (prev.permissionOverrides ?? []).filter(
              (o) => o.permissionId !== permissionId
            ),
          };
        });

        onUpdated?.();
        return;
      }

      await setUserOverride(u.id, permissionId, effect);

      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          permissionOverrides: [
            ...(prev.permissionOverrides ?? []).filter((o) => o.permissionId !== permissionId),
            { permissionId, effect },
          ],
        };
      });

      onUpdated?.();
    } finally {
      setBusyKey(null);
    }
  }

  async function onPickAvatar(file: File) {
    const key = "avatar:save";
    setBusyKey(key);

    try {
      const dataUrl = await fileToDataUrl(file);
      setAvatarPreview(dataUrl);

      await updateUserAvatar(u.id, dataUrl);

      setUser((prev) => (prev ? { ...prev, avatarUrl: dataUrl } : prev));
      onUpdated?.();
    } finally {
      setBusyKey(null);
    }
  }

  async function onRemoveAvatar() {
    const key = "avatar:remove";
    setBusyKey(key);

    try {
      setAvatarPreview(null);

      await updateUserAvatar(u.id, null);

      setUser((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      onUpdated?.();
    } finally {
      setBusyKey(null);
    }
  }

  const isSavingAvatar = busyKey === "avatar:save" || busyKey === "avatar:remove";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute left-1/2 top-1/2 w-[min(980px,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="text-sm text-muted">Editar usuario</div>
            <div className="truncate text-lg font-semibold text-text">{u.email}</div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-text hover:bg-surface2"
          >
            Cerrar
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          {/* Columna izquierda */}
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold text-text">Datos</div>

              <div className="mt-2 space-y-1 text-sm">
                <div className="text-muted">
                  <span className="font-semibold text-text">Email:</span> {u.email}
                </div>
                <div className="text-muted">
                  <span className="font-semibold text-text">Nombre:</span> {u.name || "—"}
                </div>
                <div className="text-muted">
                  <span className="font-semibold text-text">Estado:</span> {u.status}
                </div>
              </div>

              {/* FOTO */}
              <div className="mt-4 rounded-xl border border-border bg-bg p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-text">Foto</div>
                  {isSavingAvatar ? <div className="text-xs text-muted">Guardando…</div> : null}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-full border border-border bg-card">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-muted">—</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label
                      className={cn(
                        "cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-text hover:bg-surface2",
                        isSavingAvatar && "pointer-events-none opacity-60"
                      )}
                    >
                      Cambiar foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) onPickAvatar(f);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={onRemoveAvatar}
                      disabled={isSavingAvatar || !avatarPreview}
                      className={cn(
                        "rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-muted hover:bg-surface2",
                        (isSavingAvatar || !avatarPreview) && "opacity-60"
                      )}
                    >
                      Quitar
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted">
                  Nota: por ahora se guarda como DataURL (MVP). Luego lo migramos a storage.
                </div>
              </div>
            </div>

            {/* ROLES */}
            <RequirePermission permission="USERS_ROLES:ADMIN">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-sm font-semibold text-text">Roles</div>

                <div className="mt-3 grid gap-2">
                  {roles.map((r) => {
                    const checked = (u.roles ?? []).some((ur) => ur.id === r.id);
                    const isBusy = busyKey === `role:${r.id}`;

                    return (
                      <label
                        key={r.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2",
                          checked && "bg-surface2"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-text">{r.name}</div>
                          <div className="text-xs text-muted">{r.isSystem ? "Sistema" : "Custom"}</div>
                        </div>

                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isBusy}
                          onChange={() => toggleRole(r.id)}
                          className="h-5 w-5 accent-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </RequirePermission>
          </div>

          {/* Columna derecha */}
          <RequirePermission permission="USERS_ROLES:ADMIN">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-text">Overrides (ALLOW / DENY)</div>
                <div className="text-xs text-muted">DENY gana siempre</div>
              </div>

              <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-2">
                {permsByModule.map(([module, perms]) => (
                  <div key={module} className="rounded-xl border border-border bg-bg p-3">
                    <div className="text-sm font-semibold text-text">{module}</div>

                    <div className="mt-2 space-y-2">
                      {perms.map((p) => {
                        const ov = getOverride(p.id);
                        const busyAllow = busyKey === `ov:${p.id}:ALLOW`;
                        const busyDeny = busyKey === `ov:${p.id}:DENY`;

                        return (
                          <div
                            key={p.id}
                            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-text">{permLabel(p)}</div>
                              <div className="text-xs text-muted">
                                Estado: {ov ? <span className="font-semibold text-text">{ov.effect}</span> : "sin override"}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busyAllow || busyDeny}
                                onClick={() => setOrClearOverride(p.id, "ALLOW")}
                                className={cn(
                                  "rounded-md border px-3 py-1.5 text-xs font-semibold",
                                  ov?.effect === "ALLOW"
                                    ? "border-primary bg-primary text-white"
                                    : "border-border bg-bg text-text hover:bg-surface2"
                                )}
                              >
                                ALLOW
                              </button>

                              <button
                                type="button"
                                disabled={busyAllow || busyDeny}
                                onClick={() => setOrClearOverride(p.id, "DENY")}
                                className={cn(
                                  "rounded-md border px-3 py-1.5 text-xs font-semibold",
                                  ov?.effect === "DENY"
                                    ? "border-primary bg-primary text-white"
                                    : "border-border bg-bg text-text hover:bg-surface2"
                                )}
                              >
                                DENY
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-xs text-muted">
                Tip: usá overrides para excepciones puntuales. Para permisos “por defecto”, siempre es mejor el rol.
              </div>
            </div>
          </RequirePermission>
        </div>
      </div>
    </div>
  );
}
