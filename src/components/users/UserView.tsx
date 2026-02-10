// tptech-frontend/src/components/users/UserView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  Pencil,
  KeyRound,
  Shield,
  Paperclip,
  Phone,
  MapPin,
  IdCard,
  StickyNote,
  ShieldCheck,
  ShieldBan,
  User,
  Users,
  Fingerprint,
  Trash2,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useInventory } from "../../context/InventoryContext";

import { cn, absUrl, initialsFrom } from "./users.ui";
import { TPBadge } from "../ui/TPBadges";

import { prefetchUserDetail, getRolesCached, getPermsCached } from "./users.data";
import { deleteUser } from "../../services/users";

import type { UserDetail, Role, Override } from "../../services/users";
import type { Permission } from "../../services/permissions";

import ConfirmDeleteDialog from "../ui/ConfirmDeleteDialog";
import ButtonBar from "../ui/ButtonBar";

const OPEN_USERS_EDIT_KEY = "tptech_users_open_edit_v1";

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

function valueOrDash(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function cardBase(extra?: string) {
  return cn("tp-card rounded-2xl border border-border bg-card p-4", extra);
}

function SectionShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cardBase()}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {children}
    </div>
  );
}

export default function UserView() {
  const nav = useNavigate();
  const { id } = useParams();
  const userId = String(id || "");

  const auth = useAuth();
  const meId = String((auth.user as any)?.id || "");
  const permissions: string[] = (auth.permissions ?? []) as string[];

  const canView = permissions.includes("USERS_ROLES:VIEW") || permissions.includes("USERS_ROLES:ADMIN");
  const canAdmin = permissions.includes("USERS_ROLES:ADMIN");
  const isMe = Boolean(meId && userId && meId === userId);

  const inv = useInventory();
  const almacenes = (inv?.almacenes ?? []) as Array<{
    id: string;
    nombre: string;
    codigo?: string;
    ubicacion?: string;
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
    const code = w.codigo ? ` (${w.codigo})` : "";
    return `${w.nombre}${code}`;
  }

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const [perms, setPerms] = useState<Permission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);

  // ✅ ConfirmDeleteDialog
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const roleById = useMemo(() => {
    const m = new Map<string, Role>();
    for (const r of roles) m.set(String((r as any).id), r);
    return m;
  }, [roles]);

  function roleLabel(r: any) {
    const fromCatalog = r?.id ? roleById.get(String(r.id)) : null;
    const base: any = fromCatalog ?? r;
    const display = String((base as any)?.displayName || "").trim();
    if (display) return display;
    const name = String(base?.name || "").trim();
    return name || "Rol";
  }

  function labelPerm(permissionId: string) {
    const p = perms.find((x: any) => String(x?.id) === String(permissionId));
    if (!p) return permissionId;
    return `${(p as any).module} • ${(p as any).action}`;
  }

  const overridesSorted = useMemo(() => {
    const arr = [...((((detail as any)?.permissionOverrides ?? []) as Override[]) || [])];
    arr.sort((a, b) =>
      labelPerm(a.permissionId).localeCompare(labelPerm(b.permissionId), "es", { sensitivity: "base" })
    );
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, perms]);

  const attachments = useMemo(() => {
    const arr = ((detail as any)?.attachments ?? []) as any[];
    return Array.isArray(arr) ? arr : [];
  }, [detail]);

  async function ensureCatalogs() {
    if (!roles.length) {
      setRolesLoading(true);
      try {
        const list = await getRolesCached();
        setRoles(list as any);
      } finally {
        setRolesLoading(false);
      }
    }

    if (!perms.length) {
      setPermsLoading(true);
      try {
        const list = await getPermsCached();
        setPerms(list as any);
      } finally {
        setPermsLoading(false);
      }
    }
  }

  async function load() {
    if (!canView || !userId) return;

    setErr(null);
    setLoading(true);

    try {
      await ensureCatalogs();
      const d = await prefetchUserDetail(userId);
      if (!d) throw new Error("No se encontró el usuario.");
      setDetail(d);
    } catch (e: any) {
      setErr(String(e?.message || "Error cargando usuario"));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, userId]);

  if (!canView) return <div className="p-6">Sin permisos.</div>;

  const avatarSrc = detail?.avatarUrl ? absUrl(detail.avatarUrl) : "";
  const initials = initialsFrom(detail?.name || detail?.email || "U");

  const status = String(detail?.status || "").toUpperCase();
  const isActive = status === "ACTIVE";
  const isPending = status === "PENDING";
  const isBlocked = status === "BLOCKED";

  const hasPin = Boolean((detail as any)?.hasQuickPin);
  const pinEnabled = Boolean((detail as any)?.pinEnabled);

  const favLabel = detail?.favoriteWarehouseId
    ? warehouseLabelById(detail.favoriteWarehouseId) ?? detail.favoriteWarehouseId
    : null;

  const miniHint = "text-[11px] text-muted";

  function onAskDelete() {
    if (isMe || deleting) return;
    setConfirmDeleteOpen(true);
  }

  async function onConfirmDelete() {
    if (!userId || deleting) return;

    setDeleting(true);
    try {
      await deleteUser(userId);
      setConfirmDeleteOpen(false);
      nav("/configuracion/usuarios");
    } catch (e: any) {
      setErr(String(e?.message || "No se pudo eliminar el usuario."));
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-0">
      {/* ✅ Confirm modal */}
      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        title="Eliminar usuario"
        description="Esta acción no se puede deshacer."
        dangerHint="Se eliminará el usuario y perderá acceso al sistema."
        confirmText={deleting ? "Eliminando…" : "Eliminar"}
        cancelText="Cancelar"
        loading={deleting}
        onClose={() => {
          if (deleting) return;
          setConfirmDeleteOpen(false);
        }}
        onConfirm={onConfirmDelete}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">Dashboard / Configuración</div>
          <h1 className="text-2xl font-semibold truncate">Ver usuario</h1>
        </div>

        {/* ✅ ButtonBar reutilizable */}
        <ButtonBar>
          <button
            type="button"
            className="tp-btn-secondary inline-flex items-center gap-2"
            onClick={() => nav("/configuracion/usuarios")}
          >
            <ChevronLeft className="h-4 w-4" />
            Volver
          </button>

          {canAdmin && (
            <>
              <button
                type="button"
                className="tp-btn-primary inline-flex items-center gap-2"
                onClick={() => {
                  try {
                    sessionStorage.setItem(OPEN_USERS_EDIT_KEY, JSON.stringify({ userId }));
                  } catch {}
                  nav(`/configuracion/usuarios?edit=${encodeURIComponent(userId)}`);
                }}
                title={isMe ? "Editar" : "Editar usuario"}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>

              <button
                type="button"
                className={cn(
                  "tp-btn-secondary inline-flex items-center gap-2",
                  (isMe || deleting) && "opacity-60 pointer-events-none"
                )}
                onClick={onAskDelete}
                title={isMe ? "No podés eliminar tu propio usuario" : "Eliminar usuario"}
                aria-disabled={isMe || deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar
              </button>
            </>
          )}
        </ButtonBar>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">{err}</div>
      )}

      {/* Summary */}
      <div className={cn("tp-card p-4 rounded-2xl border border-border")}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : !detail ? (
          <div className="text-sm text-muted">No hay datos del usuario.</div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 rounded-full overflow-hidden border border-border bg-surface shrink-0">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-base font-bold text-primary">{initials}</div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xl truncate">
                {detail.name || "Sin nombre"} {isMe && <span className="text-xs text-muted">(vos)</span>}
              </div>

              <div className="text-sm text-muted truncate">{detail.email}</div>
              <div className="text-xs text-muted mt-1">Creado: {formatDateTime(detail.createdAt) || "—"}</div>

              <div className="mt-2 flex flex-wrap gap-2">
                <TPBadge tone={isActive ? "success" : isPending ? "warning" : "danger"}>
                  {isActive ? "Activo" : isPending ? "Pendiente" : "Inactivo"}
                </TPBadge>

                {hasPin ? (
                  <TPBadge tone={pinEnabled ? "success" : "danger"} className="gap-1">
                    {pinEnabled ? <KeyRound className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    {pinEnabled ? "PIN habilitado" : "PIN deshabilitado"}
                  </TPBadge>
                ) : (
                  <TPBadge tone="danger">Sin PIN</TPBadge>
                )}

                {favLabel ? <TPBadge tone="neutral">⭐ {favLabel}</TPBadge> : <TPBadge tone="neutral">⭐ —</TPBadge>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Secciones */}
      {detail && (
        <div className="space-y-4">
          {/* DATA */}
          <SectionShell title="Datos" icon={<User className="h-4 w-4" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className={cardBase("p-3")}>
                <div className="text-xs text-muted mb-1 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  Teléfono
                </div>
                <div className="font-semibold">
                  {valueOrDash(
                    `${String((detail as any).phoneCountry || "").trim()} ${String((detail as any).phoneNumber || "").trim()}`.trim()
                  )}
                </div>
              </div>

              <div className={cardBase("p-3")}>
                <div className="text-xs text-muted mb-1 flex items-center gap-2">
                  <IdCard className="h-3.5 w-3.5" />
                  Documento
                </div>
                <div className="font-semibold">
                  {valueOrDash(
                    `${String((detail as any).documentType || "").trim()} ${String((detail as any).documentNumber || "").trim()}`.trim()
                  )}
                </div>
              </div>

              <div className={cardBase("p-3 md:col-span-2")}>
                <div className="text-xs text-muted mb-1 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  Dirección
                </div>
                <div className="font-semibold">
                  {valueOrDash(
                    [String((detail as any).street || "").trim(), String((detail as any).number || "").trim()]
                      .filter(Boolean)
                      .join(" ")
                  )}
                </div>
                <div className="text-xs text-muted mt-1">
                  {[
                    String((detail as any).city || "").trim(),
                    String((detail as any).province || "").trim(),
                    String((detail as any).postalCode || "").trim(),
                    String((detail as any).country || "").trim(),
                  ]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </div>
              </div>

              <div className={cardBase("p-3 md:col-span-2")}>
                <div className="text-xs text-muted mb-1 flex items-center gap-2">
                  <StickyNote className="h-3.5 w-3.5" />
                  Notas
                </div>
                <div className="font-semibold whitespace-pre-wrap break-words">
                  {String((detail as any).notes || "").trim() || "—"}
                </div>
              </div>
            </div>
          </SectionShell>

          {/* ROLES + OVERRIDES */}
          <SectionShell title="Roles y permisos" icon={<Users className="h-4 w-4" />}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={cardBase("lg:col-span-2")}>
                <div className="text-sm font-semibold mb-3">Roles</div>

                {rolesLoading ? (
                  <div className="text-sm text-muted flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando roles…
                  </div>
                ) : (detail.roles || []).length ? (
                  <div className="flex flex-wrap gap-2">
                    {detail.roles.map((r: any) => (
                      <TPBadge key={r.id ?? r.name} tone="neutral">
                        {roleLabel(r)}
                      </TPBadge>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted">Sin roles</div>
                )}
              </div>

              <div className={cardBase()}>
                <div className="text-sm font-semibold mb-3">Estado</div>

                <div className="space-y-3 text-sm">
                  <div className="rounded-xl border border-border bg-card px-3 py-2">
                    <div className="text-xs text-muted mb-1">Estado</div>
                    <div className="flex items-center gap-2">
                      {isActive ? <ShieldCheck className="h-4 w-4" /> : <ShieldBan className="h-4 w-4" />}
                      <div className="font-semibold">
                        {isActive ? "Activo" : isPending ? "Pendiente" : isBlocked ? "Inactivo" : valueOrDash(status)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card px-3 py-2">
                    <div className="text-xs text-muted mb-1">Almacén favorito</div>
                    <div className="font-semibold">{favLabel || "—"}</div>
                  </div>

                  <div className={miniHint}>
                    * Cambios desde <b>Editar</b>.
                  </div>
                </div>
              </div>

              <div className={cardBase("lg:col-span-3")}>
                <div className="text-sm font-semibold mb-3">Permisos especiales</div>

                {permsLoading ? (
                  <div className="text-sm text-muted flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando permisos…
                  </div>
                ) : overridesSorted.length === 0 ? (
                  <div className="text-sm text-muted">Este usuario no tiene permisos especiales.</div>
                ) : (
                  <div className="space-y-2">
                    {overridesSorted.map((ov) => (
                      <div
                        key={ov.permissionId}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{labelPerm(ov.permissionId)}</div>
                          <div className="text-xs text-muted truncate">{ov.permissionId}</div>
                        </div>

                        <TPBadge tone={ov.effect === "ALLOW" ? "success" : "danger"}>
                          {ov.effect === "ALLOW" ? "Permitir" : "Denegar"}
                        </TPBadge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionShell>

          {/* PIN */}
          <SectionShell title="Acceso por PIN" icon={<Fingerprint className="h-4 w-4" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className={cardBase("p-3")}>
                <div className="text-xs text-muted mb-1">Tiene PIN</div>
                <div className="font-semibold">{hasPin ? "Sí" : "No"}</div>
              </div>

              <div className={cardBase("p-3")}>
                <div className="text-xs text-muted mb-1">Estado</div>
                <div className="font-semibold">{hasPin ? (pinEnabled ? "Habilitado" : "Deshabilitado") : "—"}</div>
              </div>

              <div className={cardBase("p-3")}>
                <div className="text-xs text-muted mb-1">Última actualización</div>
                <div className="font-semibold">{formatDateTime((detail as any).quickPinUpdatedAt || null) || "—"}</div>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-muted">
              * Esta vista es <b>solo lectura</b>. Cambios desde <b>Editar</b>.
            </div>
          </SectionShell>

          {/* ATTACHMENTS */}
          <SectionShell title="Adjuntos" icon={<Paperclip className="h-4 w-4" />}>
            {attachments.length === 0 ? (
              <div className="text-sm text-muted">Este usuario no tiene adjuntos.</div>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {attachments.map((a: any) => {
                  const fname = String(a.filename || "archivo");
                  const meta = [formatBytes(a.size), String(a.mimeType || "")].filter(Boolean).join(" • ");

                  // ✅ Igual que Empresa: endpoint dedicado de descarga
                  const downloadHref = absUrl(`/users/${encodeURIComponent(userId)}/attachments/${encodeURIComponent(String(a.id))}/download`);

                  return (
                    <div key={a.id} className="p-3 flex items-center justify-between gap-3 bg-card">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{fname}</div>
                        <div className="text-xs text-muted truncate">{meta || "Archivo"}</div>
                        {a.createdAt && <div className="text-[11px] text-muted">Subido: {formatDateTime(a.createdAt)}</div>}
                      </div>

                      <a
                        href={downloadHref}
                        className={cn("tp-btn", "shrink-0")}
                        target="_blank"
                        rel="noreferrer"
                        download
                        title="Descargar"
                      >
                        Descargar
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 text-[11px] text-muted">
              * Para subir/eliminar adjuntos, usá <b>Editar</b>.
            </div>
          </SectionShell>
        </div>
      )}
    </div>
  );
}
