// tptech-frontend/src/components/users/UsersTable.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Paperclip,
  KeyRound,
  Shield,
  ChevronLeft,
  ChevronRight,
  Mail,
} from "lucide-react";

import { cn, initialsFrom, absUrl } from "./users.ui";
import { TPBadge } from "../ui/TPBadges";
import { TPTableKit, type TPColDef } from "../ui/TPTableKit";
import { TPTr, TPTd, TPTableFooter } from "../ui/TPTable";
import { TPRowActions } from "../ui/TPRowActions";

import type { UserListItem } from "../../services/users";
import { prefetchUserDetail as prefetchUserDetailInternal } from "./users.data";
import { downloadUserAttachmentFile } from "../../lib/users.api";
import { apiFetch } from "../../lib/api";

import {
  type SortCol,
  type SortDir,
  type AttachmentItem,
  type AttInfo,
  formatDateTime,
  norm,
  userLabel,
  statusLabel,
  hasSpecial,
  attachmentsCount,
  roleTone,
} from "./users.utils";
import UsersAttachmentPanel from "./UsersAttachmentPanel";

/* ======================================================
   Column definitions
====================================================== */
export const USERS_COLUMNS: TPColDef[] = [
  { key: "user",      label: "Usuario",          canHide: false, sortKey: "USER" },
  { key: "status",    label: "Estado",            width: "130px", sortKey: "STATUS" },
  { key: "pin",       label: "PIN",               width: "160px", sortKey: "PIN" },
  { key: "roles",     label: "Roles",             sortKey: "ROLES" },
  { key: "warehouse", label: "Almacén favorito",  width: "180px", sortKey: "FAV" },
  { key: "actions",   label: "Acciones",          canHide: false, width: "260px", align: "right" },
];

export const USERS_COL_LS_KEY = "tptech_col_users";

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

  prefetchUserDetail?: (id: string) => Promise<any>;
  colVis: Record<string, boolean>;
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
    prefetchUserDetail,
    colVis,
  } = props;

  const nav = useNavigate();

  const [sortBy, setSortBy] = useState<SortCol>("USER");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key as SortCol);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  // Override local para sincronizar listado sin refetch
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

      if (hasQuickPin !== undefined) next.hasQuickPin = hasQuickPin;
      if (pinEnabled !== undefined) next.pinEnabled = pinEnabled;

      if (hasQuickPin === false) next.pinEnabled = false;

      pinOverridesRef.current.set(userId, next);
      setPinTick((x) => x + 1);
    }

    window.addEventListener(PIN_EVENT, onPinUpdated as any);
    return () => window.removeEventListener(PIN_EVENT, onPinUpdated as any);
  }, []);

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
        : Boolean(rawUpdatedAt);

    let pinEnabled =
      typeof ov?.pinEnabled === "boolean"
        ? ov.pinEnabled
        : typeof u?.pinEnabled === "boolean"
        ? Boolean(u.pinEnabled)
        : typeof u?.quickPinEnabled === "boolean"
        ? Boolean(u.quickPinEnabled)
        : false;

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
        const aFav = a?.favoriteWarehouseId
          ? warehouseLabelById(a.favoriteWarehouseId) ?? a.favoriteWarehouseId
          : "";
        const bFav = b?.favoriteWarehouseId
          ? warehouseLabelById(b.favoriteWarehouseId) ?? b.favoriteWarehouseId
          : "";
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

  const iconBtnBase =
    "inline-flex items-center justify-center rounded-lg border border-border bg-transparent " +
    "h-9 w-9 text-text/90 hover:bg-surface2/60 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20";

  const disabledCls = "opacity-40 cursor-not-allowed hover:bg-transparent";
  const specialPillCls = "border-violet-500/30 bg-violet-500/10 text-violet-300 dark:text-violet-200";

  /* ======================================================
     INVITE
  ====================================================== */
  const [inviteBusyIds, setInviteBusyIds] = useState<Set<string>>(() => new Set());
  const [inviteFlash, setInviteFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const inviteCooldownRef = useRef<Map<string, number>>(new Map());
  const inviteFlashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (inviteFlashTimerRef.current) window.clearTimeout(inviteFlashTimerRef.current);
      inviteFlashTimerRef.current = null;

      for (const [, t] of inviteCooldownRef.current) {
        try {
          window.clearTimeout(t);
        } catch {}
      }
      inviteCooldownRef.current.clear();
    };
  }, []);

  function isInviteBusy(userId: string) {
    return inviteBusyIds.has(String(userId || ""));
  }

  function setInviteBusy(userId: string, busy: boolean) {
    const id = String(userId || "").trim();
    if (!id) return;

    setInviteBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function flashInvite(msg: string, type: "ok" | "err", ms: number) {
    setInviteFlash({ type, msg });
    if (inviteFlashTimerRef.current) window.clearTimeout(inviteFlashTimerRef.current);
    inviteFlashTimerRef.current = window.setTimeout(() => {
      setInviteFlash(null);
      inviteFlashTimerRef.current = null;
    }, ms);
  }

  async function sendInvite(u: any) {
    const id = String(u?.id || "").trim();
    if (!id) return;

    if (isInviteBusy(id)) return;

    setInviteBusy(id, true);
    setInviteFlash(null);

    try {
      await apiFetch<{ ok: boolean }>(`/users/${encodeURIComponent(id)}/invite`, {
        method: "POST",
      });

      flashInvite(`Invitación enviada a ${String(u?.email || "usuario")}.`, "ok", 2500);
    } catch (e: any) {
      flashInvite(e?.message || "No se pudo enviar la invitación.", "err", 3500);
    } finally {
      const prevT = inviteCooldownRef.current.get(id);
      if (prevT) {
        try {
          window.clearTimeout(prevT);
        } catch {}
      }

      const t = window.setTimeout(() => {
        setInviteBusy(id, false);
        inviteCooldownRef.current.delete(id);
      }, 1200);

      inviteCooldownRef.current.set(id, t as any);
    }
  }

  /* ======================================================
     Attachments panel
  ====================================================== */
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

  const usersLegend = useMemo(() => {
    const n = sortedUsers.length;
    return `${n} ${n === 1 ? "Usuario" : "Usuarios"}`;
  }, [sortedUsers.length]);

  return (
    <>
      {/* Flash msg */}
      {inviteFlash ? (
        <div
          className={cn(
            "mb-3 rounded-xl px-4 py-3 text-sm border",
            inviteFlash.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          )}
        >
          {inviteFlash.msg}
        </div>
      ) : null}

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

            const canInviteThis = canAdmin && !isMe && isPending;
            const inviteBusy = isInviteBusy(String(u.id)) || false;

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
                      {u.createdAt && (
                        <div className="text-[11px] text-muted">Creado: {formatDateTime(u.createdAt)}</div>
                      )}

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
                          <TPBadge tone="neutral">
                            ⭐ {warehouseLabelById(u.favoriteWarehouseId) ?? u.favoriteWarehouseId}
                          </TPBadge>
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
                    {/* Ver */}
                    <button type="button" className={cn(iconBtnBase)} onClick={() => openView(u)} title="Ver">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>

                    {/* Invitar */}
                    <button
                      type="button"
                      className={cn(iconBtnBase, (!canInviteThis || inviteBusy) && disabledCls)}
                      disabled={!canInviteThis || inviteBusy}
                      onClick={() => {
                        if (canInviteThis && !inviteBusy) void sendInvite(u);
                      }}
                      title={
                        !canAdmin
                          ? "Sin permisos"
                          : isMe
                          ? "No aplica"
                          : !isPending
                          ? "Solo disponible para Pendiente"
                          : inviteBusy
                          ? "Enviando…"
                          : "Enviar invitación"
                      }
                    >
                      {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    </button>

                    {/* Editar */}
                    <button
                      type="button"
                      className={cn(iconBtnBase, !canEditThis && disabledCls)}
                      disabled={!canEditThis}
                      onClick={() => {
                        if (canEditThis) void openEdit(u);
                      }}
                      title={isMe ? "Editar tu perfil" : "Editar usuario"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>

                    {/* Adjuntos */}
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

                    {/* Toggle estado */}
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
                      {isActive ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
                      )}
                    </button>

                    {/* Eliminar */}
                    <button
                      type="button"
                      className={cn(iconBtnBase, !canDeleteThis && disabledCls)}
                      disabled={!canDeleteThis}
                      onClick={() => {
                        if (canDeleteThis) askDelete(u);
                      }}
                      title={!canAdmin ? "Sin permisos" : isMe ? "No podés eliminarte" : "Eliminar"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Footer MOBILE */}
        <TPTableFooter className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="text-xs text-muted">
            <span className="text-text font-medium">{usersLegend}</span>
            {totalLabel ? <span className="ml-2">• {totalLabel}</span> : null}
          </div>

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
        </TPTableFooter>
      </div>

      {/* =========================
          DESKTOP — usa TPTableKit
         ========================= */}
      <div className="hidden sm:block w-full">
        <TPTableKit
          rows={sortedUsers}
          columns={USERS_COLUMNS}
          storageKey={USERS_COL_LS_KEY}
          sortKey={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          loading={loading}
          emptyText="Sin resultados."
          countLabel={(n) => `${n} ${n === 1 ? "Usuario" : "Usuarios"}`}
          renderRow={(u: any, vis) => {
            const status = String(u.status || "").toUpperCase();
            const isActive = status === "ACTIVE";
            const isPending = status === "PENDING";
            const isBlocked = status === "BLOCKED";
            const isMe = Boolean(meId && u.id === meId);

            const canToggleThis = canEditStatus && !isMe;
            const canEditThis = (canAdmin || isMe) && true;
            const canDeleteThis = canAdmin && !isMe;

            const canInviteThis = canAdmin && !isMe && isPending;
            const inviteBusy = isInviteBusy(String(u.id)) || false;

            const avatarSrc = u.avatarUrl ? absUrl(u.avatarUrl) : "";
            const initials = initialsFrom(u.name || u.email || "U");

            const attCount = listAttCount(u);

            const pin = effectivePin(u);
            const pinHas = pin.hasQuickPin;
            const pinEnabled = pin.pinEnabled;

            return (
              <TPTr key={u.id}>
                {vis.user && (
                  <TPTd className="align-top">
                    <button
                      type="button"
                      className={cn("w-full text-left rounded-xl hover:opacity-95 active:scale-[0.995] transition")}
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
                  </TPTd>
                )}

                {vis.status && (
                  <TPTd className="align-top">
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
                  </TPTd>
                )}

                {vis.pin && (
                  <TPTd className="align-top">
                    {pinHas ? (
                      <TPBadge tone={pinEnabled ? "success" : "danger"} title={pinEnabled ? "PIN habilitado" : "PIN deshabilitado"} className="gap-1">
                        {pinEnabled ? <KeyRound className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                        {pinEnabled ? "Habilitado" : "Deshabilitado"}
                      </TPBadge>
                    ) : (
                      <TPBadge tone="danger" title="Sin PIN">Sin PIN</TPBadge>
                    )}
                  </TPTd>
                )}

                {vis.roles && (
                  <TPTd className="align-top">
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
                  </TPTd>
                )}

                {vis.warehouse && (
                  <TPTd className="align-top">
                    {u.favoriteWarehouseId ? (
                      <TPBadge tone="neutral">
                        ⭐ {warehouseLabelById(u.favoriteWarehouseId) ?? u.favoriteWarehouseId}
                      </TPBadge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TPTd>
                )}

                {vis.actions && (
                  <TPTd className="align-top text-right">
                    <TPRowActions
                      extra={
                        <>
                          <button
                            type="button"
                            className={cn("tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0", (!canInviteThis || inviteBusy) && "opacity-40 cursor-not-allowed")}
                            disabled={!canInviteThis || inviteBusy}
                            onClick={() => { if (canInviteThis && !inviteBusy) void sendInvite(u); }}
                            title={!canAdmin ? "Sin permisos" : isMe ? "No aplica" : !isPending ? "Solo disponible para Pendiente" : inviteBusy ? "Enviando…" : "Enviar invitación"}
                          >
                            {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            className={cn("tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0", attCount <= 0 && "opacity-40 cursor-not-allowed")}
                            disabled={attCount <= 0}
                            onClick={() => { if (attCount > 0) void openAttPanel(u); }}
                            title={attCount > 0 ? `PDF/Adjuntos (${attCount})` : "Sin adjuntos"}
                          >
                            <Paperclip className="h-4 w-4" />
                          </button>
                        </>
                      }
                      onView={() => openView(u)}
                      onEdit={canEditThis ? () => { void openEdit(u); } : undefined}
                      onToggle={canToggleThis ? () => { void toggleStatus(u); } : undefined}
                      isActive={isActive}
                      onDelete={canDeleteThis ? () => askDelete(u) : undefined}
                    />
                  </TPTd>
                )}
              </TPTr>
            );
          }}
        />

        {/* Footer DESKTOP con paginado */}
        <TPTableFooter className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="text-xs text-muted">
            <span className="text-text font-medium">{usersLegend}</span>
            {totalLabel ? <span className="ml-2">• {totalLabel}</span> : null}
          </div>

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
        </TPTableFooter>
      </div>

      <UsersAttachmentPanel
        attPanelUserId={attPanelUserId}
        attPanelUser={attPanelUser}
        attPanelInfo={attPanelInfo}
        attPanelLoading={attPanelLoading}
        attDownloadBusyId={attDownloadBusyId}
        attDownloadErr={attDownloadErr}
        iconBtnBase={iconBtnBase}
        closeAttPanel={closeAttPanel}
        downloadAttachment={downloadAttachment}
      />
    </>
  );
}
