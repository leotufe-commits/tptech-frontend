// tptech-frontend/src/pages/Users.tsx
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import {
  assignRolesToUser,
  createUser,
  fetchUser,
  fetchUsers,
  removeUserOverride,
  setUserOverride,
  updateUserStatus,
  type Role,
  type UserListItem,
  type Override,
} from "../services/users";
import { fetchRoles } from "../services/roles";
import { fetchPermissions, type Permission } from "../services/permissions";

/* =========================
   UI helpers
========================= */
function Badge({ children }: { children: any }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: any;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="tp-btn" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/* =========================
   PAGE
========================= */
export default function UsersPage() {
  const { user: me, permissions } = useAuth();

  const canView = permissions.includes("USERS_ROLES:VIEW") || permissions.includes("USERS_ROLES:ADMIN");
  const canEditStatus = permissions.includes("USERS_ROLES:EDIT") || permissions.includes("USERS_ROLES:ADMIN");
  const canAdmin = permissions.includes("USERS_ROLES:ADMIN");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [q, setQ] = useState("");

  // Roles modal
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [target, setTarget] = useState<UserListItem | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // Overrides modal
  const [ovModalOpen, setOvModalOpen] = useState(false);
  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [ovLoading, setOvLoading] = useState(false);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [permPick, setPermPick] = useState<string>("");
  const [effectPick, setEffectPick] = useState<"ALLOW" | "DENY">("ALLOW");
  const [savingOv, setSavingOv] = useState(false);

  // Create user modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cEmail, setCEmail] = useState("");
  const [cName, setCName] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cRoleIds, setCRoleIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data.users ?? []);
    } catch (e: any) {
      setErr(String(e?.message || "Error cargando usuarios"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const rolesStr = (u.roles || []).map((r) => r.name).join(" ").toLowerCase();
      return (
        (u.email || "").toLowerCase().includes(s) ||
        (u.name || "").toLowerCase().includes(s) ||
        rolesStr.includes(s)
      );
    });
  }, [users, q]);

  async function ensureRolesLoaded() {
    if (roles.length > 0) return;
    setRolesLoading(true);
    try {
      const resp = await fetchRoles();
      const list = Array.isArray(resp) ? resp : (resp.roles ?? []);
      setRoles(list);
    } catch (e: any) {
      setErr(String(e?.message || "Error cargando roles"));
    } finally {
      setRolesLoading(false);
    }
  }

  /* =========================
     CREATE USER
  ========================= */
  async function openCreateModal() {
    if (!canAdmin) return;

    setErr(null);
    setCEmail("");
    setCName("");
    setCPassword("");
    setCRoleIds([]);
    setCreateOpen(true);

    await ensureRolesLoaded();
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!canAdmin) return;

    const email = cEmail.trim();
    if (!email) {
      setErr("Completá el email.");
      return;
    }

    setCreating(true);
    setErr(null);

    try {
      await createUser({
        email,
        name: cName.trim() || null,
        password: cPassword.trim() || undefined, // opcional
        roleIds: cRoleIds,
      });

      setCreateOpen(false);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Error creando usuario"));
    } finally {
      setCreating(false);
    }
  }

  /* =========================
     ROLES
  ========================= */
  async function openRolesModal(u: UserListItem) {
    setTarget(u);
    setSelectedRoleIds((u.roles || []).map((r) => r.id));
    setRolesModalOpen(true);

    await ensureRolesLoaded();
  }

  async function saveRoles() {
    if (!target) return;
    setSavingRoles(true);
    try {
      await assignRolesToUser(target.id, selectedRoleIds);
      setRolesModalOpen(false);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Error guardando roles"));
    } finally {
      setSavingRoles(false);
    }
  }

  /* =========================
     STATUS
  ========================= */
  async function toggleStatus(u: UserListItem) {
    if (!canEditStatus) return;

    if (me?.id && u.id === me.id) {
      setErr("No podés cambiar tu propio estado.");
      return;
    }

    const next = u.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    try {
      await updateUserStatus(u.id, next);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Error actualizando estado"));
    }
  }

  /* =========================
     OVERRIDES (ALLOW/DENY)
  ========================= */
  async function openOverridesModal(u: UserListItem) {
    if (!canAdmin) return;

    setTarget(u);
    setOvModalOpen(true);
    setErr(null);
    setOvLoading(true);

    try {
      // ✅ 1) catálogo de permisos (robusto: usa lista local para preselección)
      let permsList = allPerms;

      if (permsList.length === 0) {
        const p = await fetchPermissions();
        permsList = Array.isArray(p) ? p : (p.permissions ?? []);
        setAllPerms(permsList);
      }

      // 2) overrides del usuario
      const detail = await fetchUser(u.id);
      setOverrides(detail.user.permissionOverrides ?? []);

      // ✅ preselección usando la lista real (no el state aún no actualizado)
      setPermPick(permsList[0]?.id || "");
      setEffectPick("ALLOW");
    } catch (e: any) {
      setErr(String(e?.message || "Error cargando overrides"));
    } finally {
      setOvLoading(false);
    }
  }

  function labelPerm(id: string) {
    const p = allPerms.find((x) => x.id === id);
    return p ? `${p.module}:${p.action}` : id;
  }

  async function addOrUpdateOverride() {
    if (!target || !permPick) return;
    setSavingOv(true);
    try {
      await setUserOverride(target.id, permPick, effectPick);
      const detail = await fetchUser(target.id);
      setOverrides(detail.user.permissionOverrides ?? []);
    } catch (e: any) {
      setErr(String(e?.message || "Error guardando override"));
    } finally {
      setSavingOv(false);
    }
  }

  async function removeOv(permissionId: string) {
    if (!target) return;
    setSavingOv(true);
    try {
      await removeUserOverride(target.id, permissionId);
      const detail = await fetchUser(target.id);
      setOverrides(detail.user.permissionOverrides ?? []);
    } catch (e: any) {
      setErr(String(e?.message || "Error eliminando override"));
    } finally {
      setSavingOv(false);
    }
  }

  if (!canView) return <div className="p-6">Sin permisos para ver usuarios.</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted">Gestión de usuarios, roles y overrides (ALLOW/DENY).</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="tp-input max-w-sm"
            placeholder="Buscar por email / nombre / rol…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {canAdmin && (
            <button className="tp-btn-primary" onClick={openCreateModal} type="button">
              Nuevo usuario
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      <div className="tp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Roles</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4" colSpan={4}>
                  Cargando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-4" colSpan={4}>
                  Sin resultados.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{u.name || "Sin nombre"}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>

                  <td className="px-4 py-3">
                    <Badge>{u.status}</Badge>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {(u.roles || []).length ? (
                        (u.roles || []).map((r) => (
                          <Badge key={r.id}>
                            {r.name}
                            {r.isSystem ? " • sys" : ""}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted">Sin roles</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right space-x-2">
                    {canEditStatus && (
                      <button className="tp-btn" onClick={() => toggleStatus(u)} type="button">
                        {u.status === "ACTIVE" ? "Bloquear" : "Activar"}
                      </button>
                    )}

                    {canAdmin && (
                      <>
                        <button className="tp-btn" onClick={() => openRolesModal(u)} type="button">
                          Roles
                        </button>
                        <button className="tp-btn" onClick={() => openOverridesModal(u)} type="button">
                          Overrides
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* =========================
          MODAL CREATE USER
      ========================= */}
      <Modal open={createOpen} title="Crear usuario" onClose={() => setCreateOpen(false)}>
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Email</label>
              <input className="tp-input" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Nombre (opcional)</label>
              <input className="tp-input" value={cName} onChange={(e) => setCName(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Contraseña (opcional)</label>
              <input
                className="tp-input"
                type="password"
                value={cPassword}
                onChange={(e) => setCPassword(e.target.value)}
                placeholder="Si la dejás vacía, queda PENDING"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Roles iniciales</label>
              <div className="tp-card p-3 max-h-[180px] overflow-auto tp-scroll">
                {rolesLoading ? (
                  <div className="text-sm text-muted">Cargando roles…</div>
                ) : roles.length === 0 ? (
                  <div className="text-sm text-muted">No hay roles.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {roles.map((r) => {
                      const checked = cRoleIds.includes(r.id);
                      return (
                        <label key={r.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setCRoleIds((prev) =>
                                e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                              )
                            }
                          />
                          {r.name} {r.isSystem ? "(sys)" : ""}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-muted">
                Si no seleccionás roles, queda sin permisos hasta asignar.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="tp-btn-secondary" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="tp-btn-primary" type="submit" disabled={creating}>
              {creating ? "Creando…" : "Crear"}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================
          MODAL ROLES
      ========================= */}
      <Modal
        open={rolesModalOpen}
        title={`Roles de ${target?.email}`}
        onClose={() => setRolesModalOpen(false)}
      >
        {rolesLoading ? (
          <div>Cargando roles…</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 max-h-[55vh] overflow-auto tp-scroll">
              {roles.map((r) => {
                const checked = selectedRoleIds.includes(r.id);
                return (
                  <label key={r.id} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedRoleIds((prev) =>
                          e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                        )
                      }
                    />
                    {r.name} {r.isSystem ? "(sys)" : ""}
                  </label>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button className="tp-btn-secondary" onClick={() => setRolesModalOpen(false)} type="button">
                Cancelar
              </button>
              <button className="tp-btn-primary" onClick={saveRoles} disabled={savingRoles} type="button">
                {savingRoles ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================
          MODAL OVERRIDES
      ========================= */}
      <Modal
        open={ovModalOpen}
        title={`Overrides (ALLOW/DENY) • ${target?.email}`}
        onClose={() => setOvModalOpen(false)}
      >
        {ovLoading ? (
          <div>Cargando…</div>
        ) : (
          <div className="space-y-4">
            <div className="tp-card p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted">Permiso</label>
                  <select className="tp-input" value={permPick} onChange={(e) => setPermPick(e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {allPerms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.module}:{p.action}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted">Efecto</label>
                  <select
                    className="tp-input"
                    value={effectPick}
                    onChange={(e) => setEffectPick(e.target.value as any)}
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY">DENY</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    className="tp-btn-primary w-full"
                    onClick={addOrUpdateOverride}
                    disabled={!permPick || savingOv}
                    type="button"
                  >
                    {savingOv ? "Guardando…" : "Agregar / Actualizar"}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                * DENY pisa ALLOW y también pisa permisos heredados por roles (según tu lógica backend).
              </p>
            </div>

            <div className="tp-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left">Permiso</th>
                    <th className="px-4 py-3 text-left">Efecto</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-muted" colSpan={3}>
                        Sin overrides.
                      </td>
                    </tr>
                  ) : (
                    overrides.map((ov) => (
                      <tr key={ov.permissionId} className="border-t border-border">
                        <td className="px-4 py-3">{labelPerm(ov.permissionId)}</td>
                        <td className="px-4 py-3">
                          <Badge>{ov.effect}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="tp-btn" onClick={() => removeOv(ov.permissionId)} disabled={savingOv} type="button">
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button className="tp-btn-secondary" onClick={() => setOvModalOpen(false)} type="button">
                Listo
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
