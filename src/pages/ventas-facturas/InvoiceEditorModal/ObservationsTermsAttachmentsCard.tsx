// src/pages/ventas-facturas/InvoiceEditorModal/ObservationsTermsAttachmentsCard.tsx
// ============================================================================
// Cuerpo del card "Observaciones, términos y adjuntos" del modal de Factura.
//
// FASE 3+4 — descomposición del bloque inline de VentasFacturas.tsx en un
// sub-componente con tabs internas. El `<TPCollapse>` externo lo mantiene el
// padre; este componente sólo renderiza la grilla de pestañas + paneles.
//
// Reglas de dominio respetadas:
//   · Observaciones / Términos = texto propio del comprobante (passthrough
//     puro vía onChange — el componente NO calcula ni recalcula nada).
//   · Términos: la fuente de verdad de la precarga es
//     DocumentTemplate.footerTerms (lo resuelve el padre y se inyecta como
//     `templateTerms`). Badge "Plantilla activa" / "Editado" es comparación
//     de strings, sin lógica comercial.
//   · "Guardar como predeterminado" sólo se ofrece si el padre habilita
//     `canSaveAsDefault` (permiso COMPANY_SETTINGS:EDIT) y siempre con
//     confirmación explícita.
//   · Adjuntos: CRUD vía receiptsApi (mismo patrón que sellers/entities).
//     Habilitado sólo cuando ya existe un Receipt persistido (`receiptId`).
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileText, ScrollText, RotateCcw, Save, Lock } from "lucide-react";

import { TPTabs } from "../../../components/ui/TPTabs";
import TPTextarea from "../../../components/ui/TPTextarea";
import TPAttachmentManager from "../../../components/ui/TPAttachmentManager";
import type { TPAttachmentItem } from "../../../components/ui/TPAttachmentList";
import { TPButton } from "../../../components/ui/TPButton";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { cn } from "../../../components/ui/tp";
import { toast } from "../../../lib/toast";
import { receiptsApi, type ReceiptAttachment } from "../../../services/receipts";

export type ObservationsTermsAttachmentsCardProps = {
  /** Texto manual del comprobante. Passthrough puro. */
  notes: string;
  onNotesChange: (v: string) => void;

  /** Términos del comprobante. Passthrough puro. */
  terms: string;
  onTermsChange: (v: string) => void;

  /** footerTerms de la plantilla FACTURA (fuente de verdad). "" si no hay. */
  templateTerms: string;

  /** true si el usuario tiene COMPANY_SETTINGS:EDIT. */
  canSaveAsDefault: boolean;
  /**
   * Persiste `terms` como footerTerms de la plantilla FACTURA.
   * El padre hace el PATCH + toast + refresca `templateTerms`.
   */
  onSaveAsDefault: () => Promise<void>;

  /** Id del Receipt persistido. null → todavía no se guardó el borrador. */
  receiptId: string | null;
  /**
   * Garantiza un Receipt persistido y devuelve su id (auto-guarda el
   * borrador con el flujo existente si hace falta). Idempotente: no
   * duplica si ya existe. Devuelve `null` si no se pudo (el padre toastea).
   */
  onEnsureReceiptId: () => Promise<string | null>;
};

type TabValue = "notes" | "terms" | "attachments";

function toItem(a: ReceiptAttachment): TPAttachmentItem {
  return { id: a.id, name: a.filename, size: a.size, url: a.url, mimeType: a.mimeType };
}

/** Mensaje legible de un error desconocido (sin `any`). */
function errMsg(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export function ObservationsTermsAttachmentsCard(
  props: ObservationsTermsAttachmentsCardProps,
): React.ReactElement {
  const {
    notes, onNotesChange,
    terms, onTermsChange,
    templateTerms,
    canSaveAsDefault, onSaveAsDefault,
    receiptId, onEnsureReceiptId,
  } = props;

  const [tab, setTab] = useState<TabValue>("notes");

  // ── Términos: estado de plantilla (comparación de strings, sin lógica) ────
  const tpl = (templateTerms ?? "").trim();
  const cur = (terms ?? "").trim();
  const hasTemplate = tpl.length > 0;
  const matchesTemplate = hasTemplate && cur === tpl;
  const isEdited = hasTemplate && cur !== tpl;

  const [confirmDefaultOpen, setConfirmDefaultOpen] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);

  async function handleConfirmSaveDefault() {
    if (savingDefault) return;
    setSavingDefault(true);
    try {
      await onSaveAsDefault();
      setConfirmDefaultOpen(false);
    } finally {
      setSavingDefault(false);
    }
  }

  // ── Adjuntos ──────────────────────────────────────────────────────────────
  const [items, setItems] = useState<TPAttachmentItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Auto-guardado del borrador en curso (disparado al adjuntar sin Receipt).
  const [ensuringDraft, setEnsuringDraft] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const loadedForRef = useRef<string | null>(null);

  const reloadAttachments = useCallback(async (id: string) => {
    setListLoading(true);
    try {
      const rows = await receiptsApi.listAttachments(id);
      setItems(rows.map(toItem));
      loadedForRef.current = id;
    } catch (e: unknown) {
      toast.error(errMsg(e, "No se pudieron cargar los adjuntos."));
    } finally {
      setListLoading(false);
    }
  }, []);

  // Carga perezosa: sólo cuando la pestaña Adjuntos está activa y hay Receipt.
  useEffect(() => {
    if (tab !== "attachments") return;
    if (!receiptId) return;
    if (loadedForRef.current === receiptId) return;
    void reloadAttachments(receiptId);
  }, [tab, receiptId, reloadAttachments]);

  // Si cambia el Receipt (nuevo borrador), descartar lista cargada.
  useEffect(() => {
    if (loadedForRef.current && loadedForRef.current !== receiptId) {
      loadedForRef.current = null;
      setItems([]);
    }
  }, [receiptId]);

  async function handleUpload(files: File[]) {
    if (files.length === 0 || uploading || ensuringDraft) return;

    // Si todavía no hay Receipt persistido, auto-guardar el borrador con
    // el flujo existente y continuar con la subida. Idempotente: si ya
    // existe, `onEnsureReceiptId` devuelve el id sin re-crear (no duplica).
    let id = receiptId;
    if (!id) {
      setEnsuringDraft(true);
      try {
        id = await onEnsureReceiptId();
      } finally {
        setEnsuringDraft(false);
      }
      if (!id) return; // el padre ya mostró el toast del error
    }

    setUploading(true);
    try {
      for (const f of files) {
        await receiptsApi.addAttachment(id, f);
      }
      await reloadAttachments(id);
      toast.success(files.length === 1 ? "Adjunto subido." : `${files.length} adjuntos subidos.`);
    } catch (e: unknown) {
      toast.error(errMsg(e, "No se pudo subir el adjunto."));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: TPAttachmentItem) {
    if (!receiptId || deletingId) return;
    setDeletingId(item.id);
    try {
      await receiptsApi.deleteAttachment(receiptId, item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      toast.success("Adjunto eliminado.");
    } catch (e: unknown) {
      toast.error(errMsg(e, "No se pudo eliminar el adjunto."));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const tabOptions = [
    { value: "notes",       label: "Observaciones" },
    { value: "terms",       label: "Términos" },
    { value: "attachments", label: "Adjuntos" },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <TPTabs
          options={tabOptions}
          value={tab}
          onChange={(v) => setTab(v as TabValue)}
          size="sm"
        />

        {tab === "terms" && hasTemplate && (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              matchesTemplate
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                : "border-amber-500/40 bg-amber-500/10 text-amber-600",
            )}
          >
            {matchesTemplate ? "Plantilla activa" : "Editado"}
          </span>
        )}
      </div>

      {/* ── Observaciones ─────────────────────────────────────────────────── */}
      {tab === "notes" && (
        <div className="flex items-start gap-2">
          <FileText size={14} className="mt-3 shrink-0 text-muted" />
          <TPTextarea
            value={notes}
            onChange={onNotesChange}
            minH={96}
            placeholder="Notas internas o para el cliente — propias de este comprobante."
            wrapClassName="flex-1"
          />
        </div>
      )}

      {/* ── Términos y condiciones ────────────────────────────────────────── */}
      {tab === "terms" && (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <ScrollText size={14} className="mt-3 shrink-0 text-muted" />
            <TPTextarea
              value={terms}
              onChange={onTermsChange}
              minH={96}
              placeholder="Condiciones comerciales, políticas de devolución, garantía, etc."
              wrapClassName="flex-1"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isEdited && (
              <TPButton
                variant="secondary"
                iconLeft={<RotateCcw size={13} />}
                onClick={() => onTermsChange(templateTerms)}
                className="h-8 text-xs"
              >
                Restaurar plantilla
              </TPButton>
            )}

            {canSaveAsDefault ? (
              <TPButton
                variant="secondary"
                iconLeft={<Save size={13} />}
                onClick={() => setConfirmDefaultOpen(true)}
                disabled={cur.length === 0 || matchesTemplate}
                className="h-8 text-xs"
              >
                Guardar como predeterminado
              </TPButton>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <Lock size={11} />
                Guardar plantilla requiere permiso de Configuración
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Adjuntos ──────────────────────────────────────────────────────── */}
      {tab === "attachments" && (
        <TPAttachmentManager
          items={items}
          onUpload={handleUpload}
          onDelete={receiptId ? handleDelete : undefined}
          deletingId={deletingId}
          loading={listLoading || uploading || ensuringDraft}
          disabled={uploading || ensuringDraft}
          emptyText={
            ensuringDraft
              ? "Guardando borrador…"
              : listLoading
                ? "Cargando adjuntos…"
                : receiptId
                  ? "Todavía no hay adjuntos."
                  : "Arrastrá archivos o hacé click para adjuntar. Si la factura aún no fue guardada, se guardará automáticamente como borrador."
          }
        />
      )}

      <ConfirmDeleteDialog
        open={confirmDefaultOpen}
        title="Guardar términos como predeterminados"
        description={
          "Vas a reemplazar los Términos y condiciones de la plantilla de " +
          "Factura de toda la joyería. Afecta los próximos comprobantes nuevos " +
          "y la impresión/PDF. ¿Confirmás?"
        }
        confirmText="Guardar plantilla"
        cancelText="Cancelar"
        icon={<Save className="h-5 w-5 text-amber-500" />}
        busy={savingDefault}
        onClose={() => { if (!savingDefault) setConfirmDefaultOpen(false); }}
        onConfirm={handleConfirmSaveDefault}
      />
    </div>
  );
}

export default ObservationsTermsAttachmentsCard;
