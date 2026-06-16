// src/components/ui/HelpPopover.tsx
// =============================================================================
// HelpPopover — "Ayuda rápida" contextual, ÚNICA implementación del sistema.
//
// Reemplaza los cards laterales permanentes de "Ayuda rápida" (que ocupaban
// ~280px de ancho en cada pantalla) por un botón `?` en el header que abre un
// panel flotante on-demand. Aumenta el área útil de trabajo y unifica el
// comportamiento en todo TPTech.
//
// Uso típico (en el slot `right` de TPSectionShell):
//   <HelpPopover entries={HELP_BY_TAB} active={activeTab} />
//
// `entries` = el MISMO diccionario keyed-by-tab que usaban los HelpCard. Los
// textos no se modifican: solo cambia la forma de presentación. Muestra la
// entrada activa destacada + el resto como referencia (idéntico al card previo).
//
// Cierre: click fuera, tecla Escape, o re-click en el `?`.
// =============================================================================
import React, { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "./tp";

export type HelpEntry = { title: string; body: React.ReactNode };

export function HelpPopover<K extends string>({
  entries,
  active,
  title = "Ayuda rápida",
  label = "Ayuda rápida",
}: {
  /** Diccionario de ayuda keyed por sección/tab (el mismo `HELP_BY_TAB`). */
  entries: Record<K, HelpEntry>;
  /** Clave de la sección activa — se muestra destacada arriba. */
  active: K;
  /** Título del panel. */
  title?: string;
  /** Etiqueta accesible del botón. */
  label?: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeEntry = entries[active];
  const others = (Object.keys(entries) as K[]).filter((k) => k !== active);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        title={label}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted",
          "transition-colors hover:bg-surface2 hover:text-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          open && "bg-surface2 text-text",
        )}
      >
        <HelpCircle size={18} aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title}
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)]",
            "max-h-[70vh] overflow-y-auto",
            "rounded-2xl border border-border bg-card p-4 shadow-soft",
          )}
        >
          <div className="mb-2 text-sm font-semibold text-text">{title}</div>
          <div className="space-y-3 text-xs leading-relaxed">
            <div>
              <div className="mb-0.5 font-semibold text-text">{activeEntry.title}</div>
              <p className="text-muted">{activeEntry.body}</p>
            </div>
            {others.length > 0 && (
              <div className="space-y-1.5 border-t border-border/40 pt-2 text-muted">
                {others.map((k) => (
                  <div key={k}>
                    <span className="font-medium text-text/80">{entries[k].title}: </span>
                    <span>{entries[k].body}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HelpPopover;
