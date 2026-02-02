// tptech-frontend/src/components/users/edit/UserEditFooter.tsx
import React from "react";
import { cn } from "../users.ui";

type Props = {
  modalBusy: boolean;
  modalMode: "CREATE" | "EDIT";
  onCancel: () => void;
};

export default function UserEditFooter({ modalBusy, modalMode, onCancel }: Props) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        className={cn("tp-btn-secondary", "h-[42px] px-3 py-2 text-sm", modalBusy && "opacity-60")}
        type="button"
        onClick={() => {
          if (modalBusy) return;
          onCancel();
        }}
        disabled={modalBusy}
      >
        Cancelar
      </button>

      <button
        className={cn("tp-btn-primary", "h-[42px] px-3 py-2 text-sm", modalBusy && "opacity-60")}
        type="submit"
        disabled={modalBusy}
      >
        {modalBusy ? "Guardando…" : modalMode === "CREATE" ? "Crear" : "Guardar"}
      </button>
    </div>
  );
}

export { UserEditFooter };
