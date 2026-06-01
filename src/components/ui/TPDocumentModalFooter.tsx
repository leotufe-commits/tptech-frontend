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
   * Icono opcional para el botón Cancelar/Cerrar (usar `<X size={14} />` o
   * similar). Si se omite, el botón se renderiza sin icono (default histórico).
   */
  cancelIcon?: React.ReactNode;
  /**
   * Label del botón secundario izquierdo (back-out del modal). Default
   * histórico: "Cancelar". Factura de ventas lo pisa con "Cerrar" para
   * comunicar mejor el affordance de cierre (el handler es el mismo
   * `onCancel`/`onClose` actual — no se introduce lógica nueva).
   */
  cancelLabel?: string;
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
  /**
   * Etapa D — Oculta el `summary` de totales y deja el footer reducido a
   * acciones (Cancelar / Guardar borrador / Crear/Guardar).
   *
   * Sirve para pantallas que ya muestran un card maestro de resumen en el
   * aside (ej. Factura de ventas con `<TotalDelComprobanteCard />`): el
   * resumen inline del footer pasa a ser redundante.
   *
   * Default `false` → comportamiento histórico preservado para
   * Presupuestos, Órdenes, Compras y demás pantallas hermanas que todavía
   * no migraron al card maestro.
   *
   * Cuando `true`, el `summary` se ignora aunque venga poblado — esto
   * permite al parent dejar la prop `summary` cableada y solo togglear
   * la visibilidad con un único flag (sin tener que armar dos JSX).
   */
  hideDetailedTotals?: boolean;
  /**
   * Etapa 5 — Modo solo-lectura del documento. Cuando `true`:
   *   · El botón "Guardar borrador" se OCULTA (no hay nada que guardar).
   *   · El botón primario "Crear / Guardar cambios" se OCULTA.
   * El botón Cancelar/Cerrar y `extraActions` (Imprimir, Descargar, Enviar)
   * siguen activos para que el operador pueda imprimir, enviar y cerrar. */
  readOnly?: boolean;
};

export function TPDocumentModalFooter({
  summary,
  isNew,
  onCancel,
  onSave,
  saveLabelCreate = "Crear",
  saveLabelEdit = "Guardar cambios",
  cancelIcon,
  cancelLabel = "Cancelar",
  onSaveDraft,
  draftSaving = false,
  saveDraftLabel = "Guardar borrador",
  extraActions,
  hideDetailedTotals = false,
  readOnly = false,
}: TPDocumentModalFooterProps) {
  // Etapa 5 — en readOnly ocultamos las CTAs de mutación (draft + primario).
  // Mantenemos Cancelar/Cerrar y extraActions activos para imprimir, enviar
  // y cerrar.
  const draftBtn = (!readOnly && onSaveDraft) ? (
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
  const primaryBtn = readOnly ? null : (
    <TPButton variant="primary" onClick={onSave} iconLeft={<Save size={14} />}>
      {isNew ? saveLabelCreate : saveLabelEdit}
    </TPButton>
  );

  // Etapa D — Cuando el caller indica que ya hay un card maestro mostrando
  // los totales (`hideDetailedTotals=true`), suprimimos el `summary` y
  // dejamos el footer reducido a acciones — mismo layout que cuando el
  // caller no pasó `summary` en absoluto.
  const showSummary = !hideDetailedTotals && summary !== undefined;

  if (!showSummary) {
    return (
      <div
        className="flex items-center justify-end gap-2"
        data-testid="document-modal-footer"
        data-summary-visible="false"
      >
        {extraActions}
        <TPButton variant="secondary" onClick={onCancel} iconLeft={cancelIcon}>{cancelLabel}</TPButton>
        {draftBtn}
        {primaryBtn}
      </div>
    );
  }

  return (
    <div
      className="flex w-full items-center gap-2"
      data-testid="document-modal-footer"
      data-summary-visible="true"
    >
      {summary}
      <div className="flex-1" />
      {extraActions}
      <TPButton variant="secondary" onClick={onCancel} iconLeft={cancelIcon}>Cancelar</TPButton>
      {draftBtn}
      {primaryBtn}
    </div>
  );
}

export default TPDocumentModalFooter;
