// tptech-frontend/src/components/users/edit/partials/PinConfigSection.tsx
import React from "react";
import { TPSegmentedPills } from "../../../ui/TPBadges";
import { cn, Section } from "../../users.ui";
import type { Override } from "../../../../services/users";
import { PinFlowModal } from "../sections/PinFlowModal";
import { isValidPinDraft } from "../helpers/sectionConfig.helpers";

type Props = {
  modalMode: "CREATE" | "EDIT";

  confirmOverlay: string;

  canAdmin: boolean;
  isOwner: boolean;
  isSelf: boolean;

  detailHasQuickPin: boolean;
  detailPinEnabled: boolean;

  pinFlowOpen: boolean;
  openPinFlow: () => void;
  closePinFlow: () => void;

  pinFlowStep: "NEW" | "CONFIRM";
  setPinFlowStep: (v: "NEW" | "CONFIRM") => void;

  pinDraft: string;
  setPinDraft: (v: string) => void;
  pinDraft2: string;
  setPinDraft2: (v: string) => void;

  pinBusy: boolean;
  pinToggling: boolean;
  pinPillsDisabled: boolean;

  pinMsg: string | null;
  showPinMessage: boolean;

  // drafts pending (solo CREATE)
  pinNew: string;
  pinNew2: string;
  setPinNew: (v: string) => void;
  setPinNew2: (v: string) => void;

  // actions
  adminSetOrResetPin: (opts?: { currentPin?: string; pin?: string; pin2?: string }) => Promise<void>;
  adminTogglePinEnabled: (next: boolean, opts?: { confirmRemoveOverrides?: boolean }) => Promise<void>;
  adminRemovePin: (opts?: { confirmRemoveOverrides?: boolean; currentPin?: string }) => Promise<void>;

  // overrides info
  specialListSorted: Override[];
  setConfirmDisablePinClearsSpecialOpen: (v: boolean) => void;

  // visual toggle
  pinRemovedVisual: boolean;
  setPinRemovedVisual: (v: boolean) => void;

  // for self deletion modal opening
  onAskDeleteSelf: () => void;
};

export default function PinConfigSection(props: Props) {
  const {
    modalMode,
    confirmOverlay,

    canAdmin,
    isOwner,
    isSelf,

    detailHasQuickPin,
    detailPinEnabled,

    pinFlowOpen,
    openPinFlow,
    closePinFlow,

    pinFlowStep,
    setPinFlowStep,
    pinDraft,
    setPinDraft,
    pinDraft2,
    setPinDraft2,

    pinBusy,
    pinToggling,
    pinPillsDisabled,

    pinMsg,
    showPinMessage,

    pinNew,
    pinNew2,
    setPinNew,
    setPinNew2,

    adminSetOrResetPin,
    adminTogglePinEnabled,
    adminRemovePin,

    specialListSorted,
    setConfirmDisablePinClearsSpecialOpen,

    pinRemovedVisual,
    setPinRemovedVisual,

    onAskDeleteSelf,
  } = props;

  // ✅ IMPORTANTE:
  // "pinPending" SOLO aplica en CREATE (porque ahí sí se guarda al apretar Guardar usuario).
  const pinPending = modalMode === "CREATE" ? isValidPinDraft(pinNew, pinNew2) : false;

  const canManagePin = Boolean(isSelf || canAdmin);
  const pinActionsDisabled = pinBusy || pinToggling || !canManagePin;

  // Solo pedimos "PIN actual" dentro del PinFlow si SELF y había pin real
  const hasPinForFlow = Boolean(isSelf && detailHasQuickPin && !pinRemovedVisual);

  const pinModalTitle =
    modalMode === "CREATE"
      ? pinPending
        ? "Editar PIN inicial"
        : "Crear PIN inicial"
      : detailHasQuickPin && !pinRemovedVisual
      ? "Actualizar PIN"
      : "Crear PIN";

  const showActivationPills = Boolean(detailHasQuickPin && !pinRemovedVisual);

  return (
    <>
      <PinFlowModal
        open={pinFlowOpen}
        title={pinModalTitle}
        onClose={closePinFlow}
        overlayClassName={confirmOverlay}
        hasPin={hasPinForFlow}
        pinFlowStep={pinFlowStep}
        setPinFlowStep={setPinFlowStep}
        pinDraft={pinDraft}
        setPinDraft={setPinDraft}
        pinDraft2={pinDraft2}
        setPinDraft2={setPinDraft2}
        pinBusy={pinBusy}
        pinToggling={pinToggling}
        onConfirm={async (payload?: { currentPin?: string }) => {
          // ✅ sanity: si el modal permite confirmar con basura, no seguimos
          if (!isValidPinDraft(pinDraft, pinDraft2)) return;

          setPinRemovedVisual(false);

          // ✅ CREATE: queda pendiente y se aplica cuando guardás el usuario
          if (modalMode === "CREATE") {
            setPinNew(pinDraft);
            setPinNew2(pinDraft2);
            closePinFlow();
            return;
          }

          // ✅ EDIT: se guarda INMEDIATO (NO queda pendiente)
          // limpiamos el draft pending por si venías de estados viejos
          setPinNew("");
          setPinNew2("");

          // ✅ CLAVE: no depender del state (pinNew/pinNew2) para llamar al API
          await adminSetOrResetPin({
            currentPin: payload?.currentPin,
            pin: pinDraft,
            pin2: pinDraft2,
          });

          closePinFlow();
        }}
      />

      <Section title={<div className="flex items-center gap-2">Clave rápida (PIN)</div>}>
        <div className="tp-card p-4 flex flex-col gap-3">
          <div className="text-sm">
            {detailHasQuickPin && !pinRemovedVisual ? (
              <span className="text-foreground/80">Hay un PIN configurado para este usuario.</span>
            ) : pinPending ? (
              <span className="text-foreground/80">PIN listo para aplicar al guardar.</span>
            ) : (
              <span className="text-muted">
                {modalMode === "CREATE"
                  ? "Podés definir un PIN inicial (se aplica al guardar)."
                  : "Todavía no hay un PIN configurado."}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn("tp-btn-primary", pinActionsDisabled && "opacity-60")}
              disabled={pinActionsDisabled}
              onClick={() => {
                setPinRemovedVisual(false);
                openPinFlow();
              }}
            >
              {detailHasQuickPin && !pinRemovedVisual
                ? "Actualizar PIN"
                : pinPending
                ? "Editar PIN"
                : modalMode === "CREATE"
                ? "Crear PIN inicial"
                : "Crear PIN"}
            </button>

            {detailHasQuickPin && !pinRemovedVisual ? (
              <button
                type="button"
                className={cn("tp-btn-secondary hover:text-red-400", pinActionsDisabled && "opacity-60")}
                disabled={pinActionsDisabled}
                onClick={() => {
                  if (!canManagePin) return;

                  // SELF: pedimos pin actual
                  if (isSelf) {
                    onAskDeleteSelf();
                    return;
                  }

                  // ADMIN: si hay overrides, confirmación
                  const hasOverrides = specialListSorted.length > 0;
                  if (!isOwner && hasOverrides) {
                    setConfirmDisablePinClearsSpecialOpen(true);
                    return;
                  }

                  void adminRemovePin().then(() => {
                    // ✅ en EDIT esto es real (ya se borró). En CREATE no llegás acá.
                    setPinNew("");
                    setPinNew2("");
                    setPinRemovedVisual(true);
                  });
                }}
              >
                Eliminar
              </button>
            ) : pinPending ? (
              <button
                type="button"
                className={cn("tp-btn-secondary", (pinBusy || pinToggling || !canManagePin) && "opacity-60")}
                disabled={pinBusy || pinToggling || !canManagePin}
                onClick={() => {
                  // ✅ solo CREATE: cancelar pin pendiente
                  setPinNew("");
                  setPinNew2("");
                  setPinRemovedVisual(false);
                }}
              >
                Quitar
              </button>
            ) : null}
          </div>

          {showPinMessage && pinMsg ? <div className="text-xs text-muted">{pinMsg}</div> : null}

          {modalMode === "CREATE" ? (
            <div className="text-[11px] text-muted">* El PIN se aplica recién cuando guardás el usuario.</div>
          ) : null}

          {showActivationPills ? (
            <div className="pt-1">
              <div className="text-xs text-muted mb-2">Estado del PIN</div>

              <TPSegmentedPills
                value={Boolean(detailPinEnabled)}
                onChange={(next) => {
                  if (pinPillsDisabled) return;

                  const hasOverrides = specialListSorted.length > 0;
                  if (!next && !isOwner && hasOverrides) {
                    setConfirmDisablePinClearsSpecialOpen(true);
                    return;
                  }

                  void adminTogglePinEnabled(Boolean(next));
                }}
                disabled={pinPillsDisabled}
                labels={{ off: "PIN deshabilitado", on: "PIN habilitado" }}
              />
            </div>
          ) : null}
        </div>
      </Section>
    </>
  );
}
