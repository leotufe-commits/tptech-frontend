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

  pinDraft: string;
  setPinDraft: (v: string) => void;

  pinDraft2: string;
  setPinDraft2: (v: string) => void;

  pinBusy: boolean;
  pinToggling: boolean;

  onConfirm: (payload?: { pin: string; pin2: string; currentPin?: string }) => Promise<void> | void;
}) {
  const busy = pinBusy || pinToggling;

  // ✅ PIN actual (solo si hasPin=true)
  const [currentPinDraft, setCurrentPinDraft] = React.useState("");

  const [focusKey, setFocusKey] = React.useState(0);

  // ✅ focus dedicado para “PIN nuevo” cuando se completa el PIN actual
  const [newPinFocusKey, setNewPinFocusKey] = React.useState(0);
  const prevCurrentLenRef = React.useRef(0);

  const actionLabel = hasPin ? "Actualizar PIN" : "Crear PIN";
  const modalTitle = title || actionLabel;

  function resetAll() {
    setCurrentPinDraft("");
    setPinDraft("");
    setPinDraft2("");
    setPinFlowStep("NEW");
    setFocusKey((k) => k + 1);

    setNewPinFocusKey(0);
    prevCurrentLenRef.current = 0;
  }

  React.useEffect(() => {
    if (!open) return;
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setFocusKey((k) => k + 1);
  }, [pinFlowStep, open]);

  // ✅ cuando completo PIN actual, disparamos focus al bloque nuevo
  React.useEffect(() => {
    if (!open) return;
    if (!hasPin) return;
    if (pinFlowStep !== "NEW") return;

    const len = currentPinDraft.length;
    const prev = prevCurrentLenRef.current;

    if (prev < 4 && len === 4) {
      setNewPinFocusKey((k) => k + 1);
    }

    prevCurrentLenRef.current = len;
  }, [open, hasPin, pinFlowStep, currentPinDraft]);

  const pinMismatch =
    pinFlowStep === "CONFIRM" &&
    pinDraft.length === 4 &&
    pinDraft2.length === 4 &&
    pinDraft !== pinDraft2;

  const currentOk = !hasPin || currentPinDraft.length === 4;
  const showNewPinBlock = !hasPin || currentOk;

  const canContinue = !busy && pinDraft.length === 4 && currentOk;

  const canConfirm =
    !busy &&
    pinDraft.length === 4 &&
    pinDraft2.length === 4 &&
    pinDraft === pinDraft2 &&
    currentOk;

  // ✅ CTA guía (sin cambiar lógica)
  const primaryLabel =
    pinFlowStep === "NEW"
      ? hasPin && !currentOk
        ? "Ingresá tu PIN actual"
        : "Continuar"
      : actionLabel;

  async function doPrimaryAction() {
    if (busy) return;

    if (pinFlowStep === "NEW") {
      if (!canContinue) return;
      setPinFlowStep("CONFIRM");
      return;
    }

    if (!canConfirm) return;

    try {
      await onConfirm({
        pin: pinDraft,
        pin2: pinDraft2,
        ...(hasPin ? { currentPin: currentPinDraft } : {}),
      });
      onClose();
      resetAll();
    } catch {
      // lo maneja el padre (toast / msg)
    }
  }

  const stepLabel =
    pinFlowStep === "NEW" ? "Paso 1 de 2" : "Paso 2 de 2";

  return (
    <Modal
      open={open}
      title={modalTitle}
      onClose={() => {
        if (busy) return;
        onClose();
        resetAll();
      }}
      wide={false}
      overlayClassName={overlayClassName}
      className="max-w-[380px]"
    >
      <div
        className="w-full min-h-[280px] px-4"
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
            resetAll();
          }
        }}
      >
        <div className="flex min-h-[280px] items-center justify-center">
          <div className="w-full max-w-[320px] text-center">
            {/* ✅ progreso */}
            <div className="mb-2 text-[11px] text-muted">{stepLabel}</div>

            <div
              className="tp-card rounded-2xl px-4 py-5 space-y-4"
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in oklab, var(--card) 92%, var(--bg))",
              }}
            >
              {pinFlowStep === "NEW" ? (
                <>
                  {hasPin ? (
                    <div>
                      <div className="text-xs text-muted mb-2">
                        Ingresá tu PIN actual para continuar.
                      </div>
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

                  {/* ✅ Oculto hasta completar PIN actual */}
                  <div
                    className={cn(
                      "transition-all duration-200",
                      showNewPinBlock ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none h-0 overflow-hidden"
                    )}
                  >
                    <div className="text-xs text-muted mb-2">
                      Ahora ingresá el nuevo PIN.
                    </div>

                    <div className="flex justify-center">
                      <PinBoxes
                        value={pinDraft}
                        onChange={(v) => setPinDraft(v)}
                        disabled={busy}
                        autoFocus={showNewPinBlock}
                        focusKey={!hasPin ? focusKey : newPinFocusKey}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-muted mb-2">Confirmá el nuevo PIN.</div>
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

            {/* ✅ menos aire */}
            <div className="mt-6 flex justify-center gap-2">
              <button type="button" className="tp-btn-secondary" disabled={busy} onClick={resetAll}>
                Limpiar
              </button>

              <button
                type="button"
                className={cn("tp-btn-primary", busy && "opacity-60")}
                disabled={pinFlowStep === "NEW" ? !canContinue : !canConfirm}
                onClick={() => void doPrimaryAction()}
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
