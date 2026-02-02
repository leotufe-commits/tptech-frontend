import React from "react";
import { Modal } from "../../../ui/Modal";
import { cn } from "../../users.ui";
import { TPNotice } from "../helpers/ui";

type Props = {
  confirmOverlay: string;

  // PIN clears special
  confirmDisablePinClearsSpecialOpen: boolean;
  setConfirmDisablePinClearsSpecialOpen: (v: boolean) => void;
  pinToggling: boolean;
  specialClearing: boolean;
  specialCount: number;
  onConfirmDisablePinAndClearSpecial: () => void;

  // disable special clears
  confirmDisableSpecialOpen: boolean;
  setConfirmDisableSpecialOpen: (v: boolean) => void;
  onConfirmDisableSpecialAndClear: () => void;
};

export function ConfirmModals({
  confirmOverlay,

  confirmDisablePinClearsSpecialOpen,
  setConfirmDisablePinClearsSpecialOpen,
  pinToggling,
  specialClearing,
  specialCount,
  onConfirmDisablePinAndClearSpecial,

  confirmDisableSpecialOpen,
  setConfirmDisableSpecialOpen,
  onConfirmDisableSpecialAndClear,
}: Props) {
  const busyPinClear = pinToggling || specialClearing;
  const busySpecialClear = specialClearing;

  return (
    <>
      {/* ✅ Confirm: deshabilitar PIN borra permisos especiales */}
      <Modal
        open={confirmDisablePinClearsSpecialOpen}
        title="Deshabilitar PIN"
        onClose={() => setConfirmDisablePinClearsSpecialOpen(false)}
        wide={false}
        overlayClassName={confirmOverlay}
        busy={busyPinClear}
      >
        <div className="space-y-3">
          <TPNotice tone="danger" title="Se eliminarán permisos especiales">
            Este usuario tiene <b>{specialCount}</b> permiso(s) especial(es). Si deshabilitás el PIN y confirmás, se borrarán permanentemente.
            ¿Deseás continuar?
          </TPNotice>

          <div className="flex justify-end gap-2 pt-1">
            <button
              className={cn("tp-btn-secondary", busyPinClear && "opacity-60")}
              type="button"
              disabled={busyPinClear}
              onClick={() => setConfirmDisablePinClearsSpecialOpen(false)}
            >
              Cancelar
            </button>

            <button
              className={cn("tp-btn-primary", busyPinClear && "opacity-60")}
              type="button"
              disabled={busyPinClear}
              onClick={onConfirmDisablePinAndClearSpecial}
              title="Deshabilitar PIN y borrar permisos"
            >
              {busyPinClear ? "Procesando…" : "Deshabilitar y borrar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ✅ Confirm: deshabilitar permisos especiales */}
      <Modal
        open={confirmDisableSpecialOpen}
        title="Deshabilitar permisos especiales"
        onClose={() => setConfirmDisableSpecialOpen(false)}
        wide={false}
        overlayClassName={confirmOverlay}
        busy={busySpecialClear}
      >
        <div className="space-y-3">
          <TPNotice tone="danger" title="Se eliminarán permisos asignados">
            Este usuario tiene <b>{specialCount}</b> permiso(s) especial(es). Si deshabilitás la píldora, se borrarán permanentemente.
            ¿Deseás continuar?
          </TPNotice>

          <div className="flex justify-end gap-2 pt-1">
            <button
              className={cn("tp-btn-secondary", busySpecialClear && "opacity-60")}
              type="button"
              disabled={busySpecialClear}
              onClick={() => setConfirmDisableSpecialOpen(false)}
            >
              Cancelar
            </button>

            <button
              className={cn("tp-btn-primary", busySpecialClear && "opacity-60")}
              type="button"
              disabled={busySpecialClear}
              onClick={onConfirmDisableSpecialAndClear}
              title="Deshabilitar y borrar permisos"
            >
              {busySpecialClear ? "Borrando…" : "Deshabilitar y borrar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default ConfirmModals;
