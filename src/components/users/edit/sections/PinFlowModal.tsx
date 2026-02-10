// tptech-frontend/src/components/users/edit/sections/PinFlowModal.tsx
import React from "react";
import { Modal } from "../../../ui/Modal";
import { cn } from "../../users.ui";

/* =========================
   PIN BOXES (4 dígitos)
========================= */
function PinBoxes({
  value,
  onChange,
  disabled,
  autoFocus,
  focusKey,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  focusKey?: number;
}) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 4);
  const cells = [0, 1, 2, 3].map((i) => digits[i] ?? "");

  const refs = React.useMemo(
    () => Array.from({ length: 4 }, () => React.createRef<HTMLInputElement>()),
    []
  );

  function setDigitAt(i: number, d: string) {
    const next = digits.split("");
    while (next.length < 4) next.push("");
    next[i] = d;
    onChange(next.join("").replace(/\D/g, "").slice(0, 4));
  }

  function focusCell(i: number) {
    refs[Math.max(0, Math.min(3, i))].current?.focus();
  }

  React.useEffect(() => {
    if (!autoFocus) return;
    if (disabled) return;

    const raf = requestAnimationFrame(() => {
      setTimeout(() => focusCell(0), 0);
    });

    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled, focusKey]);

  return (
    <div className={cn("flex gap-2", disabled && "opacity-60")}>
      {cells.map((c, i) => (
        <input
          key={i}
          ref={refs[i]}
          className={cn(
            "tp-input",
            "!mt-0",
            "!w-[40px]",
            "shrink-0",
            "h-[42px]",
            "rounded-md",
            "px-0 text-center text-lg",
            "tracking-[0.25em]",
            "focus:ring-2 focus:ring-[color:var(--primary)]"
          )}
          disabled={disabled}
          inputMode="numeric"
          value={c ? "•" : ""}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            if (!d) return;
            setDigitAt(i, d);
            focusCell(i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (cells[i]) {
                setDigitAt(i, "");
              } else {
                focusCell(i - 1);
                setDigitAt(Math.max(0, i - 1), "");
              }
              return;
            }
          }}
          onPaste={(e) => {
            const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
            if (!paste) return;
            e.preventDefault();
            onChange(paste);
          }}
        />
      ))}
    </div>
  );
}

/* =========================
   PIN FLOW MODAL
========================= */
export function PinFlowModal({
  open,
  title,
  onClose,
  overlayClassName,
  hasPin,
  pinFlowStep,
  setPinFlowStep,
  pinDraft,
  setPinDraft,
  pinDraft2,
  setPinDraft2,
  pinBusy,
  pinToggling,
  onConfirm,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  overlayClassName?: string;
  hasPin: boolean;

  pinFlowStep: "NEW" | "CONFIRM";
  setPinFlowStep: (v: "NEW" | "CONFIRM") => void;

  // ✅ nuevo PIN
  pinDraft: string;
  setPinDraft: (v: string) => void;

  // ✅ confirmación nuevo PIN
  pinDraft2: string;
  setPinDraft2: (v: string) => void;

  pinBusy: boolean;
  pinToggling: boolean;

  // ✅ ahora permite recibir payload (no rompe si tu handler no usa params)
  onConfirm: (payload?: { pin: string; currentPin?: string }) => Promise<void> | void;
}) {
  const busy = pinBusy || pinToggling;

  // ✅ PIN actual (solo si hasPin=true)
  const [currentPinDraft, setCurrentPinDraft] = React.useState("");

  const [focusKey, setFocusKey] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setFocusKey((k) => k + 1);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setFocusKey((k) => k + 1);
  }, [pinFlowStep, open]);

  React.useEffect(() => {
    if (!open) return;
    // cada vez que abre, reseteo el pin actual (evita “pin viejo” en pantalla)
    setCurrentPinDraft("");
  }, [open]);

  const pinMismatch =
    pinFlowStep === "CONFIRM" &&
    pinDraft.length === 4 &&
    pinDraft2.length === 4 &&
    pinDraft !== pinDraft2;

  // ✅ si ya tenía PIN, en NEW primero debe estar el PIN actual
  const canContinue = !busy && pinDraft.length === 4 && (!hasPin || currentPinDraft.length === 4);

  const canConfirm =
    !busy &&
    pinDraft.length === 4 &&
    pinDraft2.length === 4 &&
    pinDraft === pinDraft2 &&
    (!hasPin || currentPinDraft.length === 4);

  function resetAll() {
    setCurrentPinDraft("");
    setPinDraft("");
    setPinDraft2("");
    setPinFlowStep("NEW");
    setFocusKey((k) => k + 1);
  }

  // ✅ Acción primaria: NEW -> confirmar; CONFIRM -> confirmar y cerrar (si OK)
  async function doPrimaryAction() {
    if (busy) return;

    if (pinFlowStep === "NEW") {
      if (!canContinue) return;
      setPinFlowStep("CONFIRM");
      return;
    }

    if (!canConfirm) return;

    // ✅ NO cerrar si falla
    try {
      await onConfirm({
        pin: pinDraft,
        ...(hasPin ? { currentPin: currentPinDraft } : {}),
      });
      onClose();
    } catch {
      // el error lo maneja el padre (toast / setErr)
      // mantenemos abierto
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      wide={false}
      overlayClassName={overlayClassName}
      className="max-w-[380px]"
    >
      <div
        className="w-full min-h-[300px] px-4"
        onKeyDownCapture={(e) => {
          if (!open) return;

          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            void doPrimaryAction();
            return;
          }

          if (e.key === "Escape") {
            if (busy) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="w-full max-w-[320px] text-center">
            <div
              className="tp-card rounded-2xl px-4 py-5 space-y-4"
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in oklab, var(--card) 92%, var(--bg))",
              }}
            >
              {/* STEP NEW */}
              {pinFlowStep === "NEW" ? (
                <>
                  {hasPin ? (
                    <div>
                      <div className="text-xs text-muted mb-2">Ingresá tu PIN actual.</div>
                      <div className="flex justify-center">
                        <PinBoxes
                          value={currentPinDraft}
                          onChange={(v) => setCurrentPinDraft(v)}
                          disabled={busy}
                          autoFocus
                          focusKey={focusKey}
                        />
                      </div>
                      {currentPinDraft.length > 0 && currentPinDraft.length < 4 ? (
                        <div className="text-[11px] text-muted mt-2">Debe tener 4 dígitos.</div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className={cn(hasPin && currentPinDraft.length !== 4 && "opacity-55")}>
                    <div className="text-xs text-muted mb-2">
                      {hasPin ? "Ingresá el nuevo PIN." : "Ingresá el nuevo PIN."}
                    </div>

                    <div className="flex justify-center">
                      <PinBoxes
                        value={pinDraft}
                        onChange={(v) => setPinDraft(v)}
                        disabled={busy || (hasPin && currentPinDraft.length !== 4)}
                        autoFocus={!hasPin}
                        focusKey={focusKey + (hasPin ? 999 : 0)}
                      />
                    </div>

                    {hasPin && currentPinDraft.length !== 4 ? (
                      <div className="text-[11px] text-muted mt-2">Primero completá el PIN actual.</div>
                    ) : null}
                  </div>
                </>
              ) : (
                /* STEP CONFIRM */
                <>
                  <div className="text-xs text-muted mb-2">Confirmá el PIN.</div>
                  <div className="flex justify-center">
                    <PinBoxes
                      value={pinDraft2}
                      onChange={(v) => setPinDraft2(v)}
                      disabled={busy}
                      autoFocus
                      focusKey={focusKey}
                    />
                  </div>

                  {pinMismatch ? <div className="text-xs text-red-400 mt-2">El PIN no coincide</div> : null}
                </>
              )}
            </div>

            <div className="mt-10 flex justify-center gap-2">
              <button type="button" className="tp-btn-secondary" disabled={busy} onClick={resetAll}>
                Limpiar
              </button>

              <button
                type="button"
                className={cn("tp-btn-primary", busy && "opacity-60")}
                disabled={pinFlowStep === "NEW" ? !canContinue : !canConfirm}
                onClick={() => void doPrimaryAction()}
              >
                {pinFlowStep === "NEW"
                  ? "Continuar"
                  : hasPin
                  ? "Actualizar PIN"
                  : "Crear PIN"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
