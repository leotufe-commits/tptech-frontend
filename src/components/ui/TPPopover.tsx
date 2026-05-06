// src/components/ui/TPPopover.tsx
// Popover genérico con portal — se ancla a un elemento de referencia y se renderiza
// fuera del árbol DOM, evitando overflow:hidden de contenedores como TPTableWrap.
//
// Uso:
//   const btnRef = useRef<HTMLButtonElement>(null);
//   const [open, setOpen] = useState(false);
//   <button ref={btnRef} onClick={() => setOpen(v => !v)}>Abrir</button>
//   <TPPopover open={open} onClose={() => setOpen(false)} anchorRef={btnRef}>
//     Contenido del popover
//   </TPPopover>
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "./tp";

export type TPPopoverProps = {
  /** Controla visibilidad externamente. */
  open: boolean;
  /** Llamado al hacer clic fuera o presionar Escape. */
  onClose: () => void;
  /** Ref al botón/elemento que ancla el popover (para posicionarlo y para click-outside). */
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  /** Ancho fijo en px. Si se omite, el contenido determina el ancho. */
  width?: number;
  /** Separación vertical respecto al borde inferior del anchor (px). Default: 4. */
  offset?: number;
  /**
   * Si es true, no se aplican los estilos de card por defecto
   * (rounded-2xl border border-border bg-card shadow-xl).
   * El className del llamador es el único que aplica.
   */
  unstyled?: boolean;
};

export function TPPopover({
  open,
  onClose,
  anchorRef,
  children,
  className,
  width,
  offset = 4,
  unstyled = false,
}: TPPopoverProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  /* ── Calcular posición cada vez que se abre ────────────────────── */
  useEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;

    const r   = el.getBoundingClientRect();
    const top = r.bottom + window.scrollY + offset;
    let left  = r.left   + window.scrollX;

    // No salir del viewport por la derecha
    if (width) {
      const overflow = left + width - (window.innerWidth - 8);
      if (overflow > 0) left = Math.max(8 + window.scrollX, left - overflow);
    }

    setPos({ top, left });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cerrar con clic fuera o Escape ────────────────────────────── */
  useEffect(() => {
    if (!open) return;

    function handleDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !contentRef.current?.contains(t)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown",   handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown",   handleKey);
    };
  }, [open, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={contentRef}
      style={{
        position: "absolute",
        top:      pos.top,
        left:     pos.left,
        zIndex:   9999,
        ...(width ? { width } : {}),
      }}
      className={cn(
        !unstyled && "rounded-2xl border border-border bg-card shadow-xl",
        className
      )}
    >
      {children}
    </div>,
    document.body
  );
}

export default TPPopover;
