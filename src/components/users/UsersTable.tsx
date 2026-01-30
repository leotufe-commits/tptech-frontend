// tptech-frontend/src/components/users/UsersTable.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Trash2, ShieldBan, ShieldCheck, X, Paperclip, KeyRound, Shield } from "lucide-react";

import { cn, initialsFrom, absUrl } from "./users.ui";
import { SortArrows } from "../ui/TPSort";
import { TPBadge } from "../ui/TPBadges";

import {
  TPTableWrap,
  TPTableEl,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../ui/TPTable";

import type { UserListItem } from "../../services/users";

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

function pinLabel(u: any) {
  const has = Boolean(u?.hasQuickPin);
  const enabled = Boolean(u?.pinEnabled);
  if (!has) return "sin pin";
  return enabled ? "pin habilitado" : "pin deshabilitado";
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
  url: string;
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
   OWNER helpers (👑)
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

function userHasOwner(u: any, roleLabelFn?: (r: any) => string) {
  const roles = Array.isArray(u?.roles) ? u.roles : [];
  return roles.some((r: any) => isOwnerRole(r, roleLabelFn));
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

  prefetchUserDetail: (id: string) => Promise<any>;
};

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
  } = props;

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
        ak = norm(pinLabel(a));
        bk = norm(pinLabel(b));
      } else if (sortBy === "ROLES") {
        const aRoles = ((a?.roles ?? []) as any[]).map((r) => roleLabel(r)).join(" ").trim();
        const bRoles = ((b?.roles ?? []) as any[]).map((r) => roleLabel(r)).join(" ").trim();
        ak = norm(aRoles + (userHasOwner(a, roleLabel) ? " owner propietario" : "") + (hasSpecial(a) ? " permiso especial" : ""));
        bk = norm(bRoles + (userHasOwner(b, roleLabel) ? " owner propietario" : "") + (hasSpecial(b) ? " permiso especial" : ""));
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
  }, [users, sortBy, sortDir, roleLabel, warehouseLabelById]);

  // ✅ Botón ícono (outline)
  const iconBtnBase =
    "inline-flex items-center justify-center rounded-lg border border-border bg-transparent " +
    "h-9 w-9 text-text/90 hover:bg-surface2/60 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20";

  const disabledCls = "opacity-40 cursor-not-allowed hover:bg-transparent";

  /* ======================================================
     Attachments panel (clic en 📎)
  ====================================================== */
  type AttInfo = { has: boolean; count: number; items?: AttachmentItem[] };

  const attCacheRef = useRef<Map<string, AttInfo>>(new Map());
  const attInFlightRef = useRef<Set<string>>(new Set());

  const [attPanelUserId, setAttPanelUserId] = useState<string | null>(null);
  const [attTick, setAttTick] = useState(0);

  function closeAttPanel() {
    setAttPanelUserId(null);
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
      const d = await prefetchUserDetail(userId);
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

  return (
    <TPTableWrap className="w-full">
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
                  const showClip = attCount > 0;

                  const pinHas = Boolean(u.hasQuickPin);
                  const pinEnabled = Boolean(u.pinEnabled);

                  const isOwner = userHasOwner(u, roleLabel);

                  return (
                    <TPTr key={u.id} className="border-t border-border">
                      {/* Usuario */}
                      <TPTd>
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

                              {isOwner && (
                                <TPBadge tone="warning" title="Propietario (OWNER)">
                                  👑 Propietario
                                </TPBadge>
                              )}

                              {isMe && <span className="text-[11px] text-muted">(vos)</span>}
                            </div>

                            <div className="text-xs text-muted truncate">{u.email}</div>

                            {u.createdAt && <div className="text-[11px] text-muted">Creado: {formatDateTime(u.createdAt)}</div>}
                          </div>
                        </div>
                      </TPTd>

                      {/* Estado */}
                      <TPTd>
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

                      {/* PIN */}
                      <TPTd>
                        {pinHas ? (
                          <TPBadge
                            tone={pinEnabled ? "success" : "danger"}
                            title={pinEnabled ? "PIN habilitado" : "PIN deshabilitado"}
                            className="gap-1"
                          >
                            {pinEnabled ? <KeyRound className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                            {pinEnabled ? "Habilitado" : "Deshabilitado"}
                          </TPBadge>
                        ) : (
                          <span className="text-xs text-muted">Sin PIN</span>
                        )}
                      </TPTd>
                      {/* Roles */}
                      <TPTd>
                        <div className="flex flex-wrap gap-2">
                          {(u.roles || []).length ? (
                            u.roles.map((r: any) => (
                              <TPBadge key={r.id ?? r.name}>{roleLabel(r)}</TPBadge>
                            ))
                          ) : (
                            <span className="text-muted">Sin roles</span>
                          )}

                          {hasSpecial(u) && (
                            <TPBadge tone="info" title="Tiene permisos especiales">
                              Permiso especial
                            </TPBadge>
                          )}
                        </div>
                      </TPTd>

                      {/* Almacén */}
                      <TPTd>
                        {u.favoriteWarehouseId ? (
                          <TPBadge tone="neutral">
                            ⭐ {warehouseLabelById(u.favoriteWarehouseId) ?? u.favoriteWarehouseId}
                          </TPBadge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TPTd>

                      {/* Acciones */}
                      <TPTd className="text-right">
                        <div className="flex justify-end gap-2">
                          {/* 📎 Adjuntos */}
                          {showClip && (
                            <button
                              type="button"
                              className={cn(iconBtnBase)}
                              onClick={() => void openAttPanel(u)}
                              title={`Ver adjuntos (${attCount})`}
                            >
                              <Paperclip className="h-4 w-4" />
                            </button>
                          )}

                          {/* Activar / Inactivar */}
                          <button
                            type="button"
                            className={cn(iconBtnBase, !canToggleThis && disabledCls)}
                            disabled={!canToggleThis}
                            onClick={() => (canToggleThis ? toggleStatus(u) : null)}
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
                            {isActive ? (
                              <ShieldBan className="h-4 w-4" />
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
                            )}
                          </button>

                          {/* Editar */}
                          <button
                            type="button"
                            className={cn(iconBtnBase, !canEditThis && disabledCls)}
                            disabled={!canEditThis}
                            onClick={() => (canEditThis ? openEdit(u) : null)}
                            title={
                              !canAdmin && !isMe
                                ? "Sin permisos"
                                : isMe
                                ? "Editar tu perfil"
                                : "Editar usuario"
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* Eliminar */}
                          <button
                            type="button"
                            className={cn(iconBtnBase, !canDeleteThis && disabledCls)}
                            disabled={!canDeleteThis}
                            onClick={() => (canDeleteThis ? askDelete(u) : null)}
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
                      </TPTd>
                    </TPTr>
                  );
                })
              )}
            </TPTbody>
          </table>
        </TPTableEl>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 flex items-center justify-between">
        <div className="text-xs text-muted">{totalLabel}</div>

        <div className="flex items-center gap-2">
          <button
            className={cn("tp-btn", page <= 1 && "opacity-50 cursor-not-allowed")}
            type="button"
            disabled={page <= 1}
            onClick={onPrev}
          >
            Anterior
          </button>

          <div className="text-xs text-muted">
            Página <b className="text-text">{page}</b> / {totalPages}
          </div>

          <button
            className={cn("tp-btn", page >= totalPages && "opacity-50 cursor-not-allowed")}
            type="button"
            disabled={page >= totalPages}
            onClick={onNext}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Panel de adjuntos */}
      {attPanelUserId && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeAttPanel} />

          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  Adjuntos — {attPanelUser ? userLabel(attPanelUser as any) : "Usuario"}
                </div>
                <div className="text-xs text-muted truncate">
                  {attPanelUser ? String((attPanelUser as any).email || "") : ""}
                </div>
              </div>

              <button
                type="button"
                className={cn(iconBtnBase)}
                onClick={closeAttPanel}
                title="Cerrar"
              >
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
                    {attPanelInfo?.count != null
                      ? `${attPanelInfo.count} archivo(s)`
                      : "Archivos"}
                  </div>

                  <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                    {(attPanelInfo?.items ?? []).map((a) => {
                      const url = absUrl(String(a.url || ""));
                      const fname = String(a.filename || "archivo");
                      const sz = formatBytes(a.size);
                      const meta = [sz || "", a.mimeType ? String(a.mimeType) : ""]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <div
                          key={a.id}
                          className="p-3 flex items-center justify-between gap-3 bg-card"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{fname}</div>
                            <div className="text-xs text-muted truncate">
                              {meta || "Archivo"}
                            </div>
                          </div>

                          <a
                            href={url}
                            className={cn("tp-btn", "shrink-0")}
                            target="_blank"
                            rel="noreferrer"
                            download
                          >
                            Descargar
                          </a>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-muted">
                    Tip: “Descargar” abre el archivo en una pestaña (o descarga según tu navegador).
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
