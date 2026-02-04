// src/components/ui/ConfirmActionDialog.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, CircleHelp, AlertTriangle } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Tone = "primary" | "danger";

type Props = {
  open: boolean;

  title: string;
  description?: string;
  hint?: string;

  confirmText?: string; // default: "Confirmar"
  cancelText?: string; // default: "Cancelar"

  tone?: Tone; // default: "primary"
  icon?: "help" | "warning"; // default: "help"

  requireTypeToConfirm?: boolean;
  typeToConfirmText?: string; // default: "CONFIRMAR"

  loading?: boolean;

  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmActionDialog({
  open,
  title,
  description,
  hint,

  confirmText = "Confirmar",
  cancelText = "Cancelar",

  tone = "primary",
  icon = "help",

  requireTypeToConfirm = false,
  typeToConfirmText = "CONFIRMAR",

  loading = false,
  onClose,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [typed, setTyped] = useState("");

  // reset cuando abre/cierra
  useEffect(() => {
    if (!open) {
      setTyped("");
    } else {
      setTyped("");
    }
  }, [open]);

  const normalizedTarget = useMemo(() => String(typeToConfirmText || "CONFIRMAR").trim().toUpperCase(), [typeToConfirmText]);
  const normalizedTyped = useMemo(() => String(typed || "").trim().toUpperCase(), [typed]);

  const canConfirm = useMemo(() => {
    if (!requireTypeToConfirm) return true;
    return normalizedTyped === normalizedTarget;
  }, [requireTypeToConfirm, normalizedTyped, normalizedTarget]);

  // focus management + lock scroll
  useEffect(() => {
    if (!open) return;

    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    // focus al input si existe, sino al contenedor
    const t = window.setTimeout(() => {
      if (requireTypeToConfirm) inputRef.current?.focus();
      else dialogRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [open, requireTypeToConfirm]);

  // Escape / Enter
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (loading) return;
        onClose();
        return;
      }

      if (e.key === "Enter") {
        // Si está escribiendo en input, Enter confirma
        // Si no hay input, también confirma.
        if (loading) return;

        // si requireTypeToConfirm, solo confirma si coincide
        if (!canConfirm) return;

        e.preventDefault();
        onConfirm();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, canConfirm, onClose, onConfirm]);

  if (!open) return null;

  const Icon = icon === "warning" ? AlertTriangle : CircleHelp;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" aria-hidden={!open}>
      <div
        className="absolute inset-0 bg-black/40"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl outline-none"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-border p-2">
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{title}</div>

            {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}

            {hint ? (
              <div className="mt-2 rounded-xl border border-border bg-black/5 p-3 text-sm">
                {hint}
              </div>
            ) : null}
          </div>
        </div>

        {requireTypeToConfirm ? (
          <div className="mt-4">
            <label className="block text-sm font-medium">
              Escribí <span className="font-semibold">{typeToConfirmText}</span> para confirmar
            </label>

            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={loading}
              className={cn(
                "mt-2 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none",
                "focus:ring-2 focus:ring-primary/30"
              )}
              placeholder={typeToConfirmText}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
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
            disabled={loading || !canConfirm}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white",
              tone === "danger" ? "bg-red-600 hover:opacity-90" : "bg-primary hover:opacity-90",
              "disabled:opacity-50"
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
