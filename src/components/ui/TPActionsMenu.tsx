// src/components/ui/TPActionsMenu.tsx
// Menú desplegable de acciones (hamburguesa) reutilizable
import React, { useRef, useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { cn } from "./tp";

export type TPActionsMenuItem =
  | { type?: "item"; label: string; icon?: React.ReactNode; onClick: () => void; disabled?: boolean }
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
        return (
          <button
            key={i}
            type="button"
            disabled={item.disabled}
            onClick={() => { onClose(); item.onClick(); }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-text hover:bg-surface2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
          >
            {item.icon && <span className="shrink-0 text-muted">{item.icon}</span>}
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
}: {
  items: TPActionsMenuItem[];
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
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
          className="min-w-[210px] rounded-xl border border-border bg-card shadow-lg py-1.5"
        >
          <MenuItems items={items} onClose={() => setOpen(false)} />
        </div>,
        document.body
      )}
    </div>
  );
}

export default TPActionsMenu;
