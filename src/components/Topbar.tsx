// tptech-frontend/src/components/Topbar.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Settings, Lock, UsersRound } from "lucide-react";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ThemeSwitcher from "./ThemeSwitcher";

import { getTopbarMeta } from "./topbar/topbar.meta";
import { cn } from "./topbar/topbar.utils";
import { PortalMenu } from "./topbar/PortalMenu";

export default function Topbar({
  onToggleSidebar,
  onCloseSidebar,
}: {
  onToggleSidebar?: () => void;
  onCloseSidebar?: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const meta = useMemo(() => getTopbarMeta(pathname), [pathname]);

  const auth = useAuth();
  const locked = Boolean((auth as any)?.locked);

  const { theme, themes } = useTheme();
  const jewelryName = auth.jewelry?.name ?? (auth.loading ? "Cargando..." : "Sin joyería");

  const currentThemeLabel = useMemo(
    () => themes.find((t) => t.value === theme)?.label ?? "Tema",
    [themes, theme]
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  /* Publica --topbar-h para que paneles laterales puedan posicionarse */
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () =>
      document.documentElement.style.setProperty("--topbar-h", `${el.offsetHeight}px`);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  // anchorRef estable (evita re-renders raros)
  const settingsAnchorRef = useMemo<React.RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return settingsBtnRef.current;
      },
    }),
    []
  );

  // cerrar menú al navegar + cerrar drawer (si existe)
  useEffect(() => {
    setSettingsOpen(false);
    onCloseSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // si se bloquea, cerramos settings
  useEffect(() => {
    if (!locked) return;
    setSettingsOpen(false);
  }, [locked]);

  // pinLockEnabled robusto (compat)
  const pinLockEnabled = Boolean(
    (auth as any).pinLockEnabled ?? (auth as any).lockEnabled ?? (auth as any)?.jewelry?.pinLockEnabled ?? false
  );

  const pinLockTimeoutMinutes = Number((auth as any).pinLockTimeoutMinutes ?? (auth as any).lockTimeoutMinutes ?? 5);

  const pinLockRequireOnUserSwitch = Boolean(
    (auth as any).pinLockRequireOnUserSwitch ?? (auth as any)?.jewelry?.pinLockRequireOnUserSwitch ?? true
  );

  const quickSwitchEnabled = Boolean(
    (auth as any).quickSwitchEnabled ?? (auth as any)?.jewelry?.quickSwitchEnabled ?? false
  );

  // ✅ Estado del PIN del usuario actual (compat) — FIX TS2881 (usar OR, no ?? con boolean)
  const meHasQuickPin = Boolean(
    (auth as any)?.me?.hasQuickPin ||
      (auth as any)?.me?.quickPinHash != null ||
      (auth as any)?.user?.hasQuickPin ||
      false
  );

  const mePinEnabled = Boolean(
    (auth as any)?.me?.pinEnabled ?? (auth as any)?.me?.quickPinEnabled ?? (auth as any)?.user?.pinEnabled ?? false
  );

  const canLockNow = Boolean(pinLockEnabled && meHasQuickPin && mePinEnabled);

  const switchWithoutPin = Boolean(pinLockEnabled && quickSwitchEnabled && pinLockRequireOnUserSwitch === false);

  const openQuickSwitchFn = (auth as any).openQuickSwitch as undefined | (() => void);

  // ✅ Podemos abrir selector si quickSwitch está ON y existe handler (aunque luego pida PIN)
  const canOpenQuickSwitchUI = Boolean(pinLockEnabled && quickSwitchEnabled && typeof openQuickSwitchFn === "function");

  function onPressLock() {
    if (locked) return;

    // 1) Si el sistema de PIN está apagado => ir a configuración
    if (!pinLockEnabled) {
      navigate("/configuracion-sistema/pin");
      return;
    }

    // 2) Si quickSwitch está ON y podemos abrir UI => abrir selector
    if (canOpenQuickSwitchUI && typeof openQuickSwitchFn === "function") {
      openQuickSwitchFn();
      return;
    }

    // 3) Caso normal: bloquear pantalla cuando PIN global está ON
    const lockNowFn = (auth as any).lockNow;
    if (typeof lockNowFn === "function") {
      lockNowFn();
      return;
    }

    // fallback: setLocked(true)
    const setLockedFn = (auth as any).setLocked;
    if (typeof setLockedFn === "function") {
      setLockedFn(true);
      return;
    }

    // último fallback
    navigate("/configuracion-sistema/pin");
  }

  const lockBtnLabel = !pinLockEnabled ? "Configurar PIN" : canOpenQuickSwitchUI ? "Cambiar usuario" : "Bloquear";

  return (
    <header
      ref={headerRef}
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
            {/* 🔒 / 👥 Acción principal */}
            <button
              type="button"
              onClick={onPressLock}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl border border-border bg-card",
                locked && "opacity-50 pointer-events-none",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              )}
              aria-label={lockBtnLabel}
              title={lockBtnLabel}
            >
              {canOpenQuickSwitchUI ? <UsersRound className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
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

                {/* Tema */}
                <div className="tp-card p-3 space-y-2">
                  <div className="text-xs font-semibold text-muted">Tema</div>
                  <ThemeSwitcher variant="menu" />
                  <div className="text-[11px] text-muted">
                    Actual: <span className="font-semibold text-text">{currentThemeLabel}</span>
                  </div>
                </div>

                {/* Joyería + Seguridad */}
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
                      title="Tiempo de inactividad"
                    >
                      ⏱ {Number.isFinite(pinLockTimeoutMinutes) ? pinLockTimeoutMinutes : 5} min
                    </span>

                    {pinLockEnabled && quickSwitchEnabled && (
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

                  {/* (opcional) debug visual mínimo */}
                  <div className="pt-2 text-[10px] text-muted/70">
                    Estado: {pinLockEnabled ? "PIN ON" : "PIN OFF"} · Usuario PIN:{" "}
                    {meHasQuickPin && mePinEnabled ? "OK" : "NO"} · Bloquear ahora: {canLockNow ? "Sí" : "No"}
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
