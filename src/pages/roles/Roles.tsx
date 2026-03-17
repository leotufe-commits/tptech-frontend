// tptech-frontend/src/pages/Roles.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import {
  createRole,
  deleteRole,
  fetchRole,
  listRoles,
  renameRole,
  updateRolePermissions,
  extractPermissionIdsFromRoleDetail,
  type RoleLite,
} from "../../services/roles";

import { fetchPermissions, type Permission } from "../../services/permissions";

import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import TPAlert from "../../components/ui/TPAlert";
import { TPBadge } from "../../components/ui/TPBadges";
import TPButton from "../../components/ui/TPButton";
import TPRowActions from "../../components/ui/TPRowActions";
import { TPSectionShell } from "../../components/ui/TPSectionShell";

import { TPTr } from "../../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";

import RoleEditorModal from "./RoleEditorModal";

/* =========================
   Role label
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

const ROLE_COLS: TPColDef[] = [
  { key: "rol",      label: "Rol",     canHide: false, sortKey: "ROLE" },
  { key: "tipo",     label: "Tipo",    sortKey: "TYPE" },
  { key: "acciones", label: "Acciones", canHide: false, align: "right" },
];

/* =========================
   Row (memo)
========================= */
const RoleRow = React.memo(function RoleRow({
  r,
  canAdmin,
  editingRoleId,
  onOpenEdit,
  onDelete,
}: {
  r: RoleLite;
  canAdmin: boolean;
  editingRoleId: string | null;
  onOpenEdit: (r: RoleLite) => void;
  onDelete: (r: RoleLite) => void;
}) {
  const isSystem     = Boolean(r.isSystem);
  const isEditingThis = editingRoleId === r.id;

  return (
    <TPTr key={r.id}>
      <td className="px-3 py-2 font-semibold">{roleLabel(r)}</td>
      <td className="px-3 py-2 hidden sm:table-cell">
        <TPBadge size="sm">{r.isSystem ? "Sistema" : "Personalizado"}</TPBadge>
      </td>
      <td className="px-3 py-2 text-right">
        <TPRowActions
          onEdit={canAdmin && !isEditingThis ? () => onOpenEdit(r) : undefined}
          onDelete={canAdmin && !isEditingThis ? () => onDelete(r) : () => {}}
          deleteDisabled={isSystem || isEditingThis}
          deleteTitle={isSystem ? "No podés eliminar roles del sistema" : "Eliminar"}
        />
      </td>
    </TPTr>
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

  const [pageErr, setPageErr] = useState<string | null>(null);
  const [modalErr, setModalErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
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

  useEffect(() => {
    if (createOpen || editOpen) setModalErr(null);
  }, [createOpen, editOpen]);

  const filteredRoles = useMemo(() => {
    if (!q.trim()) return roles;
    const needle = q.trim().toLowerCase();
    return roles.filter((r) =>
      roleLabel(r).toLowerCase().includes(needle)
    );
  }, [roles, q]);

  const sortedRoles = useMemo(() => {
    const dir = sortDir === "ASC" ? 1 : -1;

    function typeLabel(r: RoleLite) {
      return r.isSystem ? "Sistema" : "Personalizado";
    }

    const arr = [...filteredRoles];
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
  }, [filteredRoles, sortBy, sortDir]);

  const loadRoles = useCallback(async () => {
    const reqId = ++loadReqRef.current;

    setPageErr(null);
    setLoading(true);

    try {
      const list = await listRoles();
      if (loadReqRef.current !== reqId) return;

      const uniq = new Map<string, RoleLite>();
      for (const r of list) uniq.set(r.id, r);
      setRoles(Array.from(uniq.values()));
    } catch (e: any) {
      if (loadReqRef.current !== reqId) return;
      setPageErr(String(e?.message || "Error cargando roles"));
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

  const sortDirForArrows: "asc" | "desc" = sortDir === "ASC" ? "asc" : "desc";

  /* =========================
     CREATE
  ========================= */
  const openCreateModal = useCallback(async () => {
    if (!canAdmin) return;

    setPageErr(null);
    setModalErr(null);
    setCreatingOpenLoading(true);

    try {
      await ensurePermissionsCatalog();
      setCreateOpen(true);
    } catch (e: any) {
      setPageErr(String(e?.message || "No se pudieron cargar permisos"));
    } finally {
      setCreatingOpenLoading(false);
    }
  }, [canAdmin, ensurePermissionsCatalog]);

  const onCreateSubmit = useCallback(
    async (name: string, selectedPermIds: string[]) => {
      if (!canAdmin) return;

      const clean = name.trim();
      if (!clean) {
        setModalErr("Escribí el nombre del rol.");
        return;
      }

      setCreateSaving(true);
      setModalErr(null);
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
        setModalErr(String(e?.message || "Error creando rol"));
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

      setPageErr(null);
      setModalErr(null);

      const reqId = ++editReqRef.current;
      setEditingRoleId(r.id);

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
        setPageErr(String(e?.message || "No se pudieron cargar permisos del rol"));
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
        setModalErr("El nombre no puede estar vacío.");
        return;
      }

      setEditSaving(true);
      setModalErr(null);

      try {
        if (clean !== target.name) {
          await renameRole(target.id, clean);
        }

        if (!editPermissionsDisabled) {
          await updateRolePermissions(target.id, selectedPermIds);
        }

        setEditOpen(false);
        setTarget(null);

        await loadRoles();
        await refreshMe({ silent: true, force: true } as any);
      } catch (e: any) {
        setModalErr(String(e?.message || "Error guardando cambios"));
      } finally {
        setEditSaving(false);
      }
    },
    [canAdmin, target, loadRoles, refreshMe, editPermissionsDisabled]
  );

  if (!canView) return <div className="p-6">Sin permisos para ver roles.</div>;

  return (
    <TPSectionShell
      title="Roles"
      subtitle="Gestión de roles y permisos."
    >
      {pageErr ? <TPAlert tone="danger">{pageErr}</TPAlert> : null}

      <TPTableKit
        rows={sortedRoles}
        columns={ROLE_COLS}
        storageKey="tptech_col_roles"
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar por nombre…"
        actions={
          canAdmin ? (
            <TPButton
              variant="primary"
              onClick={openCreateModal}
              disabled={creatingOpenLoading}
              loading={creatingOpenLoading}
              iconLeft={!creatingOpenLoading ? <Plus className="h-4 w-4" /> : undefined}
            >
              Nuevo Rol
            </TPButton>
          ) : undefined
        }
        sortKey={sortBy}
        sortDir={sortDirForArrows}
        onSort={(key) => toggleSort(key as "ROLE" | "TYPE")}
        loading={loading}
        emptyText="No hay roles."
        countLabel={(n) => `${n} ${n === 1 ? "rol" : "roles"}`}
        renderRow={(r) => (
          <RoleRow
            key={r.id}
            r={r}
            canAdmin={canAdmin}
            editingRoleId={editingRoleId}
            onOpenEdit={openEditModal}
            onDelete={onDelete}
          />
        )}
      />

      {/* CREATE */}
      <RoleEditorModal
        open={createOpen}
        title="Nuevo Rol"
        initialName=""
        allPerms={allPerms}
        initialSelectedIds={[]}
        loadingPerms={permsLoading}
        saving={createSaving}
        submitLabel="Crear"
        nameInputRef={createNameRef}
        errorMsg={modalErr}
        onClose={() => {
          setCreateOpen(false);
          setModalErr(null);
        }}
        onSubmit={onCreateSubmit}
      />

      {/* EDIT */}
      <RoleEditorModal
        open={editOpen}
        title={`Editar rol${target ? `: ${roleLabel(target)}` : ""}`}
        initialName={editInitialName}
        allPerms={allPerms}
        initialSelectedIds={editInitialPermIds}
        loadingPerms={permsLoading}
        saving={editSaving}
        submitLabel="Guardar"
        nameInputRef={editNameRef}
        permissionsDisabled={editPermissionsDisabled}
        errorMsg={modalErr}
        onClose={() => {
          setEditOpen(false);
          setTarget(null);
          setModalErr(null);
        }}
        onSubmit={onEditSubmit}
      />

      <ConfirmDeleteDialog {...dialogProps} />
    </TPSectionShell>
  );
}