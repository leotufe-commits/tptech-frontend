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
 *
 * ✅ FIX:
 * - FOCUS REAL: al abrir SIEMPRE manda foco al primer input/textarea/select del modal
 *   y lo re-intenta varias veces (porque otro componente lo puede “robar” después).
 * - Trap TAB dentro del modal.
 * - Restaura foco al cerrar.
 *
 * ✅ FIX MOBILE SCROLL:
 * - Bloquea el scroll del body al abrir (evita “pelea” de scroll).
 * - Body del modal con overscroll-contain + touch-pan-y + momentum (iOS).
 */

let __tp_modal_stack: string[] = [];

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "6xl";

function maxWidthClass(maxWidth?: MaxWidth, wide?: boolean) {
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

function isFocusable(el: HTMLElement) {
  if (!el) return false;
  const anyEl = el as any;
  if (anyEl.disabled) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;

  return true;
}

function getFocusable(container: HTMLElement | null) {
  if (!container) return [] as HTMLElement[];
  const all = Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "[data-tp-autofocus='1']",
        "input:not([disabled]):not([type='hidden'])",
        "textarea:not([disabled])",
        "select:not([disabled])",
        "button:not([disabled])",
        "a[href]",
        "[tabindex]:not([tabindex='-1'])",
      ].join(",")
    )
  );
  return all.filter(isFocusable);
}

function pickBest(container: HTMLElement | null) {
  if (!container) return null as HTMLElement | null;

  const explicit = container.querySelector("[data-tp-autofocus='1']") as HTMLElement | null;
  if (explicit && isFocusable(explicit)) return explicit;

  const firstField = container.querySelector(
    "input:not([disabled]):not([type='hidden']), textarea:not([disabled]), select:not([disabled])"
  ) as HTMLElement | null;
  if (firstField && isFocusable(firstField)) return firstField;

  const focusables = getFocusable(container);
  return focusables[0] ?? null;
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

  maxWidth,
  hideHeaderClose,

  headerRight,
  showCloseIcon = true,
  closeLabel = "",

  onEnter,
}: {
  open: boolean;
  title: string;

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

  maxWidth?: MaxWidth;
  hideHeaderClose?: boolean;

  headerRight?: React.ReactNode;
  showCloseIcon?: boolean;
  closeLabel?: string;

  /** ✅ Enter = ejecutar acción primaria (Guardar/Confirmar) */
  onEnter?: () => void;
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

  const prevFocusRef = useRef<HTMLElement | null>(null);

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

  // ✅ Bloquear scroll del body mientras el modal está abierto (solo top-most)
  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;
    if (!isTopMost) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;

    // Compensar scrollbar (desktop)
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;

    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [open, isTopMost]);

  // ✅ guardar + restaurar foco
  useEffect(() => {
    if (!open) return;

    prevFocusRef.current = document.activeElement as any;

    return () => {
      try {
        prevFocusRef.current?.focus?.();
      } catch {}
      prevFocusRef.current = null;
    };
  }, [open]);

  // ✅ FOCUS: reintentos (0ms, rAF, 60ms, 180ms) + guard 800ms
  useEffect(() => {
    if (!open) return;

    const focusModal = () => {
      const root = modalRef.current;
      if (!root) return;

      // si ya está adentro, no pelear
      const active = document.activeElement as HTMLElement | null;
      if (active && root.contains(active)) return;

      const best = pickBest(root);
      if (best) {
        try {
          best.focus();
          if (best instanceof HTMLInputElement || best instanceof HTMLTextAreaElement) {
            try {
              best.select?.();
            } catch {}
          }
          return;
        } catch {}
      }

      try {
        headerRef.current?.focus?.();
      } catch {}
    };

    // inmediatamente
    const t0 = window.setTimeout(focusModal, 0);

    // próximo frame (por si el input aparece luego)
    const raf = window.requestAnimationFrame(() => focusModal());

    // reintentos
    const t1 = window.setTimeout(focusModal, 60);
    const t2 = window.setTimeout(focusModal, 180);

    // guard (si algo roba foco después)
    const start = Date.now();
    const guard = window.setInterval(() => {
      if (!isTopMost) return;
      if (Date.now() - start > 800) {
        window.clearInterval(guard);
        return;
      }
      focusModal();
    }, 50);

    return () => {
      window.clearTimeout(t0);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearInterval(guard);
    };
  }, [open, isTopMost]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      // ✅ TAB trap
      if (e.key === "Tab") {
        if (!isTopMost) return;

        const root = modalRef.current;
        if (!root) return;

        const focusables = getFocusable(root);
        if (!focusables.length) {
          e.preventDefault();
          headerRef.current?.focus?.();
          return;
        }

        const active = document.activeElement as HTMLElement | null;

        if (!active || !root.contains(active)) {
          e.preventDefault();
          (e.shiftKey ? focusables[focusables.length - 1] : focusables[0])?.focus?.();
          return;
        }

        const idx = focusables.indexOf(active);
        const nextIdx = e.shiftKey ? idx - 1 : idx + 1;

        if (nextIdx < 0) {
          e.preventDefault();
          focusables[focusables.length - 1]?.focus?.();
          return;
        }
        if (nextIdx >= focusables.length) {
          e.preventDefault();
          focusables[0]?.focus?.();
          return;
        }

        return;
      }

      // ✅ ESC cerrar
      if (e.key === "Escape") {
        if (!isTopMost) return;

        if (busy) {
          e.preventDefault();
          return;
        }
        if (drag.current.active) return;

        e.preventDefault();
        onClose();
        return;
      }

      // ✅ ENTER acción primaria
      if (e.key === "Enter") {
        if (!isTopMost) return;
        if (busy) return;
        if (drag.current.active) return;
        if (!onEnter) return;

        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

        const target = e.target as HTMLElement | null;
        if (!target) return;

        if (target.closest?.("[data-tp-enter='ignore']")) return;

        const tag = (target.tagName || "").toLowerCase();
        if (tag === "textarea") return;
        if (target.closest("button, a")) return;

        if (tag === "input") {
          const t = ((target as HTMLInputElement).type || "").toLowerCase();
          if (t === "submit" || t === "button" || t === "checkbox" || t === "radio") return;
        }

        e.preventDefault();
        onEnter();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, isTopMost, busy, onEnter]);

  // ✅ si el foco se va afuera, lo devolvemos al modal
  function onFocusCapture() {
    if (!isTopMost) return;

    const root = modalRef.current;
    if (!root) return;

    const active = document.activeElement as HTMLElement | null;
    if (active && root.contains(active)) return;

    const best = pickBest(root);
    (best ?? headerRef.current)?.focus?.();
  }

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
        const rect = el.getBoundingClientRect();

        const margin = 12;

        const maxX = vw / 2 - rect.width / 2 - margin;
        const minX = -maxX;

        const maxY = vh / 2 - rect.height / 2 - margin;
        const minY = -maxY;

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

  if (!open) return null;

  const recentlyDragged = () => Date.now() - lastDragAtRef.current < 220;

  const stackSize = __tp_modal_stack.length;
  const defaultOverlayClass = stackSize > 1 ? "bg-black/25" : "bg-black/40";
  const overlayClass = overlayClassName ?? defaultOverlayClass;

  const zBase = 50 + depth * 10;
  const wCls = maxWidthClass(maxWidth, wide);

  const hasMeta = Boolean(subtitle || description);

  return (
    <div className="fixed inset-0" style={{ zIndex: zBase }} onFocusCapture={onFocusCapture}>
      {/* overlay */}
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

      {/* layout container */}
      <div className="absolute inset-0 flex items-center justify-center px-4 py-6">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "relative w-full rounded-2xl border border-border bg-card shadow-soft",
            wCls,
            "max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden",
            className
          )}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            willChange: "transform",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div
            ref={headerRef}
            tabIndex={-1}
            className={cn("border-b border-border select-none", "px-6 pt-5 pb-4", "cursor-move")}
            onPointerDown={(e) => {
              if (!isTopMost) return;
              if (busy) return;
              if ((e as any).button != null && (e as any).button !== 0) return;

              const target = e.target as HTMLElement | null;
              if (target?.closest?.("button, a, input, textarea, select, [data-no-drag='1']")) return;

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

                {subtitle ? <div className="text-sm text-muted mt-1">{subtitle}</div> : null}
                {description ? <div className="text-xs text-muted mt-1">{description}</div> : null}
              </div>

              <div className="flex items-center gap-2 shrink-0" data-no-drag="1">
                {headerRight ? <div className="flex items-center gap-2">{headerRight}</div> : null}

                {!hideHeaderClose ? (
                  <div className="flex items-center gap-2">
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

            {hasMeta ? <div className="mt-4" /> : null}
          </div>

          {/* BODY (scroll) */}
          <div
            className={cn(
              "p-6 pt-4 flex-1 min-h-0 overflow-y-auto tp-scroll",
              "overscroll-contain touch-pan-y",
              bodyClassName
            )}
            style={{ WebkitOverflowScrolling: "touch" as any }}
          >
            {children}
          </div>

          {/* FOOTER */}
          {footer ? (
            <div className={cn("px-6 py-4 border-t border-border", "flex items-center justify-end gap-2", footerClassName)}>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Modal;