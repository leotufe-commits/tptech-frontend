import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    const idx = Math.max(
      0,
      themes.findIndex((t) => t.value === theme)
    );

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

    // buscamos el focus real actual
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

  const width = r?.width ?? (isMenu ? 320 : 170);
  const leftWanted = r?.left ?? viewportPad;
  const left = clamp(leftWanted, viewportPad, window.innerWidth - viewportPad - width);

  const maxH = 320;

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
        className="overflow-hidden rounded-xl border border-border bg-card shadow-soft"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onMenuKeyDown}
      >
        <div className="tp-scroll overflow-auto" style={{ maxHeight: maxH }}>
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
                  "w-full px-3 py-2 text-left text-sm transition-colors outline-none",
                  active
                    ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]"
                    : "text-text hover:bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]",
                  "focus-visible:ring-4 focus-visible:ring-primary/25"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className={cn("flex items-center gap-2", isMenu && "w-full")}>
      {!isMenu && <span className="text-sm text-muted">Tema</span>}

      <div className={cn("relative", isMenu ? "w-full" : "w-[170px]")}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onButtonKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "tp-input text-left cursor-pointer select-none relative",
            isMenu ? "!py-2 !px-3 !pr-9 text-sm" : "!py-[0.55rem] !px-[0.9rem] !pr-[2.25rem]"
          )}
          title={current?.label ?? "Tema"}
        >
          <span className="text-sm">{current?.label ?? "Tema"}</span>

          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            ▾
          </span>
        </button>

        {open ? createPortal(menu, document.body) : null}
      </div>
    </div>
  );
}
