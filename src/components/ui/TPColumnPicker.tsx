// src/components/ui/TPColumnPicker.tsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "./tp";
import { TPCheckbox } from "./TPCheckbox";

export type ColPickerDef = {
  key: string;
  label: string;
  /** Si es false, no se puede ocultar. Default: true */
  canHide?: boolean;
};

export function TPColumnPicker({
  columns,
  visibility,
  onChange,
  className,
}: {
  columns: ColPickerDef[];
  visibility: Record<string, boolean>;
  onChange: (key: string, visible: boolean) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  function calcPos() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dropW = 200;
    const left = Math.max(8, Math.min(rect.right - dropW, window.innerWidth - dropW - 8));
    setDropPos({ top: rect.bottom + 4, left });
  }

  useEffect(() => {
    if (!open) return;
    calcPos();

    function onClickOutside(e: MouseEvent) {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onClose() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [open]);

  const hideable = columns.filter((c) => c.canHide !== false);
  if (hideable.length === 0) return null;

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((x) => !x)}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-border bg-surface h-9 w-9 text-text hover:bg-surface2/60 transition-colors",
          open && "bg-surface2/60"
        )}
        title="Mostrar/ocultar columnas"
        aria-label="Columnas visibles"
      >
        <SlidersHorizontal size={15} />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropRef}
            style={{
              position: "fixed",
              top: dropPos.top,
              left: dropPos.left,
              width: 200,
              zIndex: 9999,
            }}
            className="rounded-xl border border-border bg-card shadow-lg p-2 space-y-0.5"
          >
            <div className="px-2 pb-1.5 pt-0.5 text-xs text-muted font-semibold uppercase tracking-wide">
              Columnas visibles
            </div>
            {hideable.map((col) => (
              <TPCheckbox
                key={col.key}
                checked={visibility[col.key] !== false}
                onChange={(v) => onChange(col.key, v)}
                label={col.label}
                className="w-full px-2 py-2 rounded-lg hover:bg-surface2/50 select-none"
              />
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
