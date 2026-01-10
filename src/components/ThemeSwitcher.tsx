import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();

  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const current = useMemo(() => themes.find((t) => t.value === theme), [themes, theme]);

  // cerrar al click fuera
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

  // teclado (Esc cierra, Enter/Espacio abre)
  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((v) => !v);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">Tema</span>

      <div className="relative w-[170px]">
        {/* Botón "input-like" */}
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onButtonKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "tp-input !py-[0.55rem] !px-[0.9rem] !pr-[2.25rem] text-left",
            "cursor-pointer select-none"
          )}
        >
          <span className="text-sm">{current?.label ?? "Tema"}</span>

          {/* caret */}
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            ▾
          </span>
        </button>

        {/* Menú */}
        {open && (
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Selector de tema"
            className={cn(
              "absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-soft"
            )}
          >
            {themes.map((t) => {
              const active = t.value === theme;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setTheme(t.value as any);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm",
                    "transition-colors",
                    // ✅ acá está la magia: el activo y el hover usan --primary del theme
                    active
                      ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]"
                      : "text-text hover:bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]"
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
