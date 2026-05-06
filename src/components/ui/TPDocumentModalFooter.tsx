// src/components/ui/TPDocumentModalFooter.tsx
// ============================================================================
// TPDocumentModalFooter — footer estándar para modales de documentos.
//
// Extracción del bloque duplicado en los `footer={...}` de los modales de
// documentos. Estandariza dos layouts:
//
//   · Con `summary`: "flex w-full items-center gap-2"
//       [ summary ]  [ flex-1 ]  [ Cancelar ] [ Guardar ]
//     (lo usan VentasPresupuestos, VentasOrdenes, VentasFacturas, y todos
//      los modales con resumen inline de totales)
//
//   · Sin `summary`: "flex items-center justify-end gap-2"
//       [ Cancelar ] [ Guardar ]
//     (lo usa ComprasFacturasProveedor, que no muestra resumen abajo)
//
// El wrapper externo queda en el parent (`<Modal footer={<TPDocumentModalFooter
// ... />}>`). El componente no asume nada sobre el contenido del `summary` —
// lo renderiza tal cual.
// ============================================================================

import React from "react";
import { Save, FileText } from "lucide-react";

import { TPButton } from "./TPButton";

export type TPDocumentModalFooterProps = {
  /**
   * Contenido opcional que va a la izquierda del footer. Típicamente un
   * resumen inline tipo "Subtotal · Impuestos · Total". Si se omite, los
   * botones se alinean a la derecha sin spacer.
   */
  summary?: React.ReactNode;
  /** Determina el label del botón primario (Crear vs Guardar cambios). */
  isNew: boolean;
  onCancel: () => void;
  onSave: () => void;
  /** Label del botón primario cuando `isNew=true`. Default: "Crear". */
  saveLabelCreate?: string;
  /** Label del botón primario cuando `isNew=false`. Default: "Guardar cambios". */
  saveLabelEdit?: string;
  /**
   * Icono opcional para el botón Cancelar (usar `<X size={14} />` o similar).
   * Si se omite, el botón Cancelar se renderiza sin icono (default histórico).
   */
  cancelIcon?: React.ReactNode;
  /**
   * Si se pasa, muestra un botón "Guardar borrador" entre Cancelar y el
   * botón primario. Pensado para comprobantes que aceptan persistencia
   * pre-emisión.
   */
  onSaveDraft?: () => void;
  /** Loading del botón de guardar borrador. */
  draftSaving?: boolean;
  /** Label override para el botón de borrador. Default: "Guardar borrador". */
  saveDraftLabel?: string;
  /**
   * Acciones extra (imprimir documento, etiquetas, enviar email, etc.).
   * Se renderizan a la izquierda del Cancelar. El parent decide qué
   * botones poner.
   */
  extraActions?: React.ReactNode;
};

export function TPDocumentModalFooter({
  summary,
  isNew,
  onCancel,
  onSave,
  saveLabelCreate = "Crear",
  saveLabelEdit = "Guardar cambios",
  cancelIcon,
  onSaveDraft,
  draftSaving = false,
  saveDraftLabel = "Guardar borrador",
  extraActions,
}: TPDocumentModalFooterProps) {
  const draftBtn = onSaveDraft ? (
    <TPButton
      variant="secondary"
      onClick={onSaveDraft}
      loading={draftSaving}
      disabled={draftSaving}
      iconLeft={<FileText size={14} />}
    >
      {saveDraftLabel}
    </TPButton>
  ) : null;

  if (summary === undefined) {
    return (
      <div className="flex items-center justify-end gap-2">
        {extraActions}
        <TPButton variant="secondary" onClick={onCancel} iconLeft={cancelIcon}>Cancelar</TPButton>
        {draftBtn}
        <TPButton variant="primary" onClick={onSave} iconLeft={<Save size={14} />}>
          {isNew ? saveLabelCreate : saveLabelEdit}
        </TPButton>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-2">
      {summary}
      <div className="flex-1" />
      {extraActions}
      <TPButton variant="secondary" onClick={onCancel} iconLeft={cancelIcon}>Cancelar</TPButton>
      {draftBtn}
      <TPButton variant="primary" onClick={onSave} iconLeft={<Save size={14} />}>
        {isNew ? saveLabelCreate : saveLabelEdit}
      </TPButton>
    </div>
  );
}

export default TPDocumentModalFooter;
