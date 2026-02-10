// tptech-frontend/src/components/users/edit/partials/DeletePinConfirmModal.tsx
import React from "react";
import { X } from "lucide-react";
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
  current: string;
  setCurrent: (v: string) => void;
  err: string | null;
  setErr: (v: string | null) => void;

  onClose: () => void;
  onConfirm: (currentPin: string) => void;
};

export default function DeletePinConfirmModal(props: Props) {
  const { open, busy, current, setCurrent, err, setErr, onClose, onConfirm } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (busy) return;
          onClose();
        }}
      />

      {/* modal */}
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-surface2 text-primary">
            <X className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="text-base font-semibold text-text">Eliminar PIN</div>
            <div className="mt-1 text-sm text-muted">
              Para eliminar tu PIN, ingresá tu <b>PIN actual</b>.
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-muted mb-1">PIN actual</label>

          <input
            className="tp-input w-full"
            type="password"
            inputMode="numeric"
            placeholder="••••"
            value={current}
            onChange={(e) => {
              setCurrent(only4Digits(e.target.value));
              setErr(null);
            }}
            disabled={busy}
          />

          {err ? <div className="mt-2 text-xs text-red-400">{err}</div> : null}
          <div className="mt-2 text-[11px] text-muted">Debe tener 4 dígitos.</div>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-transparent px-4 py-2 text-sm font-semibold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!isPin4(current)) {
                setErr("Ingresá un PIN válido de 4 dígitos.");
                return;
              }
              onConfirm(current);
            }}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white",
              "bg-primary hover:opacity-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
              busy && "opacity-60 cursor-not-allowed"
            )}
          >
            Confirmar eliminación
          </button>
        </div>
      </div>
    </div>
  );
}
