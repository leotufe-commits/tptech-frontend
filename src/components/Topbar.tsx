// tptech-frontend/src/components/Topbar.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { Menu, Settings, Lock } from "lucide-react";
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
  const meta = useMemo(() => getMeta(pathname), [pathname]);

  const auth = useAuth();
  const locked = auth.locked;

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
            {/* 🔒 Bloquear ahora */}
            <button
              type="button"
              onClick={() => {
                if (locked) return;
                // ✅ ya existe en AuthContext
                auth.setLocked(true);
              }}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl border border-border bg-card",
                locked && "opacity-50 pointer-events-none",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              )}
              aria-label="Bloquear"
              title="Bloquear"
            >
              <Lock className="h-5 w-5" />
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
                    Actual:{" "}
                    <span className="font-semibold text-text">{currentThemeLabel}</span>
                  </div>
                </div>

                {/* Joyería */}
                <div className="tp-card p-3">
                  <div className="text-xs font-semibold text-muted">Joyería</div>
                  <div className="mt-1 text-sm font-semibold text-text truncate" title={jewelryName}>
                    {jewelryName}
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
