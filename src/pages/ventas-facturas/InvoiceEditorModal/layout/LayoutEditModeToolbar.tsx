// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/LayoutEditModeToolbar.tsx
//
// Toolbar del banner de "modo edicion del layout". Vive sticky-top dentro
// del modal y expone: Restaurar diseno, Cancelar cambios, Listo.

import React from "react";
import { Check, RotateCcw, X, Loader2 } from "lucide-react";
import { TPButton } from "../../../../components/ui/TPButton";
import type { PersistenceStatus } from "./types";

export type LayoutEditModeToolbarProps = {
  editing: boolean;
  onEnter: () => void;
  onExit: () => void;
  onReset: () => void;
  /**
   * Handler de "Cancelar cambios" (descartar la sesion de edicion).
   * Opcional para back-compat — si no se pasa, el boton no se renderiza.
   */
  onCancelChanges?: () => void;
  persistenceStatus?: PersistenceStatus;
};

export function LayoutEditModeToolbar(props: LayoutEditModeToolbarProps): React.ReactElement {
  const { editing, onEnter, onExit, onReset, onCancelChanges, persistenceStatus } = props;

  if (!editing) {
    // Modo lectura limpio: no renderizamos nada. El boton "Personalizar
    // layout" vive en el header del modal (`headerRight`), no en esta
    // toolbar — que solo aparece dentro del banner sticky de edicion.
    void onEnter;
    return <></>;
  }

  // Jerarquia visual del toolbar editor (decision producto):
  //   · "Restaurar diseno" → ghost (accion poco frecuente, baja jerarquia).
  //   · "Cancelar cambios" → secondary (rollback de sesion).
  //   · "Listo"            → primary (accion principal, color primary).
  // Contenedor con borde + fondo sutil para que el grupo se lea como
  // una unidad cohesionada y no botones sueltos flotando.
  return (
    <div className="flex items-center gap-2">
      {persistenceStatus ? <PersistenceIndicator status={persistenceStatus} /> : null}
      <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/50 p-1 shadow-sm backdrop-blur-sm">
        <TPButton
          variant="ghost"
          onClick={onReset}
          className="h-9 px-3 text-sm"
          iconLeft={<RotateCcw size={14} />}
          title="Volver al diseno predeterminado del preset"
        >
          Restaurar diseño
        </TPButton>
        {onCancelChanges ? (
          <TPButton
            variant="secondary"
            onClick={onCancelChanges}
            className="h-9 px-3 text-sm"
            iconLeft={<X size={14} />}
            title="Descartar cambios de esta sesion"
          >
            Cancelar cambios
          </TPButton>
        ) : null}
        <TPButton
          variant="primary"
          onClick={onExit}
          className="h-9 px-4 text-sm font-semibold"
          iconLeft={<Check size={14} />}
        >
          Listo
        </TPButton>
      </div>
    </div>
  );
}

function PersistenceIndicator(props: { status: PersistenceStatus }): React.ReactElement | null {
  const { status } = props;
  if (status === "idle") return null;
  if (status === "pending" || status === "saving") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <Loader2 size={12} className="animate-spin" />
        Guardando...
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-500">
        <Check size={12} />
        Guardado
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-red-500">
        Error al guardar
      </span>
    );
  }
  return null;
}
