// tptech-frontend/src/components/users/edit/partials/DeletePinConfirmModal.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "../../users.ui";

// 🔒 Import defensivo (evita errores de named exports en Vite)
import * as pinHelpers from "../helpers/sectionConfig.helpers";

const only4Digits =
  typeof (pinHelpers as any).only4Digits === "function"
    ? (pinHelpers as any).only4Digits
    : (v: string) => String(v || "").replace(/\D/g, "").slice(0, 4);

function isPin4(v: string) {
  if (typeof (pinHelpers as any).isPin4 === "function") {
    return (pinHelpers as any).isPin4(v);
  }
  return /^\d{4}$/.test(String(v || "").trim());
}

type Props = {
  open: boolean;
  busy: boolean;
  current: string; // guardamos "1234"
  setCurrent: (v: string) => void;
  err: string | null;
  setErr: (v: string | null) => void;

  onClose: () => void;
  onConfirm: (currentPin: string) => void;
};

export default function DeletePinConfirmModal(props: Props) {
  const { open, busy, current, setCurrent, err, setErr, onClose, onConfirm } = props;

  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const d = only4Digits(current);
    return [d[0] || "", d[1] || "", d[2] || "", d[3] || ""];
  }, [current]);

  const pinStr = digits.join("");
  const canSubmit = !busy && isPin4(only4Digits(pinStr));

  function focusAt(i: number) {
    const el = refs.current[i];
    if (!el) return;
    el.focus();
    try {
      el.select();
    } catch {
      // no-op
    }
  }

  function setDigitAt(i: number, ch: string) {
    const next = [...digits];
    next[i] = ch;
    setCurrent(next.join(""));
  }

  function fillAllFrom(startIndex: number, raw: string) {
    const clean = only4Digits(raw);
    if (!clean) return;

    const next = [...digits];
    let p = 0;

    for (let i = startIndex; i < 4 && p < clean.length; i++) {
      next[i] = clean[p++];
    }

    setCurrent(next.join(""));

    const filledCount = next.filter(Boolean).length;
    const lastFilled = Math.min(3, Math.max(0, filledCount - 1));
    const nextFocus = filledCount >= 4 ? 3 : lastFilled + 1;
    setTimeout(() => focusAt(Math.min(3, nextFocus)), 0);
  }

  function clearAll() {
    setCurrent("");
    setErr(null);
    setTimeout(() => focusAt(0), 0);
  }

  function closeAndReset() {
    if (busy) return;
    setErr(null);
    setCurrent("");
    onClose();
  }

  function confirm() {
    const clean = only4Digits(pinStr);
    if (!isPin4(clean)) {
      setErr("Ingresá un PIN válido de 4 dígitos.");
      focusAt(0);
      return;
    }
    onConfirm(clean);
  }

  // ✅ foco automático al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => focusAt(0), 0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (busy) return;
          closeAndReset();
        }}
      />

      {/* modal shell (similar al print 2) */}
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-soft">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-base font-semibold text-text">Eliminar PIN</div>
          <button
            type="button"
            className="text-sm text-muted hover:text-text"
            disabled={busy}
            onClick={closeAndReset}
          >
            Cerrar
          </button>
        </div>

        {/* body */}
        <div className="px-5 py-5">
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="w-full max-w-[320px] text-center">
              <div
                className="tp-card rounded-2xl px-4 py-5 space-y-4"
                style={{
                  border: "1px solid var(--border)",
                  background: "color-mix(in oklab, var(--card) 92%, var(--bg))",
                }}
              >
                <div className="text-xs text-muted">
                  Se desactiva la <b>clave rápida</b> para este usuario.
                </div>

                <div className="text-xs text-muted">
                  Para eliminar tu PIN, ingresá tu <b>PIN actual</b>.
                </div>

                {/* ✅ 4 campos */}
                <div className="flex justify-center">
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          refs.current[i] = el;
                        }}
                        className={cn(
                          "tp-input",
                          "!mt-0",
                          "!w-[40px]",
                          "shrink-0",
                          "h-[42px]",
                          "rounded-md",
                          "px-0 text-center text-lg",
                          "tracking-[0.25em]",
                          "focus:ring-2 focus:ring-[color:var(--primary)]",
                          busy && "opacity-70"
                        )}
                        type="password"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        // visual como print 2 (puntos)
                        value={digits[i] ? "•" : ""}
                        disabled={busy}
                        onFocus={() => setErr(null)}
                        onChange={(e) => {
                          if (busy) return;
                          setErr(null);

                          const raw = e.target.value;

                          // pegado "1234"
                          if (raw.length > 1) {
                            fillAllFrom(i, raw);
                            return;
                          }

                          const ch = String(raw || "").replace(/\D/g, "").slice(0, 1);
                          setDigitAt(i, ch);

                          if (ch && i < 3) setTimeout(() => focusAt(i + 1), 0);
                        }}
                        onKeyDown={(e) => {
                          if (busy) return;

                          if (e.key === "Backspace") {
                            e.preventDefault();
                            setErr(null);

                            if (digits[i]) {
                              setDigitAt(i, "");
                              return;
                            }
                            if (i > 0) {
                              setDigitAt(i - 1, "");
                              setTimeout(() => focusAt(i - 1), 0);
                            }
                            return;
                          }

                          if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            if (i > 0) focusAt(i - 1);
                            return;
                          }

                          if (e.key === "ArrowRight") {
                            e.preventDefault();
                            if (i < 3) focusAt(i + 1);
                            return;
                          }

                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (canSubmit) confirm();
                            else {
                              const firstEmpty = digits.findIndex((d) => !d);
                              focusAt(firstEmpty >= 0 ? firstEmpty : 0);
                            }
                            return;
                          }

                          if (e.key === "Escape") {
                            e.preventDefault();
                            if (!busy) closeAndReset();
                          }
                        }}
                        onPaste={(e) => {
                          if (busy) return;
                          e.preventDefault();
                          setErr(null);
                          const text = e.clipboardData?.getData("text") || "";
                          fillAllFrom(i, text);
                        }}
                      />
                    ))}
                  </div>
                </div>

                {err ? <div className="text-xs text-red-400">{err}</div> : null}
                <div className="text-[11px] text-muted">Debe tener 4 dígitos.</div>
              </div>

              {/* buttons (centrados como print 2) */}
              <div className="mt-10 flex justify-center gap-2">
                <button type="button" className="tp-btn-secondary" disabled={busy} onClick={clearAll}>
                  Limpiar
                </button>

                <button
                  type="button"
                  className={cn(
                    "tp-btn-primary",
                    "bg-red-600 hover:bg-red-700 border-red-600",
                    (!canSubmit || busy) && "opacity-60"
                  )}
                  disabled={!canSubmit}
                  onClick={confirm}
                >
                  Eliminar PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
