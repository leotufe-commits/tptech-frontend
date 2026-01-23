// tptech-frontend/src/pages/Users.tsx
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Loader2,
  Pencil,
  Trash2,
  ShieldBan,
  ShieldCheck,
  ImageUp,
  ImageOff,
  X,
  Paperclip,
  CheckSquare,
  Square,
  KeyRound,
  Shield,
  ShieldOff,
} from "lucide-react";

import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useInventory } from "../context/InventoryContext";
import { TPSegmentedPills } from "../components/ui/TPBadges";

import {
  assignRolesToUser,
  createUser,
  deleteUser,
  fetchUser,
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

import { fetchRoles } from "../services/roles";
import { fetchPermissions, type Permission } from "../services/permissions";

import {
  TPTableWrap,
  TPTableEl,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../components/ui/TPTable";
import { TPUserStatusBadge } from "../components/ui/TPBadges";

/* =========================
   UI helpers
========================= */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}

function Section({
  title,
  desc,
  right,
  children,
}: {
  title: React.ReactNode;
  desc?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="tp-card p-4 w-full">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">{title}</div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
        {desc ? <div className="text-xs text-muted mt-0.5">{desc}</div> : null}
      </div>
      {children}
    </div>
  );
}

function PillSwitch({
  value,
  onChange,
  disabled,
  onDisabledClick,
  labels = { on: "Habilitados", off: "Deshabilitados" },
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
  labels?: { on: string; off: string };
}) {
  const dis = !!disabled;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-bg p-1",
        dis && "opacity-60"
      )}
    >
      <button
        type="button"
        disabled={dis}
        onClick={() => {
          if (dis) return;
          onChange(false);
        }}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-semibold transition",
          !value
            ? "bg-red-500/15 text-red-400 border border-red-500/25"
            : "text-muted hover:bg-surface2",
          dis && "cursor-not-allowed"
        )}
        title={labels.off}
      >
        {labels.off}
      </button>

      <button
        type="button"
        disabled={dis}
        onClick={() => {
          if (dis) return;
          onChange(true);
        }}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-semibold transition",
          value
            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
            : "text-muted hover:bg-surface2",
          dis && "cursor-not-allowed"
        )}
        title={labels.on}
      >
        {labels.on}
      </button>

      {/* Si está deshabilitado pero querés que el click muestre un aviso/navegue */}
      {dis && onDisabledClick ? (
        <button
          type="button"
          className="ml-1 px-2 py-1 rounded-full text-[11px] text-muted hover:bg-surface2"
          onClick={onDisabledClick}
          title="Ver motivo"
        >
          ?
        </button>
      ) : null}
    </div>
  );
}


/* =========================
   Modal (scroll)
========================= */
function Modal({
  open,
  title,
  children,
  onClose,
  wide,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className={cn(
          "relative w-full rounded-2xl border border-border bg-card shadow-soft",
          wide ? "max-w-6xl" : "max-w-4xl",
          "max-h-[85vh] flex flex-col"
        )}
      >
        <div className="p-6 pb-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="tp-btn" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        <div className="p-6 pt-4 overflow-y-auto tp-scroll">{children}</div>
      </div>
    </div>
  );
}

function initialsFrom(label: string) {
  const clean = (label || "").trim();
  if (!clean) return "U";
  const parts = clean.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

/* =========================
   Helpers data
========================= */
function normalizeUsersResponse(resp: unknown) {
  const r = resp as any;
  if (r && typeof r === "object" && Array.isArray(r.users)) {
    return {
      users: r.users,
      total: Number(r.total ?? r.users.length ?? 0),
      page: Number(r.page ?? 1),
      limit: Number(r.limit ?? r.users.length ?? 30),
    };
  }
  if (Array.isArray(r)) return { users: r, total: r.length, page: 1, limit: r.length };
  return { users: [], total: 0, page: 1, limit: 30 };
}

function assertImageFile(file: File) {
  if (!file) throw new Error("Seleccioná un archivo");
  if (!file.type?.startsWith("image/")) throw new Error("El archivo debe ser una imagen");

  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) throw new Error("La imagen supera el máximo permitido (5MB)");
}

function getErrorMessage(e: unknown, fallback: string) {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || fallback;
  const maybe = e as { message?: unknown };
  if (typeof maybe?.message === "string") return maybe.message;
  return fallback;
}

/* =========================
   Labels
========================= */
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MANAGER: "Encargado",
  STAFF: "Empleado",
};

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

function permLabelByModuleAction(module?: string, action?: string) {
  const m = String(module || "");
  const a = String(action || "");
  const mLabel = MODULE_LABEL[m] ?? m;
  const aLabel = ACTION_LABEL[a] ?? a;
  return `${mLabel} • ${aLabel}`;
}

function effectLabel(e: OverrideEffect) {
  return e === "ALLOW" ? "Permitir" : "Denegar";
}

/* =========================
   Adjuntos helpers
========================= */
function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function safeFileLabel(name: string) {
  return String(name || "").trim() || "Archivo";
}

function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const API = base.replace(/\/+$/, "");
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API}${p}`;
}

async function uploadUserAttachmentsInstant(userId: string, files: File[]) {
  const arr = files ?? [];
  if (!userId || arr.length === 0) return;

  const MAX = 20 * 1024 * 1024; // 20MB por archivo
  const filtered = arr.filter((f) => f.size <= MAX);
  const rejected = arr.filter((f) => f.size > MAX);

  if (filtered.length === 0) {
    const detail = rejected
      .map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`)
      .join(", ");
    throw new Error(
      rejected.length
        ? `No se pudieron adjuntar los archivos: ${detail}. Máximo permitido: 20 MB por archivo.`
        : "No se recibió ningún archivo."
    );
  }

  const fd = new FormData();
  filtered.forEach((f) => fd.append("attachments", f));

  await apiFetch(`/users/${userId}/attachments`, { method: "PUT", body: fd as any });

  return { omitted: rejected.map((x) => x.name) };
}

async function deleteUserAttachmentInstant(userId: string, attachmentId: string) {
  if (!userId || !attachmentId) return;
  await apiFetch(`/users/${userId}/attachments/${attachmentId}`, { method: "DELETE" });
}

/* =========================
   Tabs UI
========================= */
type TabKey = "DATA" | "CONFIG";

function Tabs({ value, onChange }: { value: TabKey; onChange: (v: TabKey) => void }) {
  return (
    <div className="tp-card p-1 flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange("DATA")}
        className={cn(
          "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
          value === "DATA"
            ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]"
            : "hover:bg-surface2"
        )}
      >
        Datos del usuario
      </button>
      <button
        type="button"
        onClick={() => onChange("CONFIG")}
        className={cn(
          "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
          value === "CONFIG"
            ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]"
            : "hover:bg-surface2"
        )}
      >
        Configuración del usuario
      </button>
    </div>
  );
}

/* =========================
   Cache + Prefetch
========================= */
type UserCacheEntry = { ts: number; data: UserDetail };
const USER_TTL_MS = 10_000;

const userDetailCache = new Map<string, UserCacheEntry>();
const userDetailInFlight = new Map<string, Promise<UserDetail>>();

let rolesCache: { ts: number; data: Role[] | null; promise: Promise<Role[]> | null } = {
  ts: 0,
  data: null,
  promise: null,
};
let permsCache: { ts: number; data: Permission[] | null; promise: Promise<Permission[]> | null } = {
  ts: 0,
  data: null,
  promise: null,
};

const ROLES_TTL_MS = 20_000;
const PERMS_TTL_MS = 20_000;

function now() {
  return Date.now();
}

async function getRolesCached() {
  if (rolesCache.data && now() - rolesCache.ts < ROLES_TTL_MS) return rolesCache.data;
  if (rolesCache.promise) return rolesCache.promise;

  rolesCache.promise = (async () => {
    const list = (await fetchRoles()) as Role[];
    rolesCache.data = list;
    rolesCache.ts = now();
    return list;
  })();

  try {
    return await rolesCache.promise;
  } finally {
    rolesCache.promise = null;
  }
}

async function getPermsCached() {
  if (permsCache.data && now() - permsCache.ts < PERMS_TTL_MS) return permsCache.data;
  if (permsCache.promise) return permsCache.promise;

  permsCache.promise = (async () => {
    const list = await fetchPermissions();
    permsCache.data = list;
    permsCache.ts = now();
    return list;
  })();

  try {
    return await permsCache.promise;
  } finally {
    permsCache.promise = null;
  }
}

async function prefetchUserDetail(userId: string) {
  if (!userId) return;

  const cached = userDetailCache.get(userId);
  if (cached && now() - cached.ts < USER_TTL_MS) return cached.data;

  const inflight = userDetailInFlight.get(userId);
  if (inflight) return inflight;

  const p = (async () => {
    const resp = await fetchUser(userId);
    const d: UserDetail = (resp as any)?.user ?? (resp as any);
    userDetailCache.set(userId, { ts: now(), data: d });
    return d;
  })();

  userDetailInFlight.set(userId, p);

  try {
    return await p;
  } finally {
    userDetailInFlight.delete(userId);
  }
}

function invalidateUserDetail(userId: string) {
  if (!userId) return;
  userDetailCache.delete(userId);
  userDetailInFlight.delete(userId);
}

/* =========================
   PAGE
========================= */
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

  // catalog roles/perms
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);

  // avatar (modal) estilo "Datos de la empresa"
  const avatarInputModalRef = useRef<HTMLInputElement | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(""); // blob:
  const [avatarImgLoading, setAvatarImgLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // mapa roles por id para labels consistentes
  const roleById = useMemo(() => {
    const m = new Map<string, Role>();
    for (const r of roles) m.set(String(r.id), r);
    return m;
  }, [roles]);

  // roleLabel final: prioriza nombre editable (name)
  function roleLabel(r: Partial<Role> & { code?: string }) {
    const fromCatalog = (r as any)?.id ? roleById.get(String((r as any).id)) : null;
    const base: any = fromCatalog ?? r;

    const name = String(base?.name || "").trim();
    if (name) return name;

    const display = String(base?.displayName || "").trim();
    if (display) return display;

    const code = String(base?.code || "").toUpperCase().trim();
    return ROLE_LABEL[code] || code || "Rol";
  }

  // acciones masivas
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds]
  );
  const selectedList = useMemo(
    () => Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k),
    [selectedIds]
  );

  // delete confirmation (single)
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);

  // bulk delete confirm
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // avatar quick edit (table)
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarQuickBusyId, setAvatarQuickBusyId] = useState<string | null>(null);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [modalBusy, setModalBusy] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const [targetId, setTargetId] = useState<string>("");
  const [detail, setDetail] = useState<UserDetail | null>(null);

  // tabs
  const [tab, setTab] = useState<TabKey>("DATA");

  // form fields (shared)
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

  // ✅ QUICK PIN (ADMIN UI)
  const [pinNew, setPinNew] = useState("");
  const [pinNew2, setPinNew2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  function resetPinForm() {
    setPinNew("");
    setPinNew2("");
  }

  function pinStatusLabel() {
    const has = Boolean(detail?.hasQuickPin);
    const enabled = Boolean(detail?.pinEnabled);
    if (!has) return { text: "Sin PIN definido", tone: "muted" as const };
    if (enabled) return { text: "PIN activo", tone: "ok" as const };
    return { text: "PIN definido, pero deshabilitado", tone: "warn" as const };
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

  // permisos especiales
  const [specialEnabled, setSpecialEnabled] = useState(false);
  const [specialPermPick, setSpecialPermPick] = useState<string>("");
  const [specialEffectPick, setSpecialEffectPick] = useState<OverrideEffect>("ALLOW");
  const [specialList, setSpecialList] = useState<Override[]>([]);
  const [specialSaving, setSpecialSaving] = useState(false);

  // avatar in modal
  const [avatarFileDraft, setAvatarFileDraft] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // attachments (modal)
  const attInputRef = useRef<HTMLInputElement | null>(null);
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

  async function load(next?: { q?: string; page?: number }) {
    setErr(null);
    setLoading(true);
    try {
      const resp = await fetchUsers({ q: next?.q ?? q, page: next?.page ?? page, limit } as any);
      const norm = normalizeUsersResponse(resp);
      setUsers((norm.users ?? []) as UserListItem[]);
      setTotal(Number(norm.total ?? 0));

      setSelectedIds((prev) => {
        const keep: Record<string, boolean> = {};
        const ids = new Set((norm.users ?? []).map((u: UserListItem) => u.id));
        for (const [k, v] of Object.entries(prev)) {
          if (v && ids.has(k)) keep[k] = true;
        }
        return keep;
      });
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
    return permLabelByModuleAction(p.module, p.action);
  }

// ✅ ORDEN ALFABÉTICO DE PERMISOS ESPECIALES
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

  // ✅ PIN UI reset
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

      // ✅ PIN default al crear usuario
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

        // ✅ PIN inicial
        try {
          const p1 = String(pinNew || "").trim();
          const p2 = String(pinNew2 || "").trim();
          if (p1 && p1 === p2 && /^\d{4}$/.test(p1)) {
            await setUserQuickPin(createdUserId, p1);
            await setUserPinEnabled(createdUserId, true);
          }
        } catch (e: unknown) {
          setErr(getErrorMessage(e, "No se pudo configurar el PIN inicial."));
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

  function isSelectableUserId(id: string) {
    if (me?.id && id === me.id) return false;
    return true;
  }

  function toggleOne(id: string) {
    if (!isSelectableUserId(id)) return;
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAllOnPage() {
    const ids = users.map((u) => u.id).filter((id) => isSelectableUserId(id));
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds[id]);
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = !allSelected;
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds({});
  }

  async function bulkSetStatus(status: "ACTIVE" | "BLOCKED") {
    if (!canEditStatus) return;
    if (selectedList.length === 0) return;

    setBulkBusy(true);
    setErr(null);
    try {
      for (const id of selectedList) {
        if (!isSelectableUserId(id)) continue;
        await updateUserStatus(id, status);
      }
      clearSelection();
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error aplicando acción masiva"));
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    if (!canAdmin) return;
    if (selectedList.length === 0) return;

    setBulkBusy(true);
    setErr(null);
    try {
      for (const id of selectedList) {
        if (!isSelectableUserId(id)) continue;
        await deleteUser(id);
      }
      clearSelection();
      setBulkConfirmOpen(false);
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Error eliminando usuarios"));
    } finally {
      setBulkBusy(false);
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

  // ✅ Avatar como Empresa
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

  const iconBtnBase =
    "inline-flex items-center justify-center rounded-lg border border-border bg-card " +
    "h-9 w-9 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] hover:bg-surface2 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20";

  const disabledCls = "opacity-40 cursor-not-allowed hover:bg-card";

  const totalLabel = `${total} ${total === 1 ? "Usuario" : "Usuarios"}`;

  const selectableIdsOnPage = users.map((u) => u.id).filter((id) => isSelectableUserId(id));
  const allOnPageSelected =
    selectableIdsOnPage.length > 0 && selectableIdsOnPage.every((id) => !!selectedIds[id]);
  const someOnPageSelected =
    selectableIdsOnPage.length > 0 && selectableIdsOnPage.some((id) => !!selectedIds[id]);

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

        {selectedCount > 0 && (
          <div className="tp-card p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              Seleccionados: <b>{selectedCount}</b>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={cn("tp-btn", (!canEditStatus || bulkBusy) && "opacity-60")}
                type="button"
                disabled={!canEditStatus || bulkBusy}
                onClick={() => void bulkSetStatus("ACTIVE")}
                title={!canEditStatus ? "Sin permisos para cambiar estado" : "Activar seleccionados"}
              >
                Activar
              </button>

              <button
                className={cn("tp-btn", (!canEditStatus || bulkBusy) && "opacity-60")}
                type="button"
                disabled={!canEditStatus || bulkBusy}
                onClick={() => void bulkSetStatus("BLOCKED")}
                title={!canEditStatus ? "Sin permisos para cambiar estado" : "Inactivar seleccionados"}
              >
                Inactivar
              </button>

              <button
                className={cn("tp-btn", (!canAdmin || bulkBusy) && "opacity-60")}
                type="button"
                disabled={!canAdmin || bulkBusy}
                onClick={() => setBulkConfirmOpen(true)}
                title={!canAdmin ? "Sin permisos de administrador" : "Eliminar seleccionados"}
              >
                Eliminar
              </button>

              <button className="tp-btn-secondary" type="button" onClick={clearSelection}>
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      {/* TABLE */}
      <TPTableWrap className="w-full">
        <TPTableEl>
          <table className="min-w-[1020px] w-full text-sm">
            <TPThead>
              <tr className="border-b border-border">
                <TPTh className="text-left w-[56px]">
                  <button
                    type="button"
                    className={cn(
                      "h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-surface2",
                      (loading || selectableIdsOnPage.length === 0) && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={loading || selectableIdsOnPage.length === 0}
                    onClick={toggleAllOnPage}
                    title="Seleccionar todos (página)"
                  >
                    {allOnPageSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : someOnPageSelected ? (
                      <CheckSquare className="h-4 w-4 opacity-60" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </TPTh>

                <TPTh className="text-left">Usuario</TPTh>
                <TPTh className="text-left">Estado</TPTh>
                <TPTh className="text-left">Roles</TPTh>
                <TPTh className="text-left">Almacén favorito</TPTh>
                <TPTh className="text-right">Acciones</TPTh>
              </tr>
            </TPThead>

            <TPTbody>
              {loading ? (
                <tr>
                  <td className="px-5 py-4" colSpan={6}>
                    Cargando…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <TPEmptyRow colSpan={6} text="Sin resultados." />
              ) : (
                users.map((u) => {
                  const label = u.name?.trim() || u.email || "Usuario";
                  const initials = initialsFrom(label);
                  const favLabel = warehouseLabelById(u.favoriteWarehouseId);
                  const busy = avatarQuickBusyId === u.id;

                  const isActive = u.status === "ACTIVE";
                  const canToggleThis = canEditStatus && !(me?.id && u.id === me.id);

                  const checked = !!selectedIds[u.id];
                  const selectable = isSelectableUserId(u.id);

                  return (
                    <TPTr key={u.id} className="border-t border-border">
                      <TPTd>
                        <button
                          type="button"
                          className={cn(
                            "h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-surface2",
                            (!selectable || loading) && "opacity-50 cursor-not-allowed"
                          )}
                          disabled={!selectable || loading}
                          onClick={() => toggleOne(u.id)}
                          title={!selectable ? "No disponible" : "Seleccionar"}
                        >
                          {checked ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </TPTd>

                      <TPTd>
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-border bg-surface">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-xs font-bold text-primary">
                                {initials}
                              </div>
                            )}

                            {canAdmin && (
                              <button
                                type="button"
                                className={cn(
                                  "absolute inset-0",
                                  "opacity-0 hover:opacity-100 transition-opacity",
                                  "bg-black/30"
                                )}
                                title="Click para cambiar avatar"
                                onClick={() => {
                                  avatarInputRef.current?.setAttribute("data-userid", u.id);
                                  avatarInputRef.current?.click();
                                }}
                              >
                                <span className="sr-only">Cambiar avatar</span>
                                <div className="h-full w-full grid place-items-center text-white text-xs">
                                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar"}
                                </div>
                              </button>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold truncate">{u.name || "Sin nombre"}</div>
                            <div className="text-xs text-muted truncate">{u.email}</div>
                          </div>
                        </div>
                      </TPTd>

                      <TPTd>
                        {u.status === "ACTIVE" ? <TPUserStatusBadge status={u.status} /> : <Badge>Inactivo</Badge>}
                      </TPTd>

                      <TPTd>
                        <div className="flex flex-wrap gap-2">
                          {(u.roles || []).length ? (
                            (u.roles || []).map((r) => <Badge key={(r as any).id}>{roleLabel(r as any)}</Badge>)
                          ) : (
                            <span className="text-muted">Sin roles</span>
                          )}
                        </div>
                      </TPTd>

                      <TPTd>
                        {u.favoriteWarehouseId ? (
                          <Badge>⭐ {favLabel ? favLabel : u.favoriteWarehouseId}</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TPTd>

                      <TPTd className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className={cn(iconBtnBase, !canToggleThis && disabledCls)}
                            type="button"
                            disabled={!canToggleThis}
                            onClick={() => (canToggleThis ? void toggleStatus(u) : null)}
                            title={
                              !canEditStatus
                                ? "Sin permisos para cambiar estado"
                                : me?.id && u.id === me.id
                                ? "No podés cambiar tu propio estado"
                                : isActive
                                ? "Inactivar usuario"
                                : "Activar usuario"
                            }
                          >
                            {isActive ? <ShieldBan className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                          </button>

                          <button
                            className={cn(iconBtnBase, !canAdmin && disabledCls)}
                            type="button"
                            disabled={!canAdmin}
                            onClick={() => (canAdmin ? void openEdit(u) : null)}
                            onMouseEnter={() => void prefetchUserDetail(u.id)}
                            title={!canAdmin ? "Sin permisos de administrador" : "Editar usuario"}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            className={cn(iconBtnBase, (!canAdmin || me?.id === u.id) && disabledCls)}
                            type="button"
                            disabled={!canAdmin || me?.id === u.id}
                            onClick={() => (canAdmin ? askDelete(u) : null)}
                            title={
                              !canAdmin
                                ? "Sin permisos de administrador"
                                : me?.id === u.id
                                ? "No podés eliminar tu propio usuario"
                                : "Eliminar usuario"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TPTd>
                    </TPTr>
                  );
                })
              )}
            </TPTbody>
          </table>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              const uid = avatarInputRef.current?.getAttribute("data-userid");
              if (f && uid) void quickChangeAvatar(uid, f);
            }}
          />
        </TPTableEl>

        <div className="border-t border-border px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-muted">{totalLabel}</div>

          <div className="flex items-center justify-end gap-2">
            <button
              className={cn("tp-btn", page <= 1 && "opacity-50 cursor-not-allowed")}
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>

            <div className="text-xs text-muted">
              Página <span className="font-semibold text-text">{page}</span> / {totalPages}
            </div>

            <button
              className={cn("tp-btn", page >= totalPages && "opacity-50 cursor-not-allowed")}
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </button>
          </div>
        </div>
      </TPTableWrap>

// tptech-frontend/src/pages/Users.tsx
      {/* MODAL CREATE / EDIT */}
      <Modal
        open={modalOpen}
        wide
        title={modalMode === "CREATE" ? "Crear usuario" : `Editar usuario • ${detail?.email ?? ""}`}
        onClose={closeModal}
      >
        {modalLoading ? (
          <div className="tp-card p-4 text-sm text-muted flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : (
          <form onSubmit={saveModal} className="space-y-4">
            {/* Avatar (estilo Empresa) */}
            <div className="tp-card p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <button
                      type="button"
                      className={cn(
                        "h-16 w-16 rounded-2xl grid place-items-center relative overflow-hidden",
                        "focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]",
                        (avatarBusy || modalBusy) && "opacity-60 cursor-not-allowed"
                      )}
                      style={{
                        border: "1px solid var(--border)",
                        background: "color-mix(in oklab, var(--card) 80%, var(--bg))",
                        color: "var(--muted)",
                      }}
                      title={detail?.avatarUrl || avatarPreview ? "Editar avatar" : "Agregar avatar"}
                      onClick={() => {
                        if (!avatarBusy && !modalBusy) avatarInputModalRef.current?.click();
                      }}
                      disabled={avatarBusy || modalBusy}
                    >
                      {(avatarBusy || avatarImgLoading) && (
                        <div
                          className="absolute inset-0 grid place-items-center"
                          style={{ background: "rgba(0,0,0,0.22)" }}
                        >
                          <div className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        </div>
                      )}

                      {avatarPreview || detail?.avatarUrl ? (
                        <img
                          src={avatarPreview || detail?.avatarUrl!}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                          onLoadStart={() => setAvatarImgLoading(true)}
                          onLoad={() => setAvatarImgLoading(false)}
                          onError={() => setAvatarImgLoading(false)}
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-sm font-bold text-primary">
                          {initialsFrom(fName || fEmail || "U")}
                        </div>
                      )}

                      <div
                        className={cn(
                          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity",
                          "grid place-items-center"
                        )}
                        style={{ background: "rgba(0,0,0,0.28)" }}
                        aria-hidden="true"
                      >
                        <span className="text-white text-[11px] px-2 text-center leading-tight">
                          {avatarBusy
                            ? "SUBIENDO…"
                            : avatarPreview || detail?.avatarUrl
                            ? "EDITAR"
                            : "AGREGAR"}
                        </span>
                      </div>
                    </button>

                    {(avatarPreview || (modalMode === "EDIT" && detail?.avatarUrl)) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (avatarBusy || modalBusy) return;

                          if (avatarPreview) {
                            setAvatarPreview((prev) => {
                              if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                              return "";
                            });
                            setAvatarFileDraft(null);
                            return;
                          }

                          if (modalMode === "EDIT" && detail?.avatarUrl) void modalRemoveAvatar();
                        }}
                        className={cn(
                          "absolute top-2 right-2 h-6 w-6 rounded-full grid place-items-center",
                          "opacity-0 group-hover:opacity-100 transition-opacity"
                        )}
                        style={{
                          background: "rgba(255,255,255,0.75)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          backdropFilter: "blur(6px)",
                        }}
                        title={avatarPreview ? "Descartar" : "Eliminar avatar"}
                        aria-label={avatarPreview ? "Descartar" : "Eliminar avatar"}
                        disabled={avatarBusy || modalBusy}
                      >
                        <span className="text-[11px] leading-none">✕</span>
                      </button>
                    )}

                    <input
                      ref={avatarInputModalRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (f) void pickAvatarForModal(f);
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Avatar</div>
                    <div className="text-xs text-muted">
                      {modalMode === "CREATE"
                        ? "Podés elegirlo ahora (se sube al crear)."
                        : "Elegí uno nuevo para actualizar al instante."}
                    </div>
                  </div>
                </div>

                {avatarPreview && (
                  <button
                    className="tp-btn"
                    type="button"
                    onClick={() => {
                      setAvatarPreview((prev) => {
                        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                        return "";
                      });
                      setAvatarFileDraft(null);
                    }}
                    disabled={avatarBusy || modalBusy}
                  >
                    Descartar
                  </button>
                )}
              </div>
            </div>

            <Tabs value={tab} onChange={setTab} />

            {/* TAB DATA */}
            {tab === "DATA" ? (
              <div className="space-y-4">
                <Section title="Cuenta" desc="Email y contraseña inicial.">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-1">
                      <label className="mb-1 block text-xs text-muted">Email</label>
                      <input
                        className="tp-input"
                        value={fEmail}
                        onChange={(e) => setFEmail(e.target.value)}
                        placeholder="usuario@correo.com"
                        disabled={modalMode === "EDIT"}
                      />
                      {modalMode === "EDIT" ? (
                        <p className="mt-1 text-[11px] text-muted">(El email no se edita desde aquí)</p>
                      ) : null}
                    </div>

                    <div className="md:col-span-1">
                      <label className="mb-1 block text-xs text-muted">Contraseña (opcional)</label>
                      <input
                        className="tp-input"
                        type="password"
                        value={fPassword}
                        onChange={(e) => setFPassword(e.target.value)}
                        placeholder={
                          modalMode === "CREATE"
                            ? "Si la dejás vacía, queda Inactivo"
                            : "Dejar vacía para no cambiar"
                        }
                      />
                      {modalMode === "CREATE" ? (
                        <p className="mt-1 text-[11px] text-muted">
                          Si la contraseña está vacía, el usuario queda <b>Inactivo</b> (PENDING en backend).
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted">(Solo se cambia si escribís una nueva)</p>
                      )}
                    </div>
                  </div>
                </Section>

                <Section title="Datos personales" desc="Nombre, documento y dirección (como Empresa).">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-12">
                      <label className="mb-1 block text-xs text-muted">Nombre y apellido *</label>
                      <input
                        className="tp-input"
                        value={fName}
                        onChange={(e) => setFName(e.target.value)}
                        placeholder="Nombre Apellido"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-muted">Tipo doc.</label>
                      <input
                        className="tp-input"
                        value={fDocType}
                        onChange={(e) => setFDocType(e.target.value)}
                        placeholder="DNI / PAS / CUIT"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="mb-1 block text-xs text-muted">Nro. doc.</label>
                      <input
                        className="tp-input"
                        value={fDocNumber}
                        onChange={(e) => setFDocNumber(e.target.value)}
                        placeholder="12345678"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-muted">Tel. país</label>
                      <input
                        className="tp-input"
                        value={fPhoneCountry}
                        onChange={(e) => setFPhoneCountry(e.target.value)}
                        placeholder="+54"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="mb-1 block text-xs text-muted">Teléfono</label>
                      <input
                        className="tp-input"
                        value={fPhoneNumber}
                        onChange={(e) => setFPhoneNumber(e.target.value)}
                        placeholder="11 1234 5678"
                      />
                    </div>

                    <div className="md:col-span-12 mt-2">
                      <div className="tp-card p-4">
                        <div className="text-sm font-semibold mb-3">Domicilio</div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-5">
                            <label className="mb-1 block text-xs text-muted">Calle</label>
                            <input
                              className="tp-input"
                              value={fStreet}
                              onChange={(e) => setFStreet(e.target.value)}
                              placeholder="Calle"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-1 block text-xs text-muted">Número</label>
                            <input
                              className="tp-input"
                              value={fNumber}
                              onChange={(e) => setFNumber(e.target.value)}
                              placeholder="123"
                            />
                          </div>

                          <div className="md:col-span-5">
                            <label className="mb-1 block text-xs text-muted">Ciudad</label>
                            <input
                              className="tp-input"
                              value={fCity}
                              onChange={(e) => setFCity(e.target.value)}
                              placeholder="Ciudad"
                            />
                          </div>

                          <div className="md:col-span-4">
                            <label className="mb-1 block text-xs text-muted">Provincia</label>
                            <input
                              className="tp-input"
                              value={fProvince}
                              onChange={(e) => setFProvince(e.target.value)}
                              placeholder="Provincia"
                            />
                          </div>

                          <div className="md:col-span-4">
                            <label className="mb-1 block text-xs text-muted">Código postal</label>
                            <input
                              className="tp-input"
                              value={fPostalCode}
                              onChange={(e) => setFPostalCode(e.target.value)}
                              placeholder="1012"
                            />
                          </div>

                          <div className="md:col-span-4">
                            <label className="mb-1 block text-xs text-muted">País</label>
                            <input
                              className="tp-input"
                              value={fCountry}
                              onChange={(e) => setFCountry(e.target.value)}
                              placeholder="Argentina"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Adjuntos draft */}
                {attachmentsDraft.length > 0 && (
                  <Section title="Adjuntos seleccionados" desc="Se subirán al guardar (o al crear).">
                    <div className="space-y-2">
                      {attachmentsDraft.map((f, idx) => (
                        <div
                          key={`${f.name}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 border border-border bg-bg"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate flex items-center gap-2">
                              <Paperclip className="h-4 w-4" />
                              {safeFileLabel(f.name)}
                            </div>
                            <div className="text-xs text-muted">{formatBytes(f.size)}</div>
                          </div>

                          <button
                            type="button"
                            className="tp-btn"
                            onClick={() => removeDraftAttachmentByIndex(idx)}
                            disabled={modalBusy || uploadingAttachments}
                            title="Quitar del borrador"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Section title="Notas" desc="Notas internas.">
                    <textarea
                      className="tp-input min-h-[180px]"
                      value={fNotes}
                      onChange={(e) => setFNotes(e.target.value)}
                      placeholder="Notas internas…"
                    />
                  </Section>

                  <Section title="Adjuntos" desc="Archivos del usuario (PDF, imágenes, etc.).">
                    <div className="space-y-3">
                      <button
                        type="button"
                        className="block w-full cursor-pointer"
                        onClick={() => attInputRef.current?.click()}
                        disabled={uploadingAttachments || modalBusy}
                      >
                        <div
                          className="min-h-[180px] flex items-center justify-center border border-dashed rounded-2xl"
                          style={{
                            borderColor: "var(--border)",
                            background: "color-mix(in oklab, var(--card) 82%, var(--bg))",
                            color: "var(--muted)",
                          }}
                        >
                          {uploadingAttachments ? "Subiendo…" : "Click para agregar archivos +"}
                        </div>
                      </button>

                      <input
                        ref={attInputRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(e) => {
                          const picked = Array.from(e.currentTarget.files ?? []);
                          e.currentTarget.value = "";
                          void addAttachments(picked);
                        }}
                      />

                      {/* EDIT: mostrar guardados (servidor) */}
                      {modalMode === "EDIT" && savedAttachments.length > 0 && (
                        <div>
                          <div className="text-xs text-[color:var(--muted)] mb-2">Guardados</div>
                          <div className="space-y-2">
                            {savedAttachments.map((a) => {
                              const busy = deletingAttId === a.id;
                              const url = absUrl(a.url || "");
                              const isImg = String(a.mimeType || "").startsWith("image/");

                              return (
                                <div
                                  key={a.id}
                                  className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                                  style={{
                                    border: "1px solid var(--border)",
                                    background: "color-mix(in oklab, var(--card) 90%, var(--bg))",
                                  }}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {isImg && url ? (
                                      <img
                                        src={url}
                                        alt={safeFileLabel(a.filename)}
                                        className="h-10 w-10 rounded-lg object-cover border"
                                        style={{ borderColor: "var(--border)" }}
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div
                                        className="h-10 w-10 rounded-lg grid place-items-center border text-xs"
                                        style={{
                                          borderColor: "var(--border)",
                                          color: "var(--muted)",
                                          background: "color-mix(in oklab, var(--card) 85%, var(--bg))",
                                        }}
                                      >
                                        DOC
                                      </div>
                                    )}

                                    <div className="min-w-0">
                                      <div className="text-sm text-text truncate">{safeFileLabel(a.filename)}</div>
                                      <div className="text-xs text-muted flex gap-2">
                                        <span className="truncate">{formatBytes(a.size)}</span>
                                        {url && (
                                          <a
                                            className="underline underline-offset-2"
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Abrir
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className={cn(
                                      "h-8 w-8 rounded-full grid place-items-center",
                                      "opacity-0 group-hover:opacity-100 transition-opacity"
                                    )}
                                    style={{
                                      background: "var(--card)",
                                      border: "1px solid var(--border)",
                                    }}
                                    title="Eliminar adjunto"
                                    aria-label="Eliminar adjunto"
                                    disabled={busy}
                                    onClick={() => void removeSavedAttachment(a.id)}
                                  >
                                    <span className="text-xs">{busy ? "…" : "✕"}</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {modalMode === "EDIT" && savedAttachments.length === 0 && !uploadingAttachments && (
                        <div className="text-xs text-muted">Todavía no hay adjuntos.</div>
                      )}
                    </div>
                  </Section>
                </div>
              </div>
            ) : null}

            {/* TAB CONFIG */}
            {tab === "CONFIG" ? (
              <div className="w-full space-y-4">
                {/* ✅ PIN SOLO EN EDIT */}
                {modalMode === "EDIT" ? (
                  <Section
                    title={
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">Clave rápida (PIN)</div>
                          <div className="text-xs text-muted">
                            PIN de 4 dígitos para LockScreen / cambio rápido. (Admin)
                          </div>
                        </div>

                        {/* ✅ Reemplaza el botón por píldoras */}
                        <TPSegmentedPills
                          value={Boolean(detail?.pinEnabled)}
                          disabled={pinBusy || !detail?.hasQuickPin}
                          onChange={(v) => {
                            if (pinBusy) return;
                            if (!detail?.hasQuickPin) {
                              setPinMsg("Primero configurá un PIN para poder habilitarlo.");
                              return;
                            }
                            void adminTogglePinEnabled(v);
                          }}
                          labels={{ on: "PIN habilitado", off: "PIN deshabilitado" }}
                        />
                      </div>
                    }
                    desc={null as any}
                  >
                    <div className="space-y-3">
                      {pinMsg && (
                        <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm">
                          {pinMsg}
                        </div>
                      )}

                      {/* ✅ Mostrar estado del PIN como asteriscos + EyeIcon (visual) */}
                      <div className="flex items-center justify-between gap-3 tp-card p-3">
                        <div className="text-sm">
                          <span className="text-muted">PIN: </span>
                          <span className="font-semibold">
                            {detail?.hasQuickPin ? "••••" : "Sin PIN"}
                          </span>
                        </div>

                        {/* Este toggle es SOLO VISUAL: lo implementamos con estado local en el bloque real (UserPinSettings).
                            Acá lo dejamos simple para no romper tu file si no tenés todavía el estado showPin. */}
                      </div>

                      {/* Inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          className="tp-input"
                          type="password"
                          inputMode="numeric"
                          pattern="\d*"
                          maxLength={4}
                          value={pinNew}
                          onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ""))}
                          placeholder="Nuevo PIN (4 dígitos)"
                          disabled={pinBusy}
                        />
                        <input
                          className="tp-input"
                          type="password"
                          inputMode="numeric"
                          pattern="\d*"
                          maxLength={4}
                          value={pinNew2}
                          onChange={(e) => setPinNew2(e.target.value.replace(/\D/g, ""))}
                          placeholder="Confirmar PIN"
                          disabled={pinBusy}
                        />
                      </div>

                      {/* Acciones */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={cn("tp-btn-primary inline-flex items-center gap-2", pinBusy && "opacity-60")}
                          disabled={pinBusy}
                          onClick={() => void adminSetOrResetPin()}
                        >
                          {pinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                          Configurar / Cambiar PIN
                        </button>

                        <button
                          type="button"
                          className={cn("tp-btn-secondary inline-flex items-center gap-2", pinBusy && "opacity-60")}
                          disabled={pinBusy || !detail?.hasQuickPin}
                          onClick={() => void adminRemovePin()}
                          title={!detail?.hasQuickPin ? "No hay PIN para eliminar" : "Eliminar PIN"}
                        >
                          {pinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                          Eliminar PIN
                        </button>
                      </div>

                      <p className="text-xs text-muted">
                        Tip: si el PIN está definido pero deshabilitado, el usuario no podrá usarlo para desbloquear.
                      </p>
                    </div>
                  </Section>
                ) : null}

                <Section title="Almacén favorito" desc="Se usará por defecto en operaciones.">
                  <select
                    className="tp-input"
                    value={fFavWarehouseId}
                    onChange={(e) => setFFavWarehouseId(e.target.value)}
                    disabled={!canAdmin}
                  >
                    <option value="">Sin favorito</option>

                    {activeAlmacenes.map((a) => {
                      const isSelected = String(fFavWarehouseId) === String(a.id);
                      return (
                        <option key={a.id} value={a.id} disabled={isSelected}>
                          {a.nombre} {a.codigo ? `(${a.codigo})` : ""}
                          {isSelected ? " (seleccionado)" : ""}
                        </option>
                      );
                    })}
                  </select>

                  <div className="mt-2 text-xs text-muted">
                    {fFavWarehouseId
                      ? `Seleccionado: ${warehouseLabelById(fFavWarehouseId) ?? fFavWarehouseId}`
                      : "Sin almacén favorito"}
                  </div>
                </Section>

                <Section title="Roles del usuario" desc="Selección múltiple.">
                  <div className="tp-card p-3 max-h-[260px] overflow-auto tp-scroll">
                    {rolesLoading ? (
                      <div className="text-sm text-muted flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando roles…
                      </div>
                    ) : roles.length === 0 ? (
                      <div className="text-sm text-muted">No hay roles.</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {roles.map((r) => {
                          const checked = fRoleIds.includes((r as any).id);
                          return (
                            <label key={(r as any).id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={checked}
                                onChange={(e) =>
                                  setFRoleIds((prev) =>
                                    e.target.checked
                                      ? [...prev, (r as any).id]
                                      : prev.filter((id) => id !== (r as any).id)
                                  )
                                }
                              />
                              {roleLabel(r as any)}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted">Si no seleccionás roles, queda sin permisos hasta asignar.</p>
                </Section>

                <Section
                  title={
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2">Permisos especiales</span>

                      <TPSegmentedPills
                        value={specialEnabled}
                        onChange={(next) => {
                          setSpecialEnabled(next);
                          if (!next) setSpecialList([]);
                        }}
                        disabled={!canAdmin}
                        labels={{
                          on: "Permisos habilitados",
                          off: "Permisos deshabilitados",
                        }}
                      />
                    </div>
                  }
                  desc="Opcional: Permitir/Denegar por permiso."
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs text-muted">Permiso</label>
                        <select
                          className="tp-input"
                          value={specialPermPick}
                          onChange={(e) => setSpecialPermPick(e.target.value)}
                          disabled={permsLoading || !specialEnabled}
                        >
                          <option value="">
                            {specialEnabled ? "Seleccionar…" : "Permisos especiales deshabilitados"}
                          </option>
                          {allPerms.map((p) => {
                            const alreadyAdded = specialList.some((x) => x.permissionId === p.id);
                            return (
                              <option key={p.id} value={p.id} disabled={alreadyAdded}>
                                {permLabelByModuleAction(p.module, p.action)}
                                {alreadyAdded ? " (ya agregado)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-muted">Acción</label>
                        <select
                          className="tp-input"
                          value={specialEffectPick}
                          onChange={(e) => setSpecialEffectPick(e.target.value as any)}
                          disabled={!specialEnabled}
                        >
                          <option value="ALLOW">Permitir</option>
                          <option value="DENY">Denegar</option>
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <button
                          className={cn(
                            "tp-btn-primary w-full",
                            (!specialEnabled || !specialPermPick || specialSaving) && "opacity-60"
                          )}
                          type="button"
                          disabled={!specialEnabled || !specialPermPick || specialSaving}
                          onClick={() => void addOrUpdateSpecial()}
                        >
                          {specialSaving ? "Guardando…" : "Agregar / Actualizar"}
                        </button>

                        <p className="mt-2 text-xs text-muted">
                          * Denegar pisa Permitir y pisa permisos heredados por roles.
                        </p>
                      </div>
                    </div>

                    <div className="tp-card overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="border-b border-border">
                          <tr>
                            <th className="px-3 py-2 text-left">Permiso</th>
                            <th className="px-3 py-2 text-left">Acción</th>
                            <th className="px-3 py-2 text-right">Quitar</th>
                          </tr>
                        </thead>

                        <tbody>
                          {!specialEnabled ? (
                            <tr>
                              <td className="px-3 py-3 text-muted" colSpan={3}>
                                Permisos especiales deshabilitados.
                              </td>
                            </tr>
                          ) : specialListSorted.length === 0 ? (
                            <tr>
                              <td className="px-3 py-3 text-muted" colSpan={3}>
                                Sin permisos especiales.
                              </td>
                            </tr>
                          ) : (
                            specialListSorted.map((ov) => (
                              <tr key={ov.permissionId} className="border-t border-border">
                                <td className="px-3 py-2">{labelPerm(ov.permissionId)}</td>

                                <td className="px-3 py-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                                      ov.effect === "ALLOW"
                                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                        : "border-red-500/30 bg-red-500/15 text-red-300"
                                    )}
                                  >
                                    {effectLabel(ov.effect)}
                                  </span>
                                </td>

                                <td className="px-3 py-2 text-right">
                                  <button
                                    className={cn("tp-btn", specialSaving && "opacity-60")}
                                    type="button"
                                    disabled={specialSaving}
                                    onClick={() => void removeSpecial(ov.permissionId)}
                                  >
                                    Quitar
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Section>
              </div>
            ) : null}

            {/* ✅ ACCIONES (ACÁ agregamos “Guardar y configurar PIN” pero SOLO si nos pasás tu saveModal y cómo abrís EDIT) */}
            <div className="flex justify-end gap-2 pt-2">
              <button className="tp-btn-secondary" type="button" onClick={closeModal} disabled={modalBusy}>
                Cancelar
              </button>

              {/* TODO: acá va “Guardar y configurar PIN” en CREATE (necesito tu lógica de saveModal/openEdit) */}

              <button className={cn("tp-btn-primary", modalBusy && "opacity-60")} type="submit" disabled={modalBusy}>
                {modalBusy ? "Guardando…" : modalMode === "CREATE" ? "Crear" : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </Modal>

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

      {/* CONFIRM DELETE bulk */}
      <Modal
        open={bulkConfirmOpen}
        title="Eliminar usuarios seleccionados"
        onClose={() => {
          if (bulkBusy) return;
          setBulkConfirmOpen(false);
        }}
      >
        <div className="space-y-4">
          <div className="text-sm">
            Vas a eliminar (soft delete) <b>{selectedCount}</b> usuario(s).
            <div className="mt-2 text-xs text-muted">
              Esto eliminará usuarios seleccionados en esta página (según tu selección actual).
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="tp-btn-secondary"
              type="button"
              disabled={bulkBusy}
              onClick={() => setBulkConfirmOpen(false)}
            >
              Cancelar
            </button>
            <button
              className={cn("tp-btn", bulkBusy && "opacity-60")}
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkDelete()}
            >
              {bulkBusy ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
