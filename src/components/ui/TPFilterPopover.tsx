// src/components/ui/TPFilterPopover.tsx
// Popover con lista de opciones de filtro. Al seleccionar una opción se cierra
// automáticamente. Ideal para filtros de tipo, estado, categoría, etc.
//
// Uso:
//   <TPFilterPopover
//     open={open} onClose={() => setOpen(false)} anchorRef={btnRef}
//     title="Tipo de movimiento"
//     options={[{ value: "", label: "Todos" }, { value: "IN", label: "Entrada" }]}
//     value={kind}
//     onChange={setKind}
//   />
import React from "react";
import { TPPopover } from "./TPPopover";

export type TPFilterOption<V extends string = string> = {
  value: V;
  label: string;
};

type Props<V extends string = string> = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Encabezado de la lista (opcional). */
  title?: string;
  options: TPFilterOption<V>[];
  /** Valor actualmente seleccionado. */
  value: V;
  onChange: (v: V) => void;
};

export function TPFilterPopover<V extends string = string>({
  open,
  onClose,
  anchorRef,
  title,
  options,
  value,
  onChange,
}: Props<V>) {
  return (
    <TPPopover open={open} onClose={onClose} anchorRef={anchorRef} width={208}>
      <div className="py-1.5">
        {title && (
          <p className="px-3 py-1 text-[10px] font-semibold text-muted uppercase tracking-wide">
            {title}
          </p>
        )}
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); onClose(); }}
            className={[
              "w-full text-left text-sm px-3 py-1.5 transition-colors",
              value === opt.value
                ? "bg-primary/10 text-primary font-medium"
                : "text-text hover:bg-surface2/60",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </TPPopover>
  );
}

export default TPFilterPopover;
