// src/components/ui/ConfirmDeleteDialog.tsx
import { Loader2, Trash2 } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string; // default: "Eliminar"
  cancelText?: string; // default: "Cancelar"
  requireTypeToConfirm?: boolean;
  typeToConfirmText?: string; // default: "ELIMINAR"
  dangerHint?: string; // texto adicional opcional
  loading?: boolean;

  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteDialog({
  open,
  title = "Eliminar",
  description = "Esta acción no se puede deshacer.",
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  requireTypeToConfirm = false,
  typeToConfirmText = "ELIMINAR",
  dangerHint,
  loading = false,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  // input controlado vía DOM (simple y portable)
  const inputId = "tptech-delete-confirm-input";

  const canConfirm = () => {
    if (!requireTypeToConfirm) return true;
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    const v = (el?.value || "").trim().toUpperCase();
    return v === typeToConfirmText.toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={loading ? undefined : onClose}
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-border p-2">
            <Trash2 className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {description}
            </div>

            {dangerHint ? (
              <div className="mt-2 rounded-xl border border-border bg-black/5 p-3 text-sm">
                {dangerHint}
              </div>
            ) : null}
          </div>
        </div>

        {requireTypeToConfirm ? (
          <div className="mt-4">
            <label className="block text-sm font-medium">
              Escribí{" "}
              <span className="font-semibold">{typeToConfirmText}</span> para
              confirmar
            </label>
            <input
              id={inputId}
              disabled={loading}
              autoFocus
              className={cn(
                "mt-2 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none",
                "focus:ring-2 focus:ring-primary/30"
              )}
              placeholder={typeToConfirmText}
            />
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
            onClick={onClose}
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={loading || !canConfirm()}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white",
              "bg-primary hover:opacity-90 disabled:opacity-50"
            )}
            onClick={onConfirm}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
