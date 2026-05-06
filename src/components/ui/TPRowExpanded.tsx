// src/components/ui/TPRowExpanded.tsx
// ============================================================================
// TPRowExpanded — fila expandible para tablas (TPTableKit).
//
// Provee dos piezas complementarias:
//
//   · `TPRowExpanded`   — renderiza un `<TPTr>` extra debajo de la fila
//     principal con el contenido expandido. Ocupa todo el ancho vía `colSpan`.
//     Devuelve `null` cuando `isExpanded=false`, ideal para usar en conjunto
//     con un `React.Fragment` que envuelve la fila principal + la expandida.
//
//   · `TPRowExpandToggle` — botón con chevron (ChevronRight que rota 90° al
//     expandir). Se pensó para colocar en una celda al inicio o al final de
//     la fila; emite `onToggle()` al click sin propagar.
//
// Uso típico en `renderRow(r, vis, sel, orderedKeys)`:
//
//   return (
//     <React.Fragment key={r.id}>
//       <TPTr>
//         <TPTd><TPRowExpandToggle isExpanded={...} onToggle={...} /></TPTd>
//         {...otras celdas...}
//       </TPTr>
//       <TPRowExpanded isExpanded={expanded} colSpan={keys.length}>
//         ... contenido ...
//       </TPRowExpanded>
//     </React.Fragment>
//   );
//
// La animación de expansión es mínima (rotación del chevron). No anima el
// despliegue del contenido para mantener el foco visual; un fade suave se
// podría agregar con Tailwind `animate-*` si en el futuro se desea.
// ============================================================================

import React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "./tp";
import { TPTr, TPTd } from "./TPTable";

// ─────────────────────────────────────────────────────────────────────────────
// TPRowExpanded — fila con contenido expandido
// ─────────────────────────────────────────────────────────────────────────────

export type TPRowExpandedProps = {
  isExpanded: boolean;
  /** Cantidad de columnas que debe ocupar la fila expandida. */
  colSpan: number;
  /** Callback opcional — expuesto por simetría con el toggle. No se consume adentro. */
  onToggle?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function TPRowExpanded({
  isExpanded,
  colSpan,
  children,
  className,
}: TPRowExpandedProps) {
  if (!isExpanded) return null;

  return (
    <TPTr>
      <TPTd
        colSpan={colSpan}
        className={cn(
          "bg-surface2/60 border-t border-border/80 px-4 py-4",
          className,
        )}
      >
        {children}
      </TPTd>
    </TPTr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TPRowExpandToggle — chevron click para expandir
// ─────────────────────────────────────────────────────────────────────────────

export type TPRowExpandToggleProps = {
  isExpanded: boolean;
  onToggle: () => void;
  title?: string;
  className?: string;
};

export function TPRowExpandToggle({
  isExpanded,
  onToggle,
  title = "Ver detalle",
  className,
}: TPRowExpandToggleProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded text-muted transition hover:bg-surface2 hover:text-text",
        className,
      )}
      title={title}
      aria-expanded={isExpanded}
      aria-label={title}
    >
      <ChevronRight
        size={14}
        className={cn("transition-transform duration-150", isExpanded && "rotate-90")}
      />
    </button>
  );
}

export default TPRowExpanded;
