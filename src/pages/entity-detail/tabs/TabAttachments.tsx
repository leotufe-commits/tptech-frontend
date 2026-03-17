import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { TPCard } from "../../../components/ui/TPCard";
import { TPButton } from "../../../components/ui/TPButton";
import { TPAttachmentList, type TPAttachmentItem } from "../../../components/ui/TPAttachmentList";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../../lib/toast";
import { commercialEntitiesApi, type EntityAttachment } from "../../../services/commercial-entities";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface Props {
  entityId: string;
  data: EntityAttachment[];
  loading: boolean;
  onReload: () => void;
}

export function TabAttachments({ entityId, data, loading, onReload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busyUpload, setBusyUpload] = useState(false);

  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityAttachment | null>(null);
  const [busyDelete, setBusyDelete]     = useState(false);

  const items: TPAttachmentItem[] = data.map((a) => ({
    id:       a.id,
    name:     a.filename,
    size:     a.size,
    url:      a.url || undefined,
    mimeType: a.mimeType,
  }));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBusyUpload(true);
    try {
      await commercialEntitiesApi.attachments.upload(entityId, file);
      toast.success("Adjunto subido.");
      onReload();
    } catch (err: any) {
      toast.error(err?.message || "Error al subir el archivo.");
    } finally {
      setBusyUpload(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyDelete(true);
    try {
      await commercialEntitiesApi.attachments.remove(entityId, deleteTarget.id);
      toast.success("Adjunto eliminado.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return <div className="py-12 text-center text-sm text-muted">Cargando adjuntos…</div>;
  }

  return (
    <TPCard className="p-4 space-y-3">

      {/* Título + botón Agregar */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Adjuntos</div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,.zip"
        />
        <TPButton
          variant="secondary"
          iconLeft={<Plus size={14} />}
          onClick={() => fileInputRef.current?.click()}
          disabled={busyUpload}
          className="h-8 text-xs"
        >
          {busyUpload ? "Subiendo…" : "Agregar"}
        </TPButton>
      </div>

      {/* Lista de adjuntos */}
      <TPAttachmentList
        items={items}
        loading={busyUpload}
        deletingId={busyDelete ? deleteTarget?.id : null}
        emptyText="Todavía no hay adjuntos."
        onView={(it) => it.url && window.open(it.url, "_blank", "noreferrer")}
        onDelete={(it) => {
          const att = data.find((a) => a.id === it.id);
          if (att) { setDeleteTarget(att); setDeleteOpen(true); }
        }}
      />

      {/* Confirmación de borrado */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Eliminar "${deleteTarget?.filename ?? ""}"`}
        description="¿Estás seguro? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        busy={busyDelete}
        onClose={() => { if (!busyDelete) { setDeleteOpen(false); setDeleteTarget(null); } }}
        onConfirm={handleDelete}
      />

    </TPCard>
  );
}
