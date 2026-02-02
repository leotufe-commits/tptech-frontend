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
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  focusKey?: number;
  onEnter?: () => void;
}) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 4);
  const cells = [0, 1, 2, 3].map((i) => digits[i] ?? "");

  const refs = React.useMemo(() => Array.from({ length: 4 }, () => React.createRef<HTMLInputElement>()), []);

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
            // ✅ ENTER: ejecuta acción primaria del modal (Continuar/Guardar)
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              onEnter?.();
              return;
            }

            if (e.key === "Backspace") {
              e.preventDefault();
              if (cells[i]) {
                setDigitAt(i, "");
              } else {
                focusCell(i - 1);
                setDigitAt(Math.max(0, i - 1), "");
              }
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

  pinDraft: string;
  setPinDraft: (v: string) => void;
  pinDraft2: string;
  setPinDraft2: (v: string) => void;

  pinBusy: boolean;
  pinToggling: boolean;

  onConfirm: () => void;
}) {
  const busy = pinBusy || pinToggling;

  // ✅ fuerza focus en el primer campo cuando:
  // - se abre el modal
  // - cambiás de paso (NEW/CONFIRM)
  // - tocás "Limpiar"
  const [focusKey, setFocusKey] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setFocusKey((k) => k + 1);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setFocusKey((k) => k + 1);
  }, [pinFlowStep, open]);

  const pinMismatch =
    pinFlowStep === "CONFIRM" && pinDraft.length === 4 && pinDraft2.length === 4 && pinDraft !== pinDraft2;

  const canContinue = !busy && pinDraft.length === 4;
  const canConfirm = !busy && pinDraft.length === 4 && pinDraft2.length === 4 && pinDraft === pinDraft2;

  function doPrimaryAction() {
    if (busy) return;

    if (pinFlowStep === "NEW") {
      if (!canContinue) return;
      setPinFlowStep("CONFIRM");
      return;
    }

    if (!canConfirm) return;
    onConfirm();
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
      {/* ✅ Capturamos ENTER para que NO dispare el submit del form de atrás */}
      <div
        className="w-full min-h-[300px] px-4"
        onKeyDownCapture={(e) => {
          if (!open) return;

          // Enter: simula Continuar/Guardar
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            doPrimaryAction();
            return;
          }

          // (Opcional) Escape para cerrar, si no está busy
          if (e.key === "Escape") {
            if (busy) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            // dejamos que el Modal maneje su cierre; pero evitamos burbujeo al form padre
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="w-full max-w-[320px] text-center">
            <div
              className="tp-card rounded-2xl px-4 py-5"
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in oklab, var(--card) 92%, var(--bg))",
              }}
            >
              {/* ✅ único texto (sin label duplicado) */}
              <div className="text-xs text-muted mb-3">{pinFlowStep === "NEW" ? "Ingresá el nuevo PIN." : "Confirmá el PIN."}</div>

              <div className="flex justify-center">
                <PinBoxes
                  value={pinFlowStep === "NEW" ? pinDraft : pinDraft2}
                  onChange={(v) => {
                    if (pinFlowStep === "NEW") {
                      setPinDraft(v);

                      // ✅ si completa 4 dígitos, pasa a confirmar (mantengo tu comportamiento)
                      if (v.length === 4) setPinFlowStep("CONFIRM");
                    } else {
                      setPinDraft2(v);
                    }
                  }}
                  disabled={busy}
                  autoFocus
                  focusKey={focusKey}
                  onEnter={doPrimaryAction} // ✅ Enter dentro de casillas
                />
              </div>

              {/* ✅ SOLO muestra mismatch cuando ambos tienen 4 dígitos */}
              {pinMismatch ? <div className="text-xs text-red-400 mt-3">El PIN no coincide</div> : null}
            </div>

            <div className="mt-10 flex justify-center gap-2">
              <button
                type="button"
                className="tp-btn-secondary"
                disabled={busy}
                onClick={() => {
                  setPinDraft("");
                  setPinDraft2("");
                  setPinFlowStep("NEW");
                  setFocusKey((k) => k + 1); // ✅ focus al primero al limpiar
                }}
              >
                Limpiar
              </button>

              <button
                type="button"
                className={cn("tp-btn-primary", busy && "opacity-60")}
                disabled={pinFlowStep === "NEW" ? !canContinue : !canConfirm}
                onClick={doPrimaryAction}
              >
                {pinFlowStep === "NEW" ? "Continuar" : hasPin ? "Actualizar PIN" : "Crear PIN"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
