import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Star, Mail, Phone, Users, X, Save } from "lucide-react";
import { TPButton } from "../../../components/ui/TPButton";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPTextarea from "../../../components/ui/TPTextarea";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import { TPBadge } from "../../../components/ui/TPBadges";
import TPComboCreatable from "../../../components/ui/TPComboCreatable";
import { Modal } from "../../../components/ui/Modal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../../lib/toast";
import { useCatalog } from "../../../hooks/useCatalog";
import {
  commercialEntitiesApi,
  type EntityContact,
  type EntityContactPayload,
} from "../../../services/commercial-entities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Props {
  entityId?: string;
  data?: EntityContact[];
  loading?: boolean;
  onReload?: () => void;
  /** Modo offline (CREATE): ítems gestionados localmente sin llamadas a API */
  offlineItems?: EntityContact[];
  onOfflineItemsChange?: (items: EntityContact[]) => void;
  /** Incrementar para abrir el modal de agregar desde afuera */
  openAddTrigger?: number;
  /** Ocultar el label de conteo cuando el padre ya lo muestra */
  hideCountLabel?: boolean;
  /** Ocultar el header completo (conteo + botón) cuando el padre provee su propio header */
  hideHeader?: boolean;
}

type ContactDraft = {
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  phonePrefix: string;
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
  phonePrefix: "",
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
export function TabContacts({
  entityId,
  data = [],
  loading = false,
  onReload,
  offlineItems,
  onOfflineItemsChange,
  openAddTrigger,
  hideCountLabel = false,
  hideHeader = false,
}: Props) {
  const prefixCat = useCatalog("PHONE_PREFIX");

  const isOffline = !!onOfflineItemsChange;
  const effectiveData = isOffline ? (offlineItems ?? []) : data;

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

  useEffect(() => {
    if ((openAddTrigger ?? 0) > 0) openCreate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddTrigger]);

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
      phonePrefix: c.phonePrefix ?? "",
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

    // ── Offline mode ───────────────────────────────────────────────────────
    if (isOffline) {
      const newItem: EntityContact = {
        id: modalMode === "edit" ? editingContact!.id : `_draft_${Date.now()}`,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        position: draft.position.trim(),
        email: draft.email.trim(),
        phonePrefix: draft.phonePrefix,
        phone: draft.phone.trim(),
        whatsapp: draft.whatsapp.trim(),
        isPrimary: draft.isPrimary,
        receivesDocuments: draft.receivesDocuments,
        receivesPaymentsOrCollections: draft.receivesPaymentsOrCollections,
        portalAccess: false,
        notes: draft.notes.trim(),
        createdAt: modalMode === "edit" ? editingContact!.createdAt : new Date().toISOString(),
      };

      const current = offlineItems ?? [];
      let updated: EntityContact[];

      if (modalMode === "create") {
        // Si el nuevo es primary, quitar primary de los demás
        const base = newItem.isPrimary
          ? current.map((c) => ({ ...c, isPrimary: false }))
          : [...current];
        updated = [...base, newItem];
      } else {
        updated = current.map((c) => c.id === newItem.id ? newItem : c);
        if (newItem.isPrimary) {
          updated = updated.map((c) => c.id !== newItem.id ? { ...c, isPrimary: false } : c);
        }
      }

      onOfflineItemsChange!(updated);
      setModalOpen(false);
      return;
    }

    // ── Live mode ──────────────────────────────────────────────────────────
    const payload: EntityContactPayload = { ...draft };
    setBusySave(true);
    try {
      if (modalMode === "create") {
        await commercialEntitiesApi.contacts.create(entityId!, payload);
        toast.success("Contacto agregado.");
      } else {
        await commercialEntitiesApi.contacts.update(entityId!, editingContact!.id, payload);
        toast.success("Contacto actualizado.");
      }
      setModalOpen(false);
      onReload?.();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  async function handleSetPrimary(c: EntityContact) {
    // ── Offline mode ───────────────────────────────────────────────────────
    if (isOffline) {
      onOfflineItemsChange!(
        (offlineItems ?? []).map((item) => ({ ...item, isPrimary: item.id === c.id }))
      );
      return;
    }

    // ── Live mode ──────────────────────────────────────────────────────────
    setBusyPrimary(c.id);
    try {
      await commercialEntitiesApi.contacts.setPrimary(entityId!, c.id);
      toast.success("Contacto principal actualizado.");
      onReload?.();
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar.");
    } finally {
      setBusyPrimary(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    // ── Offline mode ───────────────────────────────────────────────────────
    if (isOffline) {
      onOfflineItemsChange!((offlineItems ?? []).filter((c) => c.id !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      return;
    }

    // ── Live mode ──────────────────────────────────────────────────────────
    setBusyDelete(true);
    try {
      await commercialEntitiesApi.contacts.remove(entityId!, deleteTarget.id);
      toast.success("Contacto eliminado.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      onReload?.();
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
    return <div className="py-12 text-center text-sm text-muted">Cargando contactos…</div>;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          {!hideCountLabel && (
            <span className="text-sm text-muted">{effectiveData.length} {effectiveData.length === 1 ? "contacto" : "contactos"}</span>
          )}
          <div className={hideCountLabel ? "ml-auto" : ""}>
            <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={15} />} className="h-8">
              Agregar contacto
            </TPButton>
          </div>
        </div>
      )}

      {/* Empty state */}
      {effectiveData.length === 0 && (
        <div className="flex flex-col items-center gap-1.5 py-5 text-center">
          <Users size={18} className="text-border" />
          <span className="text-xs text-muted">No hay contactos registrados.</span>
        </div>
      )}

      {/* List */}
      {effectiveData.map((c) => (
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
                    <Phone size={11} /> {[c.phonePrefix, c.phone].filter(Boolean).join(" ")}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <TPIconButton
                title={c.isPrimary ? "Contacto principal" : "Marcar como principal"}
                disabled={busyPrimary === c.id || c.isPrimary}
                onClick={() => !c.isPrimary && handleSetPrimary(c)}
              >
                <Star
                  size={14}
                  className={c.isPrimary ? "fill-yellow-400 text-yellow-400" : undefined}
                />
              </TPIconButton>
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
        maxWidth="xl"
      >
        <div className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TPField label="Nombre">
              <TPInput value={draft.firstName} onChange={(v) => set("firstName", v)} disabled={busySave} placeholder="Juan" />
            </TPField>
            <TPField
              label="Apellido"
              error={submitted && !draft.firstName.trim() && !draft.lastName.trim() ? "Requerido." : null}
            >
              <TPInput value={draft.lastName} onChange={(v) => set("lastName", v)} disabled={busySave} placeholder="García" />
            </TPField>
            <TPField label="Cargo / Puesto">
              <TPInput value={draft.position} onChange={(v) => set("position", v)} disabled={busySave} placeholder="Gerente de compras" />
            </TPField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TPField label="Email">
              <TPInput type="email" value={draft.email} onChange={(v) => set("email", v)} disabled={busySave} placeholder="contacto@empresa.com" />
            </TPField>
            <TPField label="Teléfono">
              <div className="flex gap-2">
                <div className="w-28 shrink-0">
                  <TPComboCreatable
                    type="PHONE_PREFIX"
                    items={prefixCat.items}
                    loading={prefixCat.loading}
                    value={draft.phonePrefix}
                    onChange={(v) => set("phonePrefix", v)}
                    placeholder="+54"
                    disabled={busySave}
                    allowCreate
                    onRefresh={() => void prefixCat.refresh()}
                    onCreate={async (label) => { await prefixCat.createItem(label); set("phonePrefix", label); }}
                    mode="edit"
                  />
                </div>
                <div className="flex-1">
                  <TPInput value={draft.phone} onChange={(v) => set("phone", v)} disabled={busySave} placeholder="11 1234 5678" />
                </div>
              </div>
            </TPField>
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
            <TPButton variant="secondary" onClick={() => setModalOpen(false)} disabled={busySave} iconLeft={<X size={14} />}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={handleSave} disabled={busySave} iconLeft={busySave ? undefined : <Save size={14} />} loading={busySave}>
              {modalMode === "create" ? "Agregar" : "Guardar"}
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
