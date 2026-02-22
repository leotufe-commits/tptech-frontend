import React from "react";
import { X, Save } from "lucide-react";
import { cn } from "../users.ui";

type Props = {
  modalBusy: boolean;
  modalMode: "CREATE" | "EDIT";
  onCancel: () => void;

  /** ✅ si false, deshabilita submit (ej: sin cambios) */
  canSubmit?: boolean;

  /** ✅ si true, oculta el botón submit (ej: pinOnly mode) */
  hideSubmit?: boolean;

  /** ✅ permite personalizar el texto del submit */
  submitLabel?: string;
};

export default function UserEditFooter({
  modalBusy,
  modalMode,
  onCancel,
  canSubmit = true,
  hideSubmit = false,
  submitLabel,
}: Props) {
  const disabledCancel = modalBusy;
  const disabledSubmit = modalBusy || !canSubmit;

  const defaultLabel = modalBusy ? "Guardando…" : modalMode === "CREATE" ? "Crear" : "Guardar";
  const label = submitLabel ?? defaultLabel;

  return (
    <>
      <button
        className={cn("tp-btn-secondary", "h-[42px] px-3 py-2 text-sm", disabledCancel && "opacity-60")}
        type="button"
        onClick={() => {
          if (disabledCancel) return;
          onCancel();
        }}
        disabled={disabledCancel}
      >
        <span className="inline-flex items-center gap-2">
          <X className="h-4 w-4" />
          {hideSubmit ? "Cerrar" : "Cancelar"}
        </span>
      </button>

      {hideSubmit ? null : (
        <button
          className={cn("tp-btn-primary", "h-[42px] px-3 py-2 text-sm", disabledSubmit && "opacity-60")}
          type="submit"
          disabled={disabledSubmit}
          title={!canSubmit && !modalBusy ? "No hay cambios para guardar" : undefined}
        >
          <span className="inline-flex items-center gap-2">
            <Save className="h-4 w-4" />
            {label}
          </span>
        </button>
      )}
    </>
  );
}

export { UserEditFooter };