// tptech-frontend/src/components/LockScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Check, Delete, Lock, Loader2, LogOut } from "lucide-react";
import EyeIcon from "./EyeIcon";

type QuickUser = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;

  hasQuickPin?: boolean;
  pinEnabled?: boolean;

  hasPin?: boolean;

  // ✅ roles (pueden venir en distintas formas)
  roles?: Array<{ id?: string; name?: string; displayName?: string }> | string[];
  roleNames?: string[];
  roleLabel?: string;
  role?: string;
  roleName?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * ✅ Convierte URLs relativas ("/uploads/...") en absolutas hacia el backend.
 * Si ya es "http/https", la deja igual.
 */
function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const API = base.replace(/\/+$/, "");
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API}${p}`;
}

function friendlyPinError(rawMsg?: string) {
  const m = String(rawMsg || "").toLowerCase();
  if (!m) return "PIN incorrecto.";
  if (m.includes("expired") || m.includes("expirad")) return "PIN incorrecto.";
  if (m.includes("invalid") || m.includes("incorrect") || m.includes("wrong")) return "PIN incorrecto.";
  if (m.includes("locked") || m.includes("bloquead")) return "Demasiados intentos. Esperá unos minutos.";
  return rawMsg || "PIN incorrecto.";
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/**
 * ✅ Normaliza nombre de rol para que coincida con lo que mostrás en Configuración/Usuarios/Roles.
 */
function prettyRoleName(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";

  const MAP: Record<string, string> = {
    OWNER: "Propietario",
    ADMIN: "Administrador",
    STAFF: "Empleado",
    MANAGER: "Encargado",

    READONLY: "Solo lectura",
    READ_ONLY: "Solo lectura",
    SOLO_LECTURA: "Solo lectura",
  };

  const upper = s.toUpperCase();
  if (MAP[upper]) return MAP[upper];

  if (/^[A-Z0-9_]+$/.test(upper)) {
    return upper
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return s;
}

/** ✅ Devuelve etiqueta de roles (soporta múltiples formas y múltiples roles) */
function getUserRoleLabel(u: any): string {
  if (!u) return "";

  // 1) roleNames: string[]
  if (Array.isArray(u.roleNames) && u.roleNames.length) {
    const arr = u.roleNames
      .filter((x: any) => typeof x === "string" && x.trim())
      .map((x: string) => x.trim())
      .map(prettyRoleName)
      .filter(Boolean);
    if (arr.length) return arr.join(" • ");
  }

  // 2) roles: string[] | {name}[]
  if (Array.isArray(u.roles) && u.roles.length) {
    if (u.roles.every((x: any) => typeof x === "string")) {
      const arr = (u.roles as string[])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .map(prettyRoleName)
        .filter(Boolean);
      if (arr.length) return arr.join(" • ");
    }

    const names = (u.roles as any[])
      .map((r) => {
        const dn = typeof r?.displayName === "string" ? r.displayName.trim() : "";
        const n = typeof r?.name === "string" ? r.name.trim() : "";
        return dn || n;
      })
      .filter(Boolean)
      .map(prettyRoleName)
      .filter(Boolean);
    if (names.length) return names.join(" • ");
  }

  // 3) roleLabel directo
  if (typeof u.roleLabel === "string" && u.roleLabel.trim()) return prettyRoleName(u.roleLabel.trim());

  // 4) otros campos directos comunes
  const direct =
    (typeof u.role === "string" ? u.role : "") ||
    (typeof u.roleName === "string" ? u.roleName : "") ||
    (typeof u?.role?.name === "string" ? u.role.name : "") ||
    "";

  return prettyRoleName(String(direct || "").trim());
}

/**
 * ✅ Merge quick user con roles del usuario actual si el endpoint no los manda.
 */
function normalizeQuickUser(
  u: any,
  opts?: { currentUserId?: string; currentUserRoles?: any[] }
): QuickUser {
  const currentUserId = opts?.currentUserId ? String(opts.currentUserId) : "";
  const sameAsCurrent = currentUserId && String(u?.id ?? "") === currentUserId;

  const baseRoles = u?.roles;
  const baseRoleNames = Array.isArray(u?.roleNames) ? u.roleNames : undefined;

  const injectedRoles =
    sameAsCurrent &&
    (!Array.isArray(baseRoles) || baseRoles.length === 0) &&
    Array.isArray(opts?.currentUserRoles)
      ? opts!.currentUserRoles
      : baseRoles;

  const roleNames =
    Array.isArray(baseRoleNames) && baseRoleNames.length
      ? baseRoleNames
          .filter((x: any) => typeof x === "string" && x.trim())
          .map((x: string) => x.trim())
      : Array.isArray(injectedRoles)
      ? injectedRoles
          .map((r: any) => (typeof r === "string" ? r : r?.name))
          .filter((x: any) => typeof x === "string" && x.trim())
          .map((x: string) => x.trim())
      : [];

  const roleLabel =
    (typeof u?.roleLabel === "string" && u.roleLabel.trim() ? u.roleLabel.trim() : "") ||
    (roleNames.length ? roleNames.join(" • ") : "") ||
    (typeof u?.roleName === "string" ? u.roleName : "") ||
    (typeof u?.role === "string" ? u.role : "") ||
    "";

  const has = Boolean(u?.hasQuickPin ?? u?.hasPin);
  const enabled =
    typeof u?.pinEnabled === "boolean"
      ? u.pinEnabled
      : typeof u?.quickPinEnabled === "boolean"
      ? u.quickPinEnabled
      : has;

  return {
    id: String(u?.id ?? ""),
    email: String(u?.email ?? ""),
    name: u?.name ?? null,
    avatarUrl: u?.avatarUrl ?? null,

    hasQuickPin: has,
    pinEnabled: enabled,
    hasPin: Boolean(u?.hasPin),

    roles: injectedRoles,
    roleNames,
    roleLabel,
    role: u?.role,
    roleName: u?.roleName,
  };
}

export default function LockScreen() {
  const {
    user,
    locked,
    setLocked,
    pinUnlock,
    pinQuickUsers,
    pinSwitchUser,
    quickSwitchEnabled,
    pinLockEnabled,
    pinLockRequireOnUserSwitch,
    jewelry,
    logout,
    roles,
  } = useAuth() as any;

  const DEV = import.meta.env.DEV;
  const bypass = DEV && sessionStorage.getItem("tptech_lock_bypass") === "1";

  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quickUsers, setQuickUsers] = useState<QuickUser[]>([]);
  const [quickUsersLoading, setQuickUsersLoading] = useState(false);

  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  const [pinFocused, setPinFocused] = useState(false);

  const switchingWithoutPin = useMemo(
    () => Boolean(quickSwitchEnabled && !pinLockRequireOnUserSwitch),
    [quickSwitchEnabled, pinLockRequireOnUserSwitch]
  );

  const mustEnterPin = !switchingWithoutPin;

  const lastDeviceUserKey = useMemo(() => {
    const jId = (jewelry as any)?.id ? String((jewelry as any).id) : "no-jewelry";
    return `tptech_device_last_user:${jId}`;
  }, [jewelry]);

  const pinDisplay = useMemo(() => {
    const slots = 4;
    const chars = pin.slice(0, 4).split("");
    const out: string[] = [];
    for (let i = 0; i < slots; i++) {
      const c = chars[i];
      if (!c) out.push("_");
      else out.push(showPin ? c : "•");
    }
    return out.join(" ");
  }, [pin, showPin]);

  const displayName = useMemo(() => {
    if (!user) return "Usuario";
    return (user?.name || "").trim() || user?.email || "Usuario";
  }, [user]);

  const initials = useMemo(() => {
    return displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x: string) => x[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
  }, [displayName]);

  const selectedUserLabel = useMemo(() => {
    if (!targetUserId) return null;
    const u = quickUsers.find((x) => x.id === targetUserId);
    return u ? (u.name || u.email) : "Usuario";
  }, [targetUserId, quickUsers]);

  const selectedUserRoleLabel = useMemo(() => {
    if (!targetUserId) return "";
    const u = quickUsers.find((x) => x.id === targetUserId);
    return getUserRoleLabel(u);
  }, [targetUserId, quickUsers]);

  // ✅ NUEVO: seleccionado es "usable" (tiene PIN y está habilitado)
  function isUserUsable(u: QuickUser) {
    const has = Boolean(u.hasQuickPin ?? u.hasPin);
    const enabled = Boolean(u.pinEnabled ?? has);
    return has && enabled;
  }

  // ✅ NUEVO: para UI: nunca "bloqueamos" (disabled) el botón usuario
  function isUserSelectable(_u: QuickUser) {
    return true;
  }

  const allowContinue = useMemo(() => {
    if (busy) return false;

    // si no pide PIN (cambio sin pin), igual requiere elegir un usuario
    if (!mustEnterPin) return Boolean(targetUserId);

    // si hay quick switch, requiere: usuario elegido Y pin de 4 dígitos
    if (quickSwitchEnabled) return Boolean(targetUserId) && pin.length === 4;

    // si no hay quick switch (solo desbloquear), alcanza con pin de 4 dígitos
    return pin.length === 4;
  }, [busy, mustEnterPin, pin.length, targetUserId, quickSwitchEnabled]);

  const continueLabel = useMemo(() => {
    if (busy) return "Verificando…";
    return targetUserId ? "Continuar" : "Desbloquear";
  }, [busy, targetUserId]);

  function focusPin() {
    queueMicrotask(() => hiddenInputRef.current?.focus?.());
  }

  function rememberLastDeviceUser(id: string) {
    if (!id) return;
    safeSet(lastDeviceUserKey, String(id));
  }

  async function doSwitchNoPin(targetId: string) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await pinSwitchUser({ targetUserId: targetId, pin4: "" } as any);
      rememberLastDeviceUser(targetId);
      setLocked(false);
      setPin("");
      setTargetUserId(null);
      setShowPin(false);
    } catch (e: any) {
      setError(friendlyPinError(e?.message));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    if (busy) return;

    if (!mustEnterPin) {
      if (!targetUserId) {
        setError("Seleccioná un usuario para continuar.");
        return;
      }
      await doSwitchNoPin(targetUserId);
      return;
    }

    // ✅ validación extra: si hay quick switch y se requiere PIN por usuario, el usuario elegido debe ser usable
    if (quickSwitchEnabled && pinLockRequireOnUserSwitch && targetUserId) {
      const u = quickUsers.find((x) => x.id === targetUserId);
      if (u && !isUserUsable(u)) {
        setError("Este usuario no tiene PIN configurado (o está deshabilitado).");
        setPin("");
        setShowPin(false);
        focusPin();
        return;
      }
    }

    if (pin.length !== 4) return;

    setError(null);

    if (!/^\d{4}$/.test(pin)) {
      setError("Ingresá un PIN de 4 dígitos.");
      return;
    }

    setBusy(true);
    try {
      if (targetUserId && quickSwitchEnabled) {
        await pinSwitchUser({ targetUserId, pin4: pin } as any);
        rememberLastDeviceUser(targetUserId);
      } else {
        await pinUnlock({ pin4: pin } as any);
        if ((user as any)?.id) rememberLastDeviceUser((user as any).id);
      }

      setLocked(false);
      setPin("");
      setTargetUserId(null);
      setShowPin(false);
      focusPin();
    } catch (e: any) {
      setError(friendlyPinError(e?.message));
      setPin("");
      setShowPin(false);
      focusPin();
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } finally {
      try {
        window.location.assign("/login");
      } catch {
        window.location.href = "/login";
      }
    }
  }

  function pressDigit(d: string) {
    if (busy) return;
    if (!mustEnterPin) return;
    setError(null);
    setPin((p) => (p.length >= 4 ? p : (p + d).slice(0, 4)));
    focusPin();
  }

  function backspaceOne() {
    if (busy) return;
    if (!mustEnterPin) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
    focusPin();
  }

  function clearAll() {
    if (busy) return;
    if (!mustEnterPin) return;
    setError(null);
    setPin("");
    focusPin();
  }

  useEffect(() => {
    if (locked && !pinLockEnabled) {
      setLocked(false);
    }
  }, [locked, pinLockEnabled, setLocked]);

  useEffect(() => {
    if (!locked || !pinLockEnabled) return;

    if (DEV && sessionStorage.getItem("tptech_lock_bypass") === "1") {
      setPin("");
      setError(null);
      setTargetUserId(null);
      setQuickUsers([]);
      setQuickUsersLoading(false);
      setShowPin(false);
      return;
    }

    setPin("");
    setError(null);
    setShowPin(false);

    const preselectFromDevice = (users: QuickUser[]) => {
      if (!quickSwitchEnabled || users.length === 0) {
        setTargetUserId(null);
        return;
      }

      const saved = safeGet(lastDeviceUserKey);
      const savedId = saved ? String(saved) : null;

      if (savedId) {
        const found = users.find((u) => u.id === savedId);
        if (found) {
          setTargetUserId(savedId);
          return;
        }
      }

      setTargetUserId(users[0]?.id ?? null);
    };

    if (quickSwitchEnabled) {
      setQuickUsersLoading(true);
      pinQuickUsers()
        .then((res: any) => {
          const usersRaw = (res?.enabled ? (res?.users ?? []) : []) as any[];

          const currentUserId = String((user as any)?.id ?? "");
          const roleArr = Array.isArray(roles) ? roles : [];

          const users = usersRaw.map((u: any) =>
            normalizeQuickUser(u, { currentUserId, currentUserRoles: roleArr })
          );

          setQuickUsers(users);
          preselectFromDevice(users);
        })
        .catch(() => {
          setQuickUsers([]);
          setTargetUserId(null);
        })
        .finally(() => {
          setQuickUsersLoading(false);
        });
    } else {
      setQuickUsers([]);
      setTargetUserId(null);
      setQuickUsersLoading(false);
    }

    queueMicrotask(() => {
      dialogRef.current?.focus?.();
      if (mustEnterPin) focusPin();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, pinLockEnabled, quickSwitchEnabled, pinQuickUsers, DEV, lastDeviceUserKey, user, roles]);

  useEffect(() => {
    if (!locked || !pinLockEnabled || bypass) return;

    function onKeyDown(e: KeyboardEvent) {
      if (busy) return;

      if (e.key === "Enter") {
        e.preventDefault();
        void handleUnlock();
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        backspaceOne();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        return;
      }

      if (mustEnterPin && /^\d$/.test(e.key)) {
        e.preventDefault();
        setError(null);
        setPin((p) => (p.length >= 4 ? p : (p + e.key).slice(0, 4)));
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, pinLockEnabled, bypass, busy, mustEnterPin]);

  useEffect(() => {
    if (!locked || !pinLockEnabled || bypass) return;

    function getFocusable(root: HTMLElement) {
      const nodes = root.querySelectorAll<HTMLElement>(
        ["button", "[href]", "input", "select", "textarea", "[tabindex]:not([tabindex='-1'])"].join(",")
      );
      return Array.from(nodes).filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;

      const focusables = getFocusable(root);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [locked, pinLockEnabled, bypass]);

  if (!locked || !pinLockEnabled || !user || bypass) return null;

  // ✅ Avatar url normalizada (arregla /uploads/... en LockScreen)
  const userAvatarSrc = (user as any)?.avatarUrl ? absUrl(String((user as any).avatarUrl)) : "";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-3xl border border-border bg-card shadow-soft overflow-hidden outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="Sesión bloqueada"
        onMouseDown={() => {
          if (mustEnterPin) focusPin();
        }}
        onKeyDownCapture={(e) => {
          if (busy) return;
          if (e.key === "Enter") {
            e.preventDefault();
            void handleUnlock();
          }
        }}
      >
        {mustEnterPin && (
          <input
            ref={hiddenInputRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d*"
            aria-hidden="true"
            tabIndex={-1}
            value={pin}
            onFocus={() => setPinFocused(true)}
            onBlur={() => setPinFocused(false)}
            onKeyDown={(e) => {
              if (busy) return;

              if (e.key === "Enter") {
                e.preventDefault();
                void handleUnlock();
                return;
              }

              if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault();
                backspaceOne();
                return;
              }
            }}
            onChange={(e) => {
              if (busy) return;
              const digits = String(e.target.value || "").replace(/\D/g, "").slice(0, 4);
              setError(null);
              setPin(digits);
            }}
            className="absolute -left-[9999px] -top-[9999px] h-0 w-0 opacity-0 pointer-events-none"
          />
        )}

        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <div className="font-semibold">Sesión bloqueada</div>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2",
              "text-xs font-semibold text-text hover:brightness-110",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
              busy && "opacity-60"
            )}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl border border-border bg-surface grid place-items-center overflow-hidden">
              {userAvatarSrc ? (
                <img
                  src={userAvatarSrc}
                  className="h-full w-full object-cover"
                  alt="avatar"
                  onError={(e) => {
                    // ✅ fallback: ocultar img y mostrar iniciales
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="text-sm font-bold text-primary">{initials}</div>
              )}

              {/* ✅ Si el <img> falla y se oculta, mostramos iniciales abajo */}
              {userAvatarSrc ? (
                <div className="text-sm font-bold text-primary pointer-events-none select-none">{initials}</div>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="font-semibold truncate">{displayName}</div>
              <div className="text-xs text-muted truncate">{(user as any).email}</div>

              {selectedUserLabel && (
                <div className="mt-1 text-[11px] text-muted truncate">
                  Cambiar a: <span className="text-text font-semibold">{selectedUserLabel}</span>
                  <span className="ml-2 text-[11px] text-muted">({selectedUserRoleLabel || "Sin rol"})</span>
                </div>
              )}

              {quickSwitchEnabled && !pinLockRequireOnUserSwitch && (
                <div className="mt-1 text-[11px] text-muted">Cambio de usuario sin PIN</div>
              )}
            </div>
          </div>

          {quickSwitchEnabled && (
            <div className="tp-card p-3 min-h-[140px]">
              <div className="text-xs text-muted mb-2">Cambiar usuario</div>

              {quickUsersLoading ? (
                <div className="h-[110px] grid place-items-center">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando…
                  </div>
                </div>
              ) : quickUsers.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {quickUsers.map((u) => {
                      const selectable = isUserSelectable(u);
                      const selected = targetUserId === u.id;

                      const roleLabel = getUserRoleLabel(u) || "Sin rol";
                      const usable = isUserUsable(u);

                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={busy}
                          className={cn(
                            "w-full text-left rounded-2xl px-3 py-2 border transition select-none",
                            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",

                            !selected && "bg-surface border-border shadow-[0_6px_14px_rgba(0,0,0,0.18)]",
                            !selected && "hover:translate-y-[-1px] hover:shadow-[0_10px_22px_rgba(0,0,0,0.22)]",
                            !selected && "active:translate-y-[0px] active:shadow-[0_4px_10px_rgba(0,0,0,0.16)]",

                            selected &&
                              "bg-[color-mix(in_oklab,var(--primary)_14%,var(--surface))] border-[color-mix(in_oklab,var(--primary)_45%,var(--border))] " +
                                "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_10px_24px_rgba(0,0,0,0.25)] " +
                                "ring-2 ring-primary/35",

                            busy && "opacity-60 pointer-events-none",

                            // ✅ si NO es usable, NO lo bloqueamos, solo lo vemos más tenue
                            pinLockRequireOnUserSwitch && !usable && "opacity-70"
                          )}
                          onClick={() => {
                            if (busy) return;

                            setError(null);
                            setTargetUserId(u.id);
                            rememberLastDeviceUser(u.id);

                            if (!pinLockRequireOnUserSwitch) {
                              void doSwitchNoPin(u.id);
                              return;
                            }

                            // ✅ si no es usable, avisamos, pero igual lo dejamos seleccionar
                            if (!usable) {
                              setError("Este usuario no tiene PIN configurado (o está deshabilitado).");
                            }

                            focusPin();
                          }}
                          title={
                            pinLockRequireOnUserSwitch && !usable
                              ? "Este usuario no tiene PIN configurado (o está deshabilitado)"
                              : "Seleccionar usuario"
                          }
                        >
                          <div className="text-xs font-semibold truncate">{u.name || u.email}</div>
                          <div className="text-[11px] text-muted truncate">{u.email}</div>
                          <div className="mt-0.5 text-[11px] text-muted truncate">{roleLabel}</div>
                        </button>
                      );
                    })}
                  </div>

                  {!pinLockRequireOnUserSwitch && (
                    <div className="mt-2 text-[11px] text-muted">Cambio de usuario sin PIN habilitado.</div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-muted">No hay usuarios disponibles para cambio rápido.</div>
              )}
            </div>
          )}

          {mustEnterPin && (
            <>
              <div className="space-y-2">
                <div className="relative">
                  <div
                    className={cn(
                      "w-full rounded-2xl border bg-bg px-4 py-3 text-center",
                      "text-lg font-semibold tracking-[0.25em]",
                      "select-none transition",
                      pinFocused
                        ? "border-[color-mix(in_oklab,var(--primary)_55%,var(--border))] ring-4 ring-primary/20"
                        : "border-border"
                    )}
                    aria-label="PIN"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      focusPin();
                    }}
                  >
                    <span className={cn(pin.length === 0 && "text-muted")}>{pinDisplay}</span>
                  </div>

                  <button
                    type="button"
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2",
                      "h-9 w-9 rounded-xl border border-border bg-surface",
                      "grid place-items-center",
                      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                      busy && "opacity-60"
                    )}
                    onClick={() => {
                      setShowPin((v) => !v);
                      focusPin();
                    }}
                    disabled={busy}
                    aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                    title={showPin ? "Ocultar" : "Mostrar"}
                  >
                    <EyeIcon open={showPin} />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted px-1">
                  <span>Teclado: números • Enter • Borrar</span>
                  <button
                    type="button"
                    className="text-[11px] underline decoration-border hover:text-text"
                    onClick={clearAll}
                    disabled={busy || pin.length === 0}
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={cn(
                      "h-14 rounded-2xl border border-border bg-surface",
                      "text-lg font-semibold",
                      "shadow-[0_8px_18px_rgba(0,0,0,0.22)]",
                      "hover:translate-y-[-1px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.26)]",
                      "active:translate-y-[0px] active:shadow-[0_6px_14px_rgba(0,0,0,0.18)]",
                      "transition",
                      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                      busy && "opacity-60 pointer-events-none"
                    )}
                    onClick={() => pressDigit(d)}
                    disabled={busy}
                    aria-label={`Tecla ${d}`}
                  >
                    {d}
                  </button>
                ))}

                <button
                  type="button"
                  className={cn(
                    "h-14 rounded-2xl border border-border bg-surface",
                    "text-sm font-semibold",
                    "shadow-[0_8px_18px_rgba(0,0,0,0.22)]",
                    "hover:translate-y-[-1px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.26)]",
                    "active:translate-y-[0px] active:shadow-[0_6px_14px_rgba(0,0,0,0.18)]",
                    "transition",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                    (busy || pin.length === 0) && "opacity-60 pointer-events-none"
                  )}
                  onClick={clearAll}
                  disabled={busy || pin.length === 0}
                  title="Limpiar"
                  aria-label="Limpiar"
                >
                  C
                </button>

                <button
                  type="button"
                  className={cn(
                    "h-14 rounded-2xl border border-border bg-surface",
                    "text-lg font-semibold",
                    "shadow-[0_8px_18px_rgba(0,0,0,0.22)]",
                    "hover:translate-y-[-1px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.26)]",
                    "active:translate-y-[0px] active:shadow-[0_6px_14px_rgba(0,0,0,0.18)]",
                    "transition",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                    busy && "opacity-60 pointer-events-none"
                  )}
                  onClick={() => pressDigit("0")}
                  disabled={busy}
                  aria-label="Tecla 0"
                >
                  0
                </button>

                <button
                  type="button"
                  className={cn(
                    "h-14 rounded-2xl border border-border bg-surface",
                    "inline-flex items-center justify-center",
                    "shadow-[0_8px_18px_rgba(0,0,0,0.22)]",
                    "hover:translate-y-[-1px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.26)]",
                    "active:translate-y-[0px] active:shadow-[0_6px_14px_rgba(0,0,0,0.18)]",
                    "transition",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                    (busy || pin.length === 0) && "opacity-60 pointer-events-none"
                  )}
                  onClick={backspaceOne}
                  disabled={busy || pin.length === 0}
                  title="Borrar"
                  aria-label="Borrar"
                >
                  <Delete className="h-5 w-5" />
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            className={cn(
              "w-full rounded-2xl h-12 px-4",
              "inline-flex items-center justify-center gap-2",
              "border border-border",
              allowContinue ? "bg-primary text-primary-foreground" : "bg-surface text-muted",
              "transition",
              allowContinue && "hover:brightness-110 active:scale-[0.99]",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            )}
            onClick={() => void handleUnlock()}
            disabled={!allowContinue}
          >
            {allowContinue && !busy ? <Check className="h-4 w-4" /> : null}
            {continueLabel}
          </button>

          {error && <div className="text-sm text-red-500 bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}
        </div>
      </div>
    </div>
  );
}
