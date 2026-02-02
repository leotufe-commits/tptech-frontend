import React from "react";
import { Modal } from "./Modal";
import { cn } from "./tp";

type Props = {
  open: boolean;
  title?: string;
  description?: React.ReactNode;

  /** Cierra SOLO el diálogo (seguir editando) */
  onClose: () => void;

  /** Descarta cambios y cierra el modal principal */
  onDiscard: () => void;

  /** Si querés personalizar el overlay */
  overlayClassName?: string;

  /** Si hay procesos ocupados, bloquea botones */
  busy?: boolean;
};

export default function ConfirmUnsavedChangesDialog({
  open,
  title = "Cambios sin guardar",
  description = (
    <>
      Hiciste cambios que todavía <b>no se guardaron</b>. Si cerrás ahora, se van a perder.
      <br />
      ¿Qué querés hacer?
    </>
  ),
  onClose,
  onDiscard,
  overlayClassName,
  busy = false,
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
      onClose={safeClose} // ✅ si está busy, no deja cerrar por overlay/X
      wide={false}
      overlayClassName={overlayClassName}
    >
      <div className="space-y-4">
        <div className="text-sm text-muted">{description}</div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            className={cn("tp-btn-secondary", busy && "opacity-60")}
            type="button"
            disabled={busy}
            onClick={safeClose}
          >
            Seguir editando
          </button>

          <button className={cn("tp-btn", busy && "opacity-60")} type="button" disabled={busy} onClick={safeDiscard}>
            Descartar cambios
          </button>
        </div>
      </div>
    </Modal>
  );
}
