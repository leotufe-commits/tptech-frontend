// tptech-frontend/src/pages/Roles.tsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  createRole,
  deleteRole,
  listRoles,
  renameRole,
  updateRolePermissions,
  type RoleLite,
} from "../services/roles";
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
export default function RolesPage() {
  const { permissions } = useAuth();

  const canView =
    permissions.includes("USERS_ROLES:VIEW") || permissions.includes("USERS_ROLES:ADMIN");
  const canAdmin = permissions.includes("USERS_ROLES:ADMIN");

  const [roles, setRoles] = useState<RoleLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // rename modal
  const [editOpen, setEditOpen] = useState(false);
  const [target, setTarget] = useState<RoleLite | null>(null);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // permissions modal
  const [permOpen, setPermOpen] = useState(false);
  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await listRoles();
      setRoles(Array.isArray(data) ? data : (data as any)?.roles ?? []);
    } catch (e: any) {
      setErr(String(e?.message || "Error cargando roles"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function ensurePermissionsCatalog() {
    if (allPerms.length > 0) return allPerms;

    setPermsLoading(true);
    try {
      // ✅ Normalizamos el shape:
      // - Permission[]
      // - { permissions: Permission[] }
      const resp: unknown = await fetchPermissions();
      const anyResp = resp as any;

      const list: Permission[] = Array.isArray(anyResp)
        ? anyResp
        : (anyResp?.permissions ?? []);

      setAllPerms(list);
      return list;
    } finally {
      setPermsLoading(false);
    }
  }

  /* =========================
     CREATE
  ========================= */
  async function onCreate() {
    if (!canAdmin) return;

    const name = newName.trim();
    if (!name) {
      setErr("Escribí el nombre del rol.");
      return;
    }

    setCreating(true);
    setErr(null);
    try {
      await createRole(name);
      setNewName("");
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Error creando rol"));
    } finally {
      setCreating(false);
    }
  }

  /* =========================
     RENAME
  ========================= */
  function openRenameModal(r: RoleLite) {
    setErr(null);
    setTarget(r);
    setEditName(r.name);
    setEditOpen(true);
  }

  async function onRename() {
    if (!canAdmin || !target) return;

    const name = editName.trim();
    if (!name) {
      setErr("El nombre no puede estar vacío.");
      return;
    }

    setRenaming(true);
    setErr(null);
    try {
      await renameRole(target.id, name);
      setEditOpen(false);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Error renombrando rol"));
    } finally {
      setRenaming(false);
    }
  }

  /* =========================
     DELETE
  ========================= */
  async function onDelete(r: RoleLite) {
    if (!canAdmin) return;
    if (r.isSystem) return;

    const ok = window.confirm(`¿Eliminar el rol "${r.name}"?`);
    if (!ok) return;

    setErr(null);
    try {
      await deleteRole(r.id);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Error eliminando rol"));
    }
  }

  /* =========================
     PERMISSIONS
  ========================= */
  async function openPermissionsModal(r: RoleLite) {
    if (!canAdmin) return;

    setErr(null);
    setTarget(r);
    setPermOpen(true);
    setSelectedPermIds([]);
    await ensurePermissionsCatalog();

    /**
     * ⚠️ IMPORTANTE:
     * Hoy tu UI no puede pre-marcar permisos del rol porque el backend
     * no los devuelve en un endpoint de detalle.
     * Para soportarlo, necesitás:
     *
     *   GET /roles/:id  -> { role: { id, name, permissionIds: string[] } }
     *
     * Y acá:
     *   const detail = await fetchRole(r.id)
     *   setSelectedPermIds(detail.role.permissionIds)
     */
  }

  async function savePermissions() {
    if (!target) return;

    setSavingPerms(true);
    setErr(null);
    try {
      await updateRolePermissions(target.id, selectedPermIds);
      setPermOpen(false);
    } catch (e: any) {
      setErr(String(e?.message || "Error guardando permisos"));
    } finally {
      setSavingPerms(false);
    }
  }

  if (!canView) {
    return <div className="p-6">Sin permisos para ver roles.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="text-sm text-muted">Gestión de roles y permisos.</p>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      {canAdmin && (
        <div className="tp-card p-4 flex flex-col md:flex-row gap-2">
          <input
            className="tp-input flex-1"
            placeholder="Nuevo rol"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="tp-btn-primary md:w-40" onClick={onCreate} disabled={creating}>
            {creating ? "Creando…" : "Crear"}
          </button>
        </div>
      )}

      <div className="tp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4" colSpan={3}>
                  Cargando…
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted" colSpan={3}>
                  No hay roles.
                </td>
              </tr>
            ) : (
              roles.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3">
                    <Badge>{r.isSystem ? "Sistema" : "Custom"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {canAdmin && (
                      <>
                        <button className="tp-btn" onClick={() => openPermissionsModal(r)} type="button">
                          Permisos
                        </button>

                        <button className="tp-btn" onClick={() => openRenameModal(r)} type="button">
                          Renombrar
                        </button>

                        {!r.isSystem && (
                          <button className="tp-btn" onClick={() => onDelete(r)} type="button">
                            Eliminar
                          </button>
                        )}
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
          MODAL RENAME
      ========================= */}
      <Modal open={editOpen} title={`Renombrar rol`} onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Nombre</label>
            <input className="tp-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button className="tp-btn-secondary" onClick={() => setEditOpen(false)} type="button">
              Cancelar
            </button>
            <button className="tp-btn-primary" onClick={onRename} disabled={renaming} type="button">
              {renaming ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* =========================
          MODAL PERMISSIONS
      ========================= */}
      <Modal open={permOpen} title={`Permisos de ${target?.name ?? ""}`} onClose={() => setPermOpen(false)}>
        {permsLoading ? (
          <div>Cargando permisos…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-auto tp-scroll">
              {allPerms.map((p) => {
                const checked = selectedPermIds.includes(p.id);
                return (
                  <label key={p.id} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedPermIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                        )
                      }
                    />
                    {p.module}:{p.action}
                  </label>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button className="tp-btn-secondary" onClick={() => setPermOpen(false)} type="button">
                Cancelar
              </button>
              <button className="tp-btn-primary" disabled={savingPerms} onClick={savePermissions} type="button">
                {savingPerms ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
