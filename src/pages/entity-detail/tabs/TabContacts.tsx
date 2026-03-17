import React, { useState } from "react";
import { Plus, Pencil, Trash2, Star, Mail, Phone, MessageCircle } from "lucide-react";
import { TPButton } from "../../../components/ui/TPButton";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPTextarea from "../../../components/ui/TPTextarea";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import { TPBadge } from "../../../components/ui/TPBadges";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import { Modal } from "../../../components/ui/Modal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  type EntityContact,
  type EntityContactPayload,
} from "../../../services/commercial-entities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Props {
  entityId: string;
  data: EntityContact[];
  loading: boolean;
  onReload: () => void;
}

type ContactDraft = {
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  phone: string;
  whatsapp: string;
  isPrimary: boolean;
  receivesDocuments: boolean;
  receivesPaymentsOrCollections: boolean;
  notes: string;
};

const EMPTY_DRAFT: ContactDraft = {
  firstName: "",
  lastName: "",
  position: "",
  email: "",
  phone: "",
  whatsapp: "",
  isPrimary: false,
  receivesDocuments: false,
  receivesPaymentsOrCollections: false,
  notes: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TabContacts({ entityId, data, loading, onReload }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingContact, setEditingContact] = useState<EntityContact | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [busySave, setBusySave] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityContact | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const [busyPrimary, setBusyPrimary] = useState<string | null>(null);

  function set<K extends keyof ContactDraft>(key: K, val: ContactDraft[K]) {
    setDraft((p) => ({ ...p, [key]: val }));
  }

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
    setSubmitted(false);
    setModalMode("create");
    setEditingContact(null);
    setModalOpen(true);
  }

  function openEdit(c: EntityContact) {
    setDraft({
      firstName: c.firstName,
      lastName: c.lastName,
      position: c.position,
      email: c.email,
      phone: c.phone,
      whatsapp: c.whatsapp,
      isPrimary: c.isPrimary,
      receivesDocuments: c.receivesDocuments,
      receivesPaymentsOrCollections: c.receivesPaymentsOrCollections,
      notes: c.notes,
    });
    setSubmitted(false);
    setModalMode("edit");
    setEditingContact(c);
    setModalOpen(true);
  }

  async function handleSave() {
    setSubmitted(true);
    if (!draft.firstName.trim() && !draft.lastName.trim()) return;

    const payload: EntityContactPayload = { ...draft };
    setBusySave(true);
    try {
      if (modalMode === "create") {
        await commercialEntitiesApi.contacts.create(entityId, payload);
        toast.success("Contacto agregado.");
      } else {
        await commercialEntitiesApi.contacts.update(entityId, editingContact!.id, payload);
        toast.success("Contacto actualizado.");
      }
      setModalOpen(false);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  async function handleSetPrimary(c: EntityContact) {
    setBusyPrimary(c.id);
    try {
      await commercialEntitiesApi.contacts.setPrimary(entityId, c.id);
      toast.success("Contacto principal actualizado.");
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar.");
    } finally {
      setBusyPrimary(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyDelete(true);
    try {
      await commercialEntitiesApi.contacts.remove(entityId, deleteTarget.id);
      toast.success("Contacto eliminado.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

  const isCurrentlyPrimary = modalMode === "edit" && editingContact?.isPrimary;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return <div className="py-12 text-center text-sm text-muted">Cargando contactos…</div>;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{data.length} {data.length === 1 ? "contacto" : "contactos"}</span>
        <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={15} />} className="h-8">
          Agregar contacto
        </TPButton>
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="py-12 text-center text-sm text-muted">
          No hay contactos registrados.
        </div>
      )}

      {/* List */}
      {data.map((c) => (
        <TPCard key={c.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Name + primary badge */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-medium text-text">
                  {[c.lastName, c.firstName].filter(Boolean).join(", ") || "Sin nombre"}
                </span>
                {c.isPrimary && (
                  <TPBadge tone="primary">
                    <Star size={10} className="fill-primary mr-0.5" />
                    Principal
                  </TPBadge>
                )}
                {c.position && (
                  <span className="text-xs text-muted">{c.position}</span>
                )}
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {c.email && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Mail size={11} /> {c.email}
                  </span>
                )}
                {c.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Phone size={11} /> {c.phone}
                  </span>
                )}
                {c.whatsapp && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <MessageCircle size={11} /> {c.whatsapp}
                  </span>
                )}
              </div>

              {/* Flags */}
              {(c.receivesDocuments || c.receivesPaymentsOrCollections) && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {c.receivesDocuments && (
                    <TPBadge tone="neutral" size="sm">Recibe documentos</TPBadge>
                  )}
                  {c.receivesPaymentsOrCollections && (
                    <TPBadge tone="neutral" size="sm">Recibe pagos/cobros</TPBadge>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {!c.isPrimary && (
                <TPIconButton
                  title="Marcar como principal"
                  disabled={busyPrimary === c.id}
                  onClick={() => handleSetPrimary(c)}
                >
                  <Star size={14} />
                </TPIconButton>
              )}
              <TPIconButton title="Editar" onClick={() => openEdit(c)}>
                <Pencil size={14} />
              </TPIconButton>
              <TPIconButton
                title="Eliminar"
                onClick={() => { setDeleteTarget(c); setDeleteOpen(true); }}
              >
                <Trash2 size={14} />
              </TPIconButton>
            </div>
          </div>
        </TPCard>
      ))}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => !busySave && setModalOpen(false)}
        title={modalMode === "create" ? "Agregar contacto" : "Editar contacto"}
        maxWidth="lg"
      >
        <div className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TPField
              label="Apellido"
              error={submitted && !draft.firstName.trim() && !draft.lastName.trim() ? "Requerido." : null}
            >
              <TPInput value={draft.lastName} onChange={(v) => set("lastName", v)} disabled={busySave} placeholder="García" />
            </TPField>
            <TPField label="Nombre">
              <TPInput value={draft.firstName} onChange={(v) => set("firstName", v)} disabled={busySave} placeholder="Juan" />
            </TPField>
          </div>

          <TPField label="Cargo / Puesto">
            <TPInput value={draft.position} onChange={(v) => set("position", v)} disabled={busySave} placeholder="Gerente de compras" />
          </TPField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TPField label="Email">
              <TPInput type="email" value={draft.email} onChange={(v) => set("email", v)} disabled={busySave} placeholder="contacto@empresa.com" />
            </TPField>
            <TPField label="Teléfono">
              <TPInput value={draft.phone} onChange={(v) => set("phone", v)} disabled={busySave} placeholder="+54 11 1234 5678" />
            </TPField>
          </div>

          <TPField label="WhatsApp">
            <TPInput value={draft.whatsapp} onChange={(v) => set("whatsapp", v)} disabled={busySave} placeholder="+54 9 11 1234 5678" />
          </TPField>

          <div className="space-y-2">
            <TPCheckbox
              checked={draft.isPrimary}
              onChange={(v) => set("isPrimary", v)}
              disabled={busySave || isCurrentlyPrimary}
              label={
                <span className="text-sm">
                  Contacto principal
                  {isCurrentlyPrimary && (
                    <span className="text-xs text-muted ml-1">(para quitar, marcá otro como principal)</span>
                  )}
                </span>
              }
            />
            <TPCheckbox
              checked={draft.receivesDocuments}
              onChange={(v) => set("receivesDocuments", v)}
              disabled={busySave}
              label={<span className="text-sm">Recibe documentos</span>}
            />
            <TPCheckbox
              checked={draft.receivesPaymentsOrCollections}
              onChange={(v) => set("receivesPaymentsOrCollections", v)}
              disabled={busySave}
              label={<span className="text-sm">Recibe pagos / cobros</span>}
            />
          </div>

          <TPField label="Notas">
            <TPTextarea
              value={draft.notes}
              onChange={(v) => set("notes", v)}
              disabled={busySave}
              minH={64}
              placeholder="Información adicional sobre este contacto…"
            />
          </TPField>

          <div className="flex justify-end gap-2 pt-2">
            <TPButton variant="secondary" onClick={() => setModalOpen(false)} disabled={busySave}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={handleSave} disabled={busySave}>
              {busySave ? "Guardando…" : modalMode === "create" ? "Agregar" : "Guardar"}
            </TPButton>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Eliminar contacto"
        description="¿Estás seguro? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        busy={busyDelete}
        onClose={() => { if (!busyDelete) { setDeleteOpen(false); setDeleteTarget(null); } }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
