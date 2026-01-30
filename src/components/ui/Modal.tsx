// tptech-frontend/src/components/ui/Modal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./tp";

/**
 * ✅ Modal DRAGGABLE (arrastrable) + stack (nested-safe)
 * - Si hay 2 modales abiertos, el overlay no se duplica fuerte
 * - Solo el modal TOP responde al click en backdrop / ESC
 *
 * ✅ NUEVO: overlayClassName (opcional)
 * - Permite oscurecer SOLO algunos modales (ej: confirms destructivos)
 * - Si no se pasa, usa el overlay por defecto (y respeta stack)
 */
let __tp_modal_stack: string[] = [];

export function Modal({
  open,
  title,
  children,
  onClose,
  wide,
  overlayClassName, // ✅ NUEVO
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  overlayClassName?: string; // ✅ NUEVO
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  // id estable por instancia
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

  // ✅ stack register/unregister
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

  useEffect(() => {
    if (!open) return;
    setPos({ x: 0, y: 0 });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!isTopMost) return; // ✅ solo el top
        if (drag.current.active) return;
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, isTopMost]);

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

  // ✅ overlay más suave si hay stack (evita “doble oscuro”)
  const stackSize = __tp_modal_stack.length;
  const defaultOverlayClass = stackSize > 1 ? "bg-black/25" : "bg-black/40";

  // ✅ si el caller pasa overlayClassName, se usa ese; sino, el default
  const overlayClass = overlayClassName ?? defaultOverlayClass;

  // ✅ z-index por profundidad
  const zBase = 50 + depth * 10;

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: zBase }}>
      <div
        className={cn("absolute inset-0", overlayClass)}
        onMouseDown={(e) => {
          if (!isTopMost) return;
          if (drag.current.active) e.preventDefault();
        }}
        onClick={() => {
          if (!isTopMost) return; // ✅ solo el top
          if (drag.current.active) return;
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
          wide ? "max-w-6xl" : "max-w-4xl",
          "max-h-[85vh] flex flex-col"
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
        <div
          ref={headerRef}
          tabIndex={-1}
          className="p-6 pb-4 border-b border-border flex items-center justify-between gap-3 cursor-move select-none"
          onPointerDown={(e) => {
            if (!isTopMost) return; // ✅ solo el top arrastra
            if ((e as any).button != null && (e as any).button !== 0) return;

            drag.current.active = true;
            drag.current.startX = e.clientX;
            drag.current.startY = e.clientY;
            drag.current.baseX = pos.x;
            drag.current.baseY = pos.y;
            lastDragAtRef.current = Date.now();
          }}
        >
          <h2 className="text-lg font-semibold">{title}</h2>

          <button
            className="tp-btn cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (!isTopMost) return;
              onClose();
            }}
            type="button"
          >
            Cerrar
          </button>
        </div>

        <div className="p-6 pt-4 overflow-y-auto tp-scroll">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
