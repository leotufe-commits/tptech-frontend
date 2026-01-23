// tptech-frontend/src/components/LockScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Check, Delete, Eye, EyeOff, Lock, Loader2, LogOut } from "lucide-react";

type QuickUser = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;

  hasQuickPin?: boolean;
  pinEnabled?: boolean;

  hasPin?: boolean;

  // ✅ roles (pueden venir en distintas formas)
  roles?: Array<{ id?: string; name?: string }> | string[];
  roleNames?: string[];
  roleLabel?: string;
  role?: string;
  roleName?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
 * - Si te llegan roles system (OWNER/ADMIN/STAFF) los convierte a etiquetas amigables.
 * - Si te llegan "SALES_MANAGER" los "humaniza".
 * - Si ya te llega un label lindo, lo deja.
 *
 * IMPORTANTE:
 * Vos pediste "con el nombre del rol que figura en configuración".
 * En la UI de Configuración normalmente el Role.name es el label final.
 * Acá NO lo pisamos salvo que sea un "CODE" tipo OWNER/ADMIN/STAFF o SNAKE_CASE.
 */
function prettyRoleName(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";

  const MAP: Record<string, string> = {
    OWNER: "Propietario",
    ADMIN: "Administrador",
    STAFF: "Empleado",
  };

  const upper = s.toUpperCase();
  if (MAP[upper]) return MAP[upper];

  // si viene como "SALES_MANAGER" => "Sales Manager"
  if (/^[A-Z0-9_]+$/.test(s)) {
    return s
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // si viene como "Vendedor" / "Encargado" => queda igual
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
    // roles como string[]
    if (u.roles.every((x: any) => typeof x === "string")) {
      const arr = (u.roles as string[])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .map(prettyRoleName)
        .filter(Boolean);
      if (arr.length) return arr.join(" • ");
    }

    // roles como objetos
    const names = (u.roles as any[])
      .map((r) => (typeof r?.name === "string" ? r.name.trim() : ""))
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
 * ✅ FIX PRINCIPAL:
 * En algunos backends, /auth/me/pin/quick-users NO manda roles.
 * Entonces, para evitar "Sin rol" en los botones, unimos (merge) con info del usuario actual:
 * - Si el quick user coincide con el user logueado => inyectamos roles del AuthContext.
 * - Si el quick user no trae roles/roleNames/roleLabel => intentamos usar roleName/roleLabel si vienen,
 *   y si no, queda "Sin rol" (para otros usuarios) hasta que el backend lo envíe.
 *
 * ⚠️ Nota: para ver roles correctos de TODOS los usuarios, el backend debe devolver roleNames/roles en quick-users.
 */
function normalizeQuickUser(u: any, opts?: { currentUserId?: string; currentUserRoles?: any[] }): QuickUser {
  const currentUserId = opts?.currentUserId ? String(opts.currentUserId) : "";
  const sameAsCurrent = currentUserId && String(u?.id ?? "") === currentUserId;

  // base
  const baseRoles = u?.roles;
  const baseRoleNames = Array.isArray(u?.roleNames) ? u.roleNames : undefined;

  // ✅ si es el usuario actual y el backend no trajo roles, injectamos roles reales del contexto
  const injectedRoles =
    sameAsCurrent && (!Array.isArray(baseRoles) || baseRoles.length === 0) && Array.isArray(opts?.currentUserRoles)
      ? opts!.currentUserRoles
      : baseRoles;

  const roleNames =
    Array.isArray(baseRoleNames) && baseRoleNames.length
      ? baseRoleNames
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

  return {
    id: String(u?.id ?? ""),
    email: String(u?.email ?? ""),
    name: u?.name ?? null,
    avatarUrl: u?.avatarUrl ?? null,

    hasQuickPin: Boolean(u?.hasQuickPin ?? u?.hasPin),
    pinEnabled: Boolean(u?.pinEnabled ?? u?.quickPinEnabled ?? true),

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
    roles, // ✅ roles reales del usuario logueado
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

  // ✅ focus visual del “campo” de PIN
  const [pinFocused, setPinFocused] = useState(false);

  /**
   * ✅ FIX “flash del teclado”
   * Si la joyería permite switch SIN PIN, NO mostramos teclado nunca.
   */
  const switchingWithoutPin = useMemo(
    () => Boolean(quickSwitchEnabled && !pinLockRequireOnUserSwitch),
    [quickSwitchEnabled, pinLockRequireOnUserSwitch]
  );

  // en modo switch sin pin, NO pedimos pin nunca
  const mustEnterPin = !switchingWithoutPin;

  // ✅ Último usuario usado en ESTE dispositivo (por joyería/tenant)
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
      .map((x) => x[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
  }, [displayName]);

  // ✅ rol del usuario actual (usar roles del auth, no del user)
  const currentUserRoleLabel = useMemo(() => {
    const roleArr = Array.isArray(roles) ? roles : [];
    const roleNames = roleArr.map((r: any) => (typeof r?.name === "string" ? r.name.trim() : "")).filter(Boolean);

    const uExtended: any = {
      ...(user as any),
      roles: roleArr.length ? roleArr : (user as any)?.roles,
      roleNames: roleNames.length ? roleNames : (user as any)?.roleNames,
    };

    return getUserRoleLabel(uExtended);
  }, [user, roles]);

  const selectedUserLabel = useMemo(() => {
    if (!targetUserId) return null;
    const u = quickUsers.find((x) => x.id === targetUserId);
    return u ? (u.name || u.email) : "Usuario";
  }, [targetUserId, quickUsers]);

  // ✅ rol del usuario seleccionado (cambio)
  const selectedUserRoleLabel = useMemo(() => {
    if (!targetUserId) return "";
    const u = quickUsers.find((x) => x.id === targetUserId);
    return getUserRoleLabel(u);
  }, [targetUserId, quickUsers]);

  const allowContinue = useMemo(() => {
    if (busy) return false;

    // ✅ modo switch sin PIN: continuar solo si hay target elegido
    if (!mustEnterPin) return Boolean(targetUserId);

    // modo con PIN
    return pin.length === 4;
  }, [busy, mustEnterPin, pin.length, targetUserId]);

  const continueLabel = useMemo(() => {
    if (busy) return "Verificando…";
    return targetUserId ? "Continuar" : "Desbloquear";
  }, [busy, targetUserId]);

  function isUserSelectable(u: QuickUser) {
    // modo sin PIN: todos los usuarios activos pueden seleccionarse
    if (!pinLockRequireOnUserSwitch) return true;

    // modo con PIN: sólo usuarios con PIN habilitado + con hash
    const has = Boolean(u.hasQuickPin ?? u.hasPin);
    const enabled = Boolean(u.pinEnabled ?? true);
    return has && enabled;
  }

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

    // ✅ modo sin PIN: hay que elegir usuario y se switchea
    if (!mustEnterPin) {
      if (!targetUserId) {
        setError("Seleccioná un usuario para continuar.");
        return;
      }
      await doSwitchNoPin(targetUserId);
      return;
    }

    // ✅ modo con PIN
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
      // ✅ salir SIEMPRE del lock
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

  // ✅ si quedó locked pero se apagó el PIN global, salimos
  useEffect(() => {
    if (locked && !pinLockEnabled) {
      setLocked(false);
    }
  }, [locked, pinLockEnabled, setLocked]);

  // ✅ cargar quick users + preseleccionar último usado (del dispositivo)
  useEffect(() => {
    if (!locked || !pinLockEnabled) return;

    // DEV bypass
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
        if (found && isUserSelectable(found)) {
          setTargetUserId(savedId);
          return;
        }
      }

      const firstSelectable = users.find((u) => isUserSelectable(u));
      setTargetUserId(firstSelectable?.id ?? null);
    };

    if (quickSwitchEnabled) {
      setQuickUsersLoading(true);
      pinQuickUsers()
        .then((res: any) => {
          const usersRaw = (res?.enabled ? (res?.users ?? []) : []) as any[];

          // ✅ FIX: merge roles del usuario actual si el backend no los manda en quick-users
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

  // ✅ teclado físico (global) — Enter simula botón
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

      // ✅ solo acepta números cuando hay PIN (modo con PIN)
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

  // ✅ focus trap
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
        // ✅ EXTRA: Enter siempre “toca el botón”
        onKeyDownCapture={(e) => {
          if (busy) return;
          if (e.key === "Enter") {
            e.preventDefault();
            void handleUnlock();
          }
        }}
      >
        {/* ✅ input invisible */}
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

          {/* ✅ cerrar sesión */}
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
              {(user as any).avatarUrl ? (
                <img src={(user as any).avatarUrl} className="h-full w-full object-cover" alt="avatar" />
              ) : (
                <div className="text-sm font-bold text-primary">{initials}</div>
              )}
            </div>

            <div className="min-w-0">
              <div className="font-semibold truncate">{displayName}</div>

              <div className="text-xs text-muted truncate">{(user as any).email}</div>

              {/* ✅ ROL ABAJO DEL MAIL (como en Configuración) */}
              <div className="mt-0.5 text-[11px] text-muted truncate">{currentUserRoleLabel || "Sin rol"}</div>

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

          {/* ✅ Cambiar usuario */}
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

                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={!selectable || busy}
                          className={cn(
                            "w-full text-left rounded-2xl px-3 py-2 border transition select-none",
                            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",

                            selectable && !selected && "bg-surface border-border shadow-[0_6px_14px_rgba(0,0,0,0.18)]",
                            selectable &&
                              !selected &&
                              "hover:translate-y-[-1px] hover:shadow-[0_10px_22px_rgba(0,0,0,0.22)]",
                            selectable &&
                              !selected &&
                              "active:translate-y-[0px] active:shadow-[0_4px_10px_rgba(0,0,0,0.16)]",

                            selected &&
                              "bg-[color-mix(in_oklab,var(--primary)_14%,var(--surface))] border-[color-mix(in_oklab,var(--primary)_45%,var(--border))] " +
                                "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_10px_24px_rgba(0,0,0,0.25)] " +
                                "ring-2 ring-primary/35",

                            (!selectable || busy) && "opacity-50 shadow-none translate-y-0"
                          )}
                          onClick={() => {
                            setError(null);
                            setTargetUserId(u.id);
                            rememberLastDeviceUser(u.id);

                            if (!pinLockRequireOnUserSwitch) {
                              void doSwitchNoPin(u.id);
                              return;
                            }

                            focusPin();
                          }}
                          title={
                            selectable ? "Seleccionar usuario" : "Este usuario no tiene PIN configurado (o está deshabilitado)"
                          }
                        >
                          <div className="text-xs font-semibold truncate">{u.name || u.email}</div>
                          {/* ✅ ROL DEBAJO DEL MAIL (como pediste) */}
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

          {/* ✅ PIN UI solo si corresponde */}
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
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
