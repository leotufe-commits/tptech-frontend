// tptech-frontend/src/components/ui/Modal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./tp";

// ── Iconos estilo Windows ──────────────────────────────────────────────────
function IconMaximize() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="3" y="3" width="10" height="10" />
    </svg>
  );
}
function IconRestore() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="6" y="3" width="7" height="7" />
      <rect x="3" y="6" width="7" height="7" />
    </svg>
  );
}

// ── Resize handles ─────────────────────────────────────────────────────────
type ResizeSide = "tl" | "t" | "tr" | "r" | "br" | "b" | "bl" | "l";

const RESIZE_CURSOR: Record<ResizeSide, string> = {
  tl: "nwse-resize", t:  "ns-resize", tr: "nesw-resize",
  r:  "ew-resize",
  br: "nwse-resize", b:  "ns-resize", bl: "nesw-resize",
  l:  "ew-resize",
};

function sidesOf(side: ResizeSide) {
  return {
    left:   side === "l" || side === "tl" || side === "bl",
    right:  side === "r" || side === "tr" || side === "br",
    top:    side === "t" || side === "tl" || side === "tr",
    bottom: side === "b" || side === "bl" || side === "br",
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

// El breakpoint `lg` de Tailwind. En mobile no leemos ni escribimos
// preferencias para no contaminar el estado guardado en desktop.
function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1024;
}

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

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";

function maxWidthClass(maxWidth?: MaxWidth, wide?: boolean) {
  if (!maxWidth) return wide ? "max-w-6xl" : "max-w-4xl";

  if (maxWidth === "sm") return "max-w-sm";
  if (maxWidth === "md") return "max-w-md";
  if (maxWidth === "lg") return "max-w-lg";
  if (maxWidth === "xl") return "max-w-xl";
  if (maxWidth === "2xl") return "max-w-2xl";
  if (maxWidth === "3xl") return "max-w-3xl";
  if (maxWidth === "4xl") return "max-w-4xl";
  if (maxWidth === "5xl") return "max-w-5xl";
  if (maxWidth === "6xl") return "max-w-6xl";
  if (maxWidth === "7xl") return "max-w-7xl";
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

  resizable = false,
  maximizable = false,
  defaultMaximized = false,
  maximizedMode = "viewport",
  modalKey,

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

  /** Permite redimensionar el modal arrastrando desde los handles. */
  resizable?: boolean;
  /** Habilita botón de maximizar/restaurar en el header. */
  maximizable?: boolean;
  /** Si maximizable, arranca maximizado al abrir. */
  defaultMaximized?: boolean;
  /**
   * Modo de maximización:
   * - "viewport" (default): ventana clásica, 8px de margen al borde.
   * - "embedded": fullscreen estilo página interna del dashboard (sin sombra,
   *   sin borde redondeado, fondo del dashboard, cubre todo el viewport).
   */
  maximizedMode?: "viewport" | "embedded";

  /**
   * Si se setea, guarda y restaura `isMaximized` + `size` en localStorage
   * bajo `tp_modal_<modalKey>`. Útil para que la preferencia del usuario
   * persista entre aperturas/sesiones.
   */
  modalKey?: string;

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

  // ── Maximizar / restaurar ──────────────────────────────────────────────
  const [isMaximized, setIsMaximized] = useState(maximizable && defaultMaximized);
  // Tamaño explícito en px cuando el usuario redimensiona (null = usar wCls).
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // Memoria del estado previo a maximizar para restaurar exactamente igual.
  const restoreRef = useRef<{ size: { width: number; height: number } | null; pos: { x: number; y: number } } | null>(null);

  useEffect(() => {
    if (!open) return;

    const mobile = isMobileViewport();

    let initialMax: boolean = Boolean(maximizable && defaultMaximized);
    let initialSize: { width: number; height: number } | null = null;
    let initialPos: { x: number; y: number } = { x: 0, y: 0 };

    if (mobile) {
      // Mobile: ignora estado guardado. Si es maximizable, arrancar en
      // pantalla completa (mejor UX). Sin tamaño ni posición personalizados.
      initialMax = Boolean(maximizable);
      initialSize = null;
      initialPos = { x: 0, y: 0 };
    } else if (modalKey && typeof window !== "undefined") {
      try {
        // Convención: `tp:modal:<modalKey>` (ver document-types.ts → LS_KEYS).
        const raw = window.localStorage.getItem(`tp:modal:${modalKey}`);
        if (raw) {
          const data = JSON.parse(raw);

          if (typeof data?.isMaximized === "boolean" && maximizable) {
            initialMax = data.isMaximized;
          }

          if (
            typeof data?.width === "number" &&
            typeof data?.height === "number"
          ) {
            const maxW = window.innerWidth - 16;
            const maxH = window.innerHeight - 16;
            initialSize = {
              width:  clamp(data.width,  720, Math.max(720, maxW)),
              height: clamp(data.height, 420, Math.max(420, maxH)),
            };
          }

          if (typeof data?.x === "number" && typeof data?.y === "number") {
            // Clamp para que el modal siga visible si cambió el viewport.
            // Mantener al menos `margin` px del modal dentro del viewport.
            const margin = 80;
            const maxX = Math.max(0, window.innerWidth  / 2 - margin);
            const maxY = Math.max(0, window.innerHeight / 2 - margin);
            initialPos = {
              x: clamp(data.x, -maxX, maxX),
              y: clamp(data.y, -maxY, maxY),
            };
          }
        }
      } catch {}
    }

    setIsMaximized(initialMax);
    setSize(initialSize);
    setPos(initialPos);
    restoreRef.current = null;
  }, [open, maximizable, defaultMaximized, modalKey]);

  function toggleMaximize() {
    setIsMaximized((prev) => {
      if (!prev) {
        // Maximizar: guardar estado actual
        restoreRef.current = { size, pos };
        setPos({ x: 0, y: 0 });
        return true;
      }
      // Restaurar: volver al estado guardado
      const prevState = restoreRef.current;
      if (prevState) {
        setSize(prevState.size);
        setPos(prevState.pos);
      } else {
        setSize(null);
        setPos({ x: 0, y: 0 });
      }
      return false;
    });
  }

  const embeddedActive = isMaximized && maximizedMode === "embedded";

  // ── Persistencia de preferencias en localStorage (opcional vía modalKey) ──
  // Guarda `{ isMaximized, width, height, x, y }` con debounce de 250 ms para
  // no escribir en cada frame durante drag/resize. En mobile NO escribe para
  // no contaminar el estado guardado en desktop.
  useEffect(() => {
    if (!open || !modalKey || typeof window === "undefined") return;
    if (isMobileViewport()) return;

    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          `tp:modal:${modalKey}`,
          JSON.stringify({
            isMaximized,
            width:  size?.width  ?? null,
            height: size?.height ?? null,
            x: pos.x,
            y: pos.y,
          }),
        );
      } catch {}
    }, 250);

    return () => window.clearTimeout(t);
  }, [open, modalKey, isMaximized, size, pos]);

  // ── Resize con handles propios ──────────────────────────────────────────
  const resize = useRef({
    active: false,
    side: "br" as ResizeSide,
    startX: 0, startY: 0,
    startW: 0, startH: 0,
    startTx: 0, startTy: 0,
  });

  function onResizeStart(e: React.PointerEvent, side: ResizeSide) {
    if (!resizable || isMaximized || busy || !isTopMost) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const el = modalRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    resize.current = {
      active: true,
      side,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
      startTx: pos.x,
      startTy: pos.y,
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = RESIZE_CURSOR[side];
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!resize.current.active) return;
      const r = resize.current;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      const s = sidesOf(r.side);

      const minW = 720;
      const minH = 420;
      const maxW = window.innerWidth  - 16;
      const maxH = window.innerHeight - 16;

      let newW = r.startW;
      let newH = r.startH;
      let newTx = r.startTx;
      let newTy = r.startTy;

      if (s.right && !s.left) {
        newW  = clamp(r.startW + dx, minW, maxW);
        newTx = r.startTx + (newW - r.startW) / 2;
      } else if (s.left && !s.right) {
        newW  = clamp(r.startW - dx, minW, maxW);
        newTx = r.startTx - (newW - r.startW) / 2;
      }

      if (s.bottom && !s.top) {
        newH  = clamp(r.startH + dy, minH, maxH);
        newTy = r.startTy + (newH - r.startH) / 2;
      } else if (s.top && !s.bottom) {
        newH  = clamp(r.startH - dy, minH, maxH);
        newTy = r.startTy - (newH - r.startH) / 2;
      }

      setSize({ width: newW, height: newH });
      setPos({ x: newTx, y: newTy });
    }

    function onUp() {
      if (!resize.current.active) return;
      resize.current.active = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

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
        // `preventScroll: true` — al cerrar el modal, restaurar el foco
        // al elemento anterior NO debe scrollear la página. Si el
        // elemento estaba fuera del viewport, el usuario decide si
        // quiere ir a buscarlo (con Tab/scroll explícito).
        prevFocusRef.current?.focus?.({ preventScroll: true } as any);
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

      // ✅ Si hay un TPActionsMenu (u otro popover que setea este flag)
      // abierto, NO movemos el foco. Abrir/cerrar el menú no debe
      // disparar el autoFocus del modal (caso típico: menú "..." de una
      // línea cerca del fondo del scroll → foco a Cliente al tope →
      // scrollIntoView automático).
      if ((typeof window !== "undefined") && (window.__tp_actions_menu_open ?? 0) > 0) return;

      // si ya está adentro, no pelear
      const active = document.activeElement as HTMLElement | null;
      if (active && root.contains(active)) return;

      // ✅ si el foco está en un modal anidado (ej. TPComboCreatable), no interferir
      if (active && active.closest?.('[role="dialog"][aria-modal="true"]')) return;

      // ✅ si el foco está en un portal marcado como zona permitida
      // (ej. TPActionsMenu, TPComboFixed, etc.), no robarlo
      if (active && active.closest?.('[data-tp-portal]')) return;

      const best = pickBest(root);
      if (best) {
        try {
          // `preventScroll: true` evita el scrollIntoView automático del
          // navegador cuando el foco va a un elemento parcialmente fuera
          // del viewport. El primer focus al abrir un modal típicamente
          // ocurre cuando el modal ya está visible, así que no necesita
          // scroll — y si lo necesita, el modal entero ya está layout-eado.
          best.focus({ preventScroll: true });
          if (best instanceof HTMLInputElement || best instanceof HTMLTextAreaElement) {
            try {
              best.select?.();
            } catch {}
          }
          return;
        } catch {}
      }

      try {
        headerRef.current?.focus?.({ preventScroll: true } as any);
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
      // Leer el stack en tiempo real para evitar stale closure cuando otro modal se abre encima
      if (__tp_modal_stack[__tp_modal_stack.length - 1] !== instanceId) return;
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
  }, [open, instanceId]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      // Leer el stack en tiempo real: evita que el trap de un modal inferior (con isTopMost
      // stale=true de su último render) intercepte Tab/Esc/Enter cuando hay un modal encima.
      const liveIsTopMost = __tp_modal_stack[__tp_modal_stack.length - 1] === instanceId;

      // ✅ TAB trap
      if (e.key === "Tab") {
        if (!liveIsTopMost) return;

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
          // Si el foco está en un portal hijo (ej. dropdown de búsqueda), dejar Tab libre
          if (active && active.closest?.("[data-tp-portal]")) return;
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
        if (!liveIsTopMost) return;

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
        if (!liveIsTopMost) return;
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
  }, [open, onClose, instanceId, busy, onEnter]);

  // ✅ si el foco se va afuera, lo devolvemos al modal
  function onFocusCapture() {
    if (!isTopMost) return;

    // ✅ Si hay un TPActionsMenu abierto, NO recapturar foco. El menú
    // tiene su propio ciclo de vida y al cerrarlo el foco volverá al
    // botón naturalmente. Sin este guard, abrir el menú en una línea
    // baja del modal causa: focus → body → recaptura a Cliente (1er
    // input) → scrollIntoView del modal hacia el tope.
    if ((typeof window !== "undefined") && (window.__tp_actions_menu_open ?? 0) > 0) return;

    const root = modalRef.current;
    if (!root) return;

    const active = document.activeElement as HTMLElement | null;
    if (active && root.contains(active)) return;

    // ✅ si el foco fue a un modal anidado (ej. "Agregar nuevo ítem" de TPComboCreatable),
    // no robarlo — los portales React propagan eventos por el árbol React aunque estén en body
    if (active && active.closest?.('[role="dialog"][aria-modal="true"]')) return;

    // ✅ si el foco fue al portal de TPComboFixed / TPComboCreatable / TPActionsMenu
    // (renderizados en body con `data-tp-portal`), no robarlo
    if (active && active.closest?.('[data-tp-portal]')) return;

    const best = pickBest(root);
    // `preventScroll: true` — si por algún motivo llegamos hasta acá y
    // refocusamos al primer input, NO queremos disparar scrollIntoView
    // del modal. Mejor el foco vuelve sin saltos visuales.
    (best ?? headerRef.current)?.focus?.({ preventScroll: true } as any);
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
  // En modo embedded el overlay no debe ensombrecer la pantalla — el modal se siente como página.
  const overlayClass = overlayClassName ?? (embeddedActive ? "bg-transparent" : defaultOverlayClass);

  const zBase = 1000 + depth * 10;
  const wCls = maxWidthClass(maxWidth, wide);

  const hasMeta = Boolean(subtitle || description);

  return createPortal(
    <div
      className={cn("fixed inset-0", embeddedActive && "pointer-events-none")}
      style={{ zIndex: zBase }}
      onFocusCapture={onFocusCapture}
    >
      {/* overlay (oculto en modo embedded) */}
      {!embeddedActive ? (
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
      ) : null}

      {/* layout container */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          !embeddedActive && "px-4 py-6"
        )}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "flex flex-col overflow-hidden",
            embeddedActive
              ? cn(
                  // Mobile: fullscreen. lg+: respeta el sidebar (left) y el
                  // topbar (top). Ambos vienen como CSS vars del layout:
                  //   --sidebar-w (Sidebar.tsx)  /  --topbar-h (Topbar.tsx)
                  "fixed inset-0",
                  "lg:left-[var(--sidebar-w,280px)]",
                  "lg:top-[var(--topbar-h,72px)]",
                  "bg-bg pointer-events-auto"
                )
              : "rounded-2xl border border-border bg-card shadow-soft",
            !isMaximized && !size && "relative w-full",
            !isMaximized && size && "relative",
            !isMaximized && !size && wCls,
            !isMaximized && !size && "max-h-[85vh]",
            // El className del caller (ej: "!max-w-[1500px] w-[96vw]") se
            // aplica solo en modo flotante; en cualquier modo maximizado
            // queremos ancho completo del área disponible.
            !isMaximized && className
          )}
          style={
            embeddedActive
              ? {
                  // Posicionamiento via clases Tailwind (top/right/bottom/left)
                  // para soportar el media query del sidebar.
                  width: "auto",
                  height: "auto",
                  maxWidth: "none",
                  maxHeight: "none",
                  transform: "none",
                  willChange: "auto",
                }
              : isMaximized
                ? {
                    position: "fixed",
                    top: 8,
                    left: 8,
                    right: 8,
                    bottom: 8,
                    width: "auto",
                    height: "auto",
                    maxWidth: "none",
                    maxHeight: "none",
                    transform: "none",
                    willChange: "auto",
                  }
                : {
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    willChange: "transform",
                    ...(size
                      ? {
                          width:  `${size.width}px`,
                          height: `${size.height}px`,
                          maxWidth:  "calc(100vw - 16px)",
                          maxHeight: "calc(100vh - 16px)",
                        }
                      : {}),
                  }
          }
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div
            ref={headerRef}
            tabIndex={-1}
            className={cn(
              "border-b border-border select-none shrink-0",
              "px-6 pt-5 pb-4",
              isMaximized ? "cursor-default" : "cursor-move"
            )}
            onPointerDown={(e) => {
              if (!isTopMost) return;
              if (busy) return;
              if (isMaximized) return;
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

                {maximizable ? (
                  <button
                    data-no-drag="1"
                    type="button"
                    title={isMaximized ? "Restaurar" : "Maximizar"}
                    aria-label={isMaximized ? "Restaurar" : "Maximizar"}
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
                      toggleMaximize();
                    }}
                    disabled={busy || !isTopMost}
                  >
                    {isMaximized ? <IconRestore /> : <IconMaximize />}
                  </button>
                ) : null}

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
              "p-6 pt-4 min-h-0 overflow-y-auto tp-scroll",
              "overscroll-contain touch-pan-y",
              (isMaximized || resizable) && "flex-1",
              bodyClassName
            )}
            style={{ WebkitOverflowScrolling: "touch" as any }}
          >
            {children}
          </div>

          {/* FOOTER */}
          {footer ? (
            <div className={cn("px-6 py-4 border-t border-border", "flex items-center justify-end gap-2 shrink-0", footerClassName)}>
              {footer}
            </div>
          ) : null}

          {/* RESIZE HANDLES (8) */}
          {resizable && !isMaximized ? (
            <>
              {/* Bordes */}
              <div
                className="absolute top-0 left-3 right-3 h-1.5 z-20 cursor-ns-resize"
                onPointerDown={(e) => onResizeStart(e, "t")}
              />
              <div
                className="absolute bottom-0 left-3 right-3 h-1.5 z-20 cursor-ns-resize"
                onPointerDown={(e) => onResizeStart(e, "b")}
              />
              <div
                className="absolute top-3 bottom-3 left-0 w-1.5 z-20 cursor-ew-resize"
                onPointerDown={(e) => onResizeStart(e, "l")}
              />
              <div
                className="absolute top-3 bottom-3 right-0 w-1.5 z-20 cursor-ew-resize"
                onPointerDown={(e) => onResizeStart(e, "r")}
              />
              {/* Esquinas */}
              <div
                className="absolute top-0 left-0 w-3 h-3 z-30 cursor-nwse-resize"
                onPointerDown={(e) => onResizeStart(e, "tl")}
              />
              <div
                className="absolute top-0 right-0 w-3 h-3 z-30 cursor-nesw-resize"
                onPointerDown={(e) => onResizeStart(e, "tr")}
              />
              <div
                className="absolute bottom-0 left-0 w-3 h-3 z-30 cursor-nesw-resize"
                onPointerDown={(e) => onResizeStart(e, "bl")}
              />
              <div
                className="absolute bottom-0 right-0 w-3 h-3 z-30 cursor-nwse-resize"
                onPointerDown={(e) => onResizeStart(e, "br")}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;