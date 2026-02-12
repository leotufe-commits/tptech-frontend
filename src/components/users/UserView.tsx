// tptech-frontend/src/components/users/UserView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  User as UserIcon,
  Users,
  Fingerprint,
  Mail,
  Warehouse,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useInventory } from "../../context/InventoryContext";

import { cn, absUrl, initialsFrom } from "./users.ui";
import { TPBadge } from "../ui/TPBadges";

import { prefetchUserDetail, getRolesCached, getPermsCached } from "./users.data";

import type { UserDetail, Role, Override } from "../../services/users";
import type { Permission } from "../../services/permissions";

import ButtonBar from "../ui/ButtonBar";

const OPEN_USERS_EDIT_KEY = "tptech_users_open_edit_v1";

/* =========================
   Helpers (mismo espíritu que PerfilJoyeriaView)
========================= */
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

function safeFileLabel(name: any) {
  const s = String(name ?? "").trim();
  return s || "archivo";
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

function InfoCard({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className={cn(cardBase("p-3"))}>
      <div className="text-xs text-muted mb-1 flex items-center gap-2">
        {icon}
        {label}
      </div>
      <div className="font-semibold whitespace-pre-wrap break-words">{valueOrDash(value)}</div>
    </div>
  );
}

function truthyParam(v: string | null) {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on" || s === "setup";
}

export default function UserView() {
  const nav = useNavigate();
  const location = useLocation();
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

  /**
   * ✅ AUTO-DERIVACIÓN A "CREAR PIN INICIAL"
   * Si llegamos con ?pin=setup (por ejemplo desde SystemPinSettings),
   * esta vista (solo lectura) redirige a Users.tsx (edit modal) para abrir directamente el flujo de PIN.
   */
  const wantsPinSetup = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    return truthyParam(sp.get("pin")) || truthyParam(sp.get("pinSetup")) || truthyParam(sp.get("setupPin"));
  }, [location.search]);

  const alreadyRedirectedRef = React.useRef(false);

  useEffect(() => {
    if (!wantsPinSetup) return;
    if (alreadyRedirectedRef.current) return;
    if (loading) return;
    if (!detail) return;

    const hasPin = Boolean((detail as any)?.hasQuickPin || (detail as any)?.quickPinEnabled);
    if (hasPin) return;

    alreadyRedirectedRef.current = true;

    try {
      sessionStorage.setItem(
        OPEN_USERS_EDIT_KEY,
        JSON.stringify({
          userId,
          openSection: "PIN",
          pinSetup: true,
          ts: Date.now(),
        })
      );
    } catch {
      // ignore
    }

    nav(`/configuracion/usuarios?edit=${encodeURIComponent(userId)}&pin=setup`, { replace: true });
  }, [wantsPinSetup, loading, detail, nav, userId]);

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

  function downloadUrl(attId: string) {
    const id = String(attId || "").trim();
    if (!id) return "";
    return absUrl(`/users/${encodeURIComponent(userId)}/attachments/${encodeURIComponent(id)}/download`);
  }

  const phone = valueOrDash(
    `${String((detail as any)?.phoneCountry || "").trim()} ${String((detail as any)?.phoneNumber || "").trim()}`.trim()
  );
  const doc = valueOrDash(
    `${String((detail as any)?.documentType || "").trim()} ${String((detail as any)?.documentNumber || "").trim()}`.trim()
  );

  const addressLine = valueOrDash(
    [String((detail as any)?.street || "").trim(), String((detail as any)?.number || "").trim()].filter(Boolean).join(" ")
  );
  const addressMeta =
    [
      String((detail as any)?.city || "").trim(),
      String((detail as any)?.province || "").trim(),
      String((detail as any)?.postalCode || "").trim(),
      String((detail as any)?.country || "").trim(),
    ]
      .filter(Boolean)
      .join(" • ") || "—";

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">Dashboard / Configuración</div>
          <h1 className="text-2xl font-semibold truncate">Ver usuario</h1>
        </div>

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
          )}
        </ButtonBar>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">{err}</div>}

      {/* Carga / vacío */}
      {loading ? (
        <div className={cn(cardBase(), "flex items-center gap-2 text-sm text-muted")}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </div>
      ) : !detail ? (
        <div className={cn(cardBase(), "text-sm text-muted")}>No hay datos del usuario.</div>
      ) : (
        <div className="space-y-4">
          {/* Resumen */}
          <div className={cn(cardBase("p-3"))}>
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 rounded-full overflow-hidden border border-border bg-surface shrink-0">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-sm font-bold text-primary">{initials}</div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-lg truncate">
                  {detail.name || "Sin nombre"} {isMe && <span className="text-xs text-muted">(vos)</span>}
                </div>
                <div className="text-sm text-muted truncate">{detail.email}</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <TPBadge tone={isActive ? "success" : isPending ? "warning" : "danger"}>
                    {isActive ? "Activo" : isPending ? "Pendiente" : isBlocked ? "Inactivo" : valueOrDash(status)}
                  </TPBadge>

                  {hasPin ? (
                    <TPBadge tone={pinEnabled ? "success" : "danger"} className="gap-1">
                      {pinEnabled ? <KeyRound className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                      {pinEnabled ? "PIN habilitado" : "PIN deshabilitado"}
                    </TPBadge>
                  ) : (
                    <TPBadge tone="danger">Sin PIN</TPBadge>
                  )}

                  {favLabel ? (
                    <TPBadge tone="neutral" className="gap-1">
                      <Warehouse className="h-3.5 w-3.5" /> {favLabel}
                    </TPBadge>
                  ) : (
                    <TPBadge tone="neutral">⭐ —</TPBadge>
                  )}
                </div>

                <div className="mt-2 text-[11px] text-muted">
                  Creado: <b>{formatDateTime(detail.createdAt) || "—"}</b>
                </div>
              </div>
            </div>
          </div>

          <SectionShell title="Datos del usuario" icon={<UserIcon className="h-4 w-4" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <InfoCard icon={<UserIcon className="h-3.5 w-3.5" />} label="Nombre" value={valueOrDash(detail.name)} />
              <InfoCard icon={<Mail className="h-3.5 w-3.5" />} label="Correo" value={valueOrDash(detail.email)} />

              <InfoCard icon={<Phone className="h-3.5 w-3.5" />} label="Teléfono" value={phone} />
              <InfoCard icon={<IdCard className="h-3.5 w-3.5" />} label="Documento" value={doc} />

              <InfoCard
                icon={<Users className="h-3.5 w-3.5" />}
                label="Roles"
                value={
                  rolesLoading ? (
                    "Cargando…"
                  ) : (detail.roles || []).length ? (
                    (detail.roles || []).map((r: any) => roleLabel(r)).join(" • ")
                  ) : (
                    "—"
                  )
                }
              />

              <InfoCard
                icon={<Fingerprint className="h-3.5 w-3.5" />}
                label="Acceso por PIN"
                value={
                  hasPin
                    ? pinEnabled
                      ? `Habilitado • ${valueOrDash(formatDateTime((detail as any)?.quickPinUpdatedAt))}`
                      : "Deshabilitado"
                    : "Sin PIN"
                }
              />
            </div>
          </SectionShell>

          <SectionShell title="Domicilio" icon={<MapPin className="h-4 w-4" />}>
            <div className={cn(cardBase("p-3"))}>
              <div className="text-xs text-muted mb-1 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                Dirección
              </div>
              <div className="font-semibold whitespace-pre-wrap break-words">{valueOrDash(addressLine)}</div>
              <div className="mt-1 text-xs text-muted whitespace-pre-wrap break-words">{valueOrDash(addressMeta)}</div>
            </div>
          </SectionShell>

          <SectionShell title="Notas" icon={<StickyNote className="h-4 w-4" />}>
            <div className={cn(cardBase("p-3"))}>
              <div className="text-xs text-muted mb-1">Notas</div>
              <div className="font-semibold whitespace-pre-wrap break-words">
                {String((detail as any)?.notes || "").trim() || "—"}
              </div>
            </div>
          </SectionShell>

          <SectionShell title="Permisos especiales" icon={<Shield className="h-4 w-4" />}>
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
          </SectionShell>

          <SectionShell title="Adjuntos" icon={<Paperclip className="h-4 w-4" />}>
            {attachments.length === 0 ? (
              <div className="text-sm text-muted">Todavía no hay adjuntos.</div>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {attachments.map((a: any) => {
                  const fname = safeFileLabel(a.filename);
                  const meta = [formatBytes(a.size), String(a.mimeType || "")].filter(Boolean).join(" • ");
                  const url = downloadUrl(a.id);

                  return (
                    <div key={a.id} className="p-3 flex items-center justify-between gap-3 bg-card">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{fname}</div>
                        <div className="text-xs text-muted truncate">{meta || "Archivo"}</div>
                      </div>

                      {url ? (
                        <a href={url} className={cn("tp-btn", "shrink-0")} title="Descargar">
                          Descargar
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 text-[11px] text-muted">
              * Esta vista es <b>solo lectura</b>. Para subir/eliminar adjuntos, usá <b>Editar</b>.
            </div>
          </SectionShell>
        </div>
      )}
    </div>
  );
}
