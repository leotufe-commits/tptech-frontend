// tptech-frontend/src/components/users/edit/partials/PinConfigSection.tsx
import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { cn, Section } from "../../users.ui";
import type { Override } from "../../../../services/users";

type Props = {
  modalMode: "CREATE" | "EDIT";
  confirmOverlay: string;

  canAdmin: boolean;
  isOwner: boolean;
  isSelf: boolean;

  detailHasQuickPin: boolean;
  detailPinEnabled: boolean;

  openPinFlow: () => void;

  pinBusy: boolean;
  pinToggling: boolean;

  pinMsg: string | null;
  showPinMessage: boolean;

  adminRemovePin: (opts?: { confirmRemoveOverrides?: boolean; currentPin?: string }) => Promise<void>;

  specialListSorted: Override[];

  pinRemovedVisual: boolean;
  setPinRemovedVisual: (v: boolean) => void;

  onAskDeleteSelf: () => void;
};

export default function PinConfigSection(props: Props) {
  const {
    modalMode,
    canAdmin,
    isSelf,

    detailHasQuickPin,
    detailPinEnabled,

    pinBusy,
    pinToggling,

    pinMsg,
    showPinMessage,

    openPinFlow,
    adminRemovePin,

    specialListSorted,

    pinRemovedVisual,
    setPinRemovedVisual,

    onAskDeleteSelf,
  } = props;

  const busy = pinBusy || pinToggling;
  const hasSpecial = (specialListSorted?.length || 0) > 0;

  const canEditPin = isSelf || canAdmin;

  useEffect(() => {
    setPinRemovedVisual(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailHasQuickPin, modalMode]);

  const effectiveEnabled = Boolean(detailPinEnabled) && !pinRemovedVisual;

  return (
    <Section
      title="Clave rápida (PIN)"
      desc="PIN de 4 dígitos para desbloqueo/cambio rápido."
    >
      {/* mensaje backend */}
      {showPinMessage && pinMsg ? (
        <div className="mb-3 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
          {pinMsg}
        </div>
      ) : null}

      {/* Estado */}
      {detailHasQuickPin ? (
        <div className="mb-2 text-xs text-muted">
          Estado:{" "}
          <b className={cn(effectiveEnabled ? "text-emerald-400" : "text-muted")}>
            {effectiveEnabled ? "Habilitado" : "Deshabilitado"}
          </b>
        </div>
      ) : (
        <div className="mb-2 text-xs text-muted">
          Estado: <b className="text-muted">Sin PIN</b>
        </div>
      )}

      {/* Botones alineados a la izquierda */}
      <div className="flex justify-start gap-2 pt-2">
        <button
          type="button"
          className={cn("tp-btn-primary", "h-[42px] px-4 py-2 text-sm", (!canEditPin || busy) && "opacity-60")}
          disabled={!canEditPin || busy}
          onClick={() => {
            setPinRemovedVisual(false);
            openPinFlow();
          }}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando…
            </span>
          ) : detailHasQuickPin ? (
            "Actualizar PIN"
          ) : (
            "Crear PIN"
          )}
        </button>

        {detailHasQuickPin ? (
          <button
            type="button"
            className={cn(
              "tp-btn-secondary",
              "h-[42px] px-4 py-2 text-sm",
              "text-red-600 border-red-600/40 hover:border-red-600/70",
              (!canEditPin || busy) && "opacity-60"
            )}
            disabled={!canEditPin || busy}
            onClick={() => {
              if (isSelf) {
                onAskDeleteSelf();
                return;
              }

              void adminRemovePin({ confirmRemoveOverrides: hasSpecial });
              setPinRemovedVisual(true);
            }}
            title={isSelf ? "Requiere tu PIN actual" : "Eliminar PIN"}
          >
            Eliminar
          </button>
        ) : null}
      </div>
    </Section>
  );
}
