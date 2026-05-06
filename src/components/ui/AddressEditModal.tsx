// src/components/ui/AddressEditModal.tsx
// ============================================================================
// AddressEditModal — alta / edición de una dirección de un CommercialEntity
// como modal flotante. Pensado para abrirse desde flujos donde el usuario
// quiere agregar una dirección al cliente sin salir del documento que está
// armando (ej. Facturas de Venta).
//
// · Llama directo a `commercialEntitiesApi.addresses.create` / `update`.
// · Tracking de dirty state + confirm "tenés cambios sin guardar".
// · Catálogos CITY / PROVINCE / COUNTRY (combo creatable).
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Check, X, AlertTriangle } from "lucide-react";

import { Modal } from "./Modal";
import { TPButton } from "./TPButton";
import { TPField } from "./TPField";
import TPInput from "./TPInput";
import TPTextarea from "./TPTextarea";
import { TPCheckbox } from "./TPCheckbox";
import TPComboCreatable from "./TPComboCreatable";
import TPComboFixed from "./TPComboFixed";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

import { useCatalog } from "../../hooks/useCatalog";
import { toast } from "../../lib/toast";
import {
  commercialEntitiesApi,
  ADDRESS_TYPE_LABELS,
  type AddressType,
  type EntityAddress,
  type EntityAddressPayload,
} from "../../services/commercial-entities";

const ADDRESS_TYPE_OPTIONS = (Object.keys(ADDRESS_TYPE_LABELS) as AddressType[]).map((k) => ({
  value: k,
  label: ADDRESS_TYPE_LABELS[k],
}));

type Draft = {
  type:         AddressType;
  label:        string;
  attn:         string;
  street:       string;
  streetNumber: string;
  floor:        string;
  apartment:    string;
  city:         string;
  province:     string;
  country:      string;
  postalCode:   string;
  isDefault:    boolean;
};

function emptyDraft(prefilledAttn?: string): Draft {
  return {
    type:         "BILLING",
    label:        "",
    attn:         prefilledAttn ?? "",
    street:       "",
    streetNumber: "",
    floor:        "",
    apartment:    "",
    city:         "",
    province:     "",
    country:      "Argentina",
    postalCode:   "",
    isDefault:    false,
  };
}

function fromExisting(addr: EntityAddress): Draft {
  return {
    type:         addr.type,
    label:        addr.label || "",
    attn:         addr.attn || "",
    street:       addr.street || "",
    streetNumber: addr.streetNumber || "",
    floor:        addr.floor || "",
    apartment:    addr.apartment || "",
    city:         addr.city || "",
    province:     addr.province || "",
    country:      addr.country || "",
    postalCode:   addr.postalCode || "",
    isDefault:    !!addr.isDefault,
  };
}

export type AddressEditModalProps = {
  open: boolean;
  /** Modo: crear nueva dirección o editar existente. */
  mode: "create" | "edit";
  /** Id del CommercialEntity dueño de la dirección. */
  entityId: string;
  /** Si existe, prellena el campo "A la atención de" (display name). */
  entityName?: string;
  /** En modo edit, dirección a editar. */
  address?: EntityAddress;
  onClose: () => void;
  /** Callback cuando se guarda exitosamente. Devuelve la dirección persistida. */
  onSaved: (address: EntityAddress) => void;
};

export default function AddressEditModal({
  open,
  mode,
  entityId,
  entityName,
  address,
  onClose,
  onSaved,
}: AddressEditModalProps) {
  const [draft, setDraft]   = useState<Draft>(() =>
    mode === "edit" && address ? fromExisting(address) : emptyDraft(entityName),
  );
  const [busy, setBusy]     = useState(false);
  const [dirty, setDirty]   = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);

  const cityCat     = useCatalog("CITY");
  const provinceCat = useCatalog("PROVINCE");
  const countryCat  = useCatalog("COUNTRY");

  // Reset cuando se abre o cambia el address.
  useEffect(() => {
    if (!open) return;
    setDraft(mode === "edit" && address ? fromExisting(address) : emptyDraft(entityName));
    setDirty(false);
    setShowUnsaved(false);
    setBusy(false);
  }, [open, mode, address, entityName]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleClose() {
    if (busy) return;
    if (dirty) { setShowUnsaved(true); return; }
    onClose();
  }

  async function handleSave() {
    if (busy) return;
    if (!draft.street.trim() && !draft.city.trim()) {
      toast.error("Cargá al menos calle o ciudad.");
      return;
    }
    setBusy(true);
    try {
      const payload: EntityAddressPayload = {
        type:         draft.type,
        label:        draft.label || undefined,
        attn:         draft.attn || undefined,
        street:       draft.street || undefined,
        streetNumber: draft.streetNumber || undefined,
        floor:        draft.floor || undefined,
        apartment:    draft.apartment || undefined,
        city:         draft.city || undefined,
        province:     draft.province || undefined,
        country:      draft.country || undefined,
        postalCode:   draft.postalCode || undefined,
        isDefault:    draft.isDefault,
      };
      const saved = mode === "edit" && address
        ? await commercialEntitiesApi.addresses.update(entityId, address.id, payload)
        : await commercialEntitiesApi.addresses.create(entityId, payload);
      toast.success(mode === "edit" ? "Dirección actualizada." : "Dirección agregada.");
      setDirty(false);
      onSaved(saved);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar la dirección.");
    } finally {
      setBusy(false);
    }
  }

  const titleText = useMemo(
    () => (mode === "edit" ? "Editar dirección" : "Agregar dirección"),
    [mode],
  );

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={titleText}
        subtitle={entityName || undefined}
        maxWidth="3xl"
        onEnter={handleSave}
        footer={
          <div className="flex items-center justify-end gap-2">
            <TPButton variant="secondary" onClick={handleClose} disabled={busy} iconLeft={<X size={14} />}>
              Cancelar
            </TPButton>
            <TPButton
              variant="primary"
              onClick={handleSave}
              disabled={busy}
              loading={busy}
              iconLeft={busy ? undefined : (mode === "edit" ? <Check size={14} /> : <Plus size={14} />)}
            >
              {mode === "edit" ? "Guardar" : "Agregar"}
            </TPButton>
          </div>
        }
      >
        <div className="space-y-4 p-1">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TPField label="A la atención de">
              <TPInput
                value={draft.attn}
                onChange={(v: string) => set("attn", v)}
                disabled={busy}
                placeholder="Nombre del destinatario"
              />
            </TPField>
            <TPField label="Tipo">
              <TPComboFixed
                value={draft.type}
                onChange={(v) => set("type", v as AddressType)}
                disabled={busy}
                options={ADDRESS_TYPE_OPTIONS}
              />
            </TPField>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="col-span-2 md:col-span-3">
              <TPField label="Calle">
                <TPInput value={draft.street} onChange={(v: string) => set("street", v)} disabled={busy} placeholder="Av. San Martín" />
              </TPField>
            </div>
            <div className="col-span-2 md:col-span-1">
              <TPField label="Número">
                <TPInput value={draft.streetNumber} onChange={(v: string) => set("streetNumber", v)} disabled={busy} placeholder="1234" />
              </TPField>
            </div>
            <div className="md:col-span-1">
              <TPField label="Piso">
                <TPInput value={draft.floor} onChange={(v: string) => set("floor", v)} disabled={busy} placeholder="2" />
              </TPField>
            </div>
            <div className="md:col-span-1">
              <TPField label="Dpto.">
                <TPInput value={draft.apartment} onChange={(v: string) => set("apartment", v)} disabled={busy} placeholder="B" />
              </TPField>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <TPField label="Código postal">
              <TPInput value={draft.postalCode} onChange={(v: string) => set("postalCode", v)} disabled={busy} placeholder="C1416" />
            </TPField>
            <TPField label="Ciudad">
              <TPComboCreatable
                type="CITY"
                items={cityCat.items}
                loading={cityCat.loading}
                value={draft.city}
                onChange={(v) => set("city", v)}
                placeholder="Buenos Aires"
                disabled={busy}
                allowCreate
                onRefresh={() => void cityCat.refresh()}
                onCreate={async (label) => { await cityCat.createItem(label); set("city", label); }}
                mode={mode}
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
                disabled={busy}
                allowCreate
                onRefresh={() => void provinceCat.refresh()}
                onCreate={async (label) => { await provinceCat.createItem(label); set("province", label); }}
                mode={mode}
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
                disabled={busy}
                allowCreate
                onRefresh={() => void countryCat.refresh()}
                onCreate={async (label) => { await countryCat.createItem(label); set("country", label); }}
                mode={mode}
              />
            </TPField>
          </div>

          <TPField label="Notas">
            <TPTextarea
              value={draft.label}
              onChange={(v: string) => set("label", v)}
              disabled={busy}
              placeholder="Observaciones sobre esta dirección…"
              minH={64}
            />
          </TPField>

          <TPCheckbox
            checked={draft.isDefault}
            onChange={(v) => set("isDefault", v)}
            disabled={busy}
            label={<span className="text-sm">Predeterminada para este tipo</span>}
          />
        </div>
      </Modal>

      <ConfirmDeleteDialog
        open={showUnsaved}
        title="Cambios sin guardar"
        description="Tenés cambios sin guardar. ¿Querés salir igualmente?"
        confirmText="Salir sin guardar"
        cancelText="Cancelar"
        icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        onClose={() => setShowUnsaved(false)}
        onConfirm={() => { setShowUnsaved(false); onClose(); }}
      />
    </>
  );
}
