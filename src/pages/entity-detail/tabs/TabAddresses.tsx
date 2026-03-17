import React, { useState } from "react";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { TPButton } from "../../../components/ui/TPButton";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPSelect from "../../../components/ui/TPSelect";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import { TPBadge } from "../../../components/ui/TPBadges";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import { Modal } from "../../../components/ui/Modal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  ADDRESS_TYPE_LABELS,
  type EntityAddress,
  type EntityAddressPayload,
  type AddressType,
} from "../../../services/commercial-entities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Props {
  entityId: string;
  data: EntityAddress[];
  loading: boolean;
  onReload: () => void;
}

type AddressDraft = {
  type: AddressType;
  label: string;
  street: string;
  streetNumber: string;
  floor: string;
  apartment: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
};

const EMPTY_DRAFT: AddressDraft = {
  type: "BILLING",
  label: "",
  street: "",
  streetNumber: "",
  floor: "",
  apartment: "",
  city: "",
  province: "",
  country: "Argentina",
  postalCode: "",
  isDefault: false,
};

const ADDRESS_TYPE_OPTIONS = (Object.keys(ADDRESS_TYPE_LABELS) as AddressType[]).map((k) => ({
  value: k,
  label: ADDRESS_TYPE_LABELS[k],
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TabAddresses({ entityId, data, loading, onReload }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingAddr, setEditingAddr] = useState<EntityAddress | null>(null);
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);
  const [busySave, setBusySave] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityAddress | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const [busyDefault, setBusyDefault] = useState<string | null>(null);

  function set<K extends keyof AddressDraft>(key: K, val: AddressDraft[K]) {
    setDraft((p) => ({ ...p, [key]: val }));
  }

  function isFirstOfType(type: AddressType) {
    const existing = data.filter((a) => a.type === type);
    if (modalMode === "create") return existing.length === 0;
    return existing.length === 1 && existing[0].id === editingAddr?.id;
  }

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
    setModalMode("create");
    setEditingAddr(null);
    setModalOpen(true);
  }

  function openEdit(addr: EntityAddress) {
    setDraft({
      type: addr.type,
      label: addr.label,
      street: addr.street,
      streetNumber: addr.streetNumber,
      floor: addr.floor,
      apartment: addr.apartment,
      city: addr.city,
      province: addr.province,
      country: addr.country,
      postalCode: addr.postalCode,
      isDefault: addr.isDefault,
    });
    setModalMode("edit");
    setEditingAddr(addr);
    setModalOpen(true);
  }

  async function handleSave() {
    const forceDefault = isFirstOfType(draft.type);
    const payload: EntityAddressPayload = {
      ...draft,
      isDefault: forceDefault || draft.isDefault,
    };
    setBusySave(true);
    try {
      if (modalMode === "create") {
        await commercialEntitiesApi.addresses.create(entityId, payload);
        toast.success("Dirección agregada.");
      } else {
        await commercialEntitiesApi.addresses.update(entityId, editingAddr!.id, payload);
        toast.success("Dirección actualizada.");
      }
      setModalOpen(false);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  async function handleSetDefault(addr: EntityAddress) {
    setBusyDefault(addr.id);
    try {
      await commercialEntitiesApi.addresses.setDefault(entityId, addr.id);
      toast.success("Dirección predeterminada actualizada.");
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar.");
    } finally {
      setBusyDefault(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyDelete(true);
    try {
      await commercialEntitiesApi.addresses.remove(entityId, deleteTarget.id);
      toast.success("Dirección eliminada.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

  function handleTypeChange(type: AddressType) {
    const existing = data.filter((a) => a.type === type);
    const willBeFirst =
      modalMode === "create"
        ? existing.length === 0
        : existing.length === 1 && existing[0].id === editingAddr?.id;
    setDraft((p) => ({ ...p, type, isDefault: willBeFirst || p.isDefault }));
  }

  const forceDefaultOnDraft = isFirstOfType(draft.type);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return <div className="py-12 text-center text-sm text-muted">Cargando direcciones…</div>;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{data.length} {data.length === 1 ? "dirección" : "direcciones"}</span>
        <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={15} />} className="h-8">
          Agregar dirección
        </TPButton>
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="py-12 text-center text-sm text-muted">
          No hay direcciones registradas.
        </div>
      )}

      {/* List */}
      {data.map((addr) => (
        <TPCard key={addr.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <TPBadge tone="neutral">{ADDRESS_TYPE_LABELS[addr.type]}</TPBadge>
                {addr.isDefault && (
                  <TPBadge tone="primary">
                    <Star size={10} className="fill-primary mr-0.5" />
                    Predeterminada
                  </TPBadge>
                )}
                {addr.label && (
                  <span className="text-xs text-muted italic">{addr.label}</span>
                )}
              </div>
              <div className="text-sm text-text">
                {[addr.street, addr.streetNumber, addr.floor && `Piso ${addr.floor}`, addr.apartment && `Dto. ${addr.apartment}`]
                  .filter(Boolean).join(" ")}
              </div>
              {(addr.city || addr.province || addr.country) && (
                <div className="text-xs text-muted mt-0.5">
                  {[addr.city, addr.province, addr.country].filter(Boolean).join(", ")}
                  {addr.postalCode && ` (${addr.postalCode})`}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!addr.isDefault && (
                <TPIconButton
                  title="Marcar como predeterminada"
                  disabled={busyDefault === addr.id}
                  onClick={() => handleSetDefault(addr)}
                >
                  <Star size={14} />
                </TPIconButton>
              )}
              <TPIconButton title="Editar" onClick={() => openEdit(addr)}>
                <Pencil size={14} />
              </TPIconButton>
              <TPIconButton
                title="Eliminar"
                onClick={() => { setDeleteTarget(addr); setDeleteOpen(true); }}
              >
                <Trash2 size={14} />
              </TPIconButton>
            </div>
          </div>
        </TPCard>
      ))}

      {/* Modal create/edit */}
      <Modal
        open={modalOpen}
        onClose={() => !busySave && setModalOpen(false)}
        title={modalMode === "create" ? "Agregar dirección" : "Editar dirección"}
        maxWidth="lg"
      >
        <div className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TPField label="Tipo">
              <TPSelect
                value={draft.type}
                onChange={(v) => handleTypeChange(v as AddressType)}
                disabled={busySave}
                options={ADDRESS_TYPE_OPTIONS}
              />
            </TPField>
            <TPField label="Etiqueta" hint="Ej: Depósito central, Casa matriz">
              <TPInput value={draft.label} onChange={(v) => set("label", v)} disabled={busySave} placeholder="Opcional" />
            </TPField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <TPField label="Calle">
                <TPInput value={draft.street} onChange={(v) => set("street", v)} disabled={busySave} placeholder="Av. San Martín" />
              </TPField>
            </div>
            <TPField label="Número">
              <TPInput value={draft.streetNumber} onChange={(v) => set("streetNumber", v)} disabled={busySave} placeholder="1234" />
            </TPField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TPField label="Piso">
              <TPInput value={draft.floor} onChange={(v) => set("floor", v)} disabled={busySave} placeholder="2" />
            </TPField>
            <TPField label="Departamento">
              <TPInput value={draft.apartment} onChange={(v) => set("apartment", v)} disabled={busySave} placeholder="B" />
            </TPField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TPField label="Ciudad">
              <TPInput value={draft.city} onChange={(v) => set("city", v)} disabled={busySave} placeholder="Buenos Aires" />
            </TPField>
            <TPField label="Provincia / Estado">
              <TPInput value={draft.province} onChange={(v) => set("province", v)} disabled={busySave} placeholder="Buenos Aires" />
            </TPField>
            <TPField label="Código postal">
              <TPInput value={draft.postalCode} onChange={(v) => set("postalCode", v)} disabled={busySave} placeholder="C1416" />
            </TPField>
          </div>

          <TPField label="País">
            <TPInput value={draft.country} onChange={(v) => set("country", v)} disabled={busySave} placeholder="Argentina" />
          </TPField>

          <TPCheckbox
            checked={forceDefaultOnDraft || draft.isDefault}
            onChange={(v) => !forceDefaultOnDraft && set("isDefault", v)}
            disabled={busySave || forceDefaultOnDraft}
            label={
              <span className="text-sm">
                Predeterminada para este tipo
                {forceDefaultOnDraft && (
                  <span className="text-xs text-muted ml-1">(única de este tipo, siempre predeterminada)</span>
                )}
              </span>
            }
          />

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
        title="Eliminar dirección"
        description="¿Estás seguro? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        busy={busyDelete}
        onClose={() => { if (!busyDelete) { setDeleteOpen(false); setDeleteTarget(null); } }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
