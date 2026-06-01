// src/components/sales/SaleCompositionEditableGrid/parts/PrefixedField.tsx
// =============================================================================
// FASE 12.20 — PrefixedField: wrap inline-flex que se ve como un solo campo
// compuesto. El prefix queda dentro del rectángulo visual del input (a la
// izquierda del valor). Hover y focus pintan el campo COMPLETO con el
// color del theme — el input interno corre con `noInputBg` para no
// duplicar el feedback.
// FASE F11 — extendido con `suffix` opcional (signo "%" / "$" / etc.
// integrado a la derecha del valor) y posibilidad de prefix/suffix
// interactivos (no aria-hidden) para los toggles de signo del editor
// de Bonificación/Recargo. Cuando `prefix` o `suffix` son ReactNode
// interactivos, el caller los pasa como tal y el wrap NO los marca como
// pointer-events-none.
// =============================================================================

import { cn } from "../../../ui/tp";

export function PrefixedField({
  prefix, suffix, children, interactive = true, className,
  prefixStatic = true, suffixStatic = true,
}: {
  prefix?:      React.ReactNode;
  suffix?:      React.ReactNode;
  children:     React.ReactNode;
  /** False → no aplica hover/focus visual (modo read-only). */
  interactive?: boolean;
  className?:   string;
  /** Default true: el prefix es decorativo (`%`, `Gramos`). False = button. */
  prefixStatic?: boolean;
  /** Default true: el suffix es decorativo. False = button. */
  suffixStatic?: boolean;
}) {
  return (
    <div
      className={cn(
        // FASE F13 — padding y gap apretados para dar más espacio al input
        // (el número es la pieza protagonista). Antes: gap-1, pl-1.5, pr-1.5.
        "inline-flex items-center gap-0.5 rounded-sm",
        prefix != null ? "pl-1" : "pl-0.5",
        suffix != null ? "pr-1" : "pr-0",
        "transition-[background-color,box-shadow] duration-150",
        interactive && "hover:bg-primary/[0.05] dark:hover:bg-primary/[0.08]",
        interactive && "focus-within:bg-primary/[0.06] dark:focus-within:bg-primary/[0.10]",
        interactive && "focus-within:shadow-[inset_0_-1px_0_0_rgb(var(--primary-rgb)_/_0.7)]",
        className,
      )}
    >
      {prefix != null && (
        prefixStatic ? (
          <span
            aria-hidden="true"
            className="shrink-0 select-none pointer-events-none text-[10px] leading-none text-muted/55 tabular-nums"
          >
            {prefix}
          </span>
        ) : (
          <span className="shrink-0 leading-none">{prefix}</span>
        )
      )}
      {children}
      {suffix != null && (
        suffixStatic ? (
          <span
            aria-hidden="true"
            className="shrink-0 select-none pointer-events-none text-[10px] leading-none text-muted/55 tabular-nums"
          >
            {suffix}
          </span>
        ) : (
          <span className="shrink-0 leading-none">{suffix}</span>
        )
      )}
    </div>
  );
}
