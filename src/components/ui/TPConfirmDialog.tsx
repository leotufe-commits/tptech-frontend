// tptech-frontend/src/components/ui/TPConfirmDialog.tsx
//
// Modal de confirmacion reutilizable alineado al design system de TPTech.
//
// Reemplaza el feo `window.confirm()` nativo del browser ("localhost dice...")
// por una superficie consistente: mismo border radius, overlay, spacing y
// botones que el resto del sistema (usa `Modal` debajo, que ya gestiona
// focus trap + ESC + backdrop).
//
// Patrones de uso:
//
//   (A) Imperativo via hook (recomendado para reemplazar window.confirm):
//
//       const { confirm, dialog } = useConfirmDialog();
//       // ...
//       const ok = await confirm({
//         title: "Aplicar plantilla",
//         description: "Tu layout tiene personalizaciones...",
//         confirmLabel: "Aplicar plantilla",
//       });
//       if (!ok) return;
//       // ...
//       return <>...{dialog}</>;
//
//   (B) Declarativo (controlado):
//
//       <TPConfirmDialog
//         open={open}
//         title="..."
//         description="..."
//         onConfirm={() => { ... }}
//         onCancel={() => setOpen(false)}
//       />

import React, { useCallback, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { TPButton } from "./TPButton";

export type TPConfirmTone = "default" | "warning" | "danger";

export type TPConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: TPConfirmTone;
  icon?: React.ReactNode;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function TPConfirmDialog(props: TPConfirmDialogProps): React.ReactElement {
  const {
    open,
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    tone = "default",
    icon,
    busy = false,
    onConfirm,
    onCancel,
  } = props;

  const confirmVariant =
    tone === "danger" ? "primary"
    : tone === "warning" ? "primary"
    : "primary";

  const iconColorClass =
    tone === "danger" ? "text-red-600 dark:text-red-400"
    : tone === "warning" ? "text-amber-600 dark:text-amber-400"
    : "text-primary";

  const defaultIcon = tone === "default"
    ? null
    : <AlertTriangle size={20} className={iconColorClass} aria-hidden />;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      hideHeaderClose
      // ENTER en el body confirma (atajo estandar de los confirm).
      onEnter={busy ? undefined : onConfirm}
      footer={
        <>
          <TPButton
            variant="ghost"
            onClick={onCancel}
            disabled={busy}
            className="h-9 text-sm"
          >
            {cancelLabel}
          </TPButton>
          <TPButton
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className="h-9 text-sm"
          >
            {confirmLabel}
          </TPButton>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {icon !== undefined ? icon : defaultIcon}
        <div className="min-w-0 flex-1 text-sm text-text">
          {description}
        </div>
      </div>
    </Modal>
  );
}

// ─── Hook imperativo ────────────────────────────────────────────────────────

type ConfirmOptions = Omit<TPConfirmDialogProps, "open" | "onConfirm" | "onCancel">;

type ConfirmState =
  | { open: false }
  | { open: true; options: ConfirmOptions; resolve: (ok: boolean) => void };

/**
 * Hook imperativo para reemplazar `window.confirm()`. Devuelve:
 *   - `confirm(opts)`: Promise<boolean>. Resuelve true si el operador
 *     confirmo, false si cancelo (incluye ESC y backdrop click).
 *   - `dialog`: ReactElement a renderizar en el JSX (el modal mismo).
 */
export function useConfirmDialog(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dialog: React.ReactElement;
} {
  const [state, setState] = useState<ConfirmState>({ open: false });
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, options: opts, resolve });
    });
  }, []);

  const handleClose = useCallback((ok: boolean) => {
    const r = resolveRef.current;
    resolveRef.current = null;
    setState({ open: false });
    if (r) r(ok);
  }, []);

  const dialog = state.open ? (
    <TPConfirmDialog
      {...state.options}
      open
      onConfirm={() => handleClose(true)}
      onCancel={() => handleClose(false)}
    />
  ) : (
    // Renderizar el componente con open=false para mantener montaje
    // estable (sin layout jumps al pasar de cerrado a abierto).
    <TPConfirmDialog
      open={false}
      title=""
      onConfirm={() => handleClose(true)}
      onCancel={() => handleClose(false)}
    />
  );

  return { confirm, dialog };
}
