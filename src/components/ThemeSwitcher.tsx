import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Palette } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ThemeSwitcher({ variant = "inline" }: { variant?: "inline" | "menu" }) {
  const { theme, setTheme, themes } = useTheme();

  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const current = useMemo(() => themes.find((t) => t.value === theme), [themes, theme]);

  const isMenu = variant === "menu";

  // Cerrar al click fuera
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // ESC cierra
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Auto-focus al abrir (en el activo o el primero)
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, themes.findIndex((t) => t.value === theme));
    const t = window.setTimeout(() => {
      optionRefs.current[idx]?.focus?.();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, theme, themes]);

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((v) => !v);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function focusMove(dir: 1 | -1) {
    const activeIdx = themes.findIndex((t) => t.value === theme);
    const start = activeIdx >= 0 ? activeIdx : 0;

    const focusedIdx = optionRefs.current.findIndex((r) => r === document.activeElement);
    const from = focusedIdx >= 0 ? focusedIdx : start;

    const next = clamp(from + dir, 0, themes.length - 1);
    optionRefs.current[next]?.focus?.();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusMove(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      focusMove(-1);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus?.();
      return;
    }
  }

  // ---- Portal positioning ----
  const r = btnRef.current?.getBoundingClientRect();
  const viewportPad = 10;
  const gap = 8;

  const width = r?.width ?? (isMenu ? 340 : 190);
  const leftWanted = r?.left ?? viewportPad;
  const left = clamp(leftWanted, viewportPad, window.innerWidth - viewportPad - width);

  const maxH = 340;

  const spaceBelow = window.innerHeight - viewportPad - (r?.bottom ?? 0);
  const spaceAbove = (r?.top ?? 0) - viewportPad;
  const openDown = spaceBelow >= 200 || spaceBelow >= spaceAbove;

  const topDown = clamp((r?.bottom ?? 0) + gap, viewportPad, window.innerHeight - viewportPad - maxH);
  const topUp = clamp((r?.top ?? 0) - gap - maxH, viewportPad, window.innerHeight - viewportPad - maxH);
  const top = openDown ? topDown : topUp;

  const menu = open ? (
    <>
      {/* overlay para click afuera */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 10000 }}
        onMouseDown={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        ref={menuRef}
        role="listbox"
        aria-label="Selector de tema"
        style={{
          position: "fixed",
          left,
          top,
          width,
          maxHeight: maxH,
          zIndex: 10001,
        }}
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-card shadow-soft",
          // animación suave
          "origin-top animate-[tpFadeIn_120ms_ease-out]"
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onMenuKeyDown}
      >
        {/* Header del dropdown */}
        <div
          className="px-3 py-2"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "color-mix(in oklab, var(--card) 92%, var(--bg))",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-8 w-8 rounded-xl grid place-items-center"
                style={{
                  border: "1px solid var(--border)",
                  background: "color-mix(in oklab, var(--card) 85%, var(--bg))",
                  color: "var(--muted)",
                }}
              >
                <Palette className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text truncate">Tema</div>
                <div className="text-xs text-muted truncate">Elegí el estilo visual</div>
              </div>
            </div>

            {/* “pill” con el actual */}
            <div
              className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in oklab, var(--primary) 10%, transparent)",
                color: "var(--text)",
              }}
              title="Tema actual"
            >
              {current?.label ?? "Actual"}
            </div>
          </div>
        </div>

        <div className="tp-scroll overflow-auto" style={{ maxHeight: maxH - 56 }}>
          {themes.map((t, i) => {
            const active = t.value === theme;

            return (
              <button
                key={t.value}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setTheme(t.value as any);
                  setOpen(false);
                  btnRef.current?.focus?.();
                }}
                className={cn(
                  "w-full px-3 py-2.5 text-left text-sm outline-none transition-colors",
                  "flex items-center justify-between gap-3",
                  active
                    ? "bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-text"
                    : "text-text hover:bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]",
                  "focus-visible:ring-4 focus-visible:ring-primary/25"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mini “swatch” (si más adelante querés mapear color por theme, lo conectamos acá) */}
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: active ? "var(--primary)" : "color-mix(in oklab, var(--muted) 45%, var(--border))",
                    }}
                    aria-hidden="true"
                  />

                  <span className="truncate">{t.label}</span>
                </div>

                <span
                  className={cn(
                    "h-6 w-6 rounded-full grid place-items-center shrink-0",
                    active ? "opacity-100" : "opacity-0"
                  )}
                  style={{
                    border: "1px solid var(--border)",
                    background: "color-mix(in oklab, var(--card) 90%, var(--bg))",
                    color: "var(--text)",
                    transition: "opacity 140ms ease",
                  }}
                  aria-hidden="true"
                >
                  <Check className="h-4 w-4" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* keyframes inline (si preferís en css global, te lo paso) */}
      <style>{`
        @keyframes tpFadeIn {
          from { opacity: 0; transform: translateY(4px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  ) : null;

  return (
    <div className={cn("flex items-center gap-2", isMenu && "w-full")}>
      {!isMenu && <span className="text-sm text-muted">Tema</span>}

      <div className={cn("relative", isMenu ? "w-full" : "w-[190px]")}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onButtonKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "tp-input text-left cursor-pointer select-none relative",
            // misma altura/feeling en ambos
            "!py-2 !px-3 !pr-10",
            "flex items-center gap-2"
          )}
          title={current?.label ?? "Tema"}
        >
          <span
            className="h-8 w-8 rounded-xl grid place-items-center"
            style={{
              border: "1px solid var(--border)",
              background: "color-mix(in oklab, var(--card) 85%, var(--bg))",
              color: "var(--muted)",
            }}
            aria-hidden="true"
          >
            <Palette className="h-4 w-4" />
          </span>

          <span className="min-w-0 flex-1 truncate text-sm">{current?.label ?? "Tema"}</span>

          <span
            className={cn(
              "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-transform",
              open && "rotate-180"
            )}
            aria-hidden="true"
          >
            <ChevronDown className="h-4 w-4" />
          </span>
        </button>

        {open ? createPortal(menu, document.body) : null}
      </div>
    </div>
  );
}
