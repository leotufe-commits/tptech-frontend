// tptech-frontend/src/pages/Roles.tsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
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

function prettyRole(name: string) {
  return name;
}

// tolera que RoleLite no tenga "code" tipado
function getRoleCode(r: RoleLite): string | undefined {
  return (r as any)?.code;
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
  wide,
}: {
  open: boolean;
  title: string;
  children: any;
  onClose: () => void;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={[
          "relative w-full rounded-2xl border border-border bg-card p-6 shadow-soft",
          wide ? "max-w-5xl" : "max-w-3xl",
        ].join(" ")}
      >
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

function SortTrianglesIcon({
  state,
  className,
}: {
  state: "INACTIVE" | "ASC" | "DESC";
  className?: string;
}) {
  // usa currentColor para que puedas controlar color con clases
  const upOpacity = state === "ASC" ? 1 : state === "DESC" ? 0.18 : 0.28;
  const downOpacity = state === "DESC" ? 1 : state === "ASC" ? 0.18 : 0.28;

  // ✅ más separación entre triángulos (gap visual)
  return (
    <span className={["inline-flex items-center", className ?? ""].join(" ")}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        {/* Triángulo arriba */}
        <path d="M12 3 L21 12 H3 Z" fill="currentColor" opacity={upOpacity} />
        {/* Triángulo abajo */}
        <path d="M3 12 H21 L12 21 Z" fill="currentColor" opacity={downOpacity} />
      </svg>
    </span>
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

  // sorting
  const [sortBy, setSortBy] = useState<"ROLE" | "TYPE">("ROLE");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");

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

  // create role modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSelectedPermIds, setCreateSelectedPermIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // ✅ autofocus inputs (nuevo rol / renombrar)
  const createNameRef = useRef<HTMLInputElement | null>(null);
  const renameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!createOpen) return;
    const t = window.setTimeout(() => createNameRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [createOpen]);

  useEffect(() => {
    if (!editOpen) return;
    const t = window.setTimeout(() => renameRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [editOpen]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await listRoles();
      const list = Array.isArray(data) ? data : (data as any)?.roles ?? [];

      // dedupe por id (solo UI)
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

  // ✅ PRECARGA: si sos admin, empezamos a traer el catálogo al entrar a la pantalla
  useEffect(() => {
    if (!canAdmin) return;
    void ensurePermissionsCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  const permsByModule = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of allPerms) {
      const key = p.module;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    const entries = Array.from(map.entries()).sort((a, b) => {
      const la = MODULE_LABEL[a[0]] ?? a[0];
      const lb = MODULE_LABEL[b[0]] ?? b[0];
      return la.localeCompare(lb, "es", { sensitivity: "base" });
    });
    const order = ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "ADMIN"];
    for (const [, list] of entries) {
      list.sort((x, y) => order.indexOf(x.action) - order.indexOf(y.action));
    }
    return entries;
  }, [allPerms]);

  const sortedRoles = useMemo(() => {
    const dir = sortDir === "ASC" ? 1 : -1;

    function typeLabel(r: RoleLite) {
      return r.isSystem ? "Sistema" : "Personalizado";
    }

    const arr = [...roles];
    arr.sort((a, b) => {
      if (sortBy === "ROLE") {
        return (
          prettyRole(a.name).localeCompare(prettyRole(b.name), "es", { sensitivity: "base" }) * dir
        );
      }

      const ta = typeLabel(a);
      const tb = typeLabel(b);

      const byType = ta.localeCompare(tb, "es", { sensitivity: "base" }) * dir;
      if (byType !== 0) return byType;

      return (
        prettyRole(a.name).localeCompare(prettyRole(b.name), "es", { sensitivity: "base" }) * dir
      );
    });

    return arr;
  }, [roles, sortBy, sortDir]);

  function toggleSort(nextBy: "ROLE" | "TYPE") {
    if (sortBy !== nextBy) {
      setSortBy(nextBy);
      setSortDir("ASC");
      return;
    }
    setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
  }

  function sortState(col: "ROLE" | "TYPE"): "INACTIVE" | "ASC" | "DESC" {
    if (sortBy !== col) return "INACTIVE";
    return sortDir === "ASC" ? "ASC" : "DESC";
  }

  /* =========================
     Helpers selección por módulo
  ========================= */
  function moduleIds(module: string, list: Permission[]) {
    return list.filter((p) => p.module === module).map((p) => p.id);
  }

  function isModuleFullySelected(current: string[], ids: string[]) {
    if (ids.length === 0) return false;
    const set = new Set(current);
    return ids.every((id) => set.has(id));
  }

  function toggleModuleSelection(
    modulePermIds: string[],
    checked: boolean,
    setter: Dispatch<SetStateAction<string[]>>
  ) {
    setter((prev) => {
      const set = new Set(prev);
      if (checked) {
        for (const id of modulePermIds) set.add(id);
      } else {
        for (const id of modulePermIds) set.delete(id);
      }
      return Array.from(set);
    });
  }

  /* =========================
     CREATE (Nuevo Rol)
  ========================= */
  async function openCreateModal() {
    if (!canAdmin) return;
    setErr(null);
    setCreateName("");
    setCreateSelectedPermIds([]);

    // ✅ primero cargamos catálogo (si falta) y recién después mostramos el modal
    await ensurePermissionsCatalog();
    setCreateOpen(true);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canAdmin) return;

    const name = createName.trim();
    if (!name) {
      setErr("Escribí el nombre del rol.");
      return;
    }

    setCreating(true);
    setErr(null);
    try {
      const created: any = await createRole(name);

      if (createSelectedPermIds.length > 0) {
        const roleId = created?.id ?? created?.role?.id;
        if (!roleId) throw new Error("No se recibió el ID del rol creado.");
        await updateRolePermissions(roleId, createSelectedPermIds);
      }

      setCreateOpen(false);
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
    const ids = (r.permissions ?? [])
      .map((p: any) => p?.id)
      .filter((x: any) => typeof x === "string" && x.length > 0);
    return Array.from(new Set(ids));
  }

  function extractPermissionIdsFromFetchRoleResponse(detail: any): string[] {
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

    if (getRoleCode(r) === "OWNER") {
      setErr("El rol Propietario no es editable.");
      return;
    }

    setErr(null);
    setTarget(r);

    setSelectedPermIds([]);
    setSavingPerms(false);

    // ✅ aseguramos catálogo antes de abrir (evita “aparece y luego carga”)
    await ensurePermissionsCatalog();
    setPermOpen(true);

    const fromList = extractPermissionIdsFromListRole(r);
    setSelectedPermIds(fromList);

    try {
      const detail = await fetchRole(r.id);
      const ids = extractPermissionIdsFromFetchRoleResponse(detail);
      if (ids.length) setSelectedPermIds(ids);
    } catch (e: any) {
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

  const btnW = "w-28";
  const btnRow = "flex items-center justify-end gap-2";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="text-sm text-muted">Gestión de roles y permisos.</p>
        </div>

        {canAdmin && (
          <button className="tp-btn-primary md:w-44" onClick={openCreateModal} type="button">
            Nuevo Rol
          </button>
        )}
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
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 hover:opacity-90"
                  onClick={() => toggleSort("ROLE")}
                  title="Ordenar por Rol"
                >
                  <span>Rol</span>
                  {/* INACTIVO apagado / ACTIVO blanco */}
                  <SortTrianglesIcon
                    state={sortState("ROLE")}
                    className={sortBy === "ROLE" ? "text-white" : "text-black opacity-70"}
                  />
                </button>
              </th>

              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 hover:opacity-90"
                  onClick={() => toggleSort("TYPE")}
                  title="Ordenar por Tipo"
                >
                  <span>Tipo</span>
                  <SortTrianglesIcon
                    state={sortState("TYPE")}
                    className={sortBy === "TYPE" ? "text-white" : "text-black opacity-70"}
                  />
                </button>
              </th>

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
            ) : sortedRoles.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted" colSpan={3}>
                  No hay roles.
                </td>
              </tr>
            ) : (
              sortedRoles.map((r) => {
                const code = getRoleCode(r);
                const isOwner = code === "OWNER";

                const canEditThis = canAdmin && !isOwner;
                const deleteDisabled = r.isSystem;

                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold">{prettyRole(r.name)}</td>

                    <td className="px-4 py-3">
                      <Badge>{r.isSystem ? "Sistema" : "Personalizado"}</Badge>
                    </td>

                    <td className="px-4 py-3">
                      <div className={btnRow}>
                        <button
                          className={`tp-btn ${btnW} ${!canEditThis ? "opacity-40 cursor-not-allowed" : ""}`}
                          onClick={() => (canEditThis ? openPermissionsModal(r) : null)}
                          type="button"
                          disabled={!canEditThis}
                          title={!canEditThis && isOwner ? "Propietario no es editable" : ""}
                        >
                          Permisos
                        </button>

                        <button
                          className={`tp-btn ${btnW} ${!canEditThis ? "opacity-40 cursor-not-allowed" : ""}`}
                          onClick={() => (canEditThis ? openRenameModal(r) : null)}
                          type="button"
                          disabled={!canEditThis}
                          title={!canEditThis && isOwner ? "Propietario no es editable" : ""}
                        >
                          Renombrar
                        </button>

                        <button
                          className={`tp-btn ${btnW} ${deleteDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                          onClick={() => (deleteDisabled ? null : onDelete(r))}
                          type="button"
                          disabled={deleteDisabled}
                          title={deleteDisabled ? "No se puede eliminar un rol del sistema" : ""}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="border-t border-border px-4 py-3 text-xs text-muted">
          {sortedRoles.length} {sortedRoles.length === 1 ? "rol" : "roles"}
        </div>
      </div>

      {/* =========================
          MODAL NUEVO ROL
      ========================= */}
      <Modal open={createOpen} title="Nuevo Rol" onClose={() => setCreateOpen(false)} wide>
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted">Nombre del rol</label>
            <input
              ref={createNameRef}
              className="tp-input"
              placeholder="Ej: Caja, Depósito, Ventas…"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
          </div>

          {permsLoading ? (
            <div>Cargando permisos…</div>
          ) : (
            <>
              <div className="text-xs text-muted">Seleccioná los permisos para este rol.</div>

              <div className="space-y-4 max-h-[55vh] overflow-auto tp-scroll pr-1">
                {permsByModule.map(([module, list]) => {
                  const ids = moduleIds(module, list);
                  const fully = isModuleFullySelected(createSelectedPermIds, ids);

                  return (
                    <div key={module} className="tp-card p-3">
                      <div className="pb-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={fully}
                            onChange={(e) =>
                              toggleModuleSelection(ids, e.target.checked, setCreateSelectedPermIds)
                            }
                          />
                          <span className="text-sm font-semibold underline underline-offset-4">
                            {MODULE_LABEL[module] ?? module}
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {list.map((p) => {
                          const checked = createSelectedPermIds.includes(p.id);
                          const code = `${p.module}:${p.action}`;
                          return (
                            <label key={p.id} className="flex gap-2 text-sm" title={code}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setCreateSelectedPermIds((prev) =>
                                    e.target.checked
                                      ? Array.from(new Set([...prev, p.id]))
                                      : prev.filter((id) => id !== p.id)
                                  )
                                }
                              />
                              {prettyPerm(p.module, p.action)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  className="tp-btn-secondary"
                  onClick={() => setCreateOpen(false)}
                  type="button"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button className="tp-btn-primary" type="submit" disabled={creating}>
                  {creating ? "Creando…" : "Crear"}
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* =========================
          MODAL RENAME
      ========================= */}
      <Modal open={editOpen} title="Renombrar rol" onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Nombre</label>
            <input
              ref={renameRef}
              className="tp-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
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
        key={target?.id ?? "no-target"}
        open={permOpen}
        title={`Permisos de ${target ? prettyRole(target.name) : ""}`}
        onClose={() => setPermOpen(false)}
        wide
      >
        {permsLoading ? (
          <div>Cargando permisos…</div>
        ) : (
          <>
            <div className="mb-3 text-xs text-muted">
              Tip: “Administrar” equivale a acceso total del módulo. (Código técnico queda en tooltip)
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-auto tp-scroll pr-1">
              {permsByModule.map(([module, list]) => {
                const ids = moduleIds(module, list);
                const fully = isModuleFullySelected(selectedPermIds, ids);

                return (
                  <div key={module} className="tp-card p-3">
                    <div className="pb-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={fully}
                          onChange={(e) =>
                            toggleModuleSelection(ids, e.target.checked, setSelectedPermIds)
                          }
                        />
                        <span className="text-sm font-semibold underline underline-offset-4">
                          {MODULE_LABEL[module] ?? module}
                        </span>
                      </label>
                    </div>

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
                                  e.target.checked
                                    ? Array.from(new Set([...prev, p.id]))
                                    : prev.filter((id) => id !== p.id)
                                )
                              }
                            />
                            {prettyPerm(p.module, p.action)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button className="tp-btn-secondary" onClick={() => setPermOpen(false)} type="button">
                Cancelar
              </button>
              <button
                className="tp-btn-primary"
                disabled={savingPerms}
                onClick={savePermissions}
                type="button"
              >
                {savingPerms ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
