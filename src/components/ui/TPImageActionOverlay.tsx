import React from "react";
import { Pencil, Plus, X } from "lucide-react";
import { cn } from "./tp";

type Props = {
  children: React.ReactNode;

  /** si ya existe imagen (muestra “Editar”), si no (muestra “Agregar”) */
  hasImage: boolean;

  /** estado */
  disabled?: boolean;
  loading?: boolean;

  /** acciones */
  onPick?: () => void;   // abrir selector de archivo
  onDelete?: () => void; // eliminar imagen

  /** textos */
  addLabel?: string;     // default "Agregar"
  editLabel?: string;    // default "Editar"
  deleteLabel?: string;  // default "Eliminar"

  /** estilos */
  className?: string;
};

export default function TPImageActionOverlay({
  children,
  hasImage,
  disabled = false,
  loading = false,
  onPick,
  onDelete,
  addLabel = "Agregar",
  editLabel = "Editar",
  deleteLabel = "Eliminar",
  className,
}: Props) {
  const canPick = Boolean(onPick) && !disabled && !loading;
  const canDelete = Boolean(onDelete) && hasImage && !disabled && !loading;

  const label = hasImage ? editLabel : addLabel;
  const Icon = hasImage ? Pencil : Plus;

  return (
    <div className={cn("relative group select-none", className)}>
      {/* Capa clickeable */}
      {canPick && (
        <button
          type="button"
          className="absolute inset-0 z-[2] cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPick?.();
          }}
          aria-label={label}
          title={label}
          style={{ background: "transparent" }}
        />
      )}

      {/* Contenido (imagen / avatar / iniciales) */}
      <div className="relative z-[1]">{children}</div>

      {/* Overlay Agregar / Editar */}
      {canPick && (
        <div
          className="absolute inset-0 z-[3] grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ background: "rgba(0,0,0,0.35)" }}
        >
          <div className="flex items-center gap-1 text-white text-[11px] font-semibold">
            <Icon className="h-3.5 w-3.5" />
            {label}
          </div>
        </div>
      )}

      {/* Botón eliminar */}
      {canDelete && (
        <button
          type="button"
          className="absolute -top-2 -right-2 z-[4] h-7 w-7 rounded-full grid place-items-center shadow-sm cursor-pointer"
          style={{
            border: "1px solid var(--border)",
            background: "color-mix(in oklab, var(--card) 86%, var(--bg))",
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete?.();
          }}
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}