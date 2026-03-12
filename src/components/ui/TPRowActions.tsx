// src/components/ui/TPRowActions.tsx
import { type ReactNode } from "react";
import { Eye, Pencil, ShieldBan, ShieldCheck, Star, Trash2, Copy } from "lucide-react";
import { cn } from "./tp";

/**
 * Botones de acción estándar para filas de tabla.
 * Todos los props son opcionales — solo se renderizan los que se pasan.
 *
 * Orden estándar: Favorito → Ver → Editar → Clonar → Toggle → Eliminar
 *
 * Uso:
 * ```tsx
 * <TPRowActions
 *   onView={() => openView(row)}
 *   onEdit={() => openEdit(row)}
 *   onToggle={() => handleToggle(row)}
 *   isActive={row.isActive}
 *   onDelete={() => openDelete(row)}
 * />
 * ```
 */
export function TPRowActions({
  onView,
  onEdit,
  onClone,
  onToggle,
  isActive,
  onFavorite,
  isFavorite,
  busyFavorite,
  onDelete,
  extra,
  className,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onClone?: () => void;
  onToggle?: () => void;
  isActive?: boolean;
  onFavorite?: () => void;
  isFavorite?: boolean;
  busyFavorite?: boolean;
  onDelete?: () => void;
  /** Nodos extra renderizados antes de las acciones estándar (ej: Invitar, Adjuntos). */
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-end gap-1.5 flex-wrap", className)}>
      {extra}
      {onFavorite && (
        <ActionBtn
          title={isFavorite ? "Quitar favorito" : "Marcar favorito"}
          onClick={onFavorite}
          disabled={busyFavorite}
        >
          <Star
            size={15}
            className={isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted"}
          />
        </ActionBtn>
      )}

      {onView && (
        <ActionBtn title="Ver detalle" onClick={onView}>
          <Eye size={15} />
        </ActionBtn>
      )}

      {onEdit && (
        <ActionBtn title="Editar" onClick={onEdit}>
          <Pencil size={15} />
        </ActionBtn>
      )}

      {onClone && (
        <ActionBtn title="Clonar" onClick={onClone}>
          <Copy size={15} />
        </ActionBtn>
      )}

      {onToggle && (
        <ActionBtn title={isActive ? "Desactivar" : "Activar"} onClick={onToggle}>
          {isActive ? (
            <ShieldBan size={15} />
          ) : (
            <ShieldCheck size={15} />
          )}
        </ActionBtn>
      )}

      {onDelete && (
        <ActionBtn
          title="Eliminar"
          onClick={onDelete}
        >
          <Trash2 size={15} />
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
