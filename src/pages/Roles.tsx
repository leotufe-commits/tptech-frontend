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
import { Pencil, Trash2 } from "lucide-react";

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

/**
 * Modal con opción draggable.
 * - draggable: permite moverlo arrastrando el header
 * - al reabrir, vuelve a la posición original (centrado)
 */
function Modal({
  open,
  title,
  children,
  onClose,
  wide,
  draggable,
}: {
  open: boolean;
  title: string;
  children: any;
  onClose: () => void;
  wide?: boolean;
  draggable?: boolean;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) return;
    // ✅ cada vez que se abre, vuelve al lugar original
    setPos({ x: 0, y: 0 });
  }, [open]);

  useEffect(() => {
    if (!open || !draggable) return;

    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy });
    }
    function onUp() {
      dragging.current = false;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [open, draggable]);

  // bloquear scroll del fondo
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const boxClass = [
    "relative w-full rounded-2xl border border-border bg-card p-6 shadow-soft",
    wide ? "max-w-5xl" : "max-w-3xl",
  ].join(" ");

  if (!draggable) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className={boxClass}>
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

  // draggable: lo posicionamos centrado con translate(-50%) + offset pos
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div
        className={[boxClass, "absolute left-1/2 top-1/2"].join(" ")}
        style={{
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* header draggable */}
        <div
          className="flex items-center justify-between gap-3 select-none"
          onMouseDown={(e) => {
            // solo si apretás header, empieza drag
            dragging.current = true;
            start.current = { x: e.clientX, y: e.clientY };
            startPos.current = { ...pos };
          }}
          style={{ cursor: "move" }}
          title="Arrastrá para mover"
        >
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            className="tp-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            type="button"
            title="Cerrar"
          >
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
  const upOpacity = state === "ASC" ? 1 : state === "DESC" ? 0.18 : 0.28;
  const downOpacity = state === "DESC" ? 1 : state === "ASC" ? 0.18 : 0.28;

  return (
    <span className={["inline-flex items-center", className ?? ""].join(" ")}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 L21 12 H3 Z" fill="currentColor" opacity={upOpacity} />
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

  // catalog permissions
  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);

  // ✅ MODAL EDIT (unificado: nombre + permisos)
  const [editOpen, setEditOpen] = useState(false);
  const [target, setTarget] = useState<RoleLite | null>(null);
  const [editName, setEditName] = useState("");
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // create role modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSelectedPermIds, setCreateSelectedPermIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // ✅ autofocus inputs (nuevo rol / editar)
  const createNameRef = useRef<HTMLInputElement | null>(null);
  const editNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!createOpen) return;
    const t = window.setTimeout(() => createNameRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [createOpen]);

  useEffect(() => {
    if (!editOpen) return;
    const t = window.setTimeout(() => editNameRef.current?.focus(), 0);
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
     EDIT (unificado)
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

  async function openEditModal(r: RoleLite) {
    if (!canAdmin) return;

    const code = getRoleCode(r);
    const isOwner = code === "OWNER";
    if (isOwner) {
      setErr("El rol Propietario no es editable.");
      return;
    }

    setErr(null);
    setTarget(r);
    setEditName(r.name);
    setSelectedPermIds([]);

    await ensurePermissionsCatalog();
    setEditOpen(true);

    // precarga rápida
    const fromList = extractPermissionIdsFromListRole(r);
    setSelectedPermIds(fromList);

    // precarga completa
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

  async function saveEdit() {
    if (!canAdmin || !target) return;

    const nextName = editName.trim();
    if (!nextName) {
      setErr("El nombre no puede estar vacío.");
      return;
    }

    setSavingEdit(true);
    setErr(null);

    try {
      // guardamos nombre si cambió
      if (nextName !== target.name) {
        await renameRole(target.id, nextName);
      }

      // guardamos permisos (siempre, por simplicidad y consistencia)
      await updateRolePermissions(target.id, selectedPermIds);

      setEditOpen(false);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Error guardando cambios"));
    } finally {
      setSavingEdit(false);
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
        {/* ✅ scroll horizontal en mobile */}
        <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" as any }}>
          <table className="w-full min-w-[720px] text-sm">
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
                    {/* ✅ visible en tema claro/oscuro */}
                    <SortTrianglesIcon
                      state={sortState("ROLE")}
                      className={sortBy === "ROLE" ? "text-text" : "text-muted"}
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
                      className={sortBy === "TYPE" ? "text-text" : "text-muted"}
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

                  const iconBtnBase =
                    "inline-flex items-center justify-center rounded-lg border border-border bg-card " +
                    "h-9 w-9 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] hover:bg-surface2 " +
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20";

                  const disabledCls = "opacity-40 cursor-not-allowed hover:bg-card";

                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold">{prettyRole(r.name)}</td>

                      <td className="px-4 py-3">
                        <Badge>{r.isSystem ? "Sistema" : "Personalizado"}</Badge>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* ✏️ EDITAR (unificado) */}
                          <button
                            className={[
                              iconBtnBase,
                              !canEditThis ? disabledCls : "",
                            ].join(" ")}
                            type="button"
                            disabled={!canEditThis}
                            onClick={() => (canEditThis ? openEditModal(r) : null)}
                            title={!canEditThis && isOwner ? "Propietario no es editable" : "Editar rol"}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* 🗑️ ELIMINAR */}
                          <button
                            className={[
                              iconBtnBase,
                              deleteDisabled ? disabledCls : "",
                            ].join(" ")}
                            type="button"
                            disabled={deleteDisabled}
                            onClick={() => (deleteDisabled ? null : onDelete(r))}
                            title={
                              deleteDisabled
                                ? "No se puede eliminar un rol del sistema"
                                : "Eliminar rol"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border px-4 py-3 text-xs text-muted">
          {sortedRoles.length} {sortedRoles.length === 1 ? "rol" : "roles"}
        </div>
      </div>

      {/* =========================
          MODAL NUEVO ROL (draggable)
      ========================= */}
      <Modal
        open={createOpen}
        title="Nuevo Rol"
        onClose={() => setCreateOpen(false)}
        wide
        draggable
      >
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
          MODAL EDITAR ROL (unificado + draggable)
      ========================= */}
      <Modal
        key={target?.id ?? "no-target"}
        open={editOpen}
        title={`Editar rol${target ? `: ${prettyRole(target.name)}` : ""}`}
        onClose={() => setEditOpen(false)}
        wide
        draggable
      >
        {permsLoading ? (
          <div>Cargando permisos…</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-muted">Nombre del rol</label>
              <input
                ref={editNameRef}
                className="tp-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="text-xs text-muted">
              Tip: “Administrar” equivale a acceso total del módulo. (Código técnico queda en tooltip)
            </div>

            <div className="space-y-4 max-h-[55vh] overflow-auto tp-scroll pr-1">
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
              <button className="tp-btn-secondary" onClick={() => setEditOpen(false)} type="button">
                Cancelar
              </button>
              <button
                className="tp-btn-primary"
                disabled={savingEdit}
                onClick={saveEdit}
                type="button"
              >
                {savingEdit ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
