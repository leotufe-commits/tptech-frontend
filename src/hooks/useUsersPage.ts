// tptech-frontend/src/hooks/useUsersPage.ts
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

import {
  getRolesCached,
  getPermsCached,
  prefetchUserDetail,
  invalidateUserDetail,
  uploadUserAttachmentsInstant,
  deleteUserAttachmentInstant,
  setUserQuickPinEnabledAdmin,
  removeUserQuickPinAdmin,
  setMyQuickPin,
  removeMyQuickPin,
  setUserQuickPinAdmin,
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
  type Role,
  type UserListItem,
  type Override,
  type UserDetail,
  type OverrideEffect,
  type UserAttachment,
} from "../services/users";

import type { Permission } from "../services/permissions";
import { LS_TOKEN_KEY, SS_TOKEN_KEY } from "../lib/api";
import { absUrl } from "../lib/url";

/** ✅ flag para “abrir modal y scrollear a Adjuntos” */
const OPEN_USERS_ATTACHMENTS_KEY = "tptech_users_open_attachments_v1";
/** ✅ evento que ya escucha UsersTable.tsx */
const PIN_EVENT = "tptech:user-pin-updated";

/** ✅ evento que escucha Sidebar.tsx */
const USER_AVATAR_EVENT = "tptech:user_avatar_changed";

function emitUserAvatarChanged(args: { userId: string; avatarUrl: string | null | undefined }) {
  try {
    window.dispatchEvent(
      new CustomEvent(USER_AVATAR_EVENT, {
        detail: {
          userId: String(args.userId || ""),
          avatarUrl: args.avatarUrl ?? "",
        },
      })
    );
  } catch {}
}

function parseTabParam(v: string | null): TabKey | null {
  const s = String(v || "").trim().toUpperCase();
  if (s === "DATA") return "DATA";
  if (s === "CONFIG") return "CONFIG";
  return null;
}

function parsePinAction(v: string | null): "create" | null {
  const s = String(v || "").trim().toLowerCase();
  if (s === "create" || s === "new" || s === "set" || s === "1" || s === "true") return "create";
  return null;
}

function stableJson(v: any) {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

function draftKey(f: File) {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

function getAccessToken() {
  return sessionStorage.getItem(SS_TOKEN_KEY) || localStorage.getItem(LS_TOKEN_KEY) || "";
}

function filenameFromContentDisposition(cd: string | null, fallback: string) {
  if (!cd) return fallback;

  const mStar = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (mStar?.[1]) {
    try {
      return decodeURIComponent(mStar[1]).replace(/["\r\n]/g, "");
    } catch {}
  }

  const m = cd.match(/filename\s*=\s*"([^"]+)"/i) || cd.match(/filename\s*=\s*([^;]+)/i);
  const name = (m?.[1] || "").trim().replace(/["\r\n]/g, "");
  return name || fallback;
}

export function useUsersPage() {
  const nav = useNavigate();
  const location = useLocation();

  /* ============================================================
     ✅ RETURN TO (volver a pantalla anterior)
  ============================================================ */
  const returnToRef = useRef<string | null>(null);

  useEffect(() => {
    const st = (location.state as any) || null;
    const fromState = st?.returnTo ? String(st.returnTo) : "";

    const qs = new URLSearchParams(location.search);
    const fromQuery = qs.get("returnTo") ? String(qs.get("returnTo") || "") : "";

    const rt = (fromState || fromQuery || "").trim();
    if (rt) returnToRef.current = rt;
  }, [location.state, location.search]);

  function goBackIfReturnTo() {
    const rt = String(returnToRef.current || "").trim();
    if (!rt) return false;

    if (!rt.startsWith("/")) {
      returnToRef.current = null;
      return false;
    }

    returnToRef.current = null;
    nav(rt, { replace: true, state: null as any });
    return true;
  }

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
  const [autoOpenPinFlow, setAutoOpenPinFlow] = useState(false);

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
     ✅ PIN (admin/self)
  ========================= */
  const [pinNew, setPinNew] = useState("");
  const [pinNew2, setPinNew2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [pinClearOverridesOnSave, setPinClearOverridesOnSave] = useState(false);

  function resetPinForm() {
    setPinNew("");
    setPinNew2("");
  }

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

  // special perms (DRAFT)
  const [specialEnabled, setSpecialEnabledState] = useState(false);
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

  /* =========================
     ✅ DIRTY CHECK
  ========================= */
  const [confirmUnsavedOpen, setConfirmUnsavedOpen] = useState(false);
  const initialSnapshotRef = useRef<string>("");
  const snapshotReadyRef = useRef(false);

  function buildDraftSnapshot() {
    const roleIdsSorted = [...(fRoleIds ?? [])].map(String).sort();
    const specialSorted = [...(specialList ?? [])]
      .map((x) => ({ permissionId: String(x.permissionId), effect: x.effect }))
      .sort((a, b) => a.permissionId.localeCompare(b.permissionId, "es"));

    const attDraftKeys = (attachmentsDraft ?? []).map(draftKey).sort();
    const hasUnsavedAvatar = modalMode === "CREATE" ? Boolean(avatarFileDraft) : false;

    return {
      modalMode,
      fEmail: String(fEmail ?? ""),
      fName: String(fName ?? ""),
      fPassword: String(fPassword ?? ""),
      fPhoneCountry: String(fPhoneCountry ?? ""),
      fPhoneNumber: String(fPhoneNumber ?? ""),
      fDocType: String(fDocType ?? ""),
      fDocNumber: String(fDocNumber ?? ""),
      fStreet: String(fStreet ?? ""),
      fNumber: String(fNumber ?? ""),
      fCity: String(fCity ?? ""),
      fProvince: String(fProvince ?? ""),
      fPostalCode: String(fPostalCode ?? ""),
      fCountry: String(fCountry ?? ""),
      fNotes: String(fNotes ?? ""),
      fRoleIds: roleIdsSorted,
      fFavWarehouseId: String(fFavWarehouseId ?? ""),
      specialEnabled: Boolean(specialEnabled),
      specialList: specialEnabled ? specialSorted : [],
      pinNew: String(pinNew ?? ""),
      pinNew2: String(pinNew2 ?? ""),
      pinClearOverridesOnSave: Boolean(pinClearOverridesOnSave),
      attachmentsDraft: modalMode === "CREATE" ? attDraftKeys : [],
      avatarDraft: hasUnsavedAvatar ? "1" : "0",
    };
  }

  function markSnapshotClean() {
    initialSnapshotRef.current = stableJson(buildDraftSnapshot());
    snapshotReadyRef.current = true;
  }

  useEffect(() => {
    if (!modalOpen) return;
    if (modalLoading) return;
    if (snapshotReadyRef.current) return;
    if (modalMode === "EDIT" && !(detail as any)?.id) return;

    let raf1 = 0;
    let raf2 = 0;

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        markSnapshotClean();
      });
    });

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, modalLoading, modalMode, (detail as any)?.id]);

  function isDirtyNow() {
    if (!snapshotReadyRef.current) return false;
    const cur = stableJson(buildDraftSnapshot());
    return cur !== initialSnapshotRef.current;
  }

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

      const normalizedUsers = rawUsers.map((u) => ({
        ...(u as any),
        hasQuickPin: Boolean((u as any)?.hasQuickPin),
        pinEnabled:
          typeof (u as any)?.pinEnabled === "boolean"
            ? Boolean((u as any).pinEnabled)
            : Boolean((u as any)?.pinEnabled),
      }));

      setUsers(sortUsersAlpha(normalizedUsers));
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

    resetPinForm();
    setPinBusy(false);
    setPinMsg(null);
    setPinClearOverridesOnSave(false);

    setAutoOpenPinFlow(false);

    if (pinMsgTimerRef.current) {
      window.clearTimeout(pinMsgTimerRef.current);
      pinMsgTimerRef.current = null;
    }

    setTab("DATA");

    initialSnapshotRef.current = "";
    snapshotReadyRef.current = false;
    setConfirmUnsavedOpen(false);
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

    setPinClearOverridesOnSave(false);
    resetPinForm();
    setPinMsg(null);
  }

  async function refreshDetailOnly(userId: string, opts?: { hydrate?: boolean }) {
    invalidateUserDetail(userId);
    const refreshed = await prefetchUserDetail(userId);
    if (!refreshed) return refreshed;

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

  function canManagePinHere() {
    return Boolean(isSelfEditing || canAdmin);
  }

  function emitPinEvent(userId: string, patch: { hasQuickPin?: boolean; pinEnabled?: boolean }) {
    const id = String(userId || "").trim();
    if (!id) return;

    const hasQuickPin = typeof patch?.hasQuickPin === "boolean" ? patch.hasQuickPin : undefined;
    const pinEnabled = typeof patch?.pinEnabled === "boolean" ? patch.pinEnabled : undefined;

    if (hasQuickPin === undefined && pinEnabled === undefined) return;

    try {
      window.dispatchEvent(
        new CustomEvent(PIN_EVENT, {
          detail: {
            userId: id,
            ...(hasQuickPin !== undefined ? { hasQuickPin } : {}),
            ...(pinEnabled !== undefined ? { pinEnabled } : {}),
          },
        })
      );
    } catch {}
  }

  function patchUserInList(userId: string, patch: Partial<UserListItem>) {
    if (!userId) return;

    emitPinEvent(userId, {
      hasQuickPin: typeof (patch as any)?.hasQuickPin === "boolean" ? Boolean((patch as any).hasQuickPin) : undefined,
      pinEnabled: typeof (patch as any)?.pinEnabled === "boolean" ? Boolean((patch as any).pinEnabled) : undefined,
    });

    setUsers((prev) =>
      (prev ?? []).map((u) => {
        if (String(u?.id) !== String(userId)) return u;
        return { ...(u as any), ...(patch as any) };
      })
    );
  }

  async function adminSetOrResetPin(opts?: { currentPin?: string }) {
    if (!canManagePinHere()) return;

    setPinMsg(null);

    if (modalMode === "CREATE") {
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
      flashPinMsg("PIN listo para aplicar al guardar.", 3000);
      return;
    }

    if (modalMode !== "EDIT" || !targetId) return;

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

    setPinBusy(true);
    try {
      if (isSelfEditing) {
        await setMyQuickPin(p1, opts?.currentPin);

        patchUserInList(targetId, {
          hasQuickPin: true,
          pinEnabled: true,
          quickPinUpdatedAt: new Date().toISOString() as any,
        });
        emitPinEvent(targetId, { hasQuickPin: true, pinEnabled: true });

        await refreshDetailOnly(targetId, { hydrate: false });
      } else {
        const rSet = await setUserQuickPinAdmin(targetId, p1);

        const enabledFromResp =
          typeof (rSet as any)?.pinEnabled === "boolean" ? Boolean((rSet as any)?.pinEnabled) : true;

        if (enabledFromResp === false) {
          await setUserQuickPinEnabledAdmin(targetId, true);
        }

        patchUserInList(targetId, {
          hasQuickPin: Boolean((rSet as any)?.hasQuickPin ?? true),
          pinEnabled: Boolean((rSet as any)?.pinEnabled ?? true),
          quickPinUpdatedAt: (rSet as any)?.quickPinUpdatedAt ?? null,
        });

        emitPinEvent(targetId, {
          hasQuickPin: Boolean((rSet as any)?.hasQuickPin ?? true),
          pinEnabled: Boolean((rSet as any)?.pinEnabled ?? true),
        });

        await refreshDetailOnly(targetId, { hydrate: false });
      }

      resetPinForm();
      setPinClearOverridesOnSave(false);
    } catch (e: any) {
      setErr(getErrorMessage(e, "Error configurando PIN"));
    } finally {
      setPinBusy(false);
    }
  }

  async function adminTogglePinEnabled(nextEnabled: boolean, opts?: { confirmRemoveOverrides?: boolean }) {
    if (!canManagePinHere()) return;

    if (isSelfEditing) {
      flashPinMsg("Esta opción no se puede cambiar desde tu propio usuario.", 3000);
      return;
    }

    if (modalMode !== "EDIT" || !targetId) return;

    setPinBusy(true);
    setPinMsg(null);

    try {
      const r = await setUserQuickPinEnabledAdmin(targetId, Boolean(nextEnabled), {
        confirmRemoveOverrides: Boolean(opts?.confirmRemoveOverrides),
      });

      if (opts?.confirmRemoveOverrides) {
        setPinClearOverridesOnSave(false);
        setSpecialPermPick("");
        setSpecialEffectPick("ALLOW");
        setSpecialEnabledState(false);
        setSpecialList([]);
      }

      patchUserInList(targetId, {
        hasQuickPin: Boolean((r as any)?.hasQuickPin),
        pinEnabled: Boolean((r as any)?.pinEnabled),
        quickPinUpdatedAt: (r as any)?.quickPinUpdatedAt ?? null,
      });

      emitPinEvent(targetId, {
        hasQuickPin: Boolean((r as any)?.hasQuickPin),
        pinEnabled: Boolean((r as any)?.pinEnabled),
      });

      await refreshDetailOnly(targetId, { hydrate: false });
      flashPinMsg(nextEnabled ? "PIN habilitado." : "PIN deshabilitado.", 2000);
    } catch (e: any) {
      setErr(getErrorMessage(e, "Error actualizando estado del PIN"));
    } finally {
      setPinBusy(false);
    }
  }

  async function adminRemovePin(opts?: { confirmRemoveOverrides?: boolean; currentPin?: string }) {
    if (!canManagePinHere()) return;

    if (modalMode === "CREATE") {
      resetPinForm();
      setPinClearOverridesOnSave(false);
      flashPinMsg("PIN quitado (pendiente).", 2000);
      return;
    }

    if (modalMode !== "EDIT" || !targetId) return;

    setPinBusy(true);
    setPinMsg(null);

    try {
      if (isSelfEditing) {
        await removeMyQuickPin(opts?.currentPin);

        patchUserInList(targetId, { hasQuickPin: false, pinEnabled: false, quickPinUpdatedAt: null });
        emitPinEvent(targetId, { hasQuickPin: false, pinEnabled: false });

        await refreshDetailOnly(targetId, { hydrate: false });
      } else {
        const r = await removeUserQuickPinAdmin(targetId, {
          confirmRemoveOverrides: Boolean(opts?.confirmRemoveOverrides),
        });

        if (opts?.confirmRemoveOverrides) {
          setPinClearOverridesOnSave(false);
          setSpecialPermPick("");
          setSpecialEffectPick("ALLOW");
          setSpecialEnabledState(false);
          setSpecialList([]);
        }

        patchUserInList(targetId, {
          hasQuickPin: Boolean((r as any)?.hasQuickPin),
          pinEnabled: Boolean((r as any)?.pinEnabled),
          quickPinUpdatedAt: (r as any)?.quickPinUpdatedAt ?? null,
        });

        emitPinEvent(targetId, {
          hasQuickPin: Boolean((r as any)?.hasQuickPin),
          pinEnabled: Boolean((r as any)?.pinEnabled),
        });

        await refreshDetailOnly(targetId, { hydrate: false });
      }

      resetPinForm();
      setPinClearOverridesOnSave(false);
      flashPinMsg("PIN eliminado.", 2000);
    } catch (e: any) {
      setErr(getErrorMessage(e, "Error eliminando PIN"));
    } finally {
      setPinBusy(false);
    }
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

  async function openEditById(userId: string, opts?: { tab?: TabKey; pinAction?: "create" | null }) {
    if (!canAdmin) return;
    if (!userId) return;

    if (modalOpen && modalMode === "EDIT" && String(targetId) === String(userId)) {
      if (opts?.tab) setTab(opts.tab);
      if (opts?.pinAction === "create") setAutoOpenPinFlow(true);
      return;
    }

    setErr(null);
    resetForm();
    setModalMode("EDIT");
    setModalOpen(true);
    setModalLoading(true);

    try {
      await ensureRolesLoaded();
      const perms = await ensurePermsLoaded();

      setTargetId(userId);
      await refreshDetailOnly(userId, { hydrate: true });

      setSpecialPermPick(perms[0]?.id || "");
      setSpecialEffectPick("ALLOW");

      setTab(opts?.tab ?? "DATA");
      setAutoOpenPinFlow(opts?.pinAction === "create");
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error cargando usuario"));
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  }

  // ✅ Listener para LockScreen
  useEffect(() => {
    if (!canView) return;

    function onOpenPinFlow(ev: Event) {
      if (!canAdmin) return;

      const ce = ev as CustomEvent<any>;
      const userId = String(ce?.detail?.userId || "").trim();
      if (!userId) return;

      void openEditById(userId, { tab: "CONFIG", pinAction: "create" });
    }

    window.addEventListener("tptech:open-pin-flow", onOpenPinFlow as any);
    return () => window.removeEventListener("tptech:open-pin-flow", onOpenPinFlow as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, canAdmin, modalOpen, modalMode, targetId]);

  // ✅ leer query param edit y abrir modal
  useEffect(() => {
    if (!canView) return;

    const qs = new URLSearchParams(location.search);
    const editId = String(qs.get("edit") || "").trim();
    if (!editId) return;

    const tabParam = parseTabParam(qs.get("tab"));
    const pinAction = parsePinAction(qs.get("pin"));

    void openEditById(editId, { tab: tabParam ?? undefined, pinAction });

    qs.delete("edit");
    qs.delete("tab");
    qs.delete("pin");

    const next = qs.toString();
    nav(next ? `/configuracion/usuarios?${next}` : `/configuracion/usuarios`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, canView]);

  async function closeModalHard() {
    if (modalBusy || avatarBusy || specialSaving || uploadingAttachments || deletingAttId || pinBusy) return;

    clearAvatarState();
    setAttachmentsDraft([]);
    setErr(null);

    setModalOpen(false);
    resetForm();

    goBackIfReturnTo();
  }

  async function closeModal() {
    if (modalBusy || avatarBusy || specialSaving || uploadingAttachments || deletingAttId || pinBusy) return;

    if (modalOpen && isDirtyNow()) {
      setConfirmUnsavedOpen(true);
      return;
    }

    await closeModalHard();
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

    try {
      if (modalMode === "CREATE") {
        const created = await createUser({
          email: cleanEmail,
          name: cleanName,
          password: fPassword.trim() || undefined,
          roleIds: fRoleIds,
        } as any);

        const createdUserId = String((created as any)?.user?.id || "");
        if (!createdUserId) throw new Error("No se recibió el ID del usuario creado.");

        const warnings: string[] = [];

        const safe = async (label: string, fn: () => Promise<void>) => {
          try {
            await fn();
          } catch (e: unknown) {
            warnings.push(getErrorMessage(e, label));
          }
        };

        await safe("No se pudo guardar el perfil del usuario.", async () => {
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
        });

        if (fFavWarehouseId) {
          await safe("No se pudo guardar el almacén favorito.", async () => {
            await updateFavoriteWarehouseForUser(createdUserId, fFavWarehouseId || null);
          });
        }

        if (avatarFileDraft) {
          await safe("No se pudo subir el avatar.", async () => {
            assertImageFile(avatarFileDraft);
            await updateUserAvatarForUser(createdUserId, avatarFileDraft);
          });
        }

        if (attachmentsDraft.length) {
          await safe("No se pudieron subir los adjuntos.", async () => {
            setUploadingAttachments(true);
            try {
              await uploadUserAttachmentsInstant(createdUserId, attachmentsDraft);
              setAttachmentsDraft([]);
            } finally {
              setUploadingAttachments(false);
            }
          });
        }

        await safe("No se pudo configurar el PIN inicial.", async () => {
          const p1 = String(pinNew || "").trim();
          const p2 = String(pinNew2 || "").trim();
          if (p1 && p1 === p2 && /^\d{4}$/.test(p1)) {
            await setUserQuickPinAdmin(createdUserId, p1);
            await setUserQuickPinEnabledAdmin(createdUserId, true);
            resetPinForm();
          }
        });

        await safe("No se pudieron aplicar permisos especiales.", async () => {
          const ownerNow = ownerRoleId ? fRoleIds.includes(String(ownerRoleId)) : false;
          if (!ownerNow && specialEnabled && specialList.length) {
            for (const ov of specialList) {
              await setUserOverride(createdUserId, ov.permissionId, ov.effect);
            }
          }
        });

        setModalOpen(false);
        resetForm();

        setPage(1);
        await load({ page: 1 });

        if (warnings.length) {
          setErr(`Usuario creado, pero hubo avisos:\n- ${warnings.join("\n- ")}`);
        }

        markSnapshotClean();
        goBackIfReturnTo();
        return;
      }

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

      if (!isSelfEditing) {
        const prevOverrides = ((detail?.permissionOverrides ?? []) as Override[]) || [];
        const ownerNow = isOwnerInDraft();
        const overridesEnabledNext = !ownerNow && !pinClearOverridesOnSave && specialEnabled;

        const nextOverrides = overridesEnabledNext ? specialList : [];
        const diff = computeOverrideDiff(prevOverrides, overridesEnabledNext, nextOverrides);

        for (const pid of diff.toRemove) {
          await removeUserOverride(targetId, pid);
        }
        for (const it of diff.toUpsert) {
          await setUserOverride(targetId, it.permissionId, it.effect);
        }
      }

      await refreshDetailAndList(targetId, { hydrate: false });

      setModalOpen(false);
      resetForm();

      markSnapshotClean();
      goBackIfReturnTo();
    } catch (e2: unknown) {
      setErr(getErrorMessage(e2, "Error guardando usuario"));
    } finally {
      setModalBusy(false);
      setSpecialSaving(false);
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

      setAvatarBusy(true);
      await updateUserAvatarForUser(targetId, file);
      setAvatarFileDraft(null);

      const refreshed = await refreshDetailOnly(targetId, { hydrate: false });

      // ✅ refresca sidebar instantáneo
      emitUserAvatarChanged({
        userId: targetId,
        avatarUrl: String((refreshed as any)?.avatarUrl || ""),
      });

      // opcional: limpiar preview blob (evita quedarse con blob viejo)
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
      const refreshed = await refreshDetailOnly(targetId, { hydrate: false });

      // ✅ refresca sidebar instantáneo
      emitUserAvatarChanged({
        userId: targetId,
        avatarUrl: String((refreshed as any)?.avatarUrl || ""),
      });

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

    if (isSelfEditing) {
      setErr("No podés editar permisos especiales en tu propio usuario.");
      return;
    }

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
    if (!attId) return;

    setDeletingAttId(attId);
    setErr(null);

    // optimista: lo saco del detail
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

  async function handleDownloadSavedAttachment(att: UserAttachment) {
    const userId = String((detail as any)?.id || "");
    const attId = String((att as any)?.id || "");
    if (!userId || !attId) return;

    const token = getAccessToken();
    if (!token) {
      setErr("Sesión expirada. Volvé a iniciar sesión.");
      return;
    }

    const downloadUrl = absUrl(`/users/${encodeURIComponent(userId)}/attachments/${encodeURIComponent(attId)}/download`);

    const resp = await fetch(downloadUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (!resp.ok) {
      let msg = `No se pudo descargar el archivo (${resp.status}).`;
      try {
        const j = await resp.json();
        if ((j as any)?.message) msg = String((j as any).message);
      } catch {}
      throw new Error(msg);
    }

    const blob = await resp.blob();
    const cd = resp.headers.get("content-disposition");
    const fallback = String((att as any)?.filename || "archivo");
    const filename = filenameFromContentDisposition(cd, fallback);

    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const totalLabel = `${total} ${total === 1 ? "Usuario" : "Usuarios"}`;

  const busyClose = modalBusy || avatarBusy || specialSaving || uploadingAttachments || Boolean(deletingAttId) || pinBusy;

  return {
    // utils
    cn,
    returnToRef,
    goBackIfReturnTo,

    // auth
    me,
    permissions,
    canView,
    canEditStatus,
    canAdmin,

    // list
    loading,
    err,
    setErr,
    users,
    totalLabel,
    page,
    setPage,
    totalPages,
    qUI,
    setQUI,

    // modal state
    modalOpen,
    modalMode,
    modalBusy,
    modalLoading,
    detail,
    targetId,
    tab,
    setTab,

    // close + dirty
    confirmUnsavedOpen,
    setConfirmUnsavedOpen,
    busyClose,
    isDirtyNow,
    closeModal,
    closeModalHard,

    // open / save / delete
    openCreate,
    openEdit,
    saveModal,
    askDelete,
    confirmOpen,
    setConfirmOpen,
    deleteBusy,
    deleteTarget,
    setDeleteTarget,
    confirmDelete,

    // roles/perms
    roles,
    rolesLoading,
    roleLabel,
    fRoleIds,
    setFRoleIds,

    allPerms,
    permsLoading,

    // fields
    fEmail,
    setFEmail,
    fName,
    setFName,
    fPassword,
    setFPassword,

    fPhoneCountry,
    setFPhoneCountry,
    fPhoneNumber,
    setFPhoneNumber,
    fDocType,
    setFDocType,
    fDocNumber,
    setFDocNumber,

    fStreet,
    setFStreet,
    fNumber,
    setFNumber,
    fCity,
    setFCity,
    fProvince,
    setFProvince,
    fPostalCode,
    setFPostalCode,
    fCountry,
    setFCountry,

    fNotes,
    setFNotes,

    // warehouse
    fFavWarehouseId,
    setFFavWarehouseId,
    activeAlmacenes,
    warehouseLabelById,

    // avatar
    avatarBusy,
    avatarImgLoading,
    setAvatarImgLoading,
    avatarPreview,
    setAvatarPreview,
    avatarInputModalRef,
    pickAvatarForModal,
    modalRemoveAvatar,
    setAvatarFileDraft,

    // attachments
    attInputRef,
    uploadingAttachments,
    deletingAttId,
    attachmentsDraft,
    removeDraftAttachmentByIndex,
    addAttachments,
    removeSavedAttachment,
    savedAttachments,
    handleDownloadSavedAttachment,

    // status toggle
    toggleStatus,

    // special perms
    specialEnabled,
    setSpecialEnabledState,
    specialPermPick,
    setSpecialPermPick,
    specialEffectPick,
    setSpecialEffectPick,
    specialSaving,
    specialListSorted,
    addOrUpdateSpecial,
    removeSpecial,

    // pin
    pinBusy,
    pinMsg,
    pinNew,
    setPinNew,
    pinNew2,
    setPinNew2,
    adminTogglePinEnabled,
    adminSetOrResetPin,
    adminRemovePin,
    autoOpenPinFlow,
    setAutoOpenPinFlow,

    // self-edit flag
    isSelfEditing,
  };
}
