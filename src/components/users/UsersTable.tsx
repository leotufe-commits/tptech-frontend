// tptech-frontend/src/components/users/UsersTable.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Pencil,
  Trash2,
  ShieldBan,
  ShieldCheck,
  X,
  Paperclip,
  KeyRound,
  Shield,
  ChevronLeft,
  ChevronRight,
  Eye, // ✅ view icon
} from "lucide-react";

import { cn, initialsFrom, absUrl } from "./users.ui";
import { SortArrows } from "../ui/TPSort";
import { TPBadge } from "../ui/TPBadges";

import { TPTableWrap, TPTableEl, TPThead, TPTbody, TPTh, TPEmptyRow } from "../ui/TPTable";

import type { UserListItem } from "../../services/users";

// ✅ Prefetch real (evita depender del prop undefined)
import { prefetchUserDetail as prefetchUserDetailInternal } from "./users.data";

// ✅ Descarga con cookie httpOnly (NO <a href> sin credenciales)
import { downloadUserAttachmentFile } from "../../lib/users.api";

/* ======================================================
   Utils fecha
====================================================== */
function formatDateTime(v?: string | Date | null) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ======================================================
   Sort helpers
====================================================== */
type SortCol = "USER" | "STATUS" | "PIN" | "ROLES" | "FAV";
type SortDir = "asc" | "desc";

function norm(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function userLabel(u: any) {
  return String(u?.name || u?.email || "").trim();
}

function statusLabel(u: any) {
  const s = String(u?.status || "").toUpperCase();
  if (s === "ACTIVE") return "activo";
  if (s === "PENDING") return "pendiente";
  if (s === "BLOCKED") return "inactivo";
  return s ? s.toLowerCase() : "";
}

function specialCount(u: any): number {
  const c = Number(u?.overridesCount ?? u?.permissionOverridesCount ?? NaN);
  if (Number.isFinite(c)) return c;

  if (typeof u?.hasSpecialPermissions === "boolean") return u.hasSpecialPermissions ? 1 : 0;
  if (Array.isArray(u?.permissionOverrides)) return u.permissionOverrides.length;

  return 0;
}

function hasSpecial(u: any) {
  return specialCount(u) > 0;
}

type AttachmentItem = {
  id: string;
  url?: string;
  filename: string;
  mimeType?: string;
  size?: number;
  createdAt?: string | Date;
};

function attachmentsCount(u: any): number {
  const c = Number(u?.attachmentsCount ?? u?.attachmentCount ?? NaN);
  if (Number.isFinite(c)) return c;

  if (typeof u?.hasAttachments === "boolean") return u.hasAttachments ? 1 : 0;
  if (Array.isArray(u?.attachments)) return u.attachments.length;

  return 0;
}

function formatBytes(n?: number) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let x = v;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2;
  return `${x.toFixed(digits)} ${units[i]}`;
}

/* ======================================================
   OWNER / ADMIN helpers (columna Roles)
====================================================== */
function isOwnerRole(r: any, roleLabelFn?: (r: any) => string) {
  const code = String(r?.code ?? "").trim().toUpperCase();
  const name = String(r?.name ?? "").trim().toUpperCase();
  if (code === "OWNER" || name === "OWNER") return true;

  const label = roleLabelFn ? String(roleLabelFn(r) || "") : "";
  const l = label.trim().toLowerCase();
  if (l.includes("propietario") || l.includes("owner")) return true;

  return false;
}

function isAdminRole(r: any, roleLabelFn?: (r: any) => string) {
  const code = String(r?.code ?? "").trim().toUpperCase();
  const name = String(r?.name ?? "").trim().toUpperCase();
  if (code === "ADMIN" || name === "ADMIN") return true;

  const label = roleLabelFn ? String(roleLabelFn(r) || "") : "";
  const l = label.trim().toLowerCase();
  if (l.includes("admin")) return true;

  return false;
}

function roleTone(r: any, roleLabelFn?: (r: any) => string) {
  if (isOwnerRole(r, roleLabelFn)) return "warning";
  if (isAdminRole(r, roleLabelFn)) return "info";
  return "neutral";
}

/* ======================================================
   Component
====================================================== */
type Props = {
  loading: boolean;
  users: UserListItem[];
  totalLabel: string;

  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;

  canAdmin: boolean;
  canEditStatus: boolean;
  meId?: string | null;

  roleLabel: (r: any) => string;
  warehouseLabelById: (id?: string | null) => string | null;

  toggleStatus: (u: UserListItem) => Promise<void> | void;
  openEdit: (u: UserListItem) => Promise<void> | void;
  askDelete: (u: UserListItem) => void;

  // ✅ lo dejamos opcional para compatibilidad (en tu Users.tsx hoy es undefined as any)
  prefetchUserDetail?: (id: string) => Promise<any>;
};

type PinOverride = {
  hasQuickPin?: boolean;
  pinEnabled?: boolean;
};

const PIN_EVENT = "tptech:user-pin-updated";

export default function UsersTable(props: Props) {
  const {
    loading,
    users,
    totalLabel,
    page,
    totalPages,
    onPrev,
    onNext,
    canAdmin,
    canEditStatus,
    meId,
    roleLabel,
    warehouseLabelById,
    toggleStatus,
    openEdit,
    askDelete,
    // ✅ si viene prop lo usamos; si no, usamos el internal
    prefetchUserDetail,
  } = props;

  const nav = useNavigate();

  const [sortBy, setSortBy] = useState<SortCol>("USER");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(col: SortCol) {
    if (sortBy !== col) {
      setSortBy(col);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  // ✅ Override local para que el listado se sincronice aunque no hayas refetch del GET /users
  const pinOverridesRef = useRef<Map<string, PinOverride>>(new Map());
  const [pinTick, setPinTick] = useState(0);

  useEffect(() => {
    function onPinUpdated(e: Event) {
      const ce = e as CustomEvent<any>;
      const d = ce?.detail ?? null;
      const userId = String(d?.userId ?? "").trim();
      if (!userId) return;

      const hasQuickPin = typeof d?.hasQuickPin === "boolean" ? Boolean(d.hasQuickPin) : undefined;
      const pinEnabled = typeof d?.pinEnabled === "boolean" ? Boolean(d.pinEnabled) : undefined;

      if (hasQuickPin === undefined && pinEnabled === undefined) return;

      const prev = pinOverridesRef.current.get(userId) ?? {};
      const next: PinOverride = { ...prev };

      // ✅ NO pisar valores previos con undefined
      if (hasQuickPin !== undefined) next.hasQuickPin = hasQuickPin;
      if (pinEnabled !== undefined) next.pinEnabled = pinEnabled;

      // ✅ coherencia: si no hay PIN, nunca puede quedar enabled=true
      if (hasQuickPin === false) next.pinEnabled = false;

      pinOverridesRef.current.set(userId, next);
      setPinTick((x) => x + 1);
    }

    window.addEventListener(PIN_EVENT, onPinUpdated as any);
    return () => window.removeEventListener(PIN_EVENT, onPinUpdated as any);
  }, []);

  /**
   * ✅ Regla importante para tu caso (lock screen / cancelar):
   * - "pinEnabled" NO es prueba de que exista PIN.
   * - Si el backend no manda hasQuickPin, NO inferimos hasQuickPin desde pinEnabled.
   *   Solo usamos señales más seguras (hasQuickPin explícito o quickPinUpdatedAt).
   */
  function effectivePin(u: any) {
    const id = String(u?.id ?? "");
    const ov = id ? pinOverridesRef.current.get(id) : undefined;

    const rawHas = typeof u?.hasQuickPin === "boolean" ? Boolean(u.hasQuickPin) : undefined;
    const rawUpdatedAt = String(u?.quickPinUpdatedAt ?? "").trim();

    const hasQuickPin =
      typeof ov?.hasQuickPin === "boolean"
        ? ov.hasQuickPin
        : rawHas !== undefined
        ? rawHas
        : Boolean(rawUpdatedAt); // ✅ fallback más seguro que pinEnabled

    let pinEnabled =
      typeof ov?.pinEnabled === "boolean"
        ? ov.pinEnabled
        : typeof u?.pinEnabled === "boolean"
        ? Boolean(u.pinEnabled)
        : typeof u?.quickPinEnabled === "boolean"
        ? Boolean(u.quickPinEnabled)
        : false;

    // ✅ coherencia: si no hay PIN, pinEnabled siempre false
    if (!hasQuickPin) pinEnabled = false;

    return { hasQuickPin, pinEnabled };
  }

  function pinLabelEffective(u: any) {
    const { hasQuickPin: has, pinEnabled: enabled } = effectivePin(u);
    if (!has) return "sin pin";
    return enabled ? "pin habilitado" : "pin deshabilitado";
  }

  const sortedUsers = useMemo(() => {
    const arr = [...(users ?? [])];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a: any, b: any) => {
      const aUser = norm(userLabel(a));
      const bUser = norm(userLabel(b));

      let ak = "";
      let bk = "";

      if (sortBy === "USER") {
        ak = aUser;
        bk = bUser;
      } else if (sortBy === "STATUS") {
        ak = norm(statusLabel(a));
        bk = norm(statusLabel(b));
      } else if (sortBy === "PIN") {
        ak = norm(pinLabelEffective(a));
        bk = norm(pinLabelEffective(b));
      } else if (sortBy === "ROLES") {
        const aRoles = ((a?.roles ?? []) as any[]).map((r) => roleLabel(r)).join(" ").trim();
        const bRoles = ((b?.roles ?? []) as any[]).map((r) => roleLabel(r)).join(" ").trim();
        ak = norm(aRoles + (hasSpecial(a) ? " permiso especial" : ""));
        bk = norm(bRoles + (hasSpecial(b) ? " permiso especial" : ""));
      } else {
        const aFav = a?.favoriteWarehouseId ? warehouseLabelById(a.favoriteWarehouseId) ?? a.favoriteWarehouseId : "";
        const bFav = b?.favoriteWarehouseId ? warehouseLabelById(b.favoriteWarehouseId) ?? b.favoriteWarehouseId : "";
        ak = norm(aFav);
        bk = norm(bFav);
      }

      const primary = ak.localeCompare(bk, "es", { sensitivity: "base" }) * dir;
      if (primary !== 0) return primary;

      const byUser = aUser.localeCompare(bUser, "es", { sensitivity: "base" }) * dir;
      if (byUser !== 0) return byUser;

      return String((a as any)?.id).localeCompare(String((b as any)?.id)) * dir;
    });

    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, sortBy, sortDir, roleLabel, warehouseLabelById, pinTick]);

  // ✅ Botón ícono (outline)
  const iconBtnBase =
    "inline-flex items-center justify-center rounded-lg border border-border bg-transparent " +
    "h-9 w-9 text-text/90 hover:bg-surface2/60 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20";

  const disabledCls = "opacity-40 cursor-not-allowed hover:bg-transparent";

  // ✅ Pill violeta para “permisos especiales”
  const specialPillCls = "border-violet-500/30 bg-violet-500/10 text-violet-300 dark:text-violet-200";

  /* ======================================================
     Attachments panel (clic en 📎)
  ====================================================== */
  type AttInfo = { has: boolean; count: number; items?: AttachmentItem[] };

  const attCacheRef = useRef<Map<string, AttInfo>>(new Map());
  const attInFlightRef = useRef<Set<string>>(new Set());

  const [attPanelUserId, setAttPanelUserId] = useState<string | null>(null);
  const [attTick, setAttTick] = useState(0);
  const [attDownloadBusyId, setAttDownloadBusyId] = useState<string | null>(null);
  const [attDownloadErr, setAttDownloadErr] = useState<string | null>(null);

  function closeAttPanel() {
    setAttPanelUserId(null);
    setAttDownloadBusyId(null);
    setAttDownloadErr(null);
  }

  useEffect(() => {
    if (!attPanelUserId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAttPanel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attPanelUserId]);

  async function ensureAttachmentsCached(userId: string) {
    if (!userId) return;
    if (attCacheRef.current.get(userId)?.items) return;
    if (attInFlightRef.current.has(userId)) return;

    attInFlightRef.current.add(userId);
    setAttTick((x) => x + 1);

    try {
      // ✅ usa prop si viene, si no usa internal
      const fn = prefetchUserDetail || prefetchUserDetailInternal;
      const d = await fn(userId);

      const root = (d as any)?.user ? (d as any).user : d;
      const arr = Array.isArray(root?.attachments) ? (root.attachments as AttachmentItem[]) : [];
      const info: AttInfo = { has: arr.length > 0, count: arr.length, items: arr };
      attCacheRef.current.set(userId, info);
    } catch {
      // ignore
    } finally {
      attInFlightRef.current.delete(userId);
      setAttTick((x) => x + 1);
    }
  }

  function listAttCount(u: any) {
    return attachmentsCount(u);
  }

  async function openAttPanel(u: any) {
    const id = String(u?.id || "");
    if (!id) return;

    setAttPanelUserId(id);
    setAttDownloadErr(null);
    await ensureAttachmentsCached(id);
  }

  const attPanelUser = useMemo(() => {
    if (!attPanelUserId) return null;
    return (users ?? []).find((x: any) => String((x as any).id) === attPanelUserId) ?? null;
  }, [attPanelUserId, users]);

  const attPanelInfo = useMemo(() => {
    if (!attPanelUserId) return null;

    const cached = attCacheRef.current.get(attPanelUserId);
    if (cached) return cached;

    const u: any = (users ?? []).find((x: any) => String((x as any).id) === attPanelUserId);
    if (u && Array.isArray(u.attachments)) {
      const arr = u.attachments as AttachmentItem[];
      return { has: arr.length > 0, count: arr.length, items: arr };
    }

    if (u) {
      const c = listAttCount(u);
      if (c > 0) return { has: true, count: c };
    }

    return { has: false, count: 0 };
  }, [attPanelUserId, users, attTick]);

  const attPanelLoading = Boolean(attPanelUserId && attInFlightRef.current.has(attPanelUserId));

  function openView(u: any) {
    const id = String(u?.id || "");
    if (!id) return;
    nav(`/configuracion/usuarios/${id}`);
  }

  async function downloadAttachment(att: AttachmentItem) {
    const userId = String(attPanelUserId || "");
    const attId = String(att?.id || "");
    if (!userId || !attId) return;

    setAttDownloadErr(null);
    setAttDownloadBusyId(attId);
    try {
      await downloadUserAttachmentFile(userId, attId, att?.filename || "archivo");
    } catch (e: any) {
      setAttDownloadErr(e?.message || "No se pudo descargar el archivo.");
    } finally {
      setAttDownloadBusyId(null);
    }
  }

  return (
    <TPTableWrap className="w-full">
      {/* =========================
          MOBILE (cards)
         ========================= */}
      <div className="sm:hidden space-y-2">
        {loading ? (
          <div className="tp-card p-4 text-sm text-muted flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="tp-card p-4 text-sm text-muted">Sin resultados.</div>
        ) : (
          sortedUsers.map((u: any) => {
            const status = String(u.status || "").toUpperCase();
            const isActive = status === "ACTIVE";
            const isPending = status === "PENDING";
            const isMe = Boolean(meId && u.id === meId);

            const canToggleThis = canEditStatus && !isMe;
            const canEditThis = (canAdmin || isMe) && true;
            const canDeleteThis = canAdmin && !isMe;

            const avatarSrc = u.avatarUrl ? absUrl(u.avatarUrl) : "";
            const initials = initialsFrom(u.name || u.email || "U");

            const attCount = listAttCount(u);

            const pin = effectivePin(u);
            const pinHas = pin.hasQuickPin;
            const pinEnabled = pin.pinEnabled;

            return (
              <div key={u.id} className={cn("tp-card w-full text-left p-3 rounded-2xl border border-border")}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => openView(u)}
                    className={cn(
                      "flex items-start gap-3 min-w-0 flex-1 text-left",
                      "hover:opacity-95 active:scale-[0.99] transition"
                    )}
                    title="Ver usuario"
                  >
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-border bg-surface shrink-0">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs font-bold text-primary">
                          {initials}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">
                        {u.name || "Sin nombre"} {isMe && <span className="text-[11px] text-muted">(vos)</span>}
                      </div>
                      <div className="text-xs text-muted truncate">{u.email}</div>
                      {u.createdAt && <div className="text-[11px] text-muted">Creado: {formatDateTime(u.createdAt)}</div>}

                      <div className="mt-2 flex flex-wrap gap-2">
                        <TPBadge tone={isActive ? "success" : isPending ? "warning" : "danger"}>
                          {isActive ? "Activo" : isPending ? "Pendiente" : "Inactivo"}
                        </TPBadge>

                        {pinHas ? (
                          <TPBadge tone={pinEnabled ? "success" : "danger"} className="gap-1">
                            {pinEnabled ? <KeyRound className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                            {pinEnabled ? "PIN habilitado" : "PIN deshabilitado"}
                          </TPBadge>
                        ) : (
                          <TPBadge tone="danger">Sin PIN</TPBadge>
                        )}

                        {u.favoriteWarehouseId ? (
                          <TPBadge tone="neutral">⭐ {warehouseLabelById(u.favoriteWarehouseId) ?? u.favoriteWarehouseId}</TPBadge>
                        ) : (
                          <TPBadge tone="neutral">⭐ —</TPBadge>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {(u.roles || []).length ? (
                          u.roles.map((r: any) => (
                            <TPBadge key={r.id ?? r.name} tone={roleTone(r, roleLabel) as any}>
                              {roleLabel(r)}
                            </TPBadge>
                          ))
                        ) : (
                          <span className="text-muted text-sm">Sin roles</span>
                        )}

                        {hasSpecial(u) && (
                          <TPBadge tone="neutral" className={specialPillCls} title="Tiene permisos especiales">
                            Permiso especial
                          </TPBadge>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="shrink-0 flex flex-col gap-2">
                    <button type="button" className={cn(iconBtnBase)} onClick={() => openView(u)} title="Ver">
                      <Eye className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      className={cn(iconBtnBase, !canEditThis && disabledCls)}
                      disabled={!canEditThis}
                      onClick={() => {
                        if (canEditThis) void openEdit(u);
                      }}
                      title={isMe ? "Editar tu perfil" : "Editar usuario"}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      className={cn(iconBtnBase, attCount <= 0 && disabledCls)}
                      disabled={attCount <= 0}
                      onClick={() => {
                        if (attCount > 0) void openAttPanel(u);
                      }}
                      title={attCount > 0 ? `PDF/Adjuntos (${attCount})` : "Sin adjuntos"}
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      className={cn(iconBtnBase, !canToggleThis && disabledCls)}
                      disabled={!canToggleThis}
                      onClick={() => {
                        if (canToggleThis) void toggleStatus(u);
                      }}
                      title={
                        !canEditStatus
                          ? "Sin permisos"
                          : isMe
                          ? "No podés cambiar tu propio estado"
                          : isActive
                          ? "Inactivar"
                          : "Activar"
                      }
                    >
                      {isActive ? <ShieldBan className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    </button>

                    <button
                      type="button"
                      className={cn(iconBtnBase, !canDeleteThis && disabledCls)}
                      disabled={!canDeleteThis}
                      onClick={() => {
                        if (canDeleteThis) askDelete(u);
                      }}
                      title={!canAdmin ? "Sin permisos" : isMe ? "No podés eliminarte" : "Eliminar"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div className="border-t border-border px-2 py-3 flex items-center justify-between">
          <div className="text-xs text-muted">{totalLabel}</div>

          <div className="flex items-center gap-2">
            <button
              className={cn(iconBtnBase, page <= 1 && disabledCls)}
              type="button"
              disabled={page <= 1}
              onClick={onPrev}
              title="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-xs text-muted">
              <b className="text-text">{page}</b> / {totalPages}
            </div>

            <button
              className={cn(iconBtnBase, page >= totalPages && disabledCls)}
              type="button"
              disabled={page >= totalPages}
              onClick={onNext}
              title="Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================
          DESKTOP
         ========================= */}
      <div className="hidden sm:block w-full overflow-x-auto">
        <TPTableEl>
          <table className="min-w-[1060px] w-full text-sm">
            <TPThead>
              <tr className="border-b border-border">
                <TPTh className="text-left">
                  <button
                    type="button"
                    className={cn("inline-flex items-center gap-1 font-semibold hover:opacity-90")}
                    onClick={() => toggleSort("USER")}
                    title="Ordenar por Usuario"
                  >
                    Usuario
                    <SortArrows dir={sortDir} active={sortBy === "USER"} />
                  </button>
                </TPTh>

                <TPTh className="text-left">
                  <button
                    type="button"
                    className={cn("inline-flex items-center gap-1 font-semibold hover:opacity-90")}
                    onClick={() => toggleSort("STATUS")}
                    title="Ordenar por Estado"
                  >
                    Estado
                    <SortArrows dir={sortDir} active={sortBy === "STATUS"} />
                  </button>
                </TPTh>

                <TPTh className="text-left">
                  <button
                    type="button"
                    className={cn("inline-flex items-center gap-1 font-semibold hover:opacity-90")}
                    onClick={() => toggleSort("PIN")}
                    title="Ordenar por PIN"
                  >
                    PIN
                    <SortArrows dir={sortDir} active={sortBy === "PIN"} />
                  </button>
                </TPTh>

                <TPTh className="text-left">
                  <button
                    type="button"
                    className={cn("inline-flex items-center gap-1 font-semibold hover:opacity-90")}
                    onClick={() => toggleSort("ROLES")}
                    title="Ordenar por Roles"
                  >
                    Roles
                    <SortArrows dir={sortDir} active={sortBy === "ROLES"} />
                  </button>
                </TPTh>

                <TPTh className="text-left">
                  <button
                    type="button"
                    className={cn("inline-flex items-center gap-1 font-semibold hover:opacity-90")}
                    onClick={() => toggleSort("FAV")}
                    title="Ordenar por Almacén favorito"
                  >
                    Almacén favorito
                    <SortArrows dir={sortDir} active={sortBy === "FAV"} />
                  </button>
                </TPTh>

                <TPTh className="text-right">Acciones</TPTh>
              </tr>
            </TPThead>

            <TPTbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-4">
                    Cargando…
                  </td>
                </tr>
              ) : sortedUsers.length === 0 ? (
                <TPEmptyRow colSpan={6} text="Sin resultados." />
              ) : (
                sortedUsers.map((u: any) => {
                  const status = String(u.status || "").toUpperCase();
                  const isActive = status === "ACTIVE";
                  const isPending = status === "PENDING";
                  const isBlocked = status === "BLOCKED";
                  const isMe = Boolean(meId && u.id === meId);

                  const canToggleThis = canEditStatus && !isMe;
                  const canEditThis = (canAdmin || isMe) && true;
                  const canDeleteThis = canAdmin && !isMe;

                  const avatarSrc = u.avatarUrl ? absUrl(u.avatarUrl) : "";
                  const initials = initialsFrom(u.name || u.email || "U");

                  const attCount = listAttCount(u);

                  const pin = effectivePin(u);
                  const pinHas = pin.hasQuickPin;
                  const pinEnabled = pin.pinEnabled;

                  return (
                    <tr key={u.id} className={cn("border-t border-border hover:bg-surface2/40")}>
                      <td className="px-5 py-3 align-top">
                        <button
                          type="button"
                          className={cn(
                            "w-full text-left",
                            "rounded-xl",
                            "hover:opacity-95 active:scale-[0.995] transition"
                          )}
                          onClick={() => openView(u)}
                          title="Ver usuario"
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full overflow-hidden border border-border bg-surface shrink-0 mt-0.5">
                              {avatarSrc ? (
                                <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-xs font-bold text-primary">
                                  {initials}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold truncate flex items-center gap-2">
                                <span className="truncate">{u.name || "Sin nombre"}</span>
                                {isMe && <span className="text-[11px] text-muted">(vos)</span>}
                              </div>

                              <div className="text-xs text-muted truncate">{u.email}</div>

                              {u.createdAt && (
                                <div className="text-[11px] text-muted">Creado: {formatDateTime(u.createdAt)}</div>
                              )}
                            </div>
                          </div>
                        </button>
                      </td>

                      <td className="px-5 py-3 align-top">
                        <TPBadge
                          tone={isActive ? "success" : isPending ? "warning" : "danger"}
                          title={
                            isPending
                              ? "Pendiente (sin contraseña / invitación)"
                              : isBlocked
                              ? "Inactivo"
                              : isActive
                              ? "Activo"
                              : statusLabel(u)
                          }
                        >
                          {isActive ? "Activo" : isPending ? "Pendiente" : "Inactivo"}
                        </TPBadge>
                      </td>

                      <td className="px-5 py-3 align-top">
                        {pinHas ? (
                          <TPBadge
                            tone={pinEnabled ? "success" : "danger"}
                            title={pinEnabled ? "PIN habilitado" : "PIN deshabilitado"}
                            className="gap-1"
                          >
                            {pinEnabled ? (
                              <KeyRound className="h-3.5 w-3.5" />
                            ) : (
                              <Shield className="h-3.5 w-3.5" />
                            )}
                            {pinEnabled ? "Habilitado" : "Deshabilitado"}
                          </TPBadge>
                        ) : (
                          <TPBadge tone="danger" title="Sin PIN">
                            Sin PIN
                          </TPBadge>
                        )}
                      </td>

                      <td className="px-5 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          {(u.roles || []).length ? (
                            u.roles.map((r: any) => (
                              <TPBadge key={r.id ?? r.name} tone={roleTone(r, roleLabel) as any}>
                                {roleLabel(r)}
                              </TPBadge>
                            ))
                          ) : (
                            <span className="text-muted">Sin roles</span>
                          )}

                          {hasSpecial(u) && (
                            <TPBadge tone="neutral" className={specialPillCls} title="Tiene permisos especiales">
                              Permiso especial
                            </TPBadge>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3 align-top">
                        {u.favoriteWarehouseId ? (
                          <TPBadge tone="neutral">
                            ⭐ {warehouseLabelById(u.favoriteWarehouseId) ?? u.favoriteWarehouseId}
                          </TPBadge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" className={cn(iconBtnBase)} onClick={() => openView(u)} title="Ver">
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            className={cn(iconBtnBase, !canEditThis && disabledCls)}
                            disabled={!canEditThis}
                            onClick={() => {
                              if (canEditThis) void openEdit(u);
                            }}
                            title={!canAdmin && !isMe ? "Sin permisos" : isMe ? "Editar tu perfil" : "Editar usuario"}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            className={cn(iconBtnBase, attCount <= 0 && disabledCls)}
                            disabled={attCount <= 0}
                            onClick={() => {
                              if (attCount > 0) void openAttPanel(u);
                            }}
                            title={attCount > 0 ? `PDF/Adjuntos (${attCount})` : "Sin adjuntos"}
                          >
                            <Paperclip className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            className={cn(iconBtnBase, !canToggleThis && disabledCls)}
                            disabled={!canToggleThis}
                            onClick={() => {
                              if (canToggleThis) void toggleStatus(u);
                            }}
                            title={
                              !canEditStatus
                                ? "Sin permisos para cambiar estado"
                                : isMe
                                ? "No podés cambiar tu propio estado"
                                : isActive
                                ? "Inactivar usuario"
                                : "Activar usuario"
                            }
                          >
                            {isActive ? <ShieldBan className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                          </button>

                          <button
                            type="button"
                            className={cn(iconBtnBase, !canDeleteThis && disabledCls)}
                            disabled={!canDeleteThis}
                            onClick={() => {
                              if (canDeleteThis) askDelete(u);
                            }}
                            title={
                              !canAdmin
                                ? "Sin permisos de administrador"
                                : isMe
                                ? "No podés eliminar tu propio usuario"
                                : "Eliminar usuario"
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
            </TPTbody>
          </table>
        </TPTableEl>
      </div>

      <div className="hidden sm:flex border-t border-border px-4 py-3 items-center justify-between">
        <div className="text-xs text-muted">{totalLabel}</div>

        <div className="flex items-center gap-2">
          <button
            className={cn(iconBtnBase, page <= 1 && disabledCls)}
            type="button"
            disabled={page <= 1}
            onClick={onPrev}
            title="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="text-xs text-muted">
            <b className="text-text">{page}</b> / {totalPages}
          </div>

          <button
            className={cn(iconBtnBase, page >= totalPages && disabledCls)}
            type="button"
            disabled={page >= totalPages}
            onClick={onNext}
            title="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {attPanelUserId && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center px-4" onClick={closeAttPanel}>
          <div className="absolute inset-0 bg-black/40" />

          <div
            className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-soft overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  Adjuntos — {attPanelUser ? userLabel(attPanelUser as any) : "Usuario"}
                </div>
                <div className="text-xs text-muted truncate">
                  {attPanelUser ? String((attPanelUser as any).email || "") : ""}
                </div>
              </div>

              <button type="button" className={cn(iconBtnBase)} onClick={closeAttPanel} title="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              {attPanelLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando adjuntos…
                </div>
              ) : !attPanelInfo?.has ? (
                <div className="text-sm text-muted">Este usuario no tiene adjuntos.</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-muted">
                    {attPanelInfo?.count != null ? `${attPanelInfo.count} archivo(s)` : "Archivos"}
                  </div>

                  {attDownloadErr ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                      {attDownloadErr}
                    </div>
                  ) : null}

                  <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                    {(attPanelInfo?.items ?? []).map((a) => {
                      const fname = String(a.filename || "archivo");
                      const sz = formatBytes(a.size);
                      const meta = [sz || "", a.mimeType ? String(a.mimeType) : ""].filter(Boolean).join(" • ");
                      const busy = attDownloadBusyId === String(a.id);

                      return (
                        <div key={a.id} className="p-3 flex items-center justify-between gap-3 bg-card">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{fname}</div>
                            <div className="text-xs text-muted truncate">{meta || "Archivo"}</div>
                          </div>

                          <button
                            type="button"
                            className={cn("tp-btn", "shrink-0", busy && "opacity-60")}
                            disabled={busy}
                            onClick={() => void downloadAttachment(a)}
                            title="Descargar"
                          >
                            {busy ? "Descargando…" : "Descargar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-muted">
                    Tip: usa cookie httpOnly (no Bearer), así que esto descarga sin romper auth.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </TPTableWrap>
  );
}
