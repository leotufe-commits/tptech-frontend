// tptech-frontend/src/components/ui/ConfirmUnsavedChangesDialog.tsx
import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { cn } from "./tp";

type Props = {
  open: boolean;
  title?: string;
  description?: React.ReactNode;

  /** Cierra SOLO el diálogo (seguir editando) */
  onClose: () => void;

  /** Descarta cambios y cierra el modal/pantalla principal */
  onDiscard: () => void;

  /** Si querés personalizar el overlay */
  overlayClassName?: string;

  /** Si hay procesos ocupados, bloquea botones y cierre */
  busy?: boolean;

  /** Opcional: texto botones */
  keepText?: string;
  discardText?: string;
};

export default function ConfirmUnsavedChangesDialog({
  open,
  title = "Cambios sin guardar",
  description = (
    <>
      Hiciste cambios que todavía <b>no se guardaron</b>. Si salís ahora, se van a perder.
      <br />
      ¿Qué querés hacer?
    </>
  ),
  onClose,
  onDiscard,
  overlayClassName,
  busy = false,
  keepText = "Seguir editando",
  discardText = "Descartar cambios",
}: Props) {
  function safeClose() {
    if (busy) return;
    onClose();
  }

  function safeDiscard() {
    if (busy) return;
    onDiscard();
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={safeClose}
      wide={false}
      overlayClassName={overlayClassName}
      busy={busy}
      className="max-w-[520px]"
    >
      <div className="space-y-4">
        {/* ✅ Estilo tipo “Usuarios”: bloque destacado */}
        <div
          className="tp-card p-3 text-sm flex gap-3 items-start"
          style={{
            border: "1px solid color-mix(in oklab, var(--danger) 35%, var(--border))",
            background: "color-mix(in oklab, var(--card) 88%, var(--bg))",
          }}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-text">Se perderán los cambios</div>
            <div className="text-xs text-muted mt-1">{description}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            className={cn("tp-btn-secondary", busy && "opacity-60")}
            type="button"
            disabled={busy}
            onClick={safeClose}
          >
            {keepText}
          </button>

          <button
            className={cn(
              // si existe tp-btn-danger, usalo. Si no, igual queda “danger” por styles inline.
              "tp-btn-danger",
              "tp-btn",
              busy && "opacity-60"
            )}
            type="button"
            disabled={busy}
            onClick={safeDiscard}
            style={{
              border: "1px solid color-mix(in oklab, var(--danger) 45%, var(--border))",
              background: "color-mix(in oklab, var(--danger) 10%, var(--card))",
            }}
          >
            {discardText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
