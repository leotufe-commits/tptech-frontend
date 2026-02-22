import React, { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn, Section } from "../../users.ui";
import type { Override } from "../../../../services/users";

// ✅ NUEVO: para saber si el bloqueo por PIN del sistema está activo (Opción C)
import { useAuth } from "../../../../context/AuthContext";

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

  // ✅ “sistema PIN apagado / no editable”
  pinPillsDisabled: boolean;

  // ✅ NUEVO: estado global del sistema y conteo
  pinLockEnabled?: boolean; // viene del hook (config del sistema)
  usersWithPinCount?: number; // viene del hook (conteo en la lista)

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
  const auth = useAuth();

  const {
    modalMode,
    canAdmin,
    isSelf,

    detailHasQuickPin,
    detailPinEnabled,

    pinBusy,
    pinToggling,
    pinPillsDisabled,

    // ✅ NUEVO
    pinLockEnabled,
    usersWithPinCount,

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

  // ✅ “sistema apagado” lo tratamos como bloqueo para crear/editar/eliminar desde acá
  const disabled = !canEditPin || busy || pinPillsDisabled;

  // ✅ importante: si marcamos removedVisual, se considera “sin pin” aunque detail diga que sí
  const effectiveHasPin = useMemo(
    () => Boolean(detailHasQuickPin) && !pinRemovedVisual,
    [detailHasQuickPin, pinRemovedVisual]
  );

  const effectiveEnabled = useMemo(
    () => Boolean(detailPinEnabled) && effectiveHasPin,
    [detailPinEnabled, effectiveHasPin]
  );

  /**
   * ✅ NUEVO:
   * - "Pendiente de configurar" cuando existe PIN (hasQuickPin) pero está deshabilitado.
   *   Esto ocurre cuando el admin “preparó” el PIN pero el usuario todavía no lo activó/configuró.
   */
  const pendingSetup = useMemo(() => effectiveHasPin && !effectiveEnabled, [effectiveHasPin, effectiveEnabled]);

  /**
   * ✅ Regla correcta:
   * - Si el “Bloqueo por PIN” del sistema está activo, debe existir AL MENOS 1 usuario con PIN.
   * - Por lo tanto, NO podés eliminar este PIN si:
   *   - este usuario tiene PIN (effectiveHasPin)
   *   - y el conteo total de usuarios con PIN es <= 1
   *
   * Ojo: esto aplica tanto a SELF como a ADMIN (porque sería el ÚLTIMO PIN).
   */
  const systemPinLockEnabled =
    typeof pinLockEnabled === "boolean" ? pinLockEnabled : Boolean((auth as any)?.pinLockEnabled);

  const totalPins = typeof usersWithPinCount === "number" ? usersWithPinCount : NaN;
  const isLastPin = effectiveHasPin && Number.isFinite(totalPins) ? totalPins <= 1 : false;

  const blockDeleteBySystemLock = Boolean(systemPinLockEnabled && isLastPin);

  // ✅ mensaje específico cuando el backend bloquea por “último PIN habilitado”
  const [lastPinLockError, setLastPinLockError] = useState<string | null>(null);

  useEffect(() => {
    // cada vez que cambia el detalle o el modo, limpiamos estado visual
    setPinRemovedVisual(false);
    setLastPinLockError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailHasQuickPin, modalMode]);

  async function onDeleteClick() {
    // ✅ no hacemos nada (botón ya está disabled, pero por si acaso)
    if (disabled) return;
    if (blockDeleteBySystemLock) return;

    // self: ya tenés modal que pide current pin
    if (isSelf) {
      onAskDeleteSelf();
      return;
    }

    setLastPinLockError(null);

    try {
      await adminRemovePin({ confirmRemoveOverrides: hasSpecial });

      // ✅ recién ahora marcamos visualmente “sin pin”
      setPinRemovedVisual(true);
    } catch (e: any) {
      // ✅ ApiError: e.status / e.data.code gracias a tu api.ts
      const status = Number(e?.status ?? NaN);
      const code = String(e?.data?.code ?? "");

      if (status === 409 && code === "LAST_PIN_LOCK_ACTIVE") {
        setLastPinLockError(
          String(
            e?.data?.message ||
              "No podés eliminar o deshabilitar el último PIN mientras el bloqueo por PIN del sistema esté activo."
          )
        );
        return;
      }

      // fallback
      throw e;
    }
  }

  const deleteDisabled = disabled || blockDeleteBySystemLock;

  const deleteTitle = pinPillsDisabled
    ? "El PIN está deshabilitado en Configuración del sistema"
    : blockDeleteBySystemLock
    ? "No podés eliminar el último PIN mientras el Bloqueo por PIN del sistema esté activo"
    : isSelf
    ? "Requiere tu PIN actual"
    : "Eliminar PIN";

  // ✅ Label del botón principal
  const primaryLabel = busy ? "" : pendingSetup ? "Configurar PIN" : effectiveHasPin ? "Actualizar PIN" : "Crear PIN";

  return (
    <Section title="Clave rápida (PIN)" desc="PIN de 4 dígitos para desbloqueo/cambio rápido.">
      {/* ✅ Nota cuando el sistema PIN está apagado */}
      {pinPillsDisabled ? (
        <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          <div className="font-semibold">El PIN está deshabilitado en la configuración del sistema.</div>
          <div className="mt-1 text-xs text-amber-800/80">
            Activá la opción en <b>Configuración del sistema → PIN</b> para poder crear/editar/eliminar PINs de usuarios.
          </div>

          <div className="mt-2">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-card px-3 py-2 text-xs font-semibold",
                "text-amber-900 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/20"
              )}
              onClick={() => navigate(SYSTEM_PIN_ROUTE)}
            >
              Ir a Configuración PIN
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ✅ Aviso: no se puede eliminar el ÚLTIMO PIN con lock activo */}
      {blockDeleteBySystemLock ? (
        <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
          <div className="font-semibold">No se puede eliminar el último PIN</div>
          <div className="mt-1 text-xs text-amber-900/80">
            El <b>Bloqueo por PIN</b> del sistema está activo y este es el <b>único PIN</b> existente. Para eliminarlo,
            primero deshabilitá el bloqueo en <b>Configuración del sistema → PIN</b>.
          </div>

          <div className="mt-2">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-card px-3 py-2 text-xs font-semibold",
                "hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/20"
              )}
              onClick={() => navigate(SYSTEM_PIN_ROUTE)}
            >
              Ir a Configuración PIN
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* mensaje backend general */}
      {showPinMessage && pinMsg ? (
        <div className="mb-3 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">{pinMsg}</div>
      ) : null}

      {/* ✅ error específico (último PIN con lock activo) */}
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
              Ir a Configuración PIN
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ✅ Estado */}
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
          title={pinPillsDisabled ? "El PIN está deshabilitado en Configuración del sistema" : undefined}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando…
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
              "text-red-600 border-red-600/40 hover:border-red-600/70",
              deleteDisabled && "opacity-60"
            )}
            disabled={deleteDisabled}
            onClick={() => void onDeleteClick()}
            title={deleteTitle}
          >
            Eliminar
          </button>
        ) : null}
      </div>
    </Section>
  );
}