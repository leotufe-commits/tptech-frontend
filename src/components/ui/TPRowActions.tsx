// src/components/ui/TPRowActions.tsx
import { type ReactNode } from "react";
import {
  Eye,
  Pencil,
  Star,
  Trash,
  Copy,
  ShieldCheck,
  ShieldBan,
} from "lucide-react";
import { cn } from "./tp";

/**
 * Botones de acción estándar para filas de tabla.
 * Todos los props son opcionales — solo se renderizan los que se pasan.
 *
 * Orden estándar: Favorito → Ver → Editar → Clonar → Toggle → Eliminar
 */

export function TPRowActions({
  onView,
  onEdit,
  editDisabled,
  onClone,
  onToggle,
  toggleDisabled,
  isActive,
  onFavorite,
  isFavorite,
  busyFavorite,
  busyToggle,
  busyDelete,
  onDelete,
  deleteDisabled,
  deleteTitle,
  extra,
  className,
}: {
  onView?: () => void;
  onEdit?: () => void;
  /** Muestra el botón editar deshabilitado (sin ocultarlo). */
  editDisabled?: boolean;
  onClone?: () => void;
  onToggle?: () => void;
  /** Muestra el botón toggle deshabilitado (sin ocultarlo). */
  toggleDisabled?: boolean;
  isActive?: boolean;
  onFavorite?: () => void;
  isFavorite?: boolean;
  busyFavorite?: boolean;
  busyToggle?: boolean;
  busyDelete?: boolean;
  onDelete?: () => void;
  /** Muestra el botón eliminar deshabilitado (sin ocultarlo). */
  deleteDisabled?: boolean;
  /** Tooltip personalizado del botón eliminar (por defecto: "Eliminar"). */
  deleteTitle?: string;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div data-tp-actions className={cn("flex items-center justify-end gap-1.5 flex-nowrap", className)}>
      {extra}

      {onFavorite && (
        <ActionBtn
          title={isFavorite ? "Quitar favorito" : "Marcar favorito"}
          onClick={onFavorite}
          disabled={busyFavorite}
        >
          <Star
            size={15}
            className={
              isFavorite
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted"
            }
          />
        </ActionBtn>
      )}

      {onView && (
        <ActionBtn title="Ver detalle" onClick={onView}>
          <Eye size={16} />
        </ActionBtn>
      )}

      {onEdit && (
        <ActionBtn title="Editar" onClick={onEdit} disabled={editDisabled}>
          <Pencil size={16} />
        </ActionBtn>
      )}

      {onClone && (
        <ActionBtn title="Clonar" onClick={onClone}>
          <Copy size={16} />
        </ActionBtn>
      )}

      {onToggle && (
        <ActionBtn
          title={isActive ? "Desactivar" : "Activar"}
          onClick={onToggle}
          disabled={busyToggle || toggleDisabled}
        >
          {isActive ? (
            <ShieldCheck size={15} className="text-muted" />
          ) : (
            <ShieldBan size={15} className="text-muted" />
          )}
        </ActionBtn>
      )}

      {onDelete && (
        <ActionBtn title={deleteTitle ?? "Eliminar"} onClick={onDelete} disabled={busyDelete || deleteDisabled}>
          <Trash size={16} />
        </ActionBtn>
      )}
    </div>
  );
}

/* ---- botón base interno ---- */
function ActionBtn({
  title,
  onClick,
  disabled,
  className,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "tp-btn-secondary h-9 w-9 !p-0 grid place-items-center shrink-0",
        className
      )}
    >
      {children}
    </button>
  );
}

export default TPRowActions;