// tptech-frontend/src/components/Topbar.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Menu, Settings, Lock, UsersRound } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ThemeSwitcher from "./ThemeSwitcher";

type RouteMeta = {
  title: string;
  crumbs: { label: string; to?: string }[];
};

function getMeta(pathname: string): RouteMeta {
  const p = pathname.toLowerCase();

  if (p === "/dashboard" || p.startsWith("/dashboard/")) {
    return { title: "Dashboard", crumbs: [{ label: "Dashboard" }] };
  }

  if (p.startsWith("/configuracion-sistema")) {
    // subpages
    if (p.startsWith("/configuracion-sistema/pin")) {
      return {
        title: "Configurar PIN",
        crumbs: [
          { label: "Dashboard", to: "/dashboard" },
          { label: "Configuración", to: "/configuracion-sistema" },
          { label: "PIN" },
        ],
      };
    }
    if (p.startsWith("/configuracion-sistema/tema")) {
      return {
        title: "Tema",
        crumbs: [
          { label: "Dashboard", to: "/dashboard" },
          { label: "Configuración", to: "/configuracion-sistema" },
          { label: "Tema" },
        ],
      };
    }

    return {
      title: "Configuración del sistema",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Configuración" }],
    };
  }

  // compat rutas viejas
  if (p.startsWith("/configuracion")) {
    return {
      title: "Configuración",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Configuración" }],
    };
  }

  if (p.startsWith("/divisas")) {
    return {
      title: "Divisas",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Divisas" }],
    };
  }

  return { title: "TPTech", crumbs: [{ label: "Dashboard", to: "/dashboard" }] };
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
}

function useOutsideClickToClose(
  open: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;

    function onDown(e: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onClose();
    }

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, containerRef, onClose]);
}

/**
 * Menú flotante en Portal (no se corta por overflow del layout).
 * Posiciona debajo del botón, y si no entra, abre hacia arriba.
 */
function PortalMenu({
  open,
  anchorRef,
  onClose,
  children,
  width = 340,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [, forceTick] = useState(0);

  useEscapeToClose(open, onClose);
  useOutsideClickToClose(open, menuRef, onClose);

  useEffect(() => {
    if (!open) return;
    const onRecalc = () => forceTick((t: number) => t + 1);
    window.addEventListener("resize", onRecalc);
    window.addEventListener("scroll", onRecalc, true);
    return () => {
      window.removeEventListener("resize", onRecalc);
      window.removeEventListener("scroll", onRecalc, true);
    };
  }, [open]);

  if (!open) return null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _tick = forceTick; // evita warning si TS/ESLint se pone pesado

  const r = anchorRef.current?.getBoundingClientRect();
  const viewportPad = 10;
  const gap = 10;

  const maxH = Math.min(560, Math.max(280, window.innerHeight - viewportPad * 2));

  const anchorRight = r?.right ?? 0;
  const anchorTop = r?.top ?? 0;
  const anchorBottom = r?.bottom ?? 0;

  const leftWanted = anchorRight - width;
  const left = clamp(leftWanted, viewportPad, window.innerWidth - viewportPad - width);

  const spaceBelow = window.innerHeight - viewportPad - anchorBottom;
  const spaceAbove = anchorTop - viewportPad;

  const openDown = spaceBelow >= 240 || spaceBelow >= spaceAbove;
  const topDown = clamp(anchorBottom + gap, viewportPad, window.innerHeight - viewportPad - maxH);
  const topUp = clamp(anchorTop - gap - maxH, viewportPad, window.innerHeight - viewportPad - maxH);
  const top = openDown ? topDown : topUp;

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          left,
          top,
          width,
          maxHeight: maxH,
          zIndex: 9999,
        }}
        className="rounded-2xl border border-border bg-bg shadow-[0_18px_40px_rgba(0,0,0,0.18)] overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tp-scroll overflow-auto" style={{ maxHeight: maxH }}>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

export default function Topbar({
  onToggleSidebar,
  onCloseSidebar,
}: {
  onToggleSidebar?: () => void;
  onCloseSidebar?: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const meta = useMemo(() => getMeta(pathname), [pathname]);

  const auth = useAuth();
  const locked = Boolean((auth as any)?.locked);

  const { theme, themes } = useTheme();

  const jewelryName = auth.jewelry?.name ?? (auth.loading ? "Cargando..." : "Sin joyería");

  const currentThemeLabel = useMemo(() => {
    return themes.find((t) => t.value === theme)?.label ?? "Tema";
  }, [themes, theme]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);

  const settingsAnchorRef = useMemo<React.RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return settingsBtnRef.current;
      },
    }),
    []
  );

  // cerrar menú al navegar y cerrar drawer (si existe)
  useEffect(() => {
    setSettingsOpen(false);
    onCloseSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ✅ si se bloquea, cerramos settings
  useEffect(() => {
    if (!locked) return;
    setSettingsOpen(false);
  }, [locked]);

  // ✅ pinLockEnabled robusto (compat con distintas versiones del AuthContext)
  const pinLockEnabled = Boolean(
    (auth as any).pinLockEnabled ??
      (auth as any).lockEnabled ??
      (auth as any)?.jewelry?.pinLockEnabled ??
      false
  );

  const pinLockTimeoutMinutes = Number(
    (auth as any).pinLockTimeoutMinutes ?? (auth as any).lockTimeoutMinutes ?? 5
  );

  const pinLockRequireOnUserSwitch = Boolean(
    (auth as any).pinLockRequireOnUserSwitch ??
      (auth as any)?.jewelry?.pinLockRequireOnUserSwitch ??
      true
  );

  const quickSwitchEnabled = Boolean(
    (auth as any).quickSwitchEnabled ?? (auth as any)?.jewelry?.quickSwitchEnabled ?? false
  );

  // “switch sin pin” = quickSwitch ON + requireOnUserSwitch false (y pin global ON)
  const switchWithoutPin = Boolean(
    pinLockEnabled && quickSwitchEnabled && pinLockRequireOnUserSwitch === false
  );

  function onPressLock() {
    if (locked) return;

    // ✅ Si el PIN está deshabilitado => ir a configuración NUEVA
    if (!pinLockEnabled) {
      navigate("/configuracion-sistema/pin");
      return;
    }

    // ✅ Si está habilitado => bloquear pantalla (LockScreen)
    const lockNowFn = (auth as any).lockNow;
    if (typeof lockNowFn === "function") {
      lockNowFn();
      return;
    }

    // ✅ fallback: si por versión no existe lockNow, usamos setLocked directo
    const setLockedFn = (auth as any).setLocked;
    if (typeof setLockedFn === "function") {
      setLockedFn(true);
      return;
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-[999] border-b border-border bg-bg/90 backdrop-blur",
        "[touch-action:pan-y]",
        "overflow-hidden",
        "[isolation:isolate]"
      )}
    >
      <div className="w-full px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          {/* IZQ: menú + título */}
          <div className="flex min-w-0 items-center gap-3">
            {/* ☰ solo mobile */}
            <button
              type="button"
              onClick={() => {
                if (locked) return;
                onToggleSidebar?.();
              }}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card",
                "lg:hidden",
                locked && "opacity-50 pointer-events-none",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              )}
              aria-label="Abrir menú"
              title="Menú"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <div className="hidden sm:flex gap-2 text-xs text-muted">
                {meta.crumbs.map((c, i) => (
                  <span key={i} className="truncate">
                    {c.to ? <Link to={c.to}>{c.label}</Link> : c.label}
                    {i < meta.crumbs.length - 1 && " / "}
                  </span>
                ))}
              </div>
              <h1 className="truncate text-lg font-semibold sm:text-xl">{meta.title}</h1>
            </div>
          </div>

          {/* DER */}
          <div className="flex shrink-0 items-center gap-2">
            {/* 🔒 Bloquear ahora (o ir a config si está apagado) */}
            <button
              type="button"
              onClick={onPressLock}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl border border-border bg-card",
                locked && "opacity-50 pointer-events-none",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              )}
              aria-label={
                pinLockEnabled ? (switchWithoutPin ? "Cambiar usuario" : "Bloquear") : "Configurar PIN"
              }
              title={
                pinLockEnabled ? (switchWithoutPin ? "Cambiar usuario" : "Bloquear") : "Configurar PIN"
              }
            >
              {switchWithoutPin ? <UsersRound className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </button>

            {/* ⚙️ Configuración */}
            <button
              ref={settingsBtnRef}
              type="button"
              onClick={() => {
                if (locked) return;
                onCloseSidebar?.();
                setSettingsOpen((v) => !v);
              }}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl border border-border bg-card",
                locked && "opacity-50 pointer-events-none",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              )}
              aria-label="Configuración"
              title="Configuración"
            >
              <Settings className="h-5 w-5" />
            </button>

            <PortalMenu
              open={settingsOpen}
              anchorRef={settingsAnchorRef}
              onClose={() => setSettingsOpen(false)}
              width={360}
            >
              <div className="p-3 space-y-3">
                <div className="px-1">
                  <div className="text-sm font-semibold text-text">Configuración</div>
                  <div className="text-xs text-muted">Preferencias del sistema</div>
                </div>

                {/* Tema (solo switch rápido, sin botones de navegación) */}
                <div className="tp-card p-3 space-y-2">
                  <div className="text-xs font-semibold text-muted">Tema</div>
                  <ThemeSwitcher variant="menu" />
                  <div className="text-[11px] text-muted">
                    Actual: <span className="font-semibold text-text">{currentThemeLabel}</span>
                  </div>
                </div>

                {/* Joyería + Seguridad (solo info, sin botones) */}
                <div className="tp-card p-3 space-y-2">
                  <div className="text-xs font-semibold text-muted">Joyería</div>

                  <div className="text-sm font-semibold text-text truncate" title={jewelryName}>
                    {jewelryName}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]",
                        pinLockEnabled
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-red-500/30 bg-red-500/10 text-red-300"
                      )}
                      title="Bloqueo por PIN"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {pinLockEnabled ? "PIN habilitado" : "PIN deshabilitado"}
                    </span>

                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] text-muted"
                      title="Tiempo de inactividad para bloquear"
                    >
                      ⏱ {Number.isFinite(pinLockTimeoutMinutes) ? pinLockTimeoutMinutes : 5} min
                    </span>

                    {pinLockEnabled && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]",
                          switchWithoutPin
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                            : "border-border bg-card text-muted"
                        )}
                        title="Cambio de usuario"
                      >
                        <UsersRound className="h-3.5 w-3.5" />
                        {switchWithoutPin ? "Switch sin PIN" : "Switch con PIN"}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 text-[11px] text-muted">
                    Para más opciones:{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={() => {
                        setSettingsOpen(false);
                        navigate("/configuracion-sistema/pin");
                      }}
                    >
                      Configuración PIN
                    </button>
                  </div>
                </div>
              </div>
            </PortalMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
