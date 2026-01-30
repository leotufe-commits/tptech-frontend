// tptech-frontend/src/pages/Roles.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Pencil, Trash2, Loader2, Lock } from "lucide-react";

import { useAuth } from "../context/AuthContext";

import {
  createRole,
  deleteRole,
  fetchRole,
  listRoles,
  renameRole,
  updateRolePermissions,
  extractPermissionIdsFromRoleDetail,
  type RoleLite,
} from "../services/roles";

import { fetchPermissions, type Permission } from "../services/permissions";

import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { SortArrows } from "../components/ui/TPSort";
import { TPBadge } from "../components/ui/TPBadges";
import { Modal } from "../components/ui/Modal";

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

const ACTION_ORDER = ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "ADMIN"] as const;

function prettyPerm(module: string, action: string) {
  return `${ACTION_LABEL[action] ?? action} ${MODULE_LABEL[module] ?? module}`;
}

/* =========================
   Role label
   - Prioriza displayName del backend
   - fallback a name
   - último fallback a code
========================= */
function roleLabel(r: RoleLite) {
  const display = String((r as any)?.displayName || "").trim();
  if (display) return display;

  const name = String(r?.name || "").trim();
  if (name) return name;

  const code = String((r as any)?.code || "").trim();
  return code || "Rol";
}

function isOwnerRole(r: RoleLite) {
  return String((r as any)?.code || "").toUpperCase().trim() === "OWNER";
}

/* =========================
   UI helpers
========================= */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* =========================
   Permission helpers
========================= */
function groupPermsByModule(all: Permission[]) {
  const map = new Map<string, Permission[]>();
  for (const p of all) {
    map.set(p.module, [...(map.get(p.module) ?? []), p]);
  }

  const entries = Array.from(map.entries()).sort((a, b) => {
    const la = MODULE_LABEL[a[0]] ?? a[0];
    const lb = MODULE_LABEL[b[0]] ?? b[0];
    return la.localeCompare(lb, "es", { sensitivity: "base" });
  });

  for (const [, list] of entries) {
    list.sort((x, y) => ACTION_ORDER.indexOf(x.action as any) - ACTION_ORDER.indexOf(y.action as any));
  }

  return entries;
}

/**
 * Checkbox con indeterminate (parcialmente seleccionado)
 */
function ModuleCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className={cn("flex items-center gap-2", disabled && "opacity-60")}>
      <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm font-semibold underline underline-offset-4">{label}</span>
    </label>
  );
}

/* =========================
   Shared editor modal
========================= */
function RoleEditorModal({
  open,
  title,
  initialName,
  permsByModule,
  initialSelectedIds,
  loadingPerms,
  saving,
  submitLabel,
  nameInputRef,
  onClose,
  onSubmit,
  permissionsDisabled,
}: {
  open: boolean;
  title: string;
  initialName: string;
  permsByModule: Array<[string, Permission[]]>;
  initialSelectedIds: string[];
  loadingPerms: boolean;
  saving: boolean;
  submitLabel: string;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (name: string, selectedIds: string[]) => Promise<void>;
  permissionsDisabled?: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(() => new Set(initialSelectedIds));

  const initializedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;

    setName(initialName);
    setSelectedSet(new Set(initialSelectedIds));
    initializedRef.current = true;
  }, [open, initialName, initialSelectedIds]);

  const toggleOne = useCallback((permId: string, checked: boolean) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permId);
      else next.delete(permId);
      return next;
    });
  }, []);

  const toggleModule = useCallback((modulePerms: Permission[], checked: boolean) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const p of modulePerms) next.add(p.id);
      } else {
        for (const p of modulePerms) next.delete(p.id);
      }
      return next;
    });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(name, Array.from(selectedSet));
  }

  return (
    <Modal open={open} title={title} onClose={onClose} wide>
      {loadingPerms ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando permisos…
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted">Nombre del rol</label>
            <input
              ref={nameInputRef}
              className="tp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Caja, Depósito, Ventas…"
            />
          </div>

          {permissionsDisabled ? (
            <div className="tp-card p-3 flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold">Rol Propietario (Owner)</div>
                <div className="text-xs text-muted">
                  En este rol solo se permite cambiar el <b>nombre</b>. Los permisos quedan bloqueados.
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted">Tip: el checkbox del título del módulo selecciona/deselecciona todo el módulo.</div>
          )}

          <div
            className={cn(
              "space-y-4 max-h-[55vh] overflow-auto tp-scroll pr-1",
              permissionsDisabled && "opacity-60 pointer-events-none select-none"
            )}
          >
            {permsByModule.map(([module, listRaw]) => {
              const list = listRaw.filter((p) => p.action !== "ADMIN");

              const ids = list.map((p) => p.id);
              const total = ids.length;

              let selectedCount = 0;
              for (const id of ids) if (selectedSet.has(id)) selectedCount++;

              const fully = total > 0 && selectedCount === total;
              const indeterminate = selectedCount > 0 && selectedCount < total;

              return (
                <div key={module} className="tp-card p-3">
                  <div className="pb-4 flex items-start justify-between gap-3">
                    <ModuleCheckbox
                      checked={fully}
                      indeterminate={indeterminate}
                      onChange={(checked) => toggleModule(list, checked)}
                      label={MODULE_LABEL[module] ?? module}
                      disabled={permissionsDisabled}
                    />
                    <div className="text-xs text-muted">
                      {selectedCount}/{total}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {list.map((p) => {
                      const checked = selectedSet.has(p.id);
                      const techCode = `${p.module}:${p.action}`;

                      return (
                        <label key={p.id} className="flex gap-2 text-sm" title={techCode}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={permissionsDisabled}
                            onChange={(e) => toggleOne(p.id, e.target.checked)}
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
            <button className="tp-btn-secondary" onClick={onClose} type="button" disabled={saving}>
              Cancelar
            </button>
            <button className="tp-btn-primary" type="submit" disabled={saving}>
              {saving ? "Guardando…" : submitLabel}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* =========================
   Row (memo) para evitar rerenders
========================= */
const RoleRow = React.memo(function RoleRow({
  r,
  canAdmin,
  editingRoleId,
  onOpenEdit,
  onDelete,
  iconBtnBase,
  disabledCls,
}: {
  r: RoleLite;
  canAdmin: boolean;
  editingRoleId: string | null;
  onOpenEdit: (r: RoleLite) => void;
  onDelete: (r: RoleLite) => void;
  iconBtnBase: string;
  disabledCls: string;
}) {
  const owner = isOwnerRole(r);
  const canEditThis = canAdmin;
  const deleteDisabled = Boolean(r.isSystem);
  const isEditingThis = editingRoleId === r.id;

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-semibold">{roleLabel(r)}</td>

      <td className="hidden sm:table-cell px-4 py-3">
        <TPBadge size="sm">{r.isSystem ? "Sistema" : "Personalizado"}</TPBadge>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            className={cn(iconBtnBase, (!canEditThis || isEditingThis) && disabledCls)}
            type="button"
            disabled={!canEditThis || isEditingThis}
            onClick={() => (canEditThis ? onOpenEdit(r) : null)}
            title={
              !canAdmin
                ? "Sin permisos"
                : isEditingThis
                ? "Cargando..."
                : owner
                ? "Editar nombre (Propietario)"
                : "Editar rol"
            }
          >
            {isEditingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          </button>

          <button
            className={cn(iconBtnBase, (deleteDisabled || isEditingThis) && disabledCls)}
            type="button"
            disabled={deleteDisabled || isEditingThis}
            onClick={() => (deleteDisabled || isEditingThis ? null : onDelete(r))}
            title={deleteDisabled ? "No se puede eliminar un rol del sistema" : isEditingThis ? "Cargando..." : "Eliminar rol"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

/* =========================
   PAGE
========================= */
export default function RolesPage() {
  const { permissions, refreshMe } = useAuth();

  const permSet = useMemo(() => new Set(permissions), [permissions]);
  const canView = permSet.has("USERS_ROLES:VIEW") || permSet.has("USERS_ROLES:ADMIN");
  const canAdmin = permSet.has("USERS_ROLES:ADMIN");

  const [roles, setRoles] = useState<RoleLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<"ROLE" | "TYPE">("ROLE");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");

  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [createSaving, setCreateSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [target, setTarget] = useState<RoleLite | null>(null);
  const [editInitialName, setEditInitialName] = useState("");
  const [editInitialPermIds, setEditInitialPermIds] = useState<string[]>([]);
  const [editPermissionsDisabled, setEditPermissionsDisabled] = useState(false);

  const createNameRef = useRef<HTMLInputElement | null>(null);
  const editNameRef = useRef<HTMLInputElement | null>(null);

  const loadReqRef = useRef(0);
  const didInitLoadRef = useRef(false);
  const editReqRef = useRef(0);

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [creatingOpenLoading, setCreatingOpenLoading] = useState(false);

  const { askDelete, dialogProps } = useConfirmDelete();

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

  const permsByModule = useMemo(() => groupPermsByModule(allPerms), [allPerms]);

  const sortedRoles = useMemo(() => {
    const dir = sortDir === "ASC" ? 1 : -1;

    function typeLabel(r: RoleLite) {
      return r.isSystem ? "Sistema" : "Personalizado";
    }

    const arr = [...roles];
    arr.sort((a, b) => {
      if (sortBy === "ROLE") {
        return roleLabel(a).localeCompare(roleLabel(b), "es", { sensitivity: "base" }) * dir;
      }

      const ta = typeLabel(a);
      const tb = typeLabel(b);

      const byType = ta.localeCompare(tb, "es", { sensitivity: "base" }) * dir;
      if (byType !== 0) return byType;

      return roleLabel(a).localeCompare(roleLabel(b), "es", { sensitivity: "base" }) * dir;
    });

    return arr;
  }, [roles, sortBy, sortDir]);

  const loadRoles = useCallback(async () => {
    const reqId = ++loadReqRef.current;

    setErr(null);
    setLoading(true);

    try {
      const list = await listRoles();

      if (loadReqRef.current !== reqId) return;

      const uniq = new Map<string, RoleLite>();
      for (const r of list) uniq.set(r.id, r);
      setRoles(Array.from(uniq.values()));
    } catch (e: any) {
      if (loadReqRef.current !== reqId) return;
      setErr(String(e?.message || "Error cargando roles"));
    } finally {
      if (loadReqRef.current === reqId) setLoading(false);
    }
  }, []);

  const ensurePermissionsCatalog = useCallback(async () => {
    if (allPerms.length > 0) return allPerms;

    setPermsLoading(true);
    try {
      const list = await fetchPermissions();
      setAllPerms(list);
      return list;
    } finally {
      setPermsLoading(false);
    }
  }, [allPerms.length]);

  useEffect(() => {
    if (!canView) return;

    if (!didInitLoadRef.current) {
      didInitLoadRef.current = true;
      void loadRoles();
    }
  }, [canView, loadRoles]);

  useEffect(() => {
    if (canView) return;
    didInitLoadRef.current = false;
    setRoles([]);
    setLoading(false);
  }, [canView]);

  function toggleSort(nextBy: "ROLE" | "TYPE") {
    if (sortBy !== nextBy) {
      setSortBy(nextBy);
      setSortDir("ASC");
      return;
    }
    setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
  }

  function sortActive(col: "ROLE" | "TYPE") {
    return sortBy === col;
  }

  const sortDirForArrows: "asc" | "desc" = sortDir === "ASC" ? "asc" : "desc";

  /* =========================
     CREATE
  ========================= */
  const openCreateModal = useCallback(async () => {
    if (!canAdmin) return;

    setErr(null);
    setCreatingOpenLoading(true);

    try {
      await ensurePermissionsCatalog();
      setCreateOpen(true);
    } catch (e: any) {
      setErr(String(e?.message || "No se pudieron cargar permisos"));
    } finally {
      setCreatingOpenLoading(false);
    }
  }, [canAdmin, ensurePermissionsCatalog]);

  const onCreateSubmit = useCallback(
    async (name: string, selectedPermIds: string[]) => {
      if (!canAdmin) return;

      const clean = name.trim();
      if (!clean) {
        setErr("Escribí el nombre del rol.");
        return;
      }

      setCreateSaving(true);
      setErr(null);
      try {
        const created = await createRole(clean);
        const roleId = created?.id;
        if (!roleId) throw new Error("No se recibió el ID del rol creado.");

        if (selectedPermIds.length > 0) {
          await updateRolePermissions(roleId, selectedPermIds);
        }

        setCreateOpen(false);

        await loadRoles();
        await refreshMe({ silent: true, force: true } as any);
      } catch (e: any) {
        setErr(String(e?.message || "Error creando rol"));
      } finally {
        setCreateSaving(false);
      }
    },
    [canAdmin, loadRoles, refreshMe]
  );

  /* =========================
     DELETE
  ========================= */
  const onDelete = useCallback(
    (r: RoleLite) => {
      if (!canAdmin) return;
      if (r.isSystem) return;

      askDelete({
        entityName: "rol",
        entityLabel: roleLabel(r),
        onDelete: () => deleteRole(r.id),
        onAfterSuccess: async () => {
          await loadRoles();
          await refreshMe({ silent: true, force: true } as any);
        },
        confirmTitle: `Eliminar rol: ${roleLabel(r)}`,
        confirmDescription: "Esta acción no se puede deshacer.",
        dangerHint: "Si este rol está asignado a usuarios o asociado a operaciones, puede que no se permita eliminarlo.",
      });
    },
    [askDelete, canAdmin, loadRoles, refreshMe]
  );

  /* =========================
     EDIT
  ========================= */
  const openEditModal = useCallback(
    async (r: RoleLite) => {
      if (!canAdmin) return;

      setErr(null);

      const reqId = ++editReqRef.current;
      setEditingRoleId(r.id);

      // ✅ ÚNICO “solo nombre”: OWNER
      const nameOnly = isOwnerRole(r);
      setEditPermissionsDisabled(nameOnly);

      setEditInitialName(r.name);
      setEditInitialPermIds([]);
      setTarget(r);

      setPermsLoading(true);
      try {
        await ensurePermissionsCatalog();

        const detail = await fetchRole(r.id);
        if (editReqRef.current !== reqId) return;

        const ids = extractPermissionIdsFromRoleDetail(detail);
        setEditInitialPermIds(ids);

        setEditOpen(true);
      } catch (e: any) {
        if (editReqRef.current !== reqId) return;
        setErr(String(e?.message || "No se pudieron cargar permisos del rol"));
      } finally {
        if (editReqRef.current === reqId) {
          setPermsLoading(false);
          setEditingRoleId(null);
        }
      }
    },
    [canAdmin, ensurePermissionsCatalog]
  );

  const onEditSubmit = useCallback(
    async (name: string, selectedPermIds: string[]) => {
      if (!canAdmin || !target) return;

      const clean = name.trim();
      if (!clean) {
        setErr("El nombre no puede estar vacío.");
        return;
      }

      setEditSaving(true);
      setErr(null);

      try {
        if (clean !== target.name) {
          await renameRole(target.id, clean);
        }

        // ✅ ahora se permite editar permisos en roles del sistema, excepto OWNER
        if (!editPermissionsDisabled) {
          await updateRolePermissions(target.id, selectedPermIds);
        }

        setEditOpen(false);
        setTarget(null);

        await loadRoles();
        await refreshMe({ silent: true, force: true } as any);
      } catch (e: any) {
        setErr(String(e?.message || "Error guardando cambios"));
      } finally {
        setEditSaving(false);
      }
    },
    [canAdmin, target, loadRoles, refreshMe, editPermissionsDisabled]
  );

  if (!canView) return <div className="p-6">Sin permisos para ver roles.</div>;

  const iconBtnBase =
    "inline-flex items-center justify-center rounded-lg border border-border bg-card " +
    "h-9 w-9 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] hover:bg-surface2 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20";

  const disabledCls = "opacity-40 cursor-not-allowed hover:bg-card";

  return (
    <div className="px-4 py-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="text-sm text-muted">Gestión de roles y permisos.</p>
        </div>

        {canAdmin && (
          <button
            className={cn(
              "tp-btn-primary w-full sm:w-auto sm:min-w-[176px] inline-flex items-center justify-center gap-2",
              creatingOpenLoading && "opacity-80"
            )}
            onClick={openCreateModal}
            type="button"
            disabled={creatingOpenLoading}
            title={creatingOpenLoading ? "Cargando..." : "Nuevo Rol"}
          >
            {creatingOpenLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </>
            ) : (
              "Nuevo Rol"
            )}
          </button>
        )}
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">{err}</div>}

      <div className="tp-card overflow-hidden w-full">
        <table className="w-full text-sm">
          <thead className="bg-surface2 text-xs uppercase text-muted border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 hover:opacity-90"
                  onClick={() => toggleSort("ROLE")}
                  title="Ordenar por Rol"
                >
                  <span>Rol</span>
                  <SortArrows dir={sortDirForArrows} active={sortActive("ROLE")} />
                </button>
              </th>

              <th className="hidden sm:table-cell px-4 py-3 text-left">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 hover:opacity-90"
                  onClick={() => toggleSort("TYPE")}
                  title="Ordenar por Tipo"
                >
                  <span>Tipo</span>
                  <SortArrows dir={sortDirForArrows} active={sortActive("TYPE")} />
                </button>
              </th>

              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
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
              sortedRoles.map((r) => (
                <RoleRow
                  key={r.id}
                  r={r}
                  canAdmin={canAdmin}
                  editingRoleId={editingRoleId}
                  onOpenEdit={openEditModal}
                  onDelete={onDelete}
                  iconBtnBase={iconBtnBase}
                  disabledCls={disabledCls}
                />
              ))
            )}
          </tbody>
        </table>

        <div className="border-t border-border px-4 py-3 text-xs text-muted">
          {sortedRoles.length} {sortedRoles.length === 1 ? "rol" : "roles"}
        </div>
      </div>

      {/* CREATE */}
      <RoleEditorModal
        open={createOpen}
        title="Nuevo Rol"
        initialName=""
        permsByModule={permsByModule}
        initialSelectedIds={[]}
        loadingPerms={permsLoading}
        saving={createSaving}
        submitLabel="Crear"
        nameInputRef={createNameRef}
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreateSubmit}
      />

      {/* EDIT */}
      <RoleEditorModal
        open={editOpen}
        title={`Editar rol${target ? `: ${roleLabel(target)}` : ""}`}
        initialName={editInitialName}
        permsByModule={permsByModule}
        initialSelectedIds={editInitialPermIds}
        loadingPerms={permsLoading}
        saving={editSaving}
        submitLabel="Guardar"
        nameInputRef={editNameRef}
        permissionsDisabled={editPermissionsDisabled}
        onClose={() => {
          setEditOpen(false);
          setTarget(null);
        }}
        onSubmit={onEditSubmit}
      />

      <ConfirmDeleteDialog {...dialogProps} />
    </div>
  );
}
