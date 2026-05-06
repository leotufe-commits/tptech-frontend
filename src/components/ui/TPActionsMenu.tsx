// src/components/ui/TPActionsMenu.tsx
// Menú desplegable de acciones (hamburguesa) reutilizable
import React, { useRef, useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { cn } from "./tp";

/**
 * Contador global de TPActionsMenu abiertos. Lo expone `Modal.tsx` (vía
 * `window.__tp_actions_menu_open`) para suspender su lógica de
 * autoFocus / restoreFocus / focus-trap mientras haya algún menú abierto.
 *
 * Mientras `> 0`:
 *   · Modal.onFocusCapture NO recaptura el foco.
 *   · Modal's focus guard interval NO refoca el primer input.
 *
 * Esto evita que abrir/cerrar el menú "..." de una línea fuerce foco en
 * Cliente (primer input del modal de Factura), provocando un scroll jump.
 */
declare global {
  interface Window {
    __tp_actions_menu_open?: number;
  }
}
function bumpActionMenuCounter(delta: 1 | -1) {
  if (typeof window === "undefined") return;
  const cur = window.__tp_actions_menu_open ?? 0;
  window.__tp_actions_menu_open = Math.max(0, cur + delta);
}

export type TPActionsMenuItem =
  | {
      type?: "item";
      label: string;
      icon?: React.ReactNode;
      onClick: () => void;
      disabled?: boolean;
      /**
       * Cuándo ejecutar `onClick` respecto al cierre del menú.
       *
       *   · `"immediate"` (default): corre la acción ANTES de cerrar el
       *     menú. Ambos `setState` quedan en el mismo batch de React. Es
       *     el modo más confiable porque no depende de timers ni de que
       *     el portal se desmonte primero. Recomendado para acciones
       *     destructivas (eliminar línea, anular comprobante).
       *
       *   · `"afterClose"`: cierra el menú primero, ejecuta la acción en
       *     el siguiente macrotask (`setTimeout 0`). Útil cuando la
       *     acción depende de que el portal ya esté desmontado (raro).
       *     Si el componente que dispara la acción se desmonta entre
       *     medio, la acción puede perderse — preferir "immediate".
       */
      actionMode?: "immediate" | "afterClose";
      /** @deprecated usar `actionMode: "afterClose"`. */
      deferAction?: boolean;
      /**
       * Si está en `true`, la acción es destructiva y se renderiza con
       * color de error. Solo afecta visual.
       */
      destructive?: boolean;
    }
  | { type: "separator" }
  | { type: "submenu"; label: string; icon?: React.ReactNode; children: TPActionsMenuItem[] };

function MenuItems({
  items,
  onClose,
}: {
  items: TPActionsMenuItem[];
  onClose: () => void;
}) {
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  return (
    <>
      {items.map((item, i) => {
        if (item.type === "separator") {
          return <div key={i} className="my-1 border-t border-border/50" />;
        }
        if (item.type === "submenu") {
          const isOpen = openSubmenu === i;
          return (
            <div key={i} className="relative">
              <button
                type="button"
                onClick={() => setOpenSubmenu(isOpen ? null : i)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-text hover:bg-surface2 transition-colors text-left"
              >
                {item.icon && <span className="shrink-0 text-muted">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                <ChevronRight
                  size={13}
                  className={cn("text-muted transition-transform shrink-0", isOpen && "rotate-90 -scale-x-100")}
                />
              </button>
              {isOpen && (
                <div className="absolute right-full top-0 min-w-[180px] rounded-xl border border-border bg-card shadow-lg py-1.5 z-50">
                  <MenuItems items={item.children} onClose={onClose} />
                </div>
              )}
            </div>
          );
        }
        const itemFn = item.onClick;
        // Resolución del modo: `actionMode` gana sobre `deferAction` (legacy).
        const mode: "immediate" | "afterClose" =
          item.actionMode ?? (item.deferAction ? "afterClose" : "immediate");
        return (
          <button
            key={i}
            type="button"
            disabled={item.disabled}
            onMouseDown={(e) => {
              // Evita que `mousedown` propague al overlay click-outside
              // del menú (ese listener cerraría el menú antes del click).
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (mode === "immediate") {
                // Modo confiable: acción PRIMERO, cierre después. React
                // batchea ambos setState. Si la acción muta el padre y
                // hace que la fila se desmonte, el menú igual cierra
                // (setOpen(false) → portal unmount). No depende de
                // setTimeout ni de que el portal se desmonte antes.
                itemFn();
                onClose();
              } else {
                // Modo legacy `afterClose`: cierre + setTimeout. Solo
                // recomendado cuando la acción dependa explícitamente
                // de que el portal ya esté desmontado.
                onClose();
                setTimeout(itemFn, 0);
              }
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left",
              item.destructive
                ? "text-red-500 hover:bg-red-500/10"
                : "text-text hover:bg-surface2",
            )}
          >
            {item.icon && (
              <span className={cn("shrink-0", item.destructive ? "text-red-500" : "text-muted")}>
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </>
  );
}

export function TPActionsMenu({
  items,
  title = "Más acciones",
  className,
  hoverTrigger = false,
}: {
  items: TPActionsMenuItem[];
  title?: string;
  className?: string;
  /** Abre el menú al hacer hover y lo cierra al salir (con pequeño delay). */
  hoverTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Scroll-preserve: cuando el botón se enfoca al hacer click, el browser
  // puede hacer `scrollIntoView` sobre el contenedor scrolleable más
  // cercano (el `.tp-scroll` del modal cuando aplica) para "centrar" el
  // foco. Guardamos el scrollTop antes de abrir el menú y lo restauramos
  // post-abrir si cambió. La defensa principal es `preventDefault` en
  // `onMouseDown`, pero esto cubre cualquier camino residual.
  const preservedScrollRef = useRef<{ el: HTMLElement; top: number } | null>(null);

  function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.body) {
      const cs = window.getComputedStyle(cur);
      const oy = cs.overflowY;
      if ((oy === "auto" || oy === "scroll") && cur.scrollHeight > cur.clientHeight) {
        return cur;
      }
      cur = cur.parentElement;
    }
    // Fallback: contenedor scrolleable del modal.
    return document.querySelector<HTMLElement>(".tp-scroll");
  }

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  function scheduleOpen() {
    clearTimer();
    timerRef.current = setTimeout(() => setOpen(true), 80);
  }

  function scheduleClose() {
    clearTimer();
    timerRef.current = setTimeout(() => setOpen(false), 150);
  }

  function calcStyle() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setStyle({
      position: "fixed",
      top:      rect.bottom + 4,
      right:    window.innerWidth - rect.right,
      zIndex:   9999,
    });
  }

  useEffect(() => {
    if (!open) return;
    calcStyle();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    }
    function onScroll() { calcStyle(); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Restauración del scrollTop preservado tras abrir el menú.
  // Defensa adicional: si pese a las protecciones algo movió el scroll,
  // lo devolvemos al valor previo en el siguiente paint.
  useEffect(() => {
    if (!open) return;
    const preserved = preservedScrollRef.current;
    if (!preserved) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (preserved.el.scrollTop !== preserved.top) {
          preserved.el.scrollTop = preserved.top;
        }
        preservedScrollRef.current = null;
      });
    });
  }, [open]);

  // Mientras el menú está abierto, incrementamos un contador global que
  // `Modal.tsx` consulta para suspender su autoFocus / restoreFocus /
  // focus-trap. Esto previene que abrir o cerrar el menú dispare
  // `pickBest(root).focus()` sobre Cliente (con su correspondiente
  // scrollIntoView). Decrementamos en cleanup — incluido el caso de
  // unmount con menú abierto (toast cierra modal, navegación, etc.).
  useEffect(() => {
    if (!open) return;
    bumpActionMenuCounter(1);
    return () => bumpActionMenuCounter(-1);
  }, [open]);

  /* Limpiar timer al desmontar */
  useEffect(() => () => clearTimer(), []);

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={hoverTrigger ? scheduleOpen  : undefined}
      onMouseLeave={hoverTrigger ? scheduleClose : undefined}
    >
      <button
        ref={btnRef}
        type="button"
        title={title}
        onMouseDown={(e) => {
          // IMPORTANTE — NO usar `e.preventDefault()` acá: si lo hacemos,
          // el botón NO recibe foco al click, el foco queda flotando en
          // `body`, y el Modal contenedor (que tiene un `onFocusCapture`
          // que recaptura cualquier foco que escape al primer input
          // focuseable, ej. Cliente) salta a Cliente — lo que dispara un
          // `scrollIntoView` del modal hacia el tope. Dejamos que el
          // botón se enfoque naturalmente: el botón ESTÁ dentro del
          // modal, así que `onFocusCapture` no se dispara.
          //
          // `stopPropagation` se mantiene para evitar interferencias con
          // listeners ancestros (drag de fila, overlay click-outside).
          e.stopPropagation();
          // Capturamos el scrollTop ANTES de abrir, para restaurarlo si
          // algún path residual lo mueve (defensa en profundidad — el
          // path principal ya no debería gatillar scroll).
          if (btnRef.current) {
            const scrollEl = findScrollableAncestor(btnRef.current);
            if (scrollEl) {
              preservedScrollRef.current = { el: scrollEl, top: scrollEl.scrollTop };
            }
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0",
          open && "bg-surface2"
        )}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={style}
          // `data-tp-portal` indica al focus-trap del Modal contenedor
          // (ver `Modal.onFocusCapture`, línea ~676) que el foco dentro
          // de este portal NO debe ser recapturado al primer input del
          // modal. Cubre el caso teclado: si el usuario tabula al menú
          // o si algún ítem se enfoca, no salta a Cliente.
          data-tp-portal=""
          className="min-w-[210px] rounded-xl border border-border bg-card shadow-lg py-1.5"
          onMouseEnter={hoverTrigger ? clearTimer      : undefined}
          onMouseLeave={hoverTrigger ? scheduleClose   : undefined}
        >
          <MenuItems items={items} onClose={() => setOpen(false)} />
        </div>,
        document.body
      )}
    </div>
  );
}

export default TPActionsMenu;
