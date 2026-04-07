import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Star, MapPin, X, Check } from "lucide-react";
import { TPButton } from "../../../components/ui/TPButton";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPTextarea from "../../../components/ui/TPTextarea";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import TPComboCreatable from "../../../components/ui/TPComboCreatable";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import { TPBadge } from "../../../components/ui/TPBadges";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import { Modal } from "../../../components/ui/Modal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../../lib/toast";
import { useCatalog } from "../../../hooks/useCatalog";
import {
  commercialEntitiesApi,
  ADDRESS_TYPE_LABELS,
  type EntityAddress,
  type EntityAddressPayload,
  type EntityContact,
  type AddressType,
} from "../../../services/commercial-entities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Props {
  entityId?: string;
  data?: EntityAddress[];
  contacts?: EntityContact[];
  /** Nombre del cliente/proveedor para pre-cargar "A la atención de" */
  entityName?: string;
  loading?: boolean;
  onReload?: () => void;
  /** Modo offline (CREATE): ítems gestionados localmente sin llamadas a API */
  offlineItems?: EntityAddress[];
  onOfflineItemsChange?: (items: EntityAddress[]) => void;
  /** Incrementar para abrir el modal de agregar desde afuera */
  openAddTrigger?: number;
  /** Ocultar el label de conteo en el header cuando el padre ya lo muestra */
  hideCountLabel?: boolean;
  /** Ocultar el header completo (conteo + botón) cuando el padre provee su propio header */
  hideHeader?: boolean;
}

type AddressDraft = {
  type: AddressType;
  attn: string;
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
  attn: "",
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
export function TabAddresses({
  entityId,
  data = [],
  contacts = [],
  entityName = "",
  loading = false,
  onReload,
  offlineItems,
  onOfflineItemsChange,
  openAddTrigger,
  hideCountLabel = false,
  hideHeader = false,
}: Props) {
  const cityCat     = useCatalog("CITY");
  const provinceCat = useCatalog("PROVINCE");
  const countryCat  = useCatalog("COUNTRY");

  const isOffline = !!onOfflineItemsChange;
  const effectiveData = isOffline ? (offlineItems ?? []) : data;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingAddr, setEditingAddr] = useState<EntityAddress | null>(null);
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);
  const [busySave, setBusySave] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityAddress | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const [busyDefault, setBusyDefault] = useState<string | null>(null);

  useEffect(() => {
    if ((openAddTrigger ?? 0) > 0) openCreate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddTrigger]);

  function set<K extends keyof AddressDraft>(key: K, val: AddressDraft[K]) {
    setDraft((p) => ({ ...p, [key]: val }));
  }

  function isFirstOfType(type: AddressType) {
    const existing = effectiveData.filter((a) => a.type === type);
    if (modalMode === "create") return existing.length === 0;
    return existing.length === 1 && existing[0].id === editingAddr?.id;
  }

  function openCreate() {
    const primary = contacts.find((c) => c.isPrimary);
    const primaryName = primary
      ? [primary.firstName, primary.lastName].filter(Boolean).join(" ")
      : "";
    const defaultAttn = primaryName || entityName;
    setDraft({ ...EMPTY_DRAFT, attn: defaultAttn });
    setModalMode("create");
    setEditingAddr(null);
    setModalOpen(true);
  }

  function openEdit(addr: EntityAddress) {
    setDraft({
      type: addr.type,
      attn: addr.attn ?? "",
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

    // ── Offline mode ───────────────────────────────────────────────────────
    if (isOffline) {
      const newItem: EntityAddress = {
        id: modalMode === "edit" ? editingAddr!.id : `_draft_${Date.now()}`,
        type: payload.type!,
        attn: payload.attn ?? "",
        label: payload.label ?? "",
        street: payload.street ?? "",
        streetNumber: payload.streetNumber ?? "",
        floor: payload.floor ?? "",
        apartment: payload.apartment ?? "",
        city: payload.city ?? "",
        province: payload.province ?? "",
        country: payload.country ?? "",
        postalCode: payload.postalCode ?? "",
        isDefault: payload.isDefault ?? false,
        createdAt: modalMode === "edit" ? editingAddr!.createdAt : new Date().toISOString(),
      };

      const current = offlineItems ?? [];
      let updated: EntityAddress[];

      if (modalMode === "create") {
        // Si es default, quitar default a otros del mismo tipo
        const base = newItem.isDefault
          ? current.map((a) => a.type === newItem.type ? { ...a, isDefault: false } : a)
          : [...current];
        updated = [...base, newItem];
      } else {
        updated = current.map((a) => a.id === newItem.id ? newItem : a);
        if (newItem.isDefault) {
          updated = updated.map((a) =>
            a.id !== newItem.id && a.type === newItem.type ? { ...a, isDefault: false } : a
          );
        }
      }

      onOfflineItemsChange!(updated);
      setModalOpen(false);
      return;
    }

    // ── Live mode ──────────────────────────────────────────────────────────
    setBusySave(true);
    try {
      if (modalMode === "create") {
        await commercialEntitiesApi.addresses.create(entityId!, payload);
        toast.success("Dirección agregada.");
      } else {
        await commercialEntitiesApi.addresses.update(entityId!, editingAddr!.id, payload);
        toast.success("Dirección actualizada.");
      }
      setModalOpen(false);
      onReload?.();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  async function handleSetDefault(addr: EntityAddress) {
    // ── Offline mode ───────────────────────────────────────────────────────
    if (isOffline) {
      const updated = (offlineItems ?? []).map((a) =>
        a.type === addr.type ? { ...a, isDefault: a.id === addr.id } : a
      );
      onOfflineItemsChange!(updated);
      return;
    }

    // ── Live mode ──────────────────────────────────────────────────────────
    setBusyDefault(addr.id);
    try {
      await commercialEntitiesApi.addresses.setDefault(entityId!, addr.id);
      toast.success("Dirección predeterminada actualizada.");
      onReload?.();
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar.");
    } finally {
      setBusyDefault(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    // ── Offline mode ───────────────────────────────────────────────────────
    if (isOffline) {
      onOfflineItemsChange!((offlineItems ?? []).filter((a) => a.id !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      return;
    }

    // ── Live mode ──────────────────────────────────────────────────────────
    setBusyDelete(true);
    try {
      await commercialEntitiesApi.addresses.remove(entityId!, deleteTarget.id);
      toast.success("Dirección eliminada.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      onReload?.();
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

  function handleTypeChange(type: AddressType) {
    const existing = effectiveData.filter((a) => a.type === type);
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
      {!hideHeader && (
        <div className="flex items-center justify-between">
          {!hideCountLabel && (
            <span className="text-sm text-muted">{effectiveData.length} {effectiveData.length === 1 ? "dirección" : "direcciones"}</span>
          )}
          <div className={hideCountLabel ? "ml-auto" : ""}>
            <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={15} />} className="h-8">
              Agregar dirección
            </TPButton>
          </div>
        </div>
      )}

      {/* Empty state */}
      {effectiveData.length === 0 && (
        <div className="flex flex-col items-center gap-1.5 py-2 text-center">
          <MapPin size={18} className="text-border" />
          <span className="text-xs text-muted">No hay direcciones registradas.</span>
        </div>
      )}

      {/* List */}
      {effectiveData.map((addr) => (
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
              {addr.attn && (
                <div className="text-xs text-muted mb-0.5">A la atención de: {addr.attn}</div>
              )}
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
              <TPIconButton
                title={addr.isDefault ? "Dirección predeterminada" : "Marcar como predeterminada"}
                disabled={busyDefault === addr.id || addr.isDefault}
                onClick={() => !addr.isDefault && handleSetDefault(addr)}
              >
                <Star
                  size={14}
                  className={addr.isDefault ? "fill-yellow-400 text-yellow-400" : undefined}
                />
              </TPIconButton>
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
        maxWidth="3xl"
      >
        <div className="space-y-4 p-1">
          {/* A la atención de | Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TPField label="A la atención de">
              <TPInput
                value={draft.attn}
                onChange={(v) => set("attn", v)}
                disabled={busySave}
                placeholder="Nombre del destinatario"
                data-tp-autofocus="1"
              />
            </TPField>
            <TPField label="Tipo">
              <TPComboFixed
                value={draft.type}
                onChange={(v) => handleTypeChange(v as AddressType)}
                disabled={busySave}
                options={ADDRESS_TYPE_OPTIONS}
              />
            </TPField>
          </div>

          {/* Calle | Número | Piso | Departamento */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="col-span-2 md:col-span-3">
              <TPField label="Calle">
                <TPInput value={draft.street} onChange={(v) => set("street", v)} disabled={busySave} placeholder="Av. San Martín" />
              </TPField>
            </div>
            <div className="col-span-2 md:col-span-1">
              <TPField label="Número">
                <TPInput value={draft.streetNumber} onChange={(v) => set("streetNumber", v)} disabled={busySave} placeholder="1234" />
              </TPField>
            </div>
            <div className="md:col-span-1">
              <TPField label="Piso">
                <TPInput value={draft.floor} onChange={(v) => set("floor", v)} disabled={busySave} placeholder="2" />
              </TPField>
            </div>
            <div className="md:col-span-1">
              <TPField label="Dpto.">
                <TPInput value={draft.apartment} onChange={(v) => set("apartment", v)} disabled={busySave} placeholder="B" />
              </TPField>
            </div>
          </div>

          {/* Código postal | Ciudad | Provincia | País */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <TPField label="Código postal">
              <TPInput value={draft.postalCode} onChange={(v) => set("postalCode", v)} disabled={busySave} placeholder="C1416" />
            </TPField>
            <TPField label="Ciudad">
              <TPComboCreatable
                type="CITY"
                items={cityCat.items}
                loading={cityCat.loading}
                value={draft.city}
                onChange={(v) => set("city", v)}
                placeholder="Buenos Aires"
                disabled={busySave}
                allowCreate
                onRefresh={() => void cityCat.refresh()}
                onCreate={async (label) => { await cityCat.createItem(label); set("city", label); }}
                mode={modalMode}
              />
            </TPField>
            <TPField label="Provincia / Estado">
              <TPComboCreatable
                type="PROVINCE"
                items={provinceCat.items}
                loading={provinceCat.loading}
                value={draft.province}
                onChange={(v) => set("province", v)}
                placeholder="Buenos Aires"
                disabled={busySave}
                allowCreate
                onRefresh={() => void provinceCat.refresh()}
                onCreate={async (label) => { await provinceCat.createItem(label); set("province", label); }}
                mode={modalMode}
              />
            </TPField>
            <TPField label="País">
              <TPComboCreatable
                type="COUNTRY"
                items={countryCat.items}
                loading={countryCat.loading}
                value={draft.country}
                onChange={(v) => set("country", v)}
                placeholder="Argentina"
                disabled={busySave}
                allowCreate
                onRefresh={() => void countryCat.refresh()}
                onCreate={async (label) => { await countryCat.createItem(label); set("country", label); }}
                mode={modalMode}
              />
            </TPField>
          </div>

          <TPField label="Notas">
            <TPTextarea
              value={draft.label}
              onChange={(v) => set("label", v)}
              disabled={busySave}
              placeholder="Observaciones sobre esta dirección…"
              minH={64}
            />
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
            <TPButton variant="secondary" onClick={() => setModalOpen(false)} disabled={busySave} iconLeft={<X size={14} />}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={handleSave} disabled={busySave} loading={busySave} iconLeft={busySave ? undefined : modalMode === "create" ? <Plus size={14} /> : <Check size={14} />}>
              {modalMode === "create" ? "Agregar" : "Guardar"}
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
