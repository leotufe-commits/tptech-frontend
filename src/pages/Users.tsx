// tptech-frontend/src/pages/Users.tsx
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useAuth } from "../context/AuthContext";
import { useInventory } from "../context/InventoryContext";

import {
  cn,
  Modal,
  normalizeUsersResponse,
  assertImageFile,
  getErrorMessage,
  ROLE_LABEL,
  type TabKey,
} from "../components/users/users.ui";

import UsersTable from "../components/users/UsersTable";
import UserEditModal from "../components/users/UserEditModal";




import {
  getRolesCached,
  getPermsCached,
  prefetchUserDetail,
  invalidateUserDetail,
  uploadUserAttachmentsInstant,
  deleteUserAttachmentInstant,
} from "../components/users/users.data";

import {
  assignRolesToUser,
  createUser,
  deleteUser,
  fetchUsers,
  removeUserOverride,
  setUserOverride,
  updateUserStatus,
  updateUserAvatarForUser,
  removeAvatarForUser,
  updateFavoriteWarehouseForUser,
  updateUserProfile,
  setUserQuickPin,
  removeUserQuickPin,
  setUserPinEnabled,
  type Role,
  type UserListItem,
  type Override,
  type UserDetail,
  type OverrideEffect,
  type UserAttachment,
} from "../services/users";

import type { Permission } from "../services/permissions";

export default function UsersPage() {
  const auth = useAuth();
  const me = (auth.user ?? null) as { id: string } | null;
  const permissions: string[] = (auth.permissions ?? []) as string[];

  const canView =
    permissions.includes("USERS_ROLES:VIEW") || permissions.includes("USERS_ROLES:ADMIN");
  const canEditStatus =
    permissions.includes("USERS_ROLES:EDIT") || permissions.includes("USERS_ROLES:ADMIN");
  const canAdmin = permissions.includes("USERS_ROLES:ADMIN");

  const inv = useInventory();
  const almacenes = (inv?.almacenes ?? []) as Array<{
    id: string;
    nombre: string;
    codigo: string;
    ubicacion: string;
    isActive?: boolean;
  }>;

  const activeAlmacenes = useMemo(() => {
    const hasIsActive = almacenes.some((a) => typeof a.isActive === "boolean");
    return hasIsActive ? almacenes.filter((a) => a.isActive !== false) : almacenes;
  }, [almacenes]);

  function warehouseLabelById(id?: string | null) {
    if (!id) return null;
    const w = activeAlmacenes.find((x) => x.id === id) || almacenes.find((x) => x.id === id);
    if (!w) return null;
    return `${w.nombre}${w.codigo ? ` (${w.codigo})` : ""}`;
  }

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [qUI, setQUI] = useState("");
  const [q, setQ] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(30);
  const [total, setTotal] = useState(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);

  // avatar (modal)
  const avatarInputModalRef = useRef<HTMLInputElement>(null!);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarImgLoading, setAvatarImgLoading] = useState(false);
  const [avatarFileDraft, setAvatarFileDraft] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const roleById = useMemo(() => {
    const m = new Map<string, Role>();
    for (const r of roles) m.set(String(r.id), r);
    return m;
  }, [roles]);

  function roleLabel(r: Partial<Role> & { code?: string }) {
    const fromCatalog = (r as any)?.id ? roleById.get(String((r as any).id)) : null;
    const base: any = fromCatalog ?? r;

    const display = String(base?.displayName || "").trim();
    if (display) return display;

    const name = String(base?.name || "").trim();
    if (name) return name;

    const code = String(base?.code || "").toUpperCase().trim();
    return ROLE_LABEL[code] || code || "Rol";
  }

  // delete confirmation
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);

  // avatar quick edit (table)
  const [avatarQuickBusyId, setAvatarQuickBusyId] = useState<string | null>(null);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [modalBusy, setModalBusy] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const [targetId, setTargetId] = useState<string>("");
  const [detail, setDetail] = useState<UserDetail | null>(null);

  const [tab, setTab] = useState<TabKey>("DATA");

  // form fields
  const [fEmail, setFEmail] = useState("");
  const [fName, setFName] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fRoleIds, setFRoleIds] = useState<string[]>([]);
  const [fFavWarehouseId, setFFavWarehouseId] = useState<string>("");

  const [fPhoneCountry, setFPhoneCountry] = useState("");
  const [fPhoneNumber, setFPhoneNumber] = useState("");
  const [fDocType, setFDocType] = useState("");
  const [fDocNumber, setFDocNumber] = useState("");

  const [fStreet, setFStreet] = useState("");
  const [fNumber, setFNumber] = useState("");
  const [fCity, setFCity] = useState("");
  const [fProvince, setFProvince] = useState("");
  const [fPostalCode, setFPostalCode] = useState("");
  const [fCountry, setFCountry] = useState("");

  const [fNotes, setFNotes] = useState("");

  // PIN (admin)
  const [pinNew, setPinNew] = useState("");
  const [pinNew2, setPinNew2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  function resetPinForm() {
    setPinNew("");
    setPinNew2("");
  }

  function assertPin4Local(pin: string) {
    const s = String(pin ?? "").trim();
    if (!/^\d{4}$/.test(s)) throw new Error("El PIN debe tener 4 dígitos.");
    return s;
  }

  async function refreshDetailAndList(userId: string) {
    invalidateUserDetail(userId);
    const refreshed = await prefetchUserDetail(userId);
    if (refreshed) hydrateFromDetail(refreshed);
    await load();
  }

  async function adminSetOrResetPin() {
    if (!canAdmin) return;
    if (modalMode !== "EDIT" || !targetId) return;

    setPinMsg(null);

    const p1 = assertPin4Local(pinNew);
    const p2 = assertPin4Local(pinNew2);
    if (p1 !== p2) {
      setPinMsg("Los PIN no coinciden.");
      return;
    }

    setPinBusy(true);
    try {
      await setUserQuickPin(targetId, p1);
      resetPinForm();
      setPinMsg("PIN configurado correctamente.");
      await refreshDetailAndList(targetId);
    } catch (e: unknown) {
      setPinMsg(getErrorMessage(e, "Error configurando el PIN."));
    } finally {
      setPinBusy(false);
    }
  }

  async function adminRemovePin() {
    if (!canAdmin) return;
    if (modalMode !== "EDIT" || !targetId) return;

    setPinMsg(null);
    setPinBusy(true);
    try {
      await removeUserQuickPin(targetId);
      resetPinForm();
      setPinMsg("PIN eliminado / desactivado.");
      await refreshDetailAndList(targetId);
    } catch (e: unknown) {
      setPinMsg(getErrorMessage(e, "Error eliminando el PIN."));
    } finally {
      setPinBusy(false);
    }
  }

  async function adminTogglePinEnabled(nextEnabled: boolean) {
    if (!canAdmin) return;
    if (modalMode !== "EDIT" || !targetId) return;

    setPinMsg(null);
    setPinBusy(true);
    try {
      await setUserPinEnabled(targetId, nextEnabled);
      setPinMsg(nextEnabled ? "PIN habilitado." : "PIN deshabilitado.");
      await refreshDetailAndList(targetId);
    } catch (e: unknown) {
      setPinMsg(getErrorMessage(e, "Error cambiando el estado del PIN."));
    } finally {
      setPinBusy(false);
    }
  }

  // special perms
  const [specialEnabled, setSpecialEnabled] = useState(false);
  const [specialPermPick, setSpecialPermPick] = useState<string>("");
  const [specialEffectPick, setSpecialEffectPick] = useState<OverrideEffect>("ALLOW");
  const [specialList, setSpecialList] = useState<Override[]>([]);
  const [specialSaving, setSpecialSaving] = useState(false);

  // attachments
  const attInputRef = useRef<HTMLInputElement>(null!);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [deletingAttId, setDeletingAttId] = useState<string | null>(null);
  const [attachmentsDraft, setAttachmentsDraft] = useState<File[]>([]);

  const savedAttachments: UserAttachment[] = useMemo(() => {
    const arr = (detail?.attachments ?? []) as UserAttachment[];
    return Array.isArray(arr) ? arr : [];
  }, [detail?.attachments]);

  // debounce search
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setQ(qUI.trim());
      setPage(1);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [qUI]);

  function sortUsersAlpha(list: UserListItem[]) {
    const arr = [...(list ?? [])];
    arr.sort((a, b) => {
      const la = String(a?.name || a?.email || "").trim().toLowerCase();
      const lb = String(b?.name || b?.email || "").trim().toLowerCase();
      return la.localeCompare(lb, "es", { sensitivity: "base" });
    });
    return arr;
  }

  async function load(next?: { q?: string; page?: number }) {
    setErr(null);
    setLoading(true);
    try {
      const resp = await fetchUsers({ q: next?.q ?? q, page: next?.page ?? page, limit } as any);
      const norm = normalizeUsersResponse(resp);

      const rawUsers = (norm.users ?? []) as UserListItem[];
      setUsers(sortUsersAlpha(rawUsers)); // ✅ ordenar alfabéticamente
      setTotal(Number(norm.total ?? 0));
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error cargando usuarios"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, q, page]);

  async function ensureRolesLoaded() {
    if (roles.length > 0) return;
    setRolesLoading(true);
    try {
      const list = await getRolesCached();
      setRoles(list as Role[]);
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error cargando roles"));
    } finally {
      setRolesLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    if (roles.length > 0) return;
    void ensureRolesLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, roles.length]);

  async function ensurePermsLoaded() {
    if (allPerms.length > 0) return allPerms;
    setPermsLoading(true);
    try {
      const list = await getPermsCached();
      setAllPerms(list);
      return list;
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error cargando permisos"));
      return [];
    } finally {
      setPermsLoading(false);
    }
  }

  function labelPerm(permissionId: string) {
    const p = allPerms.find((x) => x.id === permissionId);
    if (!p) return permissionId;
    return `${p.module} • ${p.action}`;
  }

  const specialListSorted = useMemo(() => {
    const arr = [...specialList];
    arr.sort((a, b) => {
      const la = labelPerm(a.permissionId).toLowerCase();
      const lb = labelPerm(b.permissionId).toLowerCase();
      return la.localeCompare(lb, "es");
    });
    return arr;
  }, [specialList, allPerms]);

  function resetForm() {
    setDetail(null);
    setTargetId("");

    setFEmail("");
    setFName("");
    setFPassword("");
    setFRoleIds([]);
    setFFavWarehouseId("");

    setFPhoneCountry("");
    setFPhoneNumber("");
    setFDocType("");
    setFDocNumber("");

    setFStreet("");
    setFNumber("");
    setFCity("");
    setFProvince("");
    setFPostalCode("");
    setFCountry("");

    setFNotes("");

    setSpecialList([]);
    setSpecialPermPick("");
    setSpecialEffectPick("ALLOW");

    setAvatarFileDraft(null);

    setUploadingAttachments(false);
    setDeletingAttId(null);
    setAttachmentsDraft([]);

    resetPinForm();
    setPinBusy(false);
    setPinMsg(null);

    setTab("DATA");
  }

  function hydrateFromDetail(d: UserDetail) {
    setDetail(d);

    setFEmail(d.email ?? "");
    setFName(d.name ?? "");
    setFPassword("");

    setFRoleIds((d.roles ?? []).map((r) => r.id));
    setFFavWarehouseId(d.favoriteWarehouseId ? String(d.favoriteWarehouseId) : "");

    setFPhoneCountry((d as any).phoneCountry ?? "");
    setFPhoneNumber((d as any).phoneNumber ?? "");
    setFDocType((d as any).documentType ?? "");
    setFDocNumber((d as any).documentNumber ?? "");

    setFStreet((d as any).street ?? "");
    setFNumber((d as any).number ?? "");
    setFCity((d as any).city ?? "");
    setFProvince((d as any).province ?? "");
    setFPostalCode((d as any).postalCode ?? "");
    setFCountry((d as any).country ?? "");

    setFNotes((d as any).notes ?? "");

    const ov = (d.permissionOverrides ?? []) as Override[];
    setSpecialList(ov);
    setSpecialEnabled(ov.length > 0);
  }

  async function openCreate() {
    if (!canAdmin) return;

    setErr(null);
    resetForm();
    setModalMode("CREATE");
    setModalOpen(true);
    setModalLoading(true);

    try {
      await ensureRolesLoaded();
      const perms = await ensurePermsLoaded();
      setSpecialPermPick(perms[0]?.id || "");
      setSpecialEffectPick("ALLOW");
      setSpecialEnabled(false);
      setTab("DATA");

      setPinNew("1234");
      setPinNew2("1234");
      setPinMsg(null);
    } finally {
      setModalLoading(false);
    }
  }

  async function openEdit(u: UserListItem) {
    if (!canAdmin) return;

    setErr(null);
    resetForm();
    setModalMode("EDIT");
    setModalOpen(true);
    setModalLoading(true);

    try {
      await ensureRolesLoaded();
      const perms = await ensurePermsLoaded();

      setTargetId(u.id);

      const d = await prefetchUserDetail(u.id);
      if (d) hydrateFromDetail(d);

      setSpecialPermPick(perms[0]?.id || "");
      setSpecialEffectPick("ALLOW");
      setTab("DATA");
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error cargando usuario"));
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  }

  async function closeModal() {
    if (modalBusy || avatarBusy || specialSaving || uploadingAttachments || deletingAttId || pinBusy)
      return;
    setModalOpen(false);
  }

  async function saveModal(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!canAdmin) return;

    setErr(null);

    const cleanEmail = fEmail.trim();
    const cleanName = fName.trim();

    if (!cleanEmail) {
      setErr("Completá el email.");
      setTab("DATA");
      return;
    }
    if (!cleanName) {
      setErr("Nombre y apellido es obligatorio.");
      setTab("DATA");
      return;
    }

    setModalBusy(true);

    try {
      if (modalMode === "CREATE") {
        const created = await createUser({
          email: cleanEmail,
          name: cleanName,
          password: fPassword.trim() || undefined,
          roleIds: fRoleIds,
        } as any);

        const createdUserId = (created as any)?.user?.id;
        if (!createdUserId) throw new Error("No se recibió el ID del usuario creado.");

        // PIN inicial (opcional)
        try {
          const p1 = String(pinNew || "").trim();
          const p2 = String(pinNew2 || "").trim();
          if (p1 && p1 === p2 && /^\d{4}$/.test(p1)) {
            await setUserQuickPin(createdUserId, p1);
            await setUserPinEnabled(createdUserId, true);
          }
        } catch (ePin: unknown) {
          setErr(getErrorMessage(ePin, "No se pudo configurar el PIN inicial."));
        }

        if (fFavWarehouseId) {
          await updateFavoriteWarehouseForUser(createdUserId, fFavWarehouseId || null);
        }

        if (avatarFileDraft) {
          assertImageFile(avatarFileDraft);
          await updateUserAvatarForUser(createdUserId, avatarFileDraft);
        }

        await updateUserProfile(createdUserId, {
          name: cleanName,
          phoneCountry: fPhoneCountry,
          phoneNumber: fPhoneNumber,
          documentType: fDocType,
          documentNumber: fDocNumber,
          street: fStreet,
          number: fNumber,
          city: fCity,
          province: fProvince,
          postalCode: fPostalCode,
          country: fCountry,
          notes: fNotes,
        } as any);

        if (attachmentsDraft.length) {
          setUploadingAttachments(true);
          try {
            await uploadUserAttachmentsInstant(createdUserId, attachmentsDraft);
            setAttachmentsDraft([]);
          } finally {
            setUploadingAttachments(false);
          }
        }

        if (specialEnabled && specialList.length) {
          for (const ov of specialList) {
            await setUserOverride(createdUserId, ov.permissionId, ov.effect);
          }
        }

        setModalOpen(false);
        await load({ page: 1 });
      } else {
        if (!targetId) throw new Error("Falta ID de usuario.");

        await updateUserProfile(targetId, {
          name: cleanName,
          phoneCountry: fPhoneCountry,
          phoneNumber: fPhoneNumber,
          documentType: fDocType,
          documentNumber: fDocNumber,
          street: fStreet,
          number: fNumber,
          city: fCity,
          province: fProvince,
          postalCode: fPostalCode,
          country: fCountry,
          notes: fNotes,
        } as any);

        await assignRolesToUser(targetId, fRoleIds);
        await updateFavoriteWarehouseForUser(targetId, fFavWarehouseId ? fFavWarehouseId : null);

        if (avatarFileDraft) {
          assertImageFile(avatarFileDraft);
          await updateUserAvatarForUser(targetId, avatarFileDraft);
          setAvatarFileDraft(null);
        }

        if (attachmentsDraft.length) {
          setUploadingAttachments(true);
          try {
            await uploadUserAttachmentsInstant(targetId, attachmentsDraft);
            setAttachmentsDraft([]);
          } finally {
            setUploadingAttachments(false);
          }
        }

        await load();

        const refreshed = await prefetchUserDetail(targetId);
        if (refreshed) hydrateFromDetail(refreshed);

        setModalOpen(false);
      }
    } catch (e2: unknown) {
      setErr(getErrorMessage(e2, "Error guardando usuario"));
    } finally {
      setModalBusy(false);
    }
  }

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
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error actualizando estado"));
    }
  }

  function askDelete(u: UserListItem) {
    if (!canAdmin) return;
    if (me?.id && u.id === me.id) {
      setErr("No podés eliminar tu propio usuario.");
      return;
    }
    setErr(null);
    setDeleteTarget(u);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setErr(null);
    try {
      await deleteUser(deleteTarget.id);
      setConfirmOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error eliminando usuario"));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function quickChangeAvatar(userId: string, file: File) {
    if (!canAdmin) return;
    setAvatarQuickBusyId(userId);
    setErr(null);
    try {
      assertImageFile(file);
      await updateUserAvatarForUser(userId, file);
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error subiendo avatar"));
    } finally {
      setAvatarQuickBusyId(null);
    }
  }

  async function pickAvatarForModal(file: File) {
    if (!canAdmin) return;

    try {
      assertImageFile(file);
      setErr(null);

      setAvatarPreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });

      if (modalMode === "CREATE") {
        setAvatarFileDraft(file);
        return;
      }

      if (!targetId) return;

      setAvatarBusy(true);
      await updateUserAvatarForUser(targetId, file);
      setAvatarFileDraft(null);

      const refreshed = await prefetchUserDetail(targetId);
      if (refreshed) hydrateFromDetail(refreshed);

      setAvatarPreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return "";
      });

      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error subiendo avatar"));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function modalRemoveAvatar() {
    if (!canAdmin) return;
    if (modalMode !== "EDIT") return;
    if (!targetId) return;

    setAvatarBusy(true);
    setErr(null);
    try {
      await removeAvatarForUser(targetId);

      const refreshed = await prefetchUserDetail(targetId);
      if (refreshed) hydrateFromDetail(refreshed);

      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error quitando avatar"));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function addOrUpdateSpecial() {
    if (!canAdmin) return;
    if (!specialEnabled) return;
    if (!specialPermPick) return;

    if (modalMode === "CREATE") {
      setSpecialList((prev) => {
        const next = prev.filter((x) => x.permissionId !== specialPermPick);
        next.push({ permissionId: specialPermPick, effect: specialEffectPick });
        return next;
      });
      return;
    }

    if (!targetId) return;

    setSpecialSaving(true);
    setErr(null);
    try {
      await setUserOverride(targetId, specialPermPick, specialEffectPick);
      const refreshed = await prefetchUserDetail(targetId);
      if (refreshed) hydrateFromDetail(refreshed);
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error guardando permiso especial"));
    } finally {
      setSpecialSaving(false);
    }
  }

  async function removeSpecial(permissionId: string) {
    if (!canAdmin) return;

    if (modalMode === "CREATE") {
      setSpecialList((prev) => prev.filter((x) => x.permissionId !== permissionId));
      return;
    }

    if (!targetId) return;

    setSpecialSaving(true);
    setErr(null);
    try {
      await removeUserOverride(targetId, permissionId);
      const refreshed = await prefetchUserDetail(targetId);
      if (refreshed) hydrateFromDetail(refreshed);
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error quitando permiso especial"));
    } finally {
      setSpecialSaving(false);
    }
  }

  async function addAttachments(files: File[]) {
    if (!canAdmin) return;
    if (!files.length) return;

    if (modalMode === "CREATE") {
      setAttachmentsDraft((prev) => [...prev, ...files]);
      return;
    }

    if (!targetId) return;

    setErr(null);
    setUploadingAttachments(true);
    try {
      await uploadUserAttachmentsInstant(targetId, files);

      const refreshed = await prefetchUserDetail(targetId);
      if (refreshed) hydrateFromDetail(refreshed);

      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "No se pudieron subir los adjuntos."));
    } finally {
      setUploadingAttachments(false);
    }
  }

  async function removeSavedAttachment(attId: string) {
    if (!canAdmin) return;
    if (modalMode !== "EDIT") return;
    if (!targetId) return;

    setDeletingAttId(attId);
    setErr(null);
    try {
      await deleteUserAttachmentInstant(targetId, attId);

      const refreshed = await prefetchUserDetail(targetId);
      if (refreshed) hydrateFromDetail(refreshed);

      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "No se pudo eliminar el adjunto."));
    } finally {
      setDeletingAttId(null);
    }
  }

  function removeDraftAttachmentByIndex(idx: number) {
    setAttachmentsDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  if (!canView) return <div className="p-6">Sin permisos para ver usuarios.</div>;

  const totalLabel = `${total} ${total === 1 ? "Usuario" : "Usuarios"}`;

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-0">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted">
          Gestión de usuarios, roles, permisos especiales, avatar, adjuntos y almacén favorito.
        </p>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            className="tp-input md:max-w-md"
            placeholder="Buscar por email / nombre…"
            value={qUI}
            onChange={(e) => setQUI(e.target.value)}
          />

          {canAdmin && (
            <button className="tp-btn-primary" onClick={openCreate} type="button">
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

      <UsersTable
        loading={loading}
        users={users}
        totalLabel={totalLabel}
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        canAdmin={canAdmin}
        canEditStatus={canEditStatus}
        meId={me?.id ?? null}
        roleLabel={roleLabel}
        warehouseLabelById={warehouseLabelById}
        avatarQuickBusyId={avatarQuickBusyId}
        quickChangeAvatar={quickChangeAvatar}
        toggleStatus={toggleStatus}
        openEdit={openEdit}
        askDelete={askDelete}
        prefetchUserDetail={prefetchUserDetail}
      />

      <UserEditModal
        open={modalOpen}
        wide
        modalMode={modalMode}
        modalBusy={modalBusy}
        modalLoading={modalLoading}
        title={modalMode === "CREATE" ? "Crear usuario" : `Editar usuario • ${detail?.email ?? ""}`}
        onClose={closeModal}
        onSubmit={saveModal}
        canAdmin={canAdmin}
        detail={detail}
        tab={tab}
        setTab={setTab}
        fEmail={fEmail}
        setFEmail={setFEmail}
        fName={fName}
        setFName={setFName}
        fPassword={fPassword}
        setFPassword={setFPassword}
        fPhoneCountry={fPhoneCountry}
        setFPhoneCountry={setFPhoneCountry}
        fPhoneNumber={fPhoneNumber}
        setFPhoneNumber={setFPhoneNumber}
        fDocType={fDocType}
        setFDocType={setFDocType}
        fDocNumber={fDocNumber}
        setFDocNumber={setFDocNumber}
        fStreet={fStreet}
        setFStreet={setFStreet}
        fNumber={fNumber}
        setFNumber={setFNumber}
        fCity={fCity}
        setFCity={setFCity}
        fProvince={fProvince}
        setFProvince={setFProvince}
        fPostalCode={fPostalCode}
        setFPostalCode={setFPostalCode}
        fCountry={fCountry}
        setFCountry={setFCountry}
        fNotes={fNotes}
        setFNotes={setFNotes}
        avatarBusy={avatarBusy}
        avatarImgLoading={avatarImgLoading}
        setAvatarImgLoading={setAvatarImgLoading}
        avatarPreview={avatarPreview}
        setAvatarPreview={setAvatarPreview}
        avatarInputModalRef={avatarInputModalRef}
        pickAvatarForModal={pickAvatarForModal}
        modalRemoveAvatar={modalRemoveAvatar}
        setAvatarFileDraft={setAvatarFileDraft}
        attInputRef={attInputRef}
        uploadingAttachments={uploadingAttachments}
        deletingAttId={deletingAttId}
        attachmentsDraft={attachmentsDraft}
        removeDraftAttachmentByIndex={removeDraftAttachmentByIndex}
        addAttachments={addAttachments}
        removeSavedAttachment={removeSavedAttachment}
        savedAttachments={savedAttachments}
        pinBusy={pinBusy}
        pinMsg={pinMsg}
        pinNew={pinNew}
        setPinNew={setPinNew}
        pinNew2={pinNew2}
        setPinNew2={setPinNew2}
        adminTogglePinEnabled={adminTogglePinEnabled}
        adminSetOrResetPin={adminSetOrResetPin}
        adminRemovePin={adminRemovePin}
        fFavWarehouseId={fFavWarehouseId}
        setFFavWarehouseId={setFFavWarehouseId}
        activeAlmacenes={activeAlmacenes}
        warehouseLabelById={warehouseLabelById}
        roles={roles}
        rolesLoading={rolesLoading}
        fRoleIds={fRoleIds}
        setFRoleIds={setFRoleIds}
        roleLabel={roleLabel}
        allPerms={allPerms}
        permsLoading={permsLoading}
        specialEnabled={specialEnabled}
        setSpecialEnabled={(v) => {
          setSpecialEnabled(v);
          if (!v) setSpecialList([]);
        }}
        specialPermPick={specialPermPick}
        setSpecialPermPick={setSpecialPermPick}
        specialEffectPick={specialEffectPick}
        setSpecialEffectPick={setSpecialEffectPick}
        specialSaving={specialSaving}
        specialListSorted={specialListSorted}
        addOrUpdateSpecial={addOrUpdateSpecial}
        removeSpecial={removeSpecial}
      />

      {/* CONFIRM DELETE single */}
      <Modal
        open={confirmOpen}
        title="Eliminar usuario"
        onClose={() => {
          if (deleteBusy) return;
          setConfirmOpen(false);
          setDeleteTarget(null);
        }}
      >
        <div className="space-y-4">
          <div className="text-sm">
            Vas a eliminar (soft delete) a:{" "}
            <span className="font-semibold">{deleteTarget?.email}</span>
            <div className="mt-2 text-xs text-muted">
              - Se bloquea el usuario y se invalida la sesión. <br />
              - Se liberará el email para poder recrearlo. <br />
              - Se limpian roles/permisos especiales y se quita el avatar.
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="tp-btn-secondary"
              type="button"
              disabled={deleteBusy}
              onClick={() => {
                setConfirmOpen(false);
                setDeleteTarget(null);
              }}
            >
              Cancelar
            </button>
            <button
              className={cn("tp-btn", deleteBusy && "opacity-60")}
              type="button"
              disabled={deleteBusy}
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
