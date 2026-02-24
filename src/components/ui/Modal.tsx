// tptech-frontend/src/components/ui/Modal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "./tp";

/**
 * ✅ Modal DRAGGABLE (arrastrable) + stack (nested-safe)
 * ✅ overlayClassName opcional
 * ✅ busy bloquea cierre
 * ✅ footer opcional
 * ✅ NUEVO:
 *    - maxWidth (sm/md/lg/xl/2xl/3xl/4xl/6xl)
 *    - hideHeaderClose (oculta botón del header)
 *    - subtitle / description (diseño más cuidado)
 *    - headerRight (acciones custom a la derecha)
 *    - showCloseIcon (X) + closeLabel (texto opcional)
 */

let __tp_modal_stack: string[] = [];

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "6xl";

function maxWidthClass(maxWidth?: MaxWidth, wide?: boolean) {
  // ✅ compat: si no pasan maxWidth, respetamos wide como antes
  if (!maxWidth) return wide ? "max-w-6xl" : "max-w-4xl";

  if (maxWidth === "sm") return "max-w-sm";
  if (maxWidth === "md") return "max-w-md";
  if (maxWidth === "lg") return "max-w-lg";
  if (maxWidth === "xl") return "max-w-xl";
  if (maxWidth === "2xl") return "max-w-2xl";
  if (maxWidth === "3xl") return "max-w-3xl";
  if (maxWidth === "4xl") return "max-w-4xl";
  if (maxWidth === "6xl") return "max-w-6xl";
  return wide ? "max-w-6xl" : "max-w-4xl";
}

export function Modal({
  open,
  title,
  subtitle,
  description,
  children,
  onClose,

  wide,
  overlayClassName,
  className,
  bodyClassName,
  busy,
  footer,
  footerClassName,

  // ✅ nuevo
  maxWidth,
  hideHeaderClose,

  // ✅ nuevo diseño
  headerRight,
  showCloseIcon = true,
  closeLabel = "Cerrar",
}: {
  open: boolean;
  title: string;

  /** ✅ opcionales (diseño más cuidado) */
  subtitle?: string;
  description?: string;

  children: React.ReactNode;
  onClose: () => void;

  wide?: boolean;
  overlayClassName?: string;
  className?: string;
  bodyClassName?: string;
  busy?: boolean;
  footer?: React.ReactNode;
  footerClassName?: string;

  /** ✅ ancho real del modal (si se pasa, reemplaza wide) */
  maxWidth?: MaxWidth;

  /** ✅ oculta botón "Cerrar" del header */
  hideHeaderClose?: boolean;

  /** ✅ acciones extra a la derecha del header (ej: botones) */
  headerRight?: React.ReactNode;

  /** ✅ muestra botón X */
  showCloseIcon?: boolean;

  /** ✅ texto del botón cerrar (si lo querés mostrar) */
  closeLabel?: string;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const instanceId = useMemo(() => `m_${Math.random().toString(36).slice(2)}`, []);

  const [pos, setPos] = useState({ x: 0, y: 0 });

  const drag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  const lastDragAtRef = useRef<number>(0);
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (!open) return;

    __tp_modal_stack = [...__tp_modal_stack, instanceId];
    setDepth(__tp_modal_stack.indexOf(instanceId));

    return () => {
      __tp_modal_stack = __tp_modal_stack.filter((id) => id !== instanceId);
    };
  }, [open, instanceId]);

  const isTopMost = open && __tp_modal_stack[__tp_modal_stack.length - 1] === instanceId;

  const canClose = () => {
    if (!isTopMost) return false;
    if (busy) return false;
    if (drag.current.active) return false;
    return true;
  };

  useEffect(() => {
    if (!open) return;
    setPos({ x: 0, y: 0 });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!isTopMost) return;
        if (busy) {
          e.preventDefault();
          return;
        }
        if (drag.current.active) return;
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, isTopMost, busy]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!drag.current.active) return;

      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;

      let nextX = drag.current.baseX + dx;
      let nextY = drag.current.baseY + dy;

      const el = modalRef.current;
      if (el) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 12;

        const minX = -(vw / 2) + margin;
        const maxX = vw / 2 - margin;
        const minY = -(vh / 2) + margin;
        const maxY = vh / 2 - margin;

        nextX = Math.max(minX, Math.min(maxX, nextX));
        nextY = Math.max(minY, Math.min(maxY, nextY));
      }

      setPos({ x: nextX, y: nextY });
      lastDragAtRef.current = Date.now();
    }

    function onUp() {
      if (!drag.current.active) return;
      drag.current.active = false;
      lastDragAtRef.current = Date.now();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => headerRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  const recentlyDragged = () => Date.now() - lastDragAtRef.current < 220;

  const stackSize = __tp_modal_stack.length;
  const defaultOverlayClass = stackSize > 1 ? "bg-black/25" : "bg-black/40";
  const overlayClass = overlayClassName ?? defaultOverlayClass;

  const zBase = 50 + depth * 10;
  const wCls = maxWidthClass(maxWidth, wide);

  const hasMeta = Boolean(subtitle || description);

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: zBase }}>
      <div
        className={cn("absolute inset-0", overlayClass)}
        onMouseDown={(e) => {
          if (!isTopMost) return;
          if (drag.current.active) e.preventDefault();
          if (busy) e.preventDefault();
        }}
        onClick={() => {
          if (!canClose()) return;
          if (recentlyDragged()) return;
          onClose();
        }}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full rounded-2xl border border-border bg-card shadow-soft",
          wCls,
          "max-h-[85vh] flex flex-col",
          className
        )}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          ref={headerRef}
          tabIndex={-1}
          className={cn(
            "border-b border-border select-none",
            "px-6 pt-5 pb-4",
            "cursor-move"
          )}
          onPointerDown={(e) => {
            if (!isTopMost) return;
            if (busy) return;
            if ((e as any).button != null && (e as any).button !== 0) return;

            // ✅ NO iniciar drag si el pointerdown viene de un control clickeable
            const target = e.target as HTMLElement | null;
            if (target?.closest?.("button, a, input, textarea, select, [data-no-drag='1']")) {
              return;
            }

            drag.current.active = true;
            drag.current.startX = e.clientX;
            drag.current.startY = e.clientY;
            drag.current.baseX = pos.x;
            drag.current.baseY = pos.y;
            lastDragAtRef.current = Date.now();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text leading-tight truncate">{title}</h2>

              {subtitle ? (
                <div className="text-sm text-muted mt-1">{subtitle}</div>
              ) : null}

              {description ? (
                <div className="text-xs text-muted mt-1">{description}</div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 shrink-0" data-no-drag="1">
              {headerRight ? <div className="flex items-center gap-2">{headerRight}</div> : null}

              {/* ✅ opcional: ocultar botón del header */}
              {!hideHeaderClose ? (
                <div className="flex items-center gap-2">
                  {/* Botón texto (opcional, más “clásico”) */}
                  {closeLabel ? (
                    <button
                      data-no-drag="1"
                      className={cn("tp-btn cursor-pointer", (busy || !isTopMost) && "opacity-60")}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isTopMost) return;
                        if (busy) return;
                        onClose();
                      }}
                      type="button"
                      disabled={busy || !isTopMost}
                    >
                      {closeLabel}
                    </button>
                  ) : null}

                  {/* Botón X (moderno) */}
                  {showCloseIcon ? (
                    <button
                      data-no-drag="1"
                      type="button"
                      title="Cerrar"
                      className={cn(
                        "h-9 w-9 rounded-xl border border-border bg-surface2/40",
                        "grid place-items-center hover:bg-surface2 transition",
                        (busy || !isTopMost) && "opacity-60"
                      )}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isTopMost) return;
                        if (busy) return;
                        onClose();
                      }}
                      disabled={busy || !isTopMost}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* separador extra sutil si hay meta */}
          {hasMeta ? <div className="mt-4" /> : null}
        </div>

        {/* BODY */}
        <div className={cn("p-6 pt-4 overflow-y-auto tp-scroll flex-1", bodyClassName)}>{children}</div>

        {/* FOOTER */}
        {footer ? (
          <div
            className={cn(
              "px-6 py-4 border-t border-border",
              "flex items-center justify-end gap-2",
              footerClassName
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Modal;