import React, { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn, Section } from "../../users.ui";
import type { Override } from "../../../../services/users";
import { Modal } from "../../../ui/Modal";
import { TPButton } from "../../../ui/TPButton";

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

  pinPillsDisabled: boolean;

  // true cuando este es el ultimo PIN y el Bloqueo por PIN del sistema esta activo
  isLastPinWithLock?: boolean;

  pinMsg: string | null;
  showPinMessage: boolean;

  adminTogglePinEnabled: (next: boolean, opts?: { confirmRemoveOverrides?: boolean }) => Promise<void>;
  adminRemovePin: (opts?: { confirmRemoveOverrides?: boolean; currentPin?: string }) => Promise<void>;

  specialListSorted: Override[];

  setConfirmDisablePinClearsSpecialOpen: (v: boolean) => void;

  pinRemovedVisual: boolean;
  setPinRemovedVisual: (v: boolean) => void;

  onAskDeleteSelf: () => void;
};

export default function PinConfigSection(props: Props) {
  const navigate = useNavigate();

  const {
    modalMode,
    canAdmin,
    isSelf,

    detailHasQuickPin,
    detailPinEnabled,

    pinBusy,
    pinToggling,

    isLastPinWithLock,

    pinMsg,
    showPinMessage,

    openPinFlow,
    adminRemovePin,

    specialListSorted,

    pinRemovedVisual,
    setPinRemovedVisual,

    onAskDeleteSelf,
  } = props;

  const SYSTEM_PIN_ROUTE = "/configuracion-sistema/pin";

  const busy = pinBusy || pinToggling;
  const hasSpecial = (specialListSorted?.length || 0) > 0;

  const canEditPin = isSelf || canAdmin;

  const disabled = !canEditPin || busy;

  const effectiveHasPin = useMemo(
    () => Boolean(detailHasQuickPin) && !pinRemovedVisual,
    [detailHasQuickPin, pinRemovedVisual]
  );

  const effectiveEnabled = useMemo(
    () => Boolean(detailPinEnabled) && effectiveHasPin,
    [detailPinEnabled, effectiveHasPin]
  );

  const pendingSetup = useMemo(() => effectiveHasPin && !effectiveEnabled, [effectiveHasPin, effectiveEnabled]);

  const [lastPinLockError, setLastPinLockError] = useState<string | null>(null);

  // Modal informativo: "Al eliminar el PIN, el Bloqueo por PIN quedara deshabilitado"
  const [showDisableLockConfirm, setShowDisableLockConfirm] = useState(false);

  useEffect(() => {
    setPinRemovedVisual(false);
    setLastPinLockError(null);
    setShowDisableLockConfirm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailHasQuickPin, modalMode]);

  async function proceedWithDelete() {
    if (isSelf) {
      onAskDeleteSelf();
      return;
    }

    setLastPinLockError(null);

    try {
      await adminRemovePin({ confirmRemoveOverrides: hasSpecial });
      setPinRemovedVisual(true);
    } catch (e: any) {
      const status = Number(e?.status ?? NaN);
      const code = String(e?.data?.code ?? "");

      if (status === 409 && code === "LAST_PIN_LOCK_ACTIVE") {
        setLastPinLockError(
          String(
            e?.data?.message ||
              "No se puede eliminar el PIN mientras el Bloqueo por PIN del sistema este activo."
          )
        );
        return;
      }

      throw e;
    }
  }

  function onDeleteClick() {
    if (disabled) return;

    // Si es el ultimo PIN con lock activo, mostrar aviso antes de continuar
    if (isLastPinWithLock) {
      setShowDisableLockConfirm(true);
      return;
    }

    void proceedWithDelete();
  }

  const deleteDisabled = disabled;

  const deleteTitle = isSelf ? "Requiere tu PIN actual" : "Eliminar PIN";

  const primaryLabel = busy
    ? ""
    : pendingSetup
    ? "Configurar PIN"
    : isSelf
    ? effectiveHasPin ? "Actualizar PIN" : "Crear PIN"
    : effectiveHasPin ? "Restablecer PIN" : "Asignar PIN";

  return (
    <>
    <Section title="Clave rapida (PIN)" desc="PIN de 4 digitos para desbloqueo/cambio rapido.">

      {/* mensaje backend general */}
      {showPinMessage && pinMsg ? (
        <div className="mb-3 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">{pinMsg}</div>
      ) : null}

      {/* error especifico (backend bloqueo) */}
      {lastPinLockError ? (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <div className="font-semibold">No se puede eliminar el PIN</div>
          <div className="mt-1 text-xs text-red-200/90">{lastPinLockError}</div>
          <div className="mt-2">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-red-500/25 bg-card px-3 py-2 text-xs font-semibold",
                "hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20"
              )}
              onClick={() => navigate(SYSTEM_PIN_ROUTE)}
            >
              Ir a Configuracion PIN
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Estado */}
      {effectiveHasPin ? (
        pendingSetup ? (
          <div className="mb-2 text-xs text-muted">
            Estado: <b className="text-amber-400">Pendiente de configurar</b>
          </div>
        ) : (
          <div className="mb-2 text-xs text-muted">
            Estado:{" "}
            <b className={cn(effectiveEnabled ? "text-emerald-400" : "text-muted")}>
              {effectiveEnabled ? "Habilitado" : "Deshabilitado"}
            </b>
          </div>
        )
      ) : (
        <div className="mb-2 text-xs text-muted">
          Estado: <b className="text-muted">Sin PIN</b>
        </div>
      )}

      <div className="flex justify-start gap-2 pt-2">
        <button
          type="button"
          className={cn("tp-btn-primary", "h-[42px] px-4 py-2 text-sm", disabled && "opacity-60")}
          disabled={disabled}
          onClick={() => {
            setLastPinLockError(null);
            setPinRemovedVisual(false);
            openPinFlow();
          }}
          title={undefined}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando...
            </span>
          ) : (
            primaryLabel
          )}
        </button>

        {effectiveHasPin ? (
          <button
            type="button"
            className={cn(
              "tp-btn-secondary",
              "h-[42px] px-4 py-2 text-sm",
              deleteDisabled && "opacity-60"
            )}
            disabled={deleteDisabled}
            onClick={onDeleteClick}
            title={deleteTitle}
          >
            Eliminar
          </button>
        ) : null}
      </div>
    </Section>

    {/* Modal informativo: ultimo PIN — el lock quedara deshabilitado */}
    <Modal
      open={showDisableLockConfirm}
      title="Eliminar PIN"
      maxWidth="sm"
      onClose={() => setShowDisableLockConfirm(false)}
      footer={
        <div className="flex gap-2 justify-end">
          <TPButton variant="secondary" onClick={() => setShowDisableLockConfirm(false)}>
            Cancelar
          </TPButton>
          <TPButton
            variant="danger"
            onClick={() => {
              setShowDisableLockConfirm(false);
              void proceedWithDelete();
            }}
          >
            Eliminar PIN
          </TPButton>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-text">
        <p>
          Al eliminar este PIN, el <b>Bloqueo por PIN</b> del sistema quedara{" "}
          <b>deshabilitado automaticamente</b>, ya que es el ultimo PIN existente.
        </p>
        <p className="text-muted text-xs">
          Los usuarios podran cambiar de cuenta sin necesidad de ingresar un PIN hasta que se configure uno nuevo.
        </p>
      </div>
    </Modal>
    </>
  );
}
