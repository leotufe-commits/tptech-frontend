// src/pages/InventarioAlmacenes/WarehouseEditModal.tsx
import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";

import Modal from "../../components/ui/Modal";
import { TPCard } from "../../components/ui/TPCard";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import TPTextarea from "../../components/ui/TPTextarea";
import TPCheckbox from "../../components/ui/TPCheckbox";
import TPAlert from "../../components/ui/TPAlert";

import TPComboCreatable from "../../components/ui/TPComboCreatable";
import { useCatalog } from "../../hooks/useCatalog";
import type { CatalogType } from "../../services/catalogs";

import type { WarehouseDraft } from "./types";

function asCatalogType(t: CatalogType): CatalogType {
  return t;
}

export default function WarehouseEditModal({
  open,
  onClose,
  draft,
  setDraft,
  busySave,
  onSave,
  editKey,
  onFormKeyDown,
}: {
  open: boolean;
  onClose: () => void;

  draft: WarehouseDraft;
  setDraft: React.Dispatch<React.SetStateAction<WarehouseDraft>>;

  busySave: boolean;
  onSave: () => void | Promise<void>;

  editKey: string;
  onFormKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const isCreate = !String((draft as any)?.id || "").trim();

  const prefixCat = useCatalog(asCatalogType("PHONE_PREFIX"));
  const cityCat = useCatalog(asCatalogType("CITY"));
  const provCat = useCatalog(asCatalogType("PROVINCE"));
  const countryCat = useCatalog(asCatalogType("COUNTRY"));

  useEffect(() => {
    if (!open) return;
    if (!isCreate) return;
    if ((draft as any).isActive) return;
    setDraft((d) => ({ ...(d as any), isActive: true }));
  }, [open, isCreate, (draft as any).isActive, setDraft]);

  return (
    <Modal
      open={open}
      onClose={() => (busySave ? null : onClose())}
      title={(draft as any).id ? "Editar almacén" : "Nuevo almacén"}
      subtitle="Configurá datos generales, dirección y notas. El estado define si puede usarse en movimientos."
      busy={busySave}
      maxWidth="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="text-xs text-muted">
            {(draft as any).id ? "Editando almacén existente" : "Creando nuevo almacén"}
          </div>

          <div className="flex items-center gap-2">
            <TPButton variant="ghost" onClick={onClose} disabled={busySave}>
              Cancelar
            </TPButton>

            <TPButton
              onClick={onSave}
              disabled={busySave}
              iconLeft={busySave ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            >
              Guardar
            </TPButton>
          </div>
        </div>
      }
    >
      <form
        key={editKey}
        onSubmit={(e) => (e.preventDefault(), void onSave())}
        onKeyDown={onFormKeyDown}
        className="space-y-3"
      >
        <TPCard className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TPInput
              label="Nombre"
              value={(draft as any).name}
              onChange={(v) => setDraft((d) => ({ ...(d as any), name: v }))}
              placeholder="Ej: Depósito Central"
              autoFocus
              disabled={busySave}
            />

            <TPInput
              label="Código"
              value={(draft as any).code}
              onChange={(v) => setDraft((d) => ({ ...(d as any), code: v }))}
              placeholder="Ej: DEP-CEN"
              disabled={busySave}
            />
          </div>

          <div className="mt-3">
            <TPInput
              label="A la Atención de"
              value={(draft as any).attn}
              onChange={(v) => setDraft((d) => ({ ...(d as any), attn: v }))}
              placeholder="Ej: Juan Pérez"
              disabled={busySave}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <TPComboCreatable
                label="Tel. país"
                mode={isCreate ? "create" : "edit"}
                type="PHONE_PREFIX"
                items={prefixCat.items}
                loading={prefixCat.loading}
                value={(draft as any).phoneCountry ?? ""}
                onChange={(v) => setDraft((d) => ({ ...(d as any), phoneCountry: v }))}
                placeholder="+54"
                disabled={busySave}
                allowCreate
                onRefresh={() => void prefixCat.refresh()}
                onCreate={async (label) => {
                  await prefixCat.createItem(label);
                  setDraft((d) => ({ ...(d as any), phoneCountry: label }));
                }}
              />
            </div>

            <div className="md:col-span-8">
              <TPInput
                label="Teléfono"
                value={(draft as any).phoneNumber ?? ""}
                onChange={(v) => setDraft((d) => ({ ...(d as any), phoneNumber: v }))}
                placeholder="11 1234 5678"
                disabled={busySave}
              />
            </div>
          </div>

          <div className="mt-3">
            <TPInput
              label="Ubicación (etiqueta)"
              value={(draft as any).location}
              onChange={(v) => setDraft((d) => ({ ...(d as any), location: v }))}
              placeholder="Ej: Casa Central / Local / Sucursal…"
              disabled={busySave}
            />
          </div>
        </TPCard>

        <TPCard className="p-4">
          <div className="text-sm font-semibold text-text">Dirección</div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <TPInput
              label="Calle"
              value={(draft as any).street}
              onChange={(v) => setDraft((d) => ({ ...(d as any), street: v }))}
              placeholder="Ej: Av. Corrientes"
              disabled={busySave}
            />

            <TPInput
              label="Número"
              value={(draft as any).number}
              onChange={(v) => setDraft((d) => ({ ...(d as any), number: v }))}
              placeholder="Ej: 1234"
              disabled={busySave}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <TPComboCreatable
              label="Ciudad"
              mode={isCreate ? "create" : "edit"}
              type="CITY"
              items={cityCat.items}
              loading={cityCat.loading}
              value={(draft as any).city}
              onChange={(v) => setDraft((d) => ({ ...(d as any), city: v }))}
              placeholder="Ciudad"
              disabled={busySave}
              allowCreate
              onRefresh={() => void cityCat.refresh()}
              onCreate={async (label) => {
                await cityCat.createItem(label);
                setDraft((d) => ({ ...(d as any), city: label }));
              }}
            />

            <TPComboCreatable
              label="Provincia"
              mode={isCreate ? "create" : "edit"}
              type="PROVINCE"
              items={provCat.items}
              loading={provCat.loading}
              value={(draft as any).province}
              onChange={(v) => setDraft((d) => ({ ...(d as any), province: v }))}
              placeholder="Provincia"
              disabled={busySave}
              allowCreate
              onRefresh={() => void provCat.refresh()}
              onCreate={async (label) => {
                await provCat.createItem(label);
                setDraft((d) => ({ ...(d as any), province: label }));
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <TPInput
              label="Código postal"
              value={(draft as any).postalCode}
              onChange={(v) => setDraft((d) => ({ ...(d as any), postalCode: v }))}
              disabled={busySave}
            />

            <TPComboCreatable
              label="País"
              mode={isCreate ? "create" : "edit"}
              type="COUNTRY"
              items={countryCat.items}
              loading={countryCat.loading}
              value={(draft as any).country}
              onChange={(v) => setDraft((d) => ({ ...(d as any), country: v }))}
              placeholder="País"
              disabled={busySave}
              allowCreate
              onRefresh={() => void countryCat.refresh()}
              onCreate={async (label) => {
                await countryCat.createItem(label);
                setDraft((d) => ({ ...(d as any), country: label }));
              }}
            />
          </div>
        </TPCard>

        <TPTextarea
          label="Notas"
          value={(draft as any).notes}
          onChange={(v) => setDraft((d) => ({ ...(d as any), notes: v }))}
          maxLen={500}
          disabled={busySave}
        />

        {!isCreate ? (
          <>
            <div className="pt-1">
              <TPCheckbox
                checked={!!(draft as any).isActive}
                onChange={(v) => setDraft((d) => ({ ...(d as any), isActive: !!v }))}
                label="Almacén activo"
                disabled={busySave}
              />
            </div>

            {!(draft as any).isActive ? (
              <TPAlert tone="warning" title="Almacén inactivo">
                No se podrá usar para movimientos hasta reactivarlo.
              </TPAlert>
            ) : null}
          </>
        ) : null}
      </form>
    </Modal>
  );
}