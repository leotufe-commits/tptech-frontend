// src/components/ui/ConfirmDeleteDialog.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Props = {
  open: boolean;
  title?: string;

  // ✅ soporta ambos nombres
  message?: string; // alias de description
  description?: string;

  confirmText?: string; // default: "Eliminar"
  cancelText?: string; // default: "Cancelar"

  requireTypeToConfirm?: boolean;
  typeToConfirmText?: string; // default: "ELIMINAR"
  dangerHint?: string;

  // ✅ soporta busy o loading
  busy?: boolean;
  loading?: boolean;

  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteDialog({
  open,
  title = "Eliminar",
  message,
  description,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  requireTypeToConfirm = false,
  typeToConfirmText = "ELIMINAR",
  dangerHint,
  busy,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const isBusy = !!(busy ?? loading);

  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const expected = useMemo(() => String(typeToConfirmText || "ELIMINAR").trim().toUpperCase(), [typeToConfirmText]);

  const canConfirm = useMemo(() => {
    if (!requireTypeToConfirm) return true;
    return typed.trim().toUpperCase() === expected;
  }, [requireTypeToConfirm, typed, expected]);

  if (!open) return null;

  const desc = description ?? message ?? "Esta acción no se puede deshacer.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={isBusy ? undefined : onClose} />

      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-border p-2">
            <Trash2 className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{desc}</div>

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
              Escribí <span className="font-semibold">{expected}</span> para confirmar
            </label>

            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (isBusy) return;
                if (!canConfirm) return;
                onConfirm(); // ✅ ENTER = click eliminar
              }}
              disabled={isBusy}
              autoFocus
              className={cn(
                "mt-2 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none",
                "focus:ring-2 focus:ring-primary/30"
              )}
              placeholder={expected}
            />
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isBusy}
            className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
            onClick={onClose}
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={isBusy || !canConfirm}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white",
              "bg-primary hover:opacity-90 disabled:opacity-50"
            )}
            onClick={onConfirm}
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}