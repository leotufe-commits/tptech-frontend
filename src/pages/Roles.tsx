// tptech-frontend/src/pages/Roles.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  createRole,
  deleteRole,
  listRoles,
  renameRole,
  updateRolePermissions,
  fetchRole,
  type RoleLite,
} from "../services/roles";
import { fetchPermissions, type Permission } from "../services/permissions";

/* =========================
   Labels permisos (humanos)
========================= */
const MODULE_LABEL: Record<string, string> = {
  USERS_ROLES: "Usuarios y roles",
  INVENTORY: "Inventario",
  MOVEMENTS: "Movimientos",
  CLIENTS: "Clientes",
  SALES: "Ventas",
  SUPPLIERS: "Proveedores",
  PURCHASES: "Compras",
  CURRENCIES: "Monedas",
  COMPANY_SETTINGS: "Configuración",
  REPORTS: "Reportes",
  WAREHOUSES: "Almacenes",
  PROFILE: "Perfil",
};

const ACTION_LABEL: Record<string, string> = {
  VIEW: "Ver",
  CREATE: "Crear",
  EDIT: "Editar",
  DELETE: "Eliminar",
  EXPORT: "Exportar",
  ADMIN: "Administrar",
};

function prettyPerm(module: string, action: string) {
  return `${ACTION_LABEL[action] ?? action} ${MODULE_LABEL[module] ?? module}`;
}

/* =========================
   Labels roles (humanos)
========================= */
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  STAFF: "Vendedor",
  READONLY: "Solo lectura",
};

function prettyRole(name: string) {
  return ROLE_LABEL[name] ?? name; // roles custom quedan tal cual
}

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
      // listRoles() ya devuelve array normalizado
      const list = Array.isArray(data) ? data : (data as any)?.roles ?? [];

      // ✅ Defensivo: si por algún motivo llega duplicado, lo deduplicamos por id (solo UI)
      const uniq = new Map<string, RoleLite>();
      for (const r of list) uniq.set(r.id, r);
      setRoles(Array.from(uniq.values()));
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
      const resp: unknown = await fetchPermissions();
      const anyResp = resp as any;
      const list: Permission[] = Array.isArray(anyResp) ? anyResp : anyResp?.permissions ?? [];
      setAllPerms(list);
      return list;
    } finally {
      setPermsLoading(false);
    }
  }

  const permsByModule = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of allPerms) {
      const key = p.module;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    const entries = Array.from(map.entries()).sort((a, b) => {
      const la = MODULE_LABEL[a[0]] ?? a[0];
      const lb = MODULE_LABEL[b[0]] ?? b[0];
      return la.localeCompare(lb);
    });
    const order = ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "ADMIN"];
    for (const [, list] of entries) {
      list.sort((x, y) => order.indexOf(x.action) - order.indexOf(y.action));
    }
    return entries;
  }, [allPerms]);

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

    const ok = window.confirm(`¿Eliminar el rol "${prettyRole(r.name)}"?`);
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
  function extractPermissionIdsFromListRole(r: RoleLite): string[] {
    // ✅ Si el listRoles trae permissions [{id,module,action}] lo usamos directo
    const ids = (r.permissions ?? [])
      .map((p: any) => p?.id)
      .filter((x: any) => typeof x === "string" && x.length > 0);

    // dedupe
    return Array.from(new Set(ids));
  }

  function extractPermissionIdsFromFetchRoleResponse(detail: any): string[] {
    // ✅ tolera múltiples shapes por si apiFetch transforma la respuesta
    const role = detail?.role ?? detail;
    const idsA = role?.permissionIds;
    if (Array.isArray(idsA)) return idsA.filter((x: any) => typeof x === "string");

    const perms = role?.permissions;
    if (Array.isArray(perms)) {
      const idsB = perms.map((p: any) => p?.id).filter((x: any) => typeof x === "string");
      return Array.from(new Set(idsB));
    }

    return [];
  }

  async function openPermissionsModal(r: RoleLite) {
    if (!canAdmin) return;

    // OWNER no editable
    if (r.name === "OWNER") {
      setErr("El rol Propietario no es editable.");
      return;
    }

    setErr(null);
    setTarget(r);

    // 1) Abrimos modal y mostramos catálogo
    setPermOpen(true);
    await ensurePermissionsCatalog();

    // 2) Precarga INMEDIATA desde la lista (evita modal “todo en blanco”)
    const fromList = extractPermissionIdsFromListRole(r);
    setSelectedPermIds(fromList);

    // 3) Fallback: trae el detalle (por si lista no tenía permisos o estaban incompletos)
    try {
      const detail = await fetchRole(r.id);
      const ids = extractPermissionIdsFromFetchRoleResponse(detail);
      if (ids.length) setSelectedPermIds(ids);
    } catch (e: any) {
      // si falla, al menos dejamos lo que vino de listRoles
      if (fromList.length === 0) {
        setErr(String(e?.message || "No se pudieron cargar permisos del rol"));
        setSelectedPermIds([]);
      }
    }
  }

  async function savePermissions() {
    if (!target) return;

    setSavingPerms(true);
    setErr(null);
    try {
      await updateRolePermissions(target.id, selectedPermIds);

      // ✅ refrescar lista para que quede consistente (y que no parezca que “no guardó”)
      await load();

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
                  <td className="px-4 py-3 font-semibold">{prettyRole(r.name)}</td>
                  <td className="px-4 py-3">
                    <Badge>{r.isSystem ? "Sistema" : "Personalizado"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {canAdmin && (
                      <>
                        {r.name !== "OWNER" && (
                          <button className="tp-btn" onClick={() => openPermissionsModal(r)} type="button">
                            Permisos
                          </button>
                        )}

                        {!r.isSystem && (
                          <button className="tp-btn" onClick={() => openRenameModal(r)} type="button">
                            Renombrar
                          </button>
                        )}

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
      <Modal open={editOpen} title="Renombrar rol" onClose={() => setEditOpen(false)}>
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
      <Modal
        open={permOpen}
        title={`Permisos de ${target ? prettyRole(target.name) : ""}`}
        onClose={() => setPermOpen(false)}
      >
        {permsLoading ? (
          <div>Cargando permisos…</div>
        ) : (
          <>
            <div className="mb-3 text-xs text-muted">
              Tip: “Administrar” equivale a acceso total del módulo. (Código técnico queda en tooltip)
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-auto tp-scroll pr-1">
              {permsByModule.map(([module, list]) => (
                <div key={module} className="tp-card p-3">
                  <div className="mb-2 text-sm font-semibold">{MODULE_LABEL[module] ?? module}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {list.map((p) => {
                      const checked = selectedPermIds.includes(p.id);
                      const code = `${p.module}:${p.action}`;
                      return (
                        <label key={p.id} className="flex gap-2 text-sm" title={code}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedPermIds((prev) =>
                                e.target.checked ? Array.from(new Set([...prev, p.id])) : prev.filter((id) => id !== p.id)
                              )
                            }
                          />
                          {prettyPerm(p.module, p.action)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
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
