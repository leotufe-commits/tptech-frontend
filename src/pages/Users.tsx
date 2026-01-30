// tptech-frontend/src/pages/Users.tsx
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useAuth } from "../context/AuthContext";
import { useInventory } from "../context/InventoryContext";

import {
  cn,
  normalizeUsersResponse,
  assertImageFile,
  getErrorMessage,
  ROLE_LABEL,
  type TabKey,
} from "../components/users/users.ui";

import { Modal } from "../components/ui/Modal";
import UsersTable from "../components/users/UsersTable";
import UserEditModal from "../components/users/UserEditModal";

import {
  getRolesCached,
  getPermsCached,
  prefetchUserDetail,
  invalidateUserDetail,
  uploadUserAttachmentsInstant,
  deleteUserAttachmentInstant,
  setUserQuickPinEnabledAdmin,
  removeUserQuickPinAdmin,
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
  type Role,
  type UserListItem,
  type Override,
  type UserDetail,
  type OverrideEffect,
  type UserAttachment,
} from "../services/users";

import type { Permission } from "../services/permissions";

/** ✅ flag para “abrir modal y scrollear a Adjuntos” */
const OPEN_USERS_ATTACHMENTS_KEY = "tptech_users_open_attachments_v1";

export default function UsersPage() {
  const auth = useAuth();
  const me = (auth.user ?? null) as { id: string } | null;
  const permissions: string[] = (auth.permissions ?? []) as string[];

  const canView = permissions.includes("USERS_ROLES:VIEW") || permissions.includes("USERS_ROLES:ADMIN");
  const canEditStatus = permissions.includes("USERS_ROLES:EDIT") || permissions.includes("USERS_ROLES:ADMIN");
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

  // ✅ limpieza dura del avatar para que NO quede “en memoria” al cancelar/cerrar
  function clearAvatarState() {
    setAvatarPreview((prev) => {
      try {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      } catch {}
      return "";
    });
    setAvatarImgLoading(false);
    setAvatarFileDraft(null);

    try {
      if (avatarInputModalRef.current) avatarInputModalRef.current.value = "";
    } catch {}
  }

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

  const ownerRoleId = useMemo(() => {
    const r =
      roles.find((x: any) => String((x as any)?.code || "").toUpperCase() === "OWNER") ||
      roles.find((x: any) => String((x as any)?.name || "").toUpperCase() === "OWNER");
    return r ? String((r as any).id) : null;
  }, [roles]);

  function roleLabel(r: Partial<Role> & { code?: string }) {
    const fromCatalog = (r as any)?.id ? roleById.get(String((r as any).id)) : null;
    const base: any = fromCatalog ?? r;

    const display = String((base as any)?.displayName || "").trim();
    if (display) return display;

    const name = String(base?.name || "").trim();
    if (name) return name;

    const code = String((base as any)?.code || "").toUpperCase().trim();
    return (ROLE_LABEL as any)[code] || code || "Rol";
  }

  // delete confirmation
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [modalBusy, setModalBusy] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const [targetId, setTargetId] = useState<string>("");
  const [detail, setDetail] = useState<UserDetail | null>(null);

  const [tab, setTab] = useState<TabKey>("DATA");

  const isSelfEditing = Boolean(
    modalOpen && modalMode === "EDIT" && targetId && me?.id && String(targetId) === String(me.id)
  );

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

  /* =========================
     ✅ PIN (admin) - DRAFT
     - Se aplica al backend SOLO en Guardar
  ========================= */
  const [pinNew, setPinNew] = useState("");
  const [pinNew2, setPinNew2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  // ✅ draft: enabled / remove / clearOverridesOnSave
  const [pinEnabledDraft, setPinEnabledDraft] = useState<boolean | null>(null); // null = sin cambios
  const [pinRemoveDraft, setPinRemoveDraft] = useState(false);
  const [pinClearOverridesOnSave, setPinClearOverridesOnSave] = useState(false);

  function resetPinForm() {
    setPinNew("");
    setPinNew2("");
  }

  // ✅ PIN: mensaje dentro del modal (autolimpia)
  const pinMsgTimerRef = useRef<number | null>(null);

  function flashPinMsg(msg: string, ms = 2500) {
    setPinMsg(msg);
    if (pinMsgTimerRef.current) window.clearTimeout(pinMsgTimerRef.current);
    pinMsgTimerRef.current = window.setTimeout(() => {
      setPinMsg(null);
      pinMsgTimerRef.current = null;
    }, ms);
  }

  useEffect(() => {
    return () => {
      if (pinMsgTimerRef.current) window.clearTimeout(pinMsgTimerRef.current);
    };
  }, []);

  function assertPin4Local(pin: string) {
    const s = String(pin ?? "").trim();
    if (!/^\d{4}$/.test(s)) throw new Error("El PIN debe tener 4 dígitos.");
    return s;
  }

  /**
   * ✅ Refresca el detail sin pisar el formulario (clave para que no “desaparezcan” cambios
   * cuando subís adjuntos o cambiás avatar).
   *
   * ⚠️ OJO: no tocamos drafts de PIN (pinEnabledDraft/pinRemoveDraft/...) porque ahora
   * son “pendientes hasta Guardar”.
   */
  async function refreshDetailOnly(userId: string, opts?: { hydrate?: boolean }) {
    invalidateUserDetail(userId);
    const refreshed = await prefetchUserDetail(userId);
    if (!refreshed) return refreshed;

    // 🔁 siempre sincronizamos permisos especiales (detail -> draft inicial)
    // (pero si el usuario ya tocó el draft mientras el modal está abierto,
    // no llamamos refreshDetailOnly con hydrate true salvo al abrir)
    const ov = (refreshed.permissionOverrides ?? []) as Override[];
    setSpecialList(ov);
    setSpecialEnabledState(ov.length > 0);

    if (opts?.hydrate === false) {
      setDetail(refreshed);
      return refreshed;
    }

    hydrateFromDetail(refreshed);
    return refreshed;
  }

  async function refreshDetailAndList(userId: string, opts?: { hydrate?: boolean }) {
    await refreshDetailOnly(userId, opts);
    await load();
  }

  /**
   * ✅ DRAFT handlers (antes pegaban al backend)
   * - Mantengo las mismas props para no romper UserEditModal.
   */
  async function adminSetOrResetPin() {
    if (!canAdmin) return;
    if (isSelfEditing) return;
    if (modalMode !== "EDIT" && modalMode !== "CREATE") return;

    setPinMsg(null);

    // permitimos armar el draft sin backend
    let p1 = "";
    let p2 = "";
    try {
      p1 = assertPin4Local(pinNew);
      p2 = assertPin4Local(pinNew2);
    } catch (e: any) {
      flashPinMsg(e?.message || "PIN inválido.");
      return;
    }

    if (p1 !== p2) {
      flashPinMsg("Los PIN no coinciden.");
      return;
    }

    // si el usuario está creando/cambiando PIN, por defecto lo dejamos habilitado
    if (pinEnabledDraft === null) setPinEnabledDraft(true);

    // si estaba marcado para borrar, lo desmarcamos
    if (pinRemoveDraft) setPinRemoveDraft(false);

    flashPinMsg("PIN listo para aplicar al guardar.", 3000);
  }

  async function adminRemovePin(opts?: { confirmRemoveOverrides?: boolean }) {
    if (!canAdmin) return;
    if (isSelfEditing) return;
    if (modalMode !== "EDIT" || !targetId) return;

    // draft remove
    setPinRemoveDraft(true);
    setPinEnabledDraft(false);

    if (opts?.confirmRemoveOverrides) {
      setPinClearOverridesOnSave(true);
      // dejamos el draft de especiales limpio (la confirmación ya se mostró en el modal)
      setSpecialPermPick("");
      setSpecialEffectPick("ALLOW");
      setSpecialEnabledState(false);
      setSpecialList([]);
    }

    flashPinMsg("Se eliminará el PIN al guardar.", 3000);
  }

  async function adminTogglePinEnabled(nextEnabled: boolean, opts?: { confirmRemoveOverrides?: boolean }) {
    if (!canAdmin) return;
    if (isSelfEditing) return;
    if (modalMode !== "EDIT" || !targetId) return;

    setPinEnabledDraft(nextEnabled);

    // si habilita, no tiene sentido mantener “remove”
    if (nextEnabled && pinRemoveDraft) setPinRemoveDraft(false);

    if (!nextEnabled && opts?.confirmRemoveOverrides) {
      setPinClearOverridesOnSave(true);
      // limpiar draft permisos especiales (porque al guardar se van a borrar)
      setSpecialPermPick("");
      setSpecialEffectPick("ALLOW");
      setSpecialEnabledState(false);
      setSpecialList([]);
    }

    flashPinMsg(nextEnabled ? "Cambio pendiente: PIN se habilitará al guardar." : "Cambio pendiente: PIN se deshabilitará al guardar.", 2500);
  }

  // special perms (DRAFT)
  const [specialEnabled, setSpecialEnabledState] = useState(false);
  const [specialPermPick, setSpecialPermPick] = useState<string>("");
  const [specialEffectPick, setSpecialEffectPick] = useState<OverrideEffect>("ALLOW");
  const [specialList, setSpecialList] = useState<Override[]>([]);
  const [specialSaving, setSpecialSaving] = useState(false); // ahora solo para “guardando” en saveModal

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
      setUsers(sortUsersAlpha(rawUsers));
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
    setSpecialEnabledState(false);

    clearAvatarState();

    setUploadingAttachments(false);
    setDeletingAttId(null);
    setAttachmentsDraft([]);

    // PIN drafts reset
    resetPinForm();
    setPinBusy(false);
    setPinMsg(null);
    setPinEnabledDraft(null);
    setPinRemoveDraft(false);
    setPinClearOverridesOnSave(false);

    if (pinMsgTimerRef.current) {
      window.clearTimeout(pinMsgTimerRef.current);
      pinMsgTimerRef.current = null;
    }

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
    setSpecialEnabledState(ov.length > 0);

    // PIN drafts: al abrir, no hay cambios pendientes
    setPinEnabledDraft(null);
    setPinRemoveDraft(false);
    setPinClearOverridesOnSave(false);
    resetPinForm();
    setPinMsg(null);
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
      setSpecialEnabledState(false);
      setTab("DATA");

      setPinNew("");
      setPinNew2("");
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

      // ✅ carga inicial: sí hidratamos (llenar form)
      await refreshDetailOnly(u.id, { hydrate: true });

      setSpecialPermPick(perms[0]?.id || "");
      setSpecialEffectPick("ALLOW");

      try {
        const raw = sessionStorage.getItem(OPEN_USERS_ATTACHMENTS_KEY);
        if (raw) {
          const j = JSON.parse(raw);
          if (j?.userId && String(j.userId) === String(u.id)) setTab("DATA");
          else setTab("DATA");
        } else {
          setTab("DATA");
        }
      } catch {
        setTab("DATA");
      }
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error cargando usuario"));
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  }

  async function closeModal() {
    if (modalBusy || avatarBusy || specialSaving || uploadingAttachments || deletingAttId || pinBusy) return;

    clearAvatarState();
    setAttachmentsDraft([]);
    setErr(null);

    setModalOpen(false);
    resetForm();
  }

  function isOwnerInDraft() {
    if (!ownerRoleId) return false;
    return fRoleIds.includes(String(ownerRoleId));
  }

  function computeOverrideDiff(
    prev: Override[],
    nextEnabled: boolean,
    next: Override[]
  ): { toRemove: string[]; toUpsert: Array<{ permissionId: string; effect: OverrideEffect }> } {
    const prevMap = new Map<string, OverrideEffect>();
    for (const ov of prev || []) {
      const pid = String(ov.permissionId);
      if (!pid) continue;
      prevMap.set(pid, ov.effect);
    }

    const nextMap = new Map<string, OverrideEffect>();
    if (nextEnabled) {
      for (const ov of next || []) {
        const pid = String(ov.permissionId);
        if (!pid) continue;
        nextMap.set(pid, ov.effect);
      }
    }

    const toRemove: string[] = [];
    for (const [pid] of prevMap) {
      if (!nextEnabled || !nextMap.has(pid)) toRemove.push(pid);
    }

    const toUpsert: Array<{ permissionId: string; effect: OverrideEffect }> = [];
    if (nextEnabled) {
      for (const [pid, eff] of nextMap) {
        const prevEff = prevMap.get(pid);
        if (!prevEff || prevEff !== eff) {
          toUpsert.push({ permissionId: pid, effect: eff });
        }
      }
    }

    return { toRemove, toUpsert };
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
    setSpecialSaving(true);
    setPinBusy(true);

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

        // profile extra
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

        if (fFavWarehouseId) {
          await updateFavoriteWarehouseForUser(createdUserId, fFavWarehouseId || null);
        }

        if (avatarFileDraft) {
          assertImageFile(avatarFileDraft);
          await updateUserAvatarForUser(createdUserId, avatarFileDraft);
        }

        if (attachmentsDraft.length) {
          setUploadingAttachments(true);
          try {
            await uploadUserAttachmentsInstant(createdUserId, attachmentsDraft);
            setAttachmentsDraft([]);
          } finally {
            setUploadingAttachments(false);
          }
        }

        // ✅ PIN inicial (solo si el usuario lo “marcó” con el botón y es válido)
        try {
          const p1 = String(pinNew || "").trim();
          const p2 = String(pinNew2 || "").trim();
          if (p1 && p1 === p2 && /^\d{4}$/.test(p1)) {
            await setUserQuickPin(createdUserId, p1);
            // si no tocó pills, por defecto lo habilitamos al crear PIN
            const enabled = pinEnabledDraft ?? true;
            await setUserQuickPinEnabledAdmin(createdUserId, enabled);
          }
        } catch (ePin: unknown) {
          setErr(getErrorMessage(ePin, "No se pudo configurar el PIN inicial."));
        }

        // ✅ overrides (draft) al final
        const ownerNow = ownerRoleId ? fRoleIds.includes(String(ownerRoleId)) : false;
        if (!ownerNow && specialEnabled && specialList.length) {
          for (const ov of specialList) {
            await setUserOverride(createdUserId, ov.permissionId, ov.effect);
          }
        }

        setModalOpen(false);
        resetForm();
        await load({ page: 1 });
      } else {
        if (!targetId) throw new Error("Falta ID de usuario.");

        // profile
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

        if (!isSelfEditing) {
          await assignRolesToUser(targetId, fRoleIds);
          await updateFavoriteWarehouseForUser(targetId, fFavWarehouseId ? fFavWarehouseId : null);
        }

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

        // ✅ OVERRIDES (DRAFT -> backend) + regla: si se vuelve OWNER, limpiar overrides
        if (!isSelfEditing) {
          const prevOverrides = ((detail?.permissionOverrides ?? []) as Override[]) || [];
          const ownerNow = isOwnerInDraft();

          // si se confirmó que PIN va a borrar overrides, forzamos limpieza
          const overridesEnabledNext = !ownerNow && !pinClearOverridesOnSave && specialEnabled;

          const nextOverrides = overridesEnabledNext ? specialList : [];
          const diff = computeOverrideDiff(prevOverrides, overridesEnabledNext, nextOverrides);

          // primero removemos
          for (const pid of diff.toRemove) {
            await removeUserOverride(targetId, pid);
          }

          // luego upsert
          for (const it of diff.toUpsert) {
            await setUserOverride(targetId, it.permissionId, it.effect);
          }
        }

        // ✅ PIN (DRAFT -> backend)
        if (!isSelfEditing) {
          // Si pidió borrar PIN, lo hacemos y listo
          if (pinRemoveDraft) {
            await removeUserQuickPinAdmin(targetId, { confirmRemoveOverrides: pinClearOverridesOnSave });
          } else {
            // Si setearon nuevo PIN, lo seteamos
            const p1Raw = String(pinNew || "").trim();
            const p2Raw = String(pinNew2 || "").trim();

            const hasPinDraft = Boolean(p1Raw || p2Raw);

            if (hasPinDraft) {
              const p1 = assertPin4Local(p1Raw);
              const p2 = assertPin4Local(p2Raw);
              if (p1 !== p2) throw new Error("Los PIN no coinciden.");

              await setUserQuickPin(targetId, p1);

              // si no tocaron pills, al setear PIN por defecto lo habilitamos
              const enabled = pinEnabledDraft ?? true;
              await setUserQuickPinEnabledAdmin(targetId, enabled);
            } else if (pinEnabledDraft !== null) {
              // solo toggle enabled
              await setUserQuickPinEnabledAdmin(targetId, pinEnabledDraft, { confirmRemoveOverrides: pinClearOverridesOnSave });
            }
          }
        }

        await refreshDetailAndList(targetId, { hydrate: false });

        setModalOpen(false);
        resetForm();
      }
    } catch (e2: unknown) {
      setErr(getErrorMessage(e2, "Error guardando usuario"));
    } finally {
      setModalBusy(false);
      setSpecialSaving(false);
      setPinBusy(false);
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

      // ✅ sigue siendo “instantáneo” (como lo tenías)
      setAvatarBusy(true);
      await updateUserAvatarForUser(targetId, file);
      setAvatarFileDraft(null);

      await refreshDetailOnly(targetId, { hydrate: false });

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
      await refreshDetailOnly(targetId, { hydrate: false });
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error quitando avatar"));
    } finally {
      setAvatarBusy(false);
    }
  }

  // ✅ permisos especiales ahora 100% draft (no backend)
  async function addOrUpdateSpecial() {
    if (!canAdmin) return;
    if (!specialEnabled) return;
    if (!specialPermPick) return;

    if (isSelfEditing) {
      setErr("No podés editar permisos especiales en tu propio usuario.");
      return;
    }

    // draft (CREATE/EDIT igual)
    setSpecialList((prev) => {
      const next = prev.filter((x) => x.permissionId !== specialPermPick);
      next.push({ permissionId: specialPermPick, effect: specialEffectPick });
      return next;
    });
  }

  async function removeSpecial(permissionId: string) {
    if (!canAdmin) return;

    if (isSelfEditing) {
      setErr("No podés editar permisos especiales en tu propio usuario.");
      return;
    }

    setSpecialList((prev) => prev.filter((x) => x.permissionId !== permissionId));
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

      await refreshDetailOnly(targetId, { hydrate: false });
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

    setDetail((prev) => {
      if (!prev) return prev;
      const cur = Array.isArray((prev as any).attachments) ? ((prev as any).attachments as any[]) : [];
      return {
        ...(prev as any),
        attachments: cur.filter((a) => String(a?.id) !== String(attId)),
      } as any;
    });

    try {
      await deleteUserAttachmentInstant(targetId, attId);

      await refreshDetailOnly(targetId, { hydrate: false });
      await load();
    } catch (e: unknown) {
      try {
        await refreshDetailOnly(targetId, { hydrate: false });
      } catch {}
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
        <p className="text-sm text-muted">Gestión de usuarios, roles, permisos especiales, avatar, adjuntos y almacén favorito.</p>

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

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">{err}</div>}

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
        isSelfEditing={isSelfEditing}
        detail={detail}
        tab={tab}
        setTab={setTab}
        // fields
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
        // avatar
        avatarBusy={avatarBusy}
        avatarImgLoading={avatarImgLoading}
        setAvatarImgLoading={setAvatarImgLoading}
        avatarPreview={avatarPreview}
        setAvatarPreview={setAvatarPreview}
        avatarInputModalRef={avatarInputModalRef}
        pickAvatarForModal={pickAvatarForModal}
        modalRemoveAvatar={modalRemoveAvatar}
        setAvatarFileDraft={setAvatarFileDraft}
        // attachments
        attInputRef={attInputRef}
        uploadingAttachments={uploadingAttachments}
        deletingAttId={deletingAttId}
        attachmentsDraft={attachmentsDraft}
        removeDraftAttachmentByIndex={removeDraftAttachmentByIndex}
        addAttachments={addAttachments}
        removeSavedAttachment={removeSavedAttachment}
        savedAttachments={savedAttachments}
        // pin (draft handlers)
        pinBusy={pinBusy}
        pinMsg={pinMsg}
        pinNew={pinNew}
        setPinNew={setPinNew}
        pinNew2={pinNew2}
        setPinNew2={setPinNew2}
        adminTogglePinEnabled={adminTogglePinEnabled}
        adminSetOrResetPin={adminSetOrResetPin}
        adminRemovePin={adminRemovePin}
        // warehouse
        fFavWarehouseId={fFavWarehouseId}
        setFFavWarehouseId={setFFavWarehouseId}
        activeAlmacenes={activeAlmacenes}
        warehouseLabelById={warehouseLabelById}
        // roles
        roles={roles}
        rolesLoading={rolesLoading}
        fRoleIds={fRoleIds}
        setFRoleIds={setFRoleIds}
        roleLabel={roleLabel}
        // perms
        allPerms={allPerms}
        permsLoading={permsLoading}
        // ✅ special perms (draft handlers)
        specialEnabled={specialEnabled}
        setSpecialEnabled={(v) => {
          if (isSelfEditing) {
            setErr("No podés editar permisos especiales en tu propio usuario.");
            return;
          }
          setSpecialEnabledState(v);
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
            Vas a eliminar (soft delete) a: <span className="font-semibold">{deleteTarget?.email}</span>
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

            <button className={cn("tp-btn", deleteBusy && "opacity-60")} type="button" disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleteBusy ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
