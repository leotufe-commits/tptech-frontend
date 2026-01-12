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
            <div className="grid gap-3">
              {permsByModule.map(([module, perms]) => (
                <section
                  key={module}
                  className="rounded-xl border border-border bg-bg/40 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="font-semibold">{module}</div>
                    <div className="text-xs text-text/60">
                      Click en <b>ALLOW</b> o <b>DENY</b> para setear override. Repetir click
                      lo borra.
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
                      const disabled = rowSaving !== null;

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
                              allowBusy && "opacity-70"
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
                              denyBusy && "opacity-70"
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
