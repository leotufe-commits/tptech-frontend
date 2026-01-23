import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchUser, removeUserOverride, setUserOverride } from "../services/users";
import { fetchPermissions } from "../services/permissions";

/* =========================
   Types
========================= */
type Permission = {
  id: string;
  module: string;
  action: string;
};

type OverrideEffect = "ALLOW" | "DENY";

type Override = {
  permissionId: string;
  effect: OverrideEffect;
};

type UserDetail = {
  id: string;
  email: string;
  name?: string | null;
  status: "ACTIVE" | "BLOCKED" | string;
  permissionOverrides?: Override[];
};

type FetchUserResult = {
  user: UserDetail;
};

type FetchPermissionsResult =
  | Permission[]
  | { permissions: Permission[] }
  | { data: Permission[] }
  | unknown;

/* =========================
   Helpers
========================= */
function normalizePermissions(resp: FetchPermissionsResult): Permission[] {
  if (Array.isArray(resp)) return resp as Permission[];
  if (resp && typeof resp === "object") {
    const anyResp = resp as any;
    if (Array.isArray(anyResp.permissions)) return anyResp.permissions as Permission[];
    if (Array.isArray(anyResp.data)) return anyResp.data as Permission[];
  }
  return [];
}

function permLabel(p: Permission) {
  return `${p.module}:${p.action}`;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* =========================
   Component
========================= */
export function UserPermissionsEditor({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);

  // saving por permiso (no bloquea todo el modal)
  const [saving, setSaving] = useState<Record<string, OverrideEffect | null>>({});

  // saving global (para deshabilitar permisos especiales)
  const [specialBusy, setSpecialBusy] = useState(false);

  const permsByModule = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const arr = map.get(p.module) ?? [];
      arr.push(p);
      map.set(p.module, arr);
    }

    // orden dentro de cada módulo
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.action.localeCompare(b.action));
      map.set(k, arr);
    }

    // orden de módulos
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  const overridesMap = useMemo(() => {
    const m = new Map<string, OverrideEffect>();
    for (const ov of user?.permissionOverrides ?? []) {
      m.set(ov.permissionId, ov.effect);
    }
    return m;
  }, [user?.permissionOverrides]);

  const overridesCount = useMemo(() => (user?.permissionOverrides ?? []).length, [user]);

  // ✅ “Permisos especiales habilitados” = hay al menos 1 override
  const specialEnabled = overridesCount > 0;

  const getOverrideEffect = useCallback(
    (permissionId: string): OverrideEffect | null => overridesMap.get(permissionId) ?? null,
    [overridesMap]
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // paralelo (más rápido)
        const [uRes, pRes] = await Promise.all([
          fetchUser(userId) as Promise<FetchUserResult>,
          fetchPermissions() as Promise<FetchPermissionsResult>,
        ]);

        if (!alive) return;

        setUser(uRes.user);
        setPermissions(normalizePermissions(pRes));
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Error al cargar permisos del usuario.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const setSavingFor = useCallback((permissionId: string, effect: OverrideEffect | null) => {
    setSaving((prev) => ({ ...prev, [permissionId]: effect }));
  }, []);

  const applyLocalOverride = useCallback((permissionId: string, effect: OverrideEffect | null) => {
    setUser((prev) => {
      if (!prev) return prev;

      const current = prev.permissionOverrides ?? [];
      const filtered = current.filter((o) => o.permissionId !== permissionId);

      const nextOverrides =
        effect === null ? filtered : [...filtered, { permissionId, effect } as Override];

      return { ...prev, permissionOverrides: nextOverrides };
    });
  }, []);

  const toggleOverride = useCallback(
    async (permissionId: string, effect: OverrideEffect) => {
      if (!user) return;

      const current = getOverrideEffect(permissionId); // ALLOW | DENY | null
      const willClear = current === effect;

      // optimistic UI
      setSavingFor(permissionId, effect);
      applyLocalOverride(permissionId, willClear ? null : effect);

      try {
        if (willClear) {
          await removeUserOverride(user.id, permissionId);
        } else {
          await setUserOverride(user.id, permissionId, effect);
        }
      } catch (e: any) {
        // rollback si falla
        applyLocalOverride(permissionId, current);
        setError(e?.message ?? "No se pudo guardar el override. Intentá de nuevo.");
      } finally {
        setSavingFor(permissionId, null);
      }
    },
    [user, getOverrideEffect, setSavingFor, applyLocalOverride]
  );

  // ✅ Deshabilitar permisos especiales = borrar todos los overrides
  const disableSpecialPermissions = useCallback(async () => {
    if (!user) return;
    if ((user.permissionOverrides ?? []).length === 0) return;
    if (specialBusy) return;

    const ok = window.confirm(
      "Esto va a borrar TODOS los permisos especiales (overrides) de este usuario. ¿Continuar?"
    );
    if (!ok) return;

    setError(null);
    setSpecialBusy(true);

    const prevOverrides = user.permissionOverrides ?? [];

    // optimistic: limpiar local
    setUser((prev) => (prev ? { ...prev, permissionOverrides: [] } : prev));

    try {
      // borrar uno por uno (paralelo) usando lo que ya tenés
      await Promise.all(prevOverrides.map((o) => removeUserOverride(user.id, o.permissionId)));
    } catch (e: any) {
      // rollback
      setUser((prev) => (prev ? { ...prev, permissionOverrides: prevOverrides } : prev));
      setError(e?.message ?? "No se pudo deshabilitar. Intentá de nuevo.");
    } finally {
      setSpecialBusy(false);
    }
  }, [user, specialBusy]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-surface text-text shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-semibold">Permisos por usuario</h2>
            <div className="mt-1 truncate text-sm text-text/70">
              {user ? (
                <>
                  {user.email}
                  {user.name ? ` — ${user.name}` : ""}{" "}
                  <span className="text-text/60">({user.status})</span>
                </>
              ) : (
                "—"
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm hover:bg-bg"
          >
            Cerrar
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[80vh] overflow-auto p-4">
          {loading && <div className="text-sm text-text/70">Cargando…</div>}

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && user && (
            <div className="space-y-4">
              {/* ✅ Píldora Permisos Especiales (reemplaza checkbox) */}
              <div className="rounded-xl border border-border bg-bg/40 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold">Permisos especiales</div>
                    <div className="text-xs text-text/60">
                      Los permisos especiales son overrides (ALLOW / DENY) a nivel usuario.
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Deshabilitados */}
                    <button
                      type="button"
                      disabled={specialBusy || !specialEnabled}
                      onClick={() => void disableSpecialPermissions()}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm font-semibold transition",
                        specialEnabled
                          ? "border-rose-300/60 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "border-border bg-surface text-text/50",
                        (specialBusy || !specialEnabled) && "opacity-70 cursor-not-allowed"
                      )}
                      title="Deshabilitar (borra overrides)"
                    >
                      Permisos especiales deshabilitados
                    </button>

                    {/* Habilitados (solo indicador) */}
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm font-semibold",
                        specialEnabled
                          ? "border-emerald-300/60 bg-emerald-50 text-emerald-700"
                          : "border-border bg-surface text-text/50"
                      )}
                      title={
                        specialEnabled
                          ? `Habilitados (${overridesCount} override/s)`
                          : "Deshabilitados (0 overrides)"
                      }
                    >
                      Permisos especiales habilitados
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-text/60">
                  Estado actual:{" "}
                  <b>{specialEnabled ? `Habilitados (${overridesCount})` : "Deshabilitados"}</b>
                </div>
              </div>

              {/* Lista de permisos */}
              <div className="grid gap-3">
                {permsByModule.map(([module, perms]) => (
                  <section key={module} className="rounded-xl border border-border bg-bg/40 p-3">
                    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="font-semibold">{module}</div>
                      <div className="text-xs text-text/60">
                        Click en <b>ALLOW</b> o <b>DENY</b> para setear override. Repetir click lo borra.
                      </div>
                    </div>

                    <div className="divide-y divide-border">
                      {perms.map((p) => {
                        const current = getOverrideEffect(p.id);
                        const rowSaving = saving[p.id] ?? null;

                        const allowActive = current === "ALLOW";
                        const denyActive = current === "DENY";

                        const allowBusy = rowSaving === "ALLOW";
                        const denyBusy = rowSaving === "DENY";
                        const disabled = rowSaving !== null || specialBusy;

                        return (
                          <div key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                            <div className="min-w-[240px] font-mono text-xs text-text/80">
                              {permLabel(p)}
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleOverride(p.id, "ALLOW")}
                              disabled={disabled}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-sm",
                                allowActive
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-border bg-surface hover:bg-bg",
                                allowBusy && "opacity-70",
                                disabled && "cursor-not-allowed opacity-70"
                              )}
                              title="Forzar permitir (override)"
                            >
                              {allowBusy ? "Guardando…" : "ALLOW"}
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleOverride(p.id, "DENY")}
                              disabled={disabled}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-sm",
                                denyActive
                                  ? "border-rose-300 bg-rose-50 text-rose-700"
                                  : "border-border bg-surface hover:bg-bg",
                                denyBusy && "opacity-70",
                                disabled && "cursor-not-allowed opacity-70"
                              )}
                              title="Forzar denegar (override)"
                            >
                              {denyBusy ? "Guardando…" : "DENY"}
                            </button>

                            <div className="ml-auto text-xs text-text/60">
                              {current ? (
                                <span>
                                  Override: <b>{current}</b>
                                </span>
                              ) : (
                                <span>Sin override</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm hover:bg-bg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
