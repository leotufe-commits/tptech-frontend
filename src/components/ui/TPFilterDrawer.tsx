// src/components/ui/TPFilterDrawer.tsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./tp";

const PANEL_MIN_W     = 320;
const PANEL_MAX_W     = 600;
const PANEL_DEFAULT_W = 380;

interface TPFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Nodo fijo en el pie del panel (acciones Limpiar / Aplicar) */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Habilita el handle de resize en el borde izquierdo del panel.
   * El usuario arrastra para ajustar el ancho.
   */
  resizable?: boolean;
  /**
   * Clave de localStorage para persistir el ancho elegido.
   * Solo se usa cuando `resizable=true`.
   */
  storageKey?: string;
}

/**
 * Panel lateral deslizante desde la derecha para filtros avanzados.
 *
 * - Se posiciona debajo del topbar usando la variable CSS --topbar-h
 *   que el componente Topbar publica automáticamente.
 * - No cubre el sidebar izquierdo (solo ocupa la zona derecha de contenido).
 * - Usa createPortal sobre document.body para evitar problemas de z-index
 *   con contenedores overflow-hidden/auto.
 * - Con `resizable=true`, el borde izquierdo es arrastrable para ajustar el ancho.
 */
export function TPFilterDrawer({
  open,
  onClose,
  title = "Filtros",
  footer,
  children,
  resizable = false,
  storageKey,
}: TPFilterDrawerProps) {
  /* ── Ancho del panel (solo cuando resizable=true) ───────────────────────── */
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (!resizable || !storageKey) return PANEL_DEFAULT_W;
    try {
      const saved = parseInt(localStorage.getItem(storageKey) ?? "", 10);
      return isNaN(saved) ? PANEL_DEFAULT_W : Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, saved));
    } catch { return PANEL_DEFAULT_W; }
  });

  /* Ref para acceder al ancho actual dentro de los event handlers */
  const panelWidthRef = useRef(panelWidth);
  useEffect(() => { panelWidthRef.current = panelWidth; }, [panelWidth]);

  /* ── Resize del panel ───────────────────────────────────────────────────── */
  function startPanelResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX     = e.clientX;
    const startWidth = panelWidthRef.current;

    document.body.style.userSelect = "none";
    document.body.style.cursor     = "col-resize";

    function onMove(mv: MouseEvent) {
      /* Panel está pegado a la derecha: mover el mouse a la izquierda agranda el panel */
      const delta = startX - mv.clientX;
      const newW  = Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, Math.round(startWidth + delta)));
      setPanelWidth(newW);
    }

    function onUp() {
      document.body.style.userSelect = "";
      document.body.style.cursor     = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      /* Persistir el ancho final */
      if (storageKey) {
        try { localStorage.setItem(storageKey, String(panelWidthRef.current)); } catch {}
      }
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }

  /* ── Cerrar con Escape ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return createPortal(
    <>
      {/* Backdrop — empieza debajo del topbar */}
      <div
        aria-hidden="true"
        style={{ top: "var(--topbar-h, 64px)" }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 bg-black/25 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Panel lateral */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          top:    "var(--topbar-h, 64px)",
          height: "calc(100dvh - var(--topbar-h, 64px))",
          width:  resizable ? panelWidth : undefined,
        }}
        className={cn(
          "fixed right-0 z-50 flex flex-col",
          !resizable && "w-full sm:w-[380px]",
          "bg-card border-l border-border",
          "shadow-[-4px_0_24px_rgba(0,0,0,0.12)]",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Handle de resize — borde izquierdo arrastrable */}
        {resizable && (
          <div
            className="absolute left-0 top-0 bottom-0 w-3 z-10 cursor-col-resize flex items-center justify-center group"
            onMouseDown={startPanelResize}
            title="Arrastrar para ajustar ancho"
          >
            <div className="h-8 w-px bg-border group-hover:bg-primary/60 transition-colors" />
          </div>
        )}

        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-text">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface2/60 hover:text-text transition-colors"
            aria-label="Cerrar panel de filtros"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cuerpo con scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 overscroll-contain">
          {children}
        </div>

        {/* Pie fijo */}
        {footer && (
          <div className="shrink-0 border-t border-border bg-card px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
