import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SlidersHorizontal,
  GripVertical,
} from "lucide-react";
import { cn } from "./tp";
import { TPCheckbox } from "./TPCheckbox";

export type ColPickerDef = {
  key: string;
  label: string;
  /** Si es false, no se puede ocultar. Default: true */
  canHide?: boolean;
};

type DragState = {
  draggingKey: string | null;
  overKey: string | null;
};

export function TPColumnPicker({
  columns,
  visibility,
  onChange,
  order,
  onOrderChange,
  className,
}: {
  columns: ColPickerDef[];
  visibility: Record<string, boolean>;
  onChange: (key: string, visible: boolean) => void;
  order?: string[];
  onOrderChange?: (nextOrder: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [drag, setDrag] = useState<DragState>({
    draggingKey: null,
    overKey: null,
  });

  function calcPos() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dropW = 240;
    const left = Math.max(
      8,
      Math.min(rect.right - dropW, window.innerWidth - dropW - 8)
    );
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

  const hideable = useMemo(
    () => columns.filter((c) => c.canHide !== false),
    [columns]
  );

  const orderedColumns = useMemo(() => {
    if (!order || order.length === 0) return columns;

    const map = new Map(columns.map((c) => [c.key, c]));
    const ordered = order
      .map((key) => map.get(key))
      .filter(Boolean) as ColPickerDef[];

    const missing = columns.filter((c) => !order.includes(c.key));
    return [...ordered, ...missing];
  }, [columns, order]);

  function moveColumn(draggingKey: string, overKey: string) {
    if (!onOrderChange || draggingKey === overKey) return;

    const currentOrder =
      order && order.length > 0 ? [...order] : columns.map((c) => c.key);

    const from = currentOrder.indexOf(draggingKey);
    const to = currentOrder.indexOf(overKey);

    if (from === -1 || to === -1 || from === to) return;

    const next = [...currentOrder];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onOrderChange(next);
  }

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
        title="Mostrar/ocultar y reordenar columnas"
        aria-label="Columnas"
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
              width: 240,
              zIndex: 9999,
            }}
            className="rounded-xl border border-border bg-card shadow-lg p-2 space-y-1"
          >
            <div className="px-2 pb-1.5 pt-0.5 text-xs text-muted font-semibold uppercase tracking-wide">
              Columnas visibles
            </div>

            <div className="px-2 pb-1 text-[11px] text-muted">
              Arrastrá para cambiar el orden
            </div>

            {orderedColumns.map((col) => {
              const isHideable = col.canHide !== false;
              const isDragging = drag.draggingKey === col.key;
              const isOver = drag.overKey === col.key && drag.draggingKey !== col.key;

              return (
                <div
                  key={col.key}
                  draggable={!!onOrderChange}
                  onDragStart={() =>
                    setDrag({ draggingKey: col.key, overKey: col.key })
                  }
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (drag.draggingKey && drag.draggingKey !== col.key) {
                      setDrag((prev) => ({ ...prev, overKey: col.key }));
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag.draggingKey) {
                      moveColumn(drag.draggingKey, col.key);
                    }
                    setDrag({ draggingKey: null, overKey: null });
                  }}
                  onDragEnd={() =>
                    setDrag({ draggingKey: null, overKey: null })
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                    "hover:bg-surface2/50",
                    isDragging && "opacity-50",
                    isOver && "bg-surface2"
                  )}
                >
                  <div
                    className={cn(
                      "shrink-0 text-muted",
                      onOrderChange ? "cursor-grab active:cursor-grabbing" : "opacity-40"
                    )}
                    title="Arrastrar para reordenar"
                  >
                    <GripVertical size={14} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <TPCheckbox
                      checked={visibility[col.key] !== false}
                      onChange={(v) => isHideable && onChange(col.key, v)}
                      label={col.label}
                      disabled={!isHideable}
                      className="w-full select-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}