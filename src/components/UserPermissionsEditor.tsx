import { useEffect, useMemo, useState } from "react";
import { fetchUser, setUserOverride, removeUserOverride } from "../services/users";
import { fetchPermissions } from "../services/permissions";

type Permission = {
  id: string;
  module: string;
  action: string;
};

type Override = {
  permissionId: string;
  effect: "ALLOW" | "DENY";
};

type UserDetail = {
  id: string;
  email: string;
  name?: string | null;
  status: "ACTIVE" | "BLOCKED" | string;
  permissionOverrides?: Override[];
};

function permLabel(p: Permission) {
  return `${p.module}:${p.action}`;
}

export function UserPermissionsEditor({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [uRes, pRes] = await Promise.all([fetchUser(userId), fetchPermissions()]);

        if (!alive) return;

        setUser(uRes.user);

        // ✅ soporta ambos formatos:
        // - Permission[]
        // - { permissions: Permission[] }
        const perms = Array.isArray(pRes) ? pRes : (pRes?.permissions ?? []);
        setPermissions(perms);
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

  function getOverride(permissionId: string) {
    return user?.permissionOverrides?.find((o) => o.permissionId === permissionId) ?? null;
  }

  async function setOrClearOverride(permissionId: string, effect: "ALLOW" | "DENY") {
    if (!user) return;

    const key = `${permissionId}:${effect}`;
    setSavingKey(key);

    try {
      const existing = getOverride(permissionId);

      // click al mismo effect => borrar
      if (existing && existing.effect === effect) {
        await removeUserOverride(user.id, permissionId);

        const nextOverrides = (user.permissionOverrides ?? []).filter(
          (o) => o.permissionId !== permissionId
        );

        setUser({ ...user, permissionOverrides: nextOverrides });
        return;
      }

      // set / update
      await setUserOverride(user.id, permissionId, effect);

      const nextOverrides: Override[] = [
        ...(user.permissionOverrides ?? []).filter((o) => o.permissionId !== permissionId),
        { permissionId, effect },
      ];

      setUser({ ...user, permissionOverrides: nextOverrides });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        // click afuera cierra
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          maxHeight: "85vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Permisos por usuario</h2>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              {user ? (
                <>
                  {user.email} {user.name ? `— ${user.name}` : ""} ({user.status})
                </>
              ) : (
                "—"
              )}
            </div>
          </div>

          <button type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <hr style={{ margin: "12px 0" }} />

        {loading && <div>Cargando…</div>}
        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}

        {!loading && user && (
          <div style={{ display: "grid", gap: 10 }}>
            {permsByModule.map(([module, perms]) => (
              <div
                key={module}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{module}</div>

                {perms.map((p) => {
                  const ov = getOverride(p.id);
                  const allowActive = ov?.effect === "ALLOW";
                  const denyActive = ov?.effect === "DENY";

                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "6px 0",
                        borderTop: "1px dashed #eee",
                      }}
                    >
                      <div style={{ minWidth: 220, fontFamily: "monospace" }}>
                        {permLabel(p)}
                      </div>

                      <button
                        type="button"
                        onClick={() => setOrClearOverride(p.id, "ALLOW")}
                        disabled={savingKey !== null}
                        style={{
                          fontWeight: allowActive ? "bold" : "normal",
                          opacity: savingKey && savingKey !== `${p.id}:ALLOW` ? 0.6 : 1,
                        }}
                      >
                        ALLOW
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrClearOverride(p.id, "DENY")}
                        disabled={savingKey !== null}
                        style={{
                          fontWeight: denyActive ? "bold" : "normal",
                          opacity: savingKey && savingKey !== `${p.id}:DENY` ? 0.6 : 1,
                        }}
                      >
                        DENY
                      </button>

                      <div style={{ marginLeft: "auto", opacity: 0.75 }}>
                        {ov ? <em>override: {ov.effect}</em> : <span>sin override</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
